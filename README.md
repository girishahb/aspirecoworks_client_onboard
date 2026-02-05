# AspireCoWorks Client Onboarding System

A robust NestJS backend application for managing client onboarding processes with Prisma ORM, PostgreSQL, Zod validation, and role-based access control.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based guards
- **User Management**: Complete CRUD operations with role-based access (SUPER_ADMIN, ADMIN, MANAGER, COMPANY_ADMIN, USER)
- **Client Profiles**: Manage client onboarding profiles with status tracking
- **Document Management**: Upload, verify, and manage client documents
- **Audit Logging**: Comprehensive audit trail for all operations
- **Zod Validation**: Type-safe request validation using Zod schemas
- **Swagger Documentation**: Auto-generated API documentation

## Tech Stack

- **Framework**: NestJS
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Validation**: Zod
- **Authentication**: JWT (Passport)
- **Documentation**: Swagger/OpenAPI

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd aspirecoworks_client_onboard
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `JWT_EXPIRES_IN`: Token expiration time (default: 7d)
- `PORT`: Server port (default: 3000)

4. Set up the database:
```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed the database (optional)
npm run prisma:seed
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`
Swagger documentation at `http://localhost:3000/api`

## Default Users

After seeding, you can login with:

- **Admin**: `admin@aspirecoworks.com` / `Admin123!`
- **Manager**: `manager@aspirecoworks.com` / `Manager123!`
- **Company admin (Dashboard)**: `company-admin@example.com` / `Client123!` — linked to Example Corp for testing the client Dashboard

## Testing the Dashboard (activation, renewal, messages)

The client Dashboard shows **account activation status** (green Active / red Inactive), **renewal date**, and **upcoming or overdue renewal** messages.

1. **Start backend and frontend**
   ```bash
   # Terminal 1 – backend
   npm run start:dev

   # Terminal 2 – frontend
   cd frontend
   npm install
   npm run dev
   ```
   Ensure `frontend/.env` has `VITE_API_BASE_URL=http://localhost:3000` (or your backend URL).

2. **Ensure DB is migrated and seeded**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

3. **Log in as company admin**
   - Open the frontend (e.g. `http://localhost:5173`).
   - Log in with **company-admin@example.com** / **Client123!**.
   - Go to **Dashboard**. You should see:
     - **Account status**: Active (green)
     - **Renewal date**: ~30 days from today
     - **Message**: “Your renewal is coming up in X days (on [date]).”

4. **Try other scenarios (optional)**  
   Use **Prisma Studio** (`npm run prisma:studio`) and edit the **ClientProfile** for “Example Corp” (taxId `TAX123456`):
   - **Inactive + overdue**: set `renewalStatus` to `EXPIRED` and `renewalDate` to a past date → red status, inactive message, and “Renewal is overdue…”
   - **Upcoming in 7 days**: set `renewalDate` to 5 days from today, `renewalStatus` to `ACTIVE` → “Your renewal is due in 5 days…”
   - **Active, no reminder**: set `renewalDate` to 60 days from today → no yellow message.

## Testing the Admin flow

The admin area includes: **Admin Login**, **Admin Dashboard** (companies table), **Company Review** (profile, documents, approve/reject, activate), and **Audit log** (read-only).

1. **Start backend and frontend** (same as above)
   ```bash
   # Terminal 1
   npm run start:dev

   # Terminal 2
   cd frontend
   npm run dev
   ```
   Ensure `frontend/.env` has `VITE_API_BASE_URL=http://localhost:3000`.

2. **DB migrated and seeded**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

3. **Admin login**
   - Open the frontend (e.g. `http://localhost:5173`).
   - Go to **Admin** in the nav (or `/admin/login`).
   - Log in with **admin@aspirecoworks.com** / **Admin123!**.
   - You should be redirected to **Admin Dashboard** (`/admin/dashboard`).
   - If you use a non-admin user (e.g. company-admin@example.com), you should see “Access denied. Admin accounts only.” and stay on the login page.

4. **Admin Dashboard**
   - You should see a table of **Companies** (company name, status, created date).
   - Click a row → goes to **Company review** for that company (`/admin/companies/:companyId`).
   - Use the **Audit log** link to open the read-only audit log (`/admin/audit-log`).

