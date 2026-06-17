#!/usr/bin/env bash
# =========================================================================
# Bookly Unified GCP/Cloud Run Deployment Automator
# =========================================================================
set -eo pipefail

# Style definitions for beautiful, premium command-line feedback
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Cleanup temporary files on exit
cleanup() {
  if [ -f "cloudrun-env.yaml" ]; then
    log_info "Cleaning up temporary environment files..."
    rm -f cloudrun-env.yaml
  fi
  if [ -f "parse-secrets.py" ]; then
    rm -f parse-secrets.py
  fi
  if [ -f "update-dashboard.py" ]; then
    rm -f update-dashboard.py
  fi
}
trap cleanup EXIT

# =========================================================================
# CONFIGURATION DEFAULT VALUES
# =========================================================================
DEFAULT_PROJECT_ID="snappy-premise-497407-v6"
DEFAULT_REGION="us-central1"
DEFAULT_REPO_NAME="bookly-registry"
DEFAULT_IMAGE_NAME="bookly-api"
DEFAULT_TAG="latest"
DEFAULT_SERVICE_NAME="bookly"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       BOOKLY UNIFIED GCP/CLOUD RUN ROLLOUT          ${NC}"
echo -e "${BLUE}====================================================${NC}"

# Read inputs with premium terminal prompt feel
read -p "Enter GCP Project ID [${DEFAULT_PROJECT_ID}]: " PROJECT_ID
PROJECT_ID=${PROJECT_ID:-$DEFAULT_PROJECT_ID}

read -p "Enter GCP Registry Region [${DEFAULT_REGION}]: " REGION
REGION=${REGION:-$DEFAULT_REGION}

read -p "Enter Artifact Registry Repository Name [${DEFAULT_REPO_NAME}]: " REPO_NAME
REPO_NAME=${REPO_NAME:-$DEFAULT_REPO_NAME}

read -p "Enter Container Image Name [${DEFAULT_IMAGE_NAME}]: " IMAGE_NAME
IMAGE_NAME=${IMAGE_NAME:-$DEFAULT_IMAGE_NAME}

read -p "Enter Deployment Version Tag [${DEFAULT_TAG}]: " TAG
TAG=${TAG:-$DEFAULT_TAG}

read -p "Enter Cloud Run Service Name [${DEFAULT_SERVICE_NAME}]: " SERVICE_NAME
SERVICE_NAME=${SERVICE_NAME:-$DEFAULT_SERVICE_NAME}

FULL_IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

echo ""
log_info "Target Image: ${FULL_IMAGE_NAME}"
log_info "Verifying CLI tools local requirements..."

# Verify CLI dependencies
for cmd in gcloud docker python3; do
  if ! command -v $cmd &> /dev/null; then
    log_error "Required CLI tool '$cmd' is missing from your environment. Please install it and retry."
    exit 1
  fi
done
log_success "All local dependencies verified successfully."

# Configure active GCP project
log_info "Setting active Google Cloud Project to '${PROJECT_ID}'..."
gcloud config set project "${PROJECT_ID}" --quiet

# Parse backend-secrets.yaml using Python to extract environment variables
SECRETS_FILE="k8s/backend-secrets.yaml"
if [ ! -f "$SECRETS_FILE" ]; then
  log_error "Required secrets file '${SECRETS_FILE}' not found. Cannot proceed."
  exit 1
fi

log_info "Parsing environment variables from '${SECRETS_FILE}'..."

cat << 'EOF' > parse-secrets.py
import sys
import re

try:
    with open('k8s/backend-secrets.yaml', 'r') as f:
        content = f.read()

    match = re.search(r'stringData:\s*\n(.*)', content, re.DOTALL)
    if not match:
        print('Error: stringData section not found in secrets file')
        sys.exit(1)

    lines = match.group(1).split('\n')
    env_vars = {}
    for line in lines:
        if line and not line.startswith(' ') and not line.startswith('\t') and not line.startswith('#'):
            break
        
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        
        parts = line.split(':', 1)
        if len(parts) == 2:
            key = parts[0].strip()
            val = parts[1].strip()
            
            # Strip outer quotes if present
            if (val.startswith("'") and val.endswith("'")) or (val.startswith('"') and val.endswith('"')):
                val = val[1:-1]
            
            env_vars[key] = val

    with open('cloudrun-env.yaml', 'w') as f:
        for key, val in env_vars.items():
            if key in ('PORT', 'GOOGLE_CALLBACK_URL', 'CORS_ORIGIN'):
                continue
            # Escape single quotes in values for YAML safety
            escaped_val = val.replace("'", "''")
            f.write(f"{key}: '{escaped_val}'\n")
            
except Exception as e:
    print(f'Error during parsing: {e}', file=sys.stderr)
    sys.exit(1)
EOF

python3 parse-secrets.py
rm -f parse-secrets.py

if [ ! -f "cloudrun-env.yaml" ]; then
  log_error "Failed to generate 'cloudrun-env.yaml'. Exiting."
  exit 1
