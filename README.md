# 🌿 RescueBite — Surplus Food Exchange & Impact Platform

**RescueBite** is a full-stack community surplus-food donation and redistribution platform. It bridges the gap between commercial food donors (restaurants, hotels, bakeries, caterers) and verified non-profit organizations (NGOs) to rescue fresh surplus food, reduce landfill waste, and feed communities in need.

---

## 🌟 Key Features

- **🛡️ Multi-Role Security & Verification**:
  - **Donor Partners**: Businesses register and submit business profiles for administrative verification before posting surplus food listings.
  - **NGO Recipients**: Non-profits submit registration details for admin review before reserving available food donations.
  - **Admin Team**: Platform administrators manage user accounts, review pending applications, and monitor platform-wide impact statistics.

- **🍲 Real-Time Surplus Food Marketplace**:
  - Browse live surplus food items with category filtering (`prepared-meals`, `bakery`, `produce`, `dairy`, `packaged`, `beverages`, `frozen`).
  - Geospatial proximity search (`$near` 2dsphere queries) to locate nearby food listings.
  - Search by title, description, or pickup location.

- **⚡ Atomic Reservation State Machine**:
  - Atomic status transitions (`active` → `reserved` → `completed` / `cancelled`) prevent race conditions and conflicting reservations.
  - NGOs can release reservations back to active state if pickup is unfeasible.
  - Handoff completion automatically generates an immutable impact record.

- **📊 Traceable Impact Analytics**:
  - Automated tracking of total meals rescued, financial value saved ($), and category breakdowns.
  - Dedicated impact dashboards for Donors, NGOs, and Admins.

- **🌓 Eye-Friendly Dynamic Dark / Light Mode**:
  - Integrated theme engine with localStorage persistence and system theme preference detection.
  - Modern, responsive UI designed with CSS custom tokens, glassmorphism cards, and smooth micro-animations.

---

## 🛠️ Technology Stack

| Domain | Stack Component | Details |
|---|---|---|
| **Backend Runtime** | Node.js (>= 18) | JavaScript server runtime |
| **Web Framework** | Express.js (v4) | RESTful API routes & static server |
| **Database** | MongoDB Atlas / Mongoose (v8) | NoSQL document storage with 2dsphere geospatial indexing |
| **Authentication** | JWT (JSON Web Tokens) + bcryptjs | Secure bearer token auth & password hashing |
| **Validation** | Zod (v3) | Strict request schema & environment variable validation |
| **File Uploads** | Multer | Multipart image uploads with MIME & binary magic-number validation |
| **Frontend UI** | HTML5, Vanilla JavaScript, CSS3 | Single-origin static Web client served out of `/public` |

---

## 📂 Project Structure

```
RescueBite/
├── server.js                      # Application entrypoint & HTTP server listener
├── package.json                   # Dependencies, scripts & engine definitions
├── .env.example                   # Environment variable template
├── scripts/                       # Automated testing & seed utility scripts
│   ├── seed.js                    # Idempotent demo data generator
│   ├── verify-phase4.js           # Uploads & media validation checks
│   ├── verify-phase5-6.js         # Marketplace & reservation state checks
│   ├── verify-phase7-8.js         # Impact records & admin console checks
│   ├── verify-phase9.js           # System configuration & readiness checks
│   ├── verify-role-middleware.js  # Role-Based Access Control (RBAC) tests
│   └── verify-e2e.js              # Full HTTP end-to-end integration test
├── public/                        # Web Frontend static assets
│   ├── index.html                 # Platform landing page
│   ├── marketplace.html           # Live surplus food discovery page
│   ├── donor.html                 # Donor workspace & listing creation modal
│   ├── ngo.html                   # NGO rescue hub & active reservations
│   ├── admin.html                 # Platform administration console
│   ├── login.html                 # Authentication sign-in page with quick presets
│   ├── register.html              # Account self-registration page
│   ├── styles.css                 # Master CSS design system (tokens, light/dark themes)
│   └── app.js                     # Multi-page application controller logic
└── src/                           # Backend application logic
    ├── app.js                     # Express app configuration & middleware wiring
    ├── config/                    # Database (db.js) & Environment (env.js) configs
    ├── constants/                 # Platform constants & category definitions
    ├── controllers/               # Route business logic handlers
    ├── middleware/                # Auth, Role, Verification, Upload & Error handlers
    ├── models/                    # Mongoose database models (User, Partner, Ngo, Donation, Impact)
    ├── routes/                    # API route definitions
    └── utils/                     # JWT, password & async wrapper helpers
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas cluster connection URI

### 2. Environment Setup
Clone the repository and install dependencies:

```bash
npm install
```

Copy `.env.example` to create your local `.env` configuration file:

```powershell
# PowerShell
Copy-Item .env.example .env
```

```bash
# Bash / macOS / Linux
cp .env.example .env
```

### 3. Environment Variables

Configure your `.env` parameters:

| Variable | Required | Description | Default |
|---|---|---|---|
| `MONGODB_URI` | **Yes** | MongoDB connection string (Atlas or Local) | — |
| `JWT_SECRET` | **Yes** | Secret key for signing JWTs (min 16 chars) | — |
| `PORT` | No | Express server port | `4000` |
| `CLIENT_ORIGIN` | No | CORS allowed origin | `*` |
| `JWT_EXPIRES_IN` | No | Token expiration duration | `7d` |
| `NODE_ENV` | No | Application environment (`development` / `production`) | `development` |

### 4. Run the Platform

Start the server in development mode (with auto-reload via `nodemon`):

```bash
npm run dev
```

Or run in standard production mode:

```bash
npm start
```

Access the application in your browser at: **[http://localhost:4000](http://localhost:4000)**

---

## 🔑 Demo Accounts & Seed Data

Populate the database with pre-configured demo accounts, verified business profiles, active surplus listings, and sample impact history:

```bash
npm run seed
```

All seeded demo accounts use the password: **`DemoPass123!`**

| Role | Email | Status | Workspace |
|---|---|---|---|
| **Admin** | `admin@taki.demo` | Active | Admin Console (`/admin.html`) |
| **Donor** | `donor@taki.demo` | Verified Partner | Donor Portal (`/donor.html`) |
| **NGO** | `ngo@taki.demo` | Verified NGO | NGO Hub (`/ngo.html`) |

*Note: The sign-in page (`/login.html`) includes quick-preset buttons to fill these credentials automatically.*

---

## 📡 API Reference

### 🔐 Auth Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Public | Create user with role `donor` or `ngo` |
| `POST` | `/api/auth/login` | Public | Public | Authenticate user and return JWT token |
| `GET` | `/api/auth/me` | Required | Any | Retrieve current authenticated user profile |

### 🏢 Partner Profile Endpoints (`/api/partners`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/partners/register` | Required | Donor | Submit business partner verification profile |
| `GET` | `/api/partners/me` | Required | Donor | Fetch caller's partner verification profile |
| `PATCH` | `/api/partners/me` | Required | Donor | Edit profile while pending or resubmit after rejection |
| `GET` | `/api/partners/pending` | Required | Admin | List pending donor partner applications |
| `PATCH` | `/api/partners/:id/verify` | Required | Admin | Approve or reject a partner business profile |