5. **Company review** (`/admin/companies/:companyId`)
   - **Company profile**: name, contact, onboarding status, renewal, address, notes.
   - **Documents**: name, type, status, uploaded date; **Download**, and for pending docs **Approve** / **Reject** (reject asks for a reason).
   - **Activate Company**: enabled only when all required documents are approved (compliance). Click to activate; UI refreshes and shows “Company is already active”.
   - **Back to dashboard** returns to the admin companies list.

6. **Audit log** (`/admin/audit-log`)
   - Read-only table: **Timestamp**, **Action** (Document approved / Document rejected / Company activated), **Admin** (email), **Context** (company name link, document name).
   - Perform an approve/reject or activate on the Company review page, then open Audit log to see the new entry.

**Note:** Document list, approve/reject, and compliance status use backend endpoints that may require **SUPER_ADMIN** in production. The seed **ADMIN** user can list companies, get company, and activate via client-profiles. If you get 403 on documents or compliance, ensure the logged-in user has the required role or add that role to the backend for ADMIN.

## API Structure

### Authentication
- `POST /auth/login` - Login user
- `POST /auth/register` - Register new user

### Users
- `GET /users` - Get all users (Admin/Manager only)
- `GET /users/me` - Get current user profile
- `GET /users/:id` - Get user by ID (Admin/Manager only)
- `POST /users` - Create user (Admin only)
- `PATCH /users/:id` - Update user (Admin only)
- `DELETE /users/:id` - Delete user (Admin only)

### Client Profiles
- `GET /client-profiles` - Get all client profiles
- `GET /client-profiles/:id` - Get client profile by ID
- `POST /client-profiles` - Create client profile
- `PATCH /client-profiles/:id` - Update client profile
- `PATCH /client-profiles/:id/status` - Update onboarding status (Admin/Manager only)
- `DELETE /client-profiles/:id` - Delete client profile (Admin only)

### Documents
- `GET /documents` - Get all documents
- `GET /documents/:id` - Get document by ID
- `POST /documents` - Create document
- `PATCH /documents/:id` - Update document
- `PATCH /documents/:id/status` - Update document status (Admin/Manager only)
- `DELETE /documents/:id` - Delete document

### Audit Logs
- `GET /audit-logs` - Get all audit logs (Admin/Manager only)
- `GET /audit-logs/:id` - Get audit log by ID (Admin/Manager only)

## Role-Based Access Control

- **SUPER_ADMIN**: Highest privilege level, full system access
- **ADMIN**: Full access to all resources
- **MANAGER**: Can manage client profiles and documents, view audit logs
- **COMPANY_ADMIN**: Company-level administrator, can access company dashboard, upload documents, view invoices (must have companyId set)
- **USER**: Basic user access (default for new registrations)

## Authorization Checks

All endpoints (except public auth endpoints) require:
1. Valid JWT token in Authorization header: `Bearer <token>`
2. Appropriate role permissions (enforced by `RolesGuard`)
3. Resource ownership checks (for COMPANY_ADMIN role - must have companyId set)

## Database Schema

The application uses Prisma with the following main entities:
- **User**: System users with roles
- **ClientProfile**: Client onboarding profiles
- **Document**: Client documents
- **AuditLog**: Audit trail for all operations

See `prisma/schema.prisma` for the complete schema definition.

## Development

```bash
# Run tests
npm run test

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format

# Prisma Studio (Database GUI)
npm run prisma:studio
```

## Project Structure

```
src/
├── auth/              # Authentication module
├── users/             # User management
├── client-profiles/   # Client profile management
├── documents/         # Document management
├── audit-logs/        # Audit logging
├── prisma/            # Prisma service
├── common/             # Shared utilities
│   ├── decorators/    # Custom decorators
│   ├── guards/        # Auth guards
│   └── enums/         # Enumerations
└── main.ts            # Application entry point
```

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (RBAC)
- Resource-level authorization checks
- Input validation with Zod
- SQL injection protection via Prisma
- Audit logging for compliance

## License

Private - AspireCoWorks
