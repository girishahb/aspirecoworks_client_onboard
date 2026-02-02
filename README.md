# AspireCoWorks Client Onboarding System

A robust NestJS backend application for managing client onboarding processes with Prisma ORM, PostgreSQL, Zod validation, and role-based access control.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based guards
- **User Management**: Complete CRUD operations with role-based access (ADMIN, MANAGER, CLIENT, USER)
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
- **Client**: `client@example.com` / `Client123!`

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

- **ADMIN**: Full access to all resources
- **MANAGER**: Can manage client profiles and documents, view audit logs
- **CLIENT**: Can create and view their own profiles and documents
- **USER**: Basic user access

## Authorization Checks

All endpoints (except public auth endpoints) require:
1. Valid JWT token in Authorization header: `Bearer <token>`
2. Appropriate role permissions (enforced by `RolesGuard`)
3. Resource ownership checks (for CLIENT role)

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