### 🤝 NGO Profile Endpoints (`/api/ngos`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/ngos/register` | Required | NGO | Submit NGO verification profile |
| `GET` | `/api/ngos/me` | Required | NGO | Fetch caller's NGO verification profile |
| `PATCH` | `/api/ngos/me` | Required | NGO | Edit profile while pending or resubmit after rejection |
| `GET` | `/api/ngos/pending` | Required | Admin | List pending NGO applications |
| `PATCH` | `/api/ngos/:id/verify` | Required | Admin | Approve or reject an NGO verification profile |

### 🍲 Donation & Marketplace Endpoints (`/api/donations`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/donations` | Optional | Public | Browse active, unexpired surplus food listings |
| `GET` | `/api/donations/nearby` | Optional | Public | Geospatial distance-ordered discovery (`lat`, `lng`) |
| `GET` | `/api/donations/mine` | Required | Donor | List all donations created by the caller |
| `GET` | `/api/donations/:id` | Required | Any | Get detailed view of a specific donation |
| `POST` | `/api/donations` | Required | Verified Donor | Publish a new surplus food listing (JSON or Multipart) |
| `PATCH` | `/api/donations/:id` | Required | Donor Owner | Update an active surplus food listing |
| `PATCH` | `/api/donations/:id/status` | Required | Donor Owner | Cancel listing or confirm completion |
| `POST` | `/api/donations/:id/reserve` | Required | Verified NGO | Atomically reserve an active food listing |
| `POST` | `/api/donations/:id/reservation/cancel` | Required | Reserving NGO | Release reservation back to active status |
| `POST` | `/api/donations/:id/reservation/complete` | Required | Donor Owner | Confirm food handoff completion & log impact |
| `DELETE` | `/api/donations/:id` | Required | Admin | Delete a surplus food listing |

### 📊 Impact & Admin Endpoints (`/api/impact` & `/api/admin`)

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/impact/mine` | Required | Donor | List completed rescue outcomes from caller's listings |
| `GET` | `/api/impact/received` | Required | Verified NGO | List completed rescues delivered to caller's NGO |
| `GET` | `/api/admin/impact` | Required | Admin | Paginated platform-wide impact records |
| `GET` | `/api/admin/stats` | Required | Admin | Aggregate platform metrics & summary totals |
| `GET` | `/api/admin/users` | Required | Admin | Paginated user list with role & status filters |
| `PATCH` | `/api/admin/users/:id/active` | Required | Admin | Enable or disable a user account |

---

## 🧪 Verification & Automated Testing

Run the complete automated verification test suite:

```bash
npm run verify
```

To run individual verification modules:

```bash
npm run verify:phase4      # Uploads, MIME security & static header tests
npm run verify:phase5-6    # Marketplace browse, geo-search & atomic reservations
npm run verify:phase7-8    # Impact logging & admin console management
npm run verify:phase9      # System config & seed integration tests
npm run verify:e2e        # HTTP end-to-end integration flow
```

---

## 📜 License

This project is licensed under the **MIT License**.
