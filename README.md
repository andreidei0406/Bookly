# Bookly - Appointment Booking SaaS

Welcome to the Bookly project! This repository contains the complete stack for a production-ready Appointment Booking Software-as-a-Service (SaaS). 

Currently, this repository houses the **Backend API**.

---

## 🏗️ Backend Architecture

The API is built using **Node.js, Express, Prisma ORM, and PostgreSQL**. It follows a highly scalable, industry-standard **3-Tier Architecture** (also known as the Controller-Service pattern). 

If you want to understand how the code flows, here is the exact path a request takes when a user hits an endpoint:

### 1. Routes (`src/routes/`)
This is the entry point. A route file (like `business.routes.js`) simply maps an HTTP method and a URL (like `GET /api/v1/businesses`) to a specific Controller function. It also attaches any necessary **Middleware** (like checking if the user is logged in).

### 2. Middleware (`src/middleware/`)
Before the request reaches the controller, it passes through security checkpoints:
* **`validate.middleware.js`**: Uses `zod` to ensure the incoming JSON body is perfectly formatted. If a user forgets to send an email, it rejects the request instantly.
* **`auth.middleware.js`**: Checks for a valid JWT Access Token in the `Authorization` header. If valid, it attaches the user data to `req.user`.
* **`rbac.middleware.js`**: (Role-Based Access Control) Checks if the user has permission to do the action (e.g., verifying if the user is the `OWNER` of a business before letting them delete it).

### 3. Controllers (`src/controllers/`)
The traffic cop. Controllers (like `business.controller.js`) are deliberately kept very thin. Their only job is to:
1. Grab data from the request (`req.body`, `req.params`).
2. Pass that data to a **Service**.
3. Take the result from the Service and send it back to the user using standard response formatters (`created()`, `success()`).

### 4. Services (`src/services/`)
**This is where the magic happens.** All your heavy business logic lives here (like `business.service.js`). 
* Need to hash a password? Do it in a service. 
* Need to check if an email already exists? Do it in a service. 
* Need to fetch something from the database? The service asks Prisma to do it.
* By keeping logic here, it makes your code incredibly easy to test (which is why our tests run in 5 milliseconds!).

### 5. Prisma ORM (`src/prisma/`)
The database layer. Instead of writing raw SQL strings, we use Prisma.
* **`schema.prisma`**: The source of truth. Defines all your tables (Users, Businesses, Bookings) and how they relate to each other.
* Prisma automatically generates a strictly-typed JavaScript client that the Services use to interact with PostgreSQL securely (preventing SQL injection automatically).

---

## 🔒 Security & Authentication Flow

The API uses a dual-token JWT architecture:
1. **Access Token**: Short-lived (expires in 15 minutes). Sent with every single request.
2. **Refresh Token**: Long-lived (expires in 7 days). Stored securely in the database and sent as a secure, HTTP-only cookie to the browser. When the Access Token expires, the frontend secretly uses the Refresh Token to get a new one without forcing the user to log in again.

---

## 🚀 Running the API Locally

### 1. Start the Database
We use Docker to run the PostgreSQL database so you don't have to install it locally.
```bash
cd api
docker-compose up -d
```

### 2. Install & Generate
Install Node packages and generate the Prisma client:
```bash
npm install
npm run db:generate
```

### 3. Seed the Database
Push the schema to the database and insert the default demo data (Admin user, Demo Salon, etc.):
```bash
npm run db:migrate:deploy
npm run db:seed
```

### 4. Start the Server
Start the development server with hot-reloading:
```bash
npm run dev
```

You can now hit `http://localhost:3000/health` to verify the server is running!

### 5. Running Tests
The API is fully tested using **Vitest**. To run the tests in watch mode:
```bash
npm test
```