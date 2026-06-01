#!/usr/bin/env bash
# =========================================================================
# Bookly Backend GCP/GKE Deployment Automator
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

# =========================================================================
# CONFIGURATION DEFAULT VALUES (Modify or input dynamically)
# =========================================================================
DEFAULT_PROJECT_ID="bookly-production"
DEFAULT_REGION="us-central1"
DEFAULT_REPO_NAME="bookly-registry"
DEFAULT_IMAGE_NAME="bookly-api"
DEFAULT_TAG="latest"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       BOOKLY BACKEND GCP/GKE ROLLOUT INITIATOR      ${NC}"
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

FULL_IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${TAG}"

echo ""
log_info "Target Image: ${FULL_IMAGE_NAME}"
log_info "Verifying CLI tools local requirements..."

# Verify CLI dependencies
for cmd in gcloud docker kubectl; do
  if ! command -v $cmd &> /dev/null; then
    log_error "Required CLI tool '$cmd' is missing from your environment. Please install it and retry."
    exit 1
  fi
done
log_success "All local dependencies verified successfully."

# 1. Configure Docker authentication to Artifact Registry
log_info "Configuring Docker credential helper for ${REGION}-docker.pkg.dev..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

# 2. Build local Docker Image
log_info "Building production backend Docker image..."
docker build -t "$FULL_IMAGE_NAME" -f api/Dockerfile api/

# 3. Push Image to Google Artifact Registry
log_info "Pushing image to Google Artifact Registry..."
docker push "$FULL_IMAGE_NAME"
log_success "Docker image successfully uploaded to Artifact Registry."

# 4. Handle Kubernetes Secrets
SECRETS_FILE="k8s/backend-secrets.yaml"
if [ ! -f "$SECRETS_FILE" ]; then
  log_warn "Actual secrets file '${SECRETS_FILE}' not found."
  log_info "Generating secret configuration from template..."
  cp k8s/backend-secret-template.yaml "$SECRETS_FILE"
  log_warn "--------------------------------------------------------"
  log_warn "Action Required: Please edit '${SECRETS_FILE}' with your"
  log_warn "actual database credentials, SMTP details, and JWT keys."
  log_warn "--------------------------------------------------------"
  read -p "Press [Enter] once you have updated the file to continue..."
fi

log_info "Applying Kubernetes secrets to default namespace..."
kubectl apply -f "$SECRETS_FILE"

# 5. Run Database Migrations Pre-Job
log_info "Preparing Database Migration Job..."
# Replace placeholder image with actual built image dynamically
MIGRATION_TEMP_FILE=$(mktemp)
sed "s|GCP_ARTIFACT_REGISTRY_IMAGE_PLACEHOLDER|${FULL_IMAGE_NAME}|g" k8s/db-migration-job.yaml > "$MIGRATION_TEMP_FILE"

log_info "Triggering database schema migrations..."
kubectl delete job bookly-db-migration --ignore-not-found=true
kubectl apply -f "$MIGRATION_TEMP_FILE"

log_info "Waiting for database migration Job to complete..."
if kubectl wait --for=condition=complete --timeout=180s job/bookly-db-migration; then
  log_success "Database schema migrations completed successfully."
else
  log_error "Database migration Job failed or timed out. Fetching pod logs:"
  MIGRATION_POD=$(kubectl get pods --selector=job-name=bookly-db-migration --output=jsonpath='{.items[0].metadata.name}' || true)
  if [ -n "$MIGRATION_POD" ]; then
    kubectl logs "$MIGRATION_POD" || true
  fi
  rm -f "$MIGRATION_TEMP_FILE"
  exit 1
fi
rm -f "$MIGRATION_TEMP_FILE"

# 6. Apply API Pod Deployment & Service
log_info "Deploying backend application..."
DEPLOYMENT_TEMP_FILE=$(mktemp)
sed "s|GCP_ARTIFACT_REGISTRY_IMAGE_PLACEHOLDER|${FULL_IMAGE_NAME}|g" k8s/backend-deployment.yaml > "$DEPLOYMENT_TEMP_FILE"

kubectl apply -f "$DEPLOYMENT_TEMP_FILE"
kubectl apply -f k8s/backend-service.yaml
rm -f "$DEPLOYMENT_TEMP_FILE"

# 7. Monitor rollout progress
log_info "Monitoring Kubernetes backend rollout status..."
kubectl rollout status deployment/bookly-backend

echo ""
echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}    BOOKLY API DEPLOYED & ONLINE ON GOOGLE CLOUD    ${NC}"
echo -e "${GREEN}====================================================${NC}"
log_success "Rolling update successfully completed. All pods running & healthy."
log_info "Internal address: http://bookly-backend-service.default.svc.cluster.local:80"
log_info "To debug or view pod logs locally: kubectl logs -l app=bookly-backend --tail=100 -f"
