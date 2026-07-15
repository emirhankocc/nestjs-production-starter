# NestJS Production Starter

A production-oriented NestJS backend starter built with TypeScript, PostgreSQL, Prisma, JWT and Docker.

## Status

Sprint 4 (Authorization) is complete.

The project currently provides environment configuration, API versioning, request validation, Swagger documentation, PostgreSQL via Docker Compose, Prisma ORM integration, a database-aware health-check endpoint, JWT authentication with refresh-token rotation and role-based authorization for protected endpoints.

## Current Functionality (Sprint 4)

- Custom access-token guard without Passport
- Authenticated profile endpoint at `GET /api/v1/users/me`
- Role-based authorization with `@Roles()` metadata
- Admin proof endpoint at `GET /api/v1/admin/ping`
- Swagger bearer authentication for protected endpoints

## Authentication Endpoints

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `POST` | `/api/v1/auth/register` | `201` | Register a new user |
| `POST` | `/api/v1/auth/login` | `200` | Authenticate a user |
| `POST` | `/api/v1/auth/refresh` | `200` | Rotate refresh token |
| `POST` | `/api/v1/auth/logout` | `204` | Revoke refresh session |

### Register

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}'
```

Example response:

```json
{
  "user": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "email": "user@example.com",
    "role": "USER",
    "isActive": true,
    "createdAt": "2026-07-13T00:00:00.000Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Public registration always creates `USER` accounts. `ADMIN` users must currently be created or promoted directly in the development database.

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}'
```

### Refresh

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

### Logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh-token>"}'
```

## Authorization

Protected endpoints require a short-lived access token in the `Authorization` header:

```http
Authorization: Bearer <access-token>
```

### Profile

```bash
curl http://localhost:3000/api/v1/users/me \
  -H "Authorization: Bearer <access-token>"
```

Example response:

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "email": "user@example.com",
  "role": "USER",
  "isActive": true,
  "createdAt": "2026-07-13T00:00:00.000Z"
}
```

Behavior:

- `200` when the access token is valid and the user exists and is active
- `401 Unauthorized.` when the token is missing, invalid, expired, or the user no longer exists or is inactive

The profile is loaded from the database using `payload.sub`; it is not returned directly from the JWT payload.

### Admin Proof Endpoint

```bash
curl http://localhost:3000/api/v1/admin/ping \
  -H "Authorization: Bearer <admin-access-token>"
```

Example response:

```json
{
  "status": "ok",
  "message": "Admin access granted"
}
```

Behavior:

- `200` when the access token is valid and the user role is `ADMIN`
- `401 Unauthorized.` when the access token is missing or invalid
- `403 Forbidden` when the access token is valid but the role is not `ADMIN`

There is no admin management, permission management, or user CRUD in this sprint.

## Token and Session Model

- Access tokens are short-lived JWTs signed with `JWT_ACCESS_SECRET`.
- Refresh tokens are JWTs signed with `JWT_REFRESH_SECRET` and include both the user id (`sub`) and refresh-session id (`sessionId`).
- Only an Argon2id hash of the complete refresh token is stored in `RefreshSession.tokenHash`.
- Refresh rotation revokes the previous session and creates a new one inside a Prisma transaction.
- Logout revokes the matching refresh session when the token is valid, but still returns `204` for invalid or already-revoked tokens.

## Current Limitations

- No admin management endpoints
- No permission management framework
- No user CRUD or profile update endpoints
- No logout-all or session listing

## Planned Version 1

- Environment validation
- PostgreSQL and Prisma
- JWT authentication
- Refresh-token rotation
- Role-based authorization
- Swagger documentation
- Docker support
- Automated tests
- GitHub Actions CI

## Development Approach

The project is developed incrementally through defined sprints. AI tools may support planning, implementation and code review, while architecture decisions, validation and final responsibility remain with the project author.

## Prerequisites

- Node.js 20 or later
- npm 10 or later
- Docker and Docker Compose for local PostgreSQL

## Environment Variables

Copy `.env.example` to `.env` and adjust values as needed:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) | `development` |
| `PORT` | HTTP server port | `3000` |
| `API_PREFIX` | Global API route prefix | `api` |
| `API_VERSION` | Default URI API version | `1` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public` |
| `JWT_ACCESS_SECRET` | Access-token signing secret (min 32 chars) | placeholder in `.env.example` |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret (min 32 chars) | placeholder in `.env.example` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |

The application fails during startup when supplied environment variables are invalid.

## Installation

```bash
npm install
```

## Database

Start the local PostgreSQL container:

```bash
docker compose up -d
```

Check container status:

```bash
docker compose ps
```

Stop the local PostgreSQL container:

```bash
docker compose down
```

If port `5432` is already in use on your machine, stop the conflicting PostgreSQL instance before starting Docker Compose.

Apply database migrations:

```bash
npx prisma migrate dev --name init_user_and_refresh_session
```

Generate the Prisma client:

```bash
npx prisma generate
```

Promote a user to `ADMIN` in the development database:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'user@example.com';
```

Log in again after promotion so the new access token contains the updated role.

## Development

```bash
npm run start:dev
```

## API

- Base path: `/api/v1`
- Swagger UI: `http://localhost:3000/docs`
- Health check: `GET http://localhost:3000/api/v1/health`

Example health response:

```json
{
  "status": "ok",
  "service": "nestjs-production-starter",
  "timestamp": "2026-07-13T00:00:00.000Z",
  "uptime": 12.345,
  "database": "up"
}
```

## Quality Checks

```bash
npm run lint
npm run test
npm run build
```

## Sprint 0 — Baseline (Complete)

- Minimal NestJS application scaffolded with strict TypeScript
- Lint, test and build commands verified
- Project scope and AI development rules defined in `PROJECT_SPEC.md` and `.cursor/rules/project.mdc`

## Sprint 1 — Application Foundation (Complete)

- Environment configuration and validation
- Global validation pipe
- API prefix and URI versioning
- Swagger documentation
- Health-check endpoint with tests

## Sprint 2 — Database Foundation (Complete)

- PostgreSQL with Docker Compose
- Prisma installation and configuration
- `User` and `RefreshSession` models
- Initial migration
- `PrismaService` integration
- Database-aware health-check endpoint with tests

## Sprint 3 — Authentication (Complete)

- User registration
- User login
- Argon2id password hashing
- JWT access and refresh tokens
- Refresh-token rotation
- Secure logout with hashed refresh sessions
- Authentication unit tests

## Sprint 4 — Authorization (Complete)

- Custom `AccessTokenGuard` without Passport
- `@CurrentUser()` decorator
- `GET /api/v1/users/me` protected profile endpoint
- `@Roles()` decorator and `RolesGuard`
- `GET /api/v1/admin/ping` admin proof endpoint
- Swagger bearer authentication for protected routes
- Authorization unit and e2e tests
