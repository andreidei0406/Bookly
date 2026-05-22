# Bookly — Appointment Booking SaaS

A full-stack, production-ready **Calendly-style** appointment booking platform built as a monorepo.

| Layer | Tech |
|-------|------|
| **Frontend** | Angular 21 · TailwindCSS · Signals |
| **Backend API** | Node.js 24 · Express 5 · Prisma ORM |
| **Database** | PostgreSQL 16 (Docker) |
| **Auth** | HttpOnly cookie JWTs + Google OAuth 2.0 |
| **Payments** | Stripe Checkout (optional per-service) |
| **CI** | GitHub Actions |

---

## 📁 Monorepo Structure

```
Bookly/
├── api/                 # Express REST API
│   ├── src/
│   │   ├── config/      # Centralised env config & logger
│   │   ├── controllers/ # Thin HTTP handlers
│   │   ├── middleware/   # Auth, RBAC, validation, error handling
│   │   ├── prisma/      # Schema, migrations, seed
│   │   ├── routes/      # Express route definitions
│   │   ├── services/    # Business logic layer
│   │   ├── utils/       # Helpers (Prisma singleton, ApiError, etc.)
│   │   └── validators/  # Zod schemas
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
│
├── frontend/            # Angular 21 SPA
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/          # Guards, interceptors, services
│   │   │   └── features/      # Auth, Dashboard, Booking pages
│   │   ├── styles.css         # Tailwind + design tokens
│   │   └── index.html
│   └── package.json
│
└── .github/workflows/ci.yml   # CI pipeline
```

---

## 🏗️ Backend Architecture

The API follows an industry-standard **Controller → Service → ORM** pattern.
Here is the exact path a request takes:

### 1. Routes (`src/routes/`)
Maps HTTP methods and URLs (e.g. `GET /api/v1/businesses`) to Controller functions.
Attaches middleware (auth, validation, RBAC) along the way.

### 2. Middleware (`src/middleware/`)
Security checkpoints that run *before* the controller:
- **`validate.middleware.js`** — Uses Zod to reject malformed bodies instantly.
- **`auth.middleware.js`** — Reads the `accessToken` from the HttpOnly cookie and attaches `req.user`.
- **`rbac.middleware.js`** — Verifies the user has the correct role (OWNER, ADMIN, STAFF).

### 3. Controllers (`src/controllers/`)
Deliberately thin. They extract data from the request, call a Service, and send the response.

### 4. Services (`src/services/`)
All business logic lives here: password hashing, availability checks, Stripe checkout sessions, Google Calendar integration, etc.

### 5. Prisma ORM (`src/prisma/`)
- **`schema.prisma`** — The source of truth for all tables (Users, Businesses, Services, Bookings, etc.).
- Prisma generates a type-safe client that prevents SQL injection automatically.

---

## 🖥️ Frontend Architecture

The Angular 21 SPA is built with modern best practices:

- **Standalone components** — No NgModules.
- **Signals** — Reactive state management using Angular's native `signal()` API.
- **Functional interceptors & guards** — `authInterceptor` adds `withCredentials: true` to every request; `authGuard` / `noAuthGuard` protect routes.
- **HttpOnly cookie auth** — Tokens are never visible to JavaScript. The `AuthService` hydrates the session via `GET /api/v1/auth/me` on startup.

### Key Views

| View | Description |
|------|-------------|
| **Login / Register** | Glassmorphism UI with email/password + Google OAuth |
| **Dashboard** | Calendar-first layout with a slim icon sidebar (Calendar, Profile, Logout) |
| **Public Booking** | `/booking/:businessSlug` — Public page for customers to book services |

---

## 🔒 Security & Authentication

The API uses a **dual-token JWT** architecture stored as **HttpOnly cookies**:

1. **Access Token** — Short-lived (15 min). Sent automatically by the browser with every request.
2. **Refresh Token** — Long-lived (7 days). Stored in the database; used to silently rotate the access token.

Both tokens are set with `HttpOnly`, `Secure` (in production), and `SameSite=Lax` flags, making them immune to XSS token theft.

### Google OAuth 2.0
Users can log in with their Google account. The backend handles the full OAuth handshake via Passport.js and sets the same HttpOnly cookies on the redirect.

---

## 💳 Stripe Integration

Each Service can be configured with a `paymentType`:
- **FREE** — No payment required.
- **OPTIONAL** — Customer *may* pay by card or in person.
- **REQUIRED** — Card payment via Stripe Checkout is mandatory before the booking is confirmed.

---

## 🚀 Running Locally

### Prerequisites
- **Node.js ≥ 24** and **npm**
- **Docker** (for PostgreSQL)

### 1. Start the Backend (API + Database)

```bash
cd api
cp .env.example .env          # edit with your secrets
docker compose up --build -d  # starts Postgres + API
```

The Docker startup command automatically:
1. Pushes the Prisma schema to the database (`prisma db push`)
2. Seeds demo data (Admin user, Demo Salon, services, working hours)
3. Starts the Node.js server on **port 3000**

Verify: `curl http://localhost:3000/health`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm start              # Angular dev server on port 4200
```

Open **http://localhost:4200** in your browser.

### 3. Demo Accounts

| Account | Email | Password |
|---------|-------|----------|
| **Admin** (Business Owner) | `admin@bookly.com` | `Admin1234!` |
| **Customer** | `customer@example.com` | `Customer1234!` |

---

## 🧪 Running Tests

### Backend (Vitest)
```bash
cd api
npm test
```

### Frontend (Angular CLI)
```bash
cd frontend
npm run build    # production build check
```

---

## 🔄 CI Pipeline

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

| Job | Steps |
|-----|-------|
| **API** | Install → Generate Prisma → Lint → Test |
| **Frontend** | Install → Build (type-check + bundle) |

Both jobs run in parallel for fast feedback.

---

## 📝 Environment Variables

Copy `api/.env.example` to `api/.env` and configure:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key (optional for dev) |
| `CORS_ORIGIN` | Frontend URL (default: `http://localhost:4200`) |