fi
log_success "Parsed secrets and generated 'cloudrun-env.yaml' successfully."

# Check if Cloud Run service already exists to determine public URL
log_info "Checking for existing Cloud Run service '${SERVICE_NAME}'..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format="value(status.url)" 2>/dev/null || true)

if [ -z "$SERVICE_URL" ]; then
  log_warn "Cloud Run service '${SERVICE_NAME}' does not exist yet."
  log_info "Deploying a lightweight placeholder image to reserve the name and claim the service URL..."
  gcloud run deploy "${SERVICE_NAME}" \
    --image="gcr.io/cloudrun/hello" \
    --region="${REGION}" \
    --allow-unauthenticated \
    --quiet
  
  SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format="value(status.url)")
  log_success "Reserved Service URL: ${SERVICE_URL}"
else
  log_success "Service '${SERVICE_NAME}' exists. Stable URL: ${SERVICE_URL}"
fi

# Update frontend/src/app/features/dashboard/dashboard/dashboard.ts with the new Service URL fallback
log_info "Updating Angular dashboard booking link fallback to point to the production Service URL..."

cat << 'EOF' > update-dashboard.py
import re
import sys

filepath = 'frontend/src/app/features/dashboard/dashboard/dashboard.ts'
service_url = sys.argv[1]

try:
    with open(filepath, 'r') as f:
        content = f.read()

    if "origin.includes('localhost:3000')" in content:
        pattern = r"(if\s*\(\s*origin\.includes\(\s*['\" ]localhost:3000['\" ]\s*\)\s*\)\s*\{\s*\n\s*origin\s*=\s*['\" ])[^'\" ]+(['\" ])"
        replacement = rf"\g<1>{service_url}\g<2>"
        new_content = re.sub(pattern, replacement, content)
    else:
        target = r"let url = `\${window\.location\.origin}/booking/\${username}`;"
        replacement = f"""let origin = window.location.origin;
    if (origin.includes('localhost:3000')) {{
      origin = '{service_url}';
    }}
    let url = `${{origin}}/booking/${{username}}`;"""
        new_content = re.sub(target, replacement, content)

    with open(filepath, 'w') as f:
        f.write(new_content)
    print('SUCCESS')
except Exception as e:
    print(f'Error updating dashboard.ts: {e}', file=sys.stderr)
    sys.exit(1)
EOF

python3 update-dashboard.py "$SERVICE_URL"
rm -f update-dashboard.py

# Configure Docker credential helper for Artifact Registry region
log_info "Configuring Docker credential helper for ${REGION}-docker.pkg.dev..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# Build and tag the unified Docker Image
log_info "Building production Bookly Docker image (Express API + Angular SPA)..."
docker build --platform linux/amd64 -t "$FULL_IMAGE_NAME" -f Dockerfile .

# Push image to Artifact Registry
log_info "Pushing Docker image to Artifact Registry..."
docker push "$FULL_IMAGE_NAME"
log_success "Docker image successfully uploaded to registry."

# Set up and execute Database migrations using Cloud Run Job
log_info "Deploying/Updating Cloud Run migration job..."
gcloud run jobs deploy "${SERVICE_NAME}-migrate" \
  --image="$FULL_IMAGE_NAME" \
  --region="$REGION" \
  --env-vars-file=cloudrun-env.yaml \
  --command="npx" \
  --args="prisma","db","push"," --schema=src/prisma/schema.prisma" \
  --quiet

log_info "Executing database migrations..."
if gcloud run jobs execute "${SERVICE_NAME}-migrate" --region="$REGION" --wait --quiet; then
  log_success "Database migrations completed successfully."
else
  log_error "Database migration Job execution failed. Please check logs in Google Cloud Logging."
  exit 1
fi

# Append final dynamic OAuth and CORS redirect URLs to the env file
log_info "Injecting dynamic Google OAuth callback and CORS configurations..."
echo "GOOGLE_CALLBACK_URL: '${SERVICE_URL}/api/v1/auth/google/callback'" >> cloudrun-env.yaml
echo "CORS_ORIGIN: '${SERVICE_URL}'" >> cloudrun-env.yaml

# Deploy/Update the main Cloud Run Service
log_info "Deploying production Bookly service to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="$FULL_IMAGE_NAME" \
  --region="$REGION" \
  --env-vars-file=cloudrun-env.yaml \
  --allow-unauthenticated \
  --quiet

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}  BOOKLY DEPLOYED & ONLINE ON CLOUD RUN (API+SPA)   ${NC}"
echo -e "${GREEN}====================================================${NC}"
log_success "Deployment completed successfully!"
log_info "Public HTTPS URL: ${SERVICE_URL}"
echo ""
log_warn "--------------------------------------------------------"
log_warn "Action Required: Update Google OAuth Redirect URIs!"
log_warn "Please register the following callback URL in Google Console:"
log_warn "--> ${SERVICE_URL}/api/v1/auth/google/callback"
log_warn "--------------------------------------------------------"
