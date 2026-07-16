# NestJS Production Starter

A production-oriented NestJS backend starter built with TypeScript, PostgreSQL, Prisma, JWT and Docker.

## Status

Sprint 8 (Production Docker) is complete.

The project currently provides environment configuration, API versioning, request validation, Swagger documentation, PostgreSQL via Docker Compose, Prisma ORM integration, a database-aware health-check endpoint, JWT authentication with refresh-token rotation, role-based authorization, standardized API error responses with request IDs, structured HTTP logging, Helmet security headers, response compression, in-memory rate limiting and a production-oriented multi-stage Docker image.

## Current Functionality (Sprint 8)

- Multi-stage production Dockerfile on Node 22 LTS slim
- Non-root production runtime container
- Production Compose stack for API and PostgreSQL
- One-off production migration flow with `prisma migrate deploy`
- Development PostgreSQL port override through `POSTGRES_HOST_PORT`
- Node-based API health checks in production Compose

## Production Docker

### Image design

The production image uses three stages:

1. **dependencies** — reproducible `npm ci`
2. **build** — Prisma Client generation and NestJS compilation
3. **production** — runtime dependencies, generated Prisma Client, compiled app and migration files only

The final container:

- runs as the dedicated `nestjs` user (UID `1001`)
- sets `NODE_ENV=production`
- starts with `node dist/src/main.js`
- does not bake secrets or `.env` files into the image
- intentionally includes the Prisma CLI so one-off `prisma migrate deploy` commands can reuse the same API image

Prisma CLI trade-off: the production runtime keeps Prisma CLI on purpose. This increases image size, but it avoids a separate migration image and keeps production migration commands simple and explicit. Migrations are not run automatically on every API container restart; they are executed separately with `docker compose run --rm api npx prisma migrate deploy`.

Package metadata: `private: true` in `package.json` prevents accidental publication to the public npm registry. It does not make the GitHub repository private.

### Development PostgreSQL

Start the development database:

```bash
docker compose up -d
```

If local port `5432` is already in use on Windows or another machine, override only the host port without changing the tracked Compose file:

```powershell
$env:POSTGRES_HOST_PORT="5434"
docker compose up -d
```

Update `DATABASE_URL` in your local `.env` to match the host port you choose.

### Production environment

Copy the production example file and replace every placeholder with real values:

```bash
cp .env.production.example .env.production
```

Important:

- never commit `.env.production`
- `POSTGRES_PASSWORD` and `DATABASE_URL` must stay consistent
- use different values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`

### Build the production image

```bash
docker build --no-cache -t nestjs-production-starter-api .
```

### Production startup

Start PostgreSQL:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d postgres
```

Run migrations once with a one-off command:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm api npx prisma migrate deploy
```

Start the API:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d api
```

Or start the full production stack after migrations:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

### Production operations

Health check:

```bash
curl http://localhost:3000/api/v1/health
```

View logs:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml logs -f api
```

Graceful shutdown:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml stop api
```

Stop the full production stack:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml down
```

### Migration safety

- use `npx prisma migrate deploy` in production
- do not use `prisma migrate dev` in production containers
- do not use `prisma db push` in production
- migrations are not executed automatically on every API container restart

### Production limitations

This sprint does not include:

- GitHub Actions CI
- Nginx
- HTTPS / automatic TLS
- Kubernetes
- container registry publishing
- VPS deployment automation

## Current Functionality (Sprint 7)

- Helmet security headers with explicit configuration
- Response compression via middleware
- Global API rate limiting with `@nestjs/throttler`
- Stricter authentication rate limits for register, login and refresh
- Standardized `429 Too Many Requests` responses
- Optional `TRUST_PROXY` for reverse-proxy deployments
- CORS intentionally disabled for this sprint

## HTTP Security

### Helmet

Helmet is applied globally during application bootstrap before controllers handle requests.

Configured protections include:

- Content Security Policy with restrictive defaults
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options`
- `Referrer-Policy`
- `Strict-Transport-Security` in production-capable deployments
- `hidePoweredBy: true` so framework information is not exposed

Swagger UI trade-off: `/docs` requires inline scripts and styles. The CSP allows `'unsafe-inline'` only for `scriptSrc` and `styleSrc` on the self-hosted Swagger page. This is the minimum practical adjustment needed to keep `/docs` functional while retaining CSP elsewhere.

### Response Compression

The `compression` middleware is enabled globally with library defaults. It runs after Helmet and before NestJS route handling. JSON API responses and Swagger remain functional. Tiny responses are left uncompressed by the library threshold.

### Rate Limiting

Rate limiting uses `@nestjs/throttler` with in-memory storage.

| Scope | Default limit | Window |
|-------|---------------|--------|
| General API | `100` requests | `60` seconds |
| Authentication (`register`, `login`, `refresh`) | `10` requests | `60` seconds |

Policy details:

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login` and `POST /api/v1/auth/refresh` use the stricter authentication limit
- `POST /api/v1/auth/logout` uses the general API limit
- `GET /api/v1/health` is excluded from rate limiting so health checks stay reachable
- `/docs` is excluded from rate limiting so Swagger remains reachable

When a limit is exceeded, the API returns:

```json
{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Too many requests. Please try again later.",
  "path": "/api/v1/auth/login",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-07-13T00:00:00.000Z"
}
```

Internal throttler state is never exposed in responses.

### Rate-Limiting Limitations

Current throttling is process-local. Each application instance tracks limits independently in memory.

Multi-instance deployment would require shared storage later. Redis is not implemented in this sprint.

### Reverse Proxy Support

`TRUST_PROXY` defaults to `false`.

Enable it only when the application runs behind a controlled reverse proxy that sets `X-Forwarded-For` correctly:

```env
TRUST_PROXY=true
```

When enabled, Express `trust proxy` is set to `1` so rate limiting can use the original client IP.

### CORS

CORS is intentionally not enabled in Sprint 7.

The API does not use permissive settings such as `origin: '*'`, `origin: true`, or unrestricted credentials. Consumers deploying a separate frontend must configure an explicit allowlist later.

## Current Functionality (Sprint 6)

- Structured HTTP request-completion logging
- Request ID correlation across logs and responses
- Log-level routing for `2xx`/`3xx`, `4xx` and `5xx`
- Server-side logging for unknown and infrastructure errors
- Safe startup logging without secrets

## Structured Logging

The application uses the built-in NestJS `Logger` with stable JSON log entries.

### HTTP Request Completion

Each completed HTTP request produces one log entry:

```json
{
  "event": "http_request_completed",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "method": "POST",
  "path": "/api/v1/auth/login",
  "statusCode": 200,
  "durationMs": 42.15
}
```

Fields included:

- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`

Log levels:

- `2xx` and `3xx`: `log`
- `4xx`: `warn`
- `5xx`: `error`

### Request ID Correlation

The `requestId` in HTTP logs matches the `x-request-id` response header and the `requestId` field in API error responses.

### Security

The logging layer does not write:

- request bodies
- response bodies
- `Authorization` headers
- cookies
- passwords
- access tokens
- refresh tokens
- database connection strings
- environment secrets

Expected client errors such as `400`, `401`, `403` and `409` are covered by HTTP completion warning logs only. Unknown internal and infrastructure failures are logged separately as `unhandled_exception` entries without changing the public API error format.

## Current Functionality (Sprint 5)

- Global request ID middleware using `x-request-id`
- Standardized error response format across the API
- Global exception filter with safe Prisma error normalization
- Structured validation error details
- Safe production error behavior without stack traces or secrets

## Error Responses

All API errors use this standard shape:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Unauthorized.",
  "path": "/api/v1/users/me",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-07-13T00:00:00.000Z"
}
```

Validation failures return `400` with structured `details`:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/v1/auth/register",
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "timestamp": "2026-07-13T00:00:00.000Z",
  "details": [
    {
      "field": "email",
      "messages": [
        "email must be an email"
      ]
    }
  ]
}
```

### Request ID

- Clients may send `x-request-id` with any non-empty string.
- When omitted, the API generates a UUID with `crypto.randomUUID()`.
- The same value is attached to the request and returned in the `x-request-id` response header.

### Safe Production Errors

- Stack traces are never returned.
- Raw Prisma errors, database hostnames, model names and secrets are never exposed.
- Unknown server errors return `500` with `An unexpected error occurred.`

### HTTP Status Examples

| Scenario | Status | `error` |
|----------|--------|---------|
| Validation failure | `400` | `Bad Request` |
| Missing or invalid access token | `401` | `Unauthorized` |
| Insufficient role | `403` | `Forbidden` |
| Missing record | `404` | `Not Found` |
| Duplicate email | `409` | `Conflict` |
| Unexpected server error | `500` | `Internal Server Error` |
| Database unavailable | `503` | `Service Unavailable` |
| Rate limit exceeded | `429` | `Too Many Requests` |

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
| `POSTGRES_HOST_PORT` | Host port for development PostgreSQL | `5432` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/nestjs_starter?schema=public` |
| `JWT_ACCESS_SECRET` | Access-token signing secret (min 32 chars) | placeholder in `.env.example` |
| `JWT_ACCESS_EXPIRES_IN` | Access-token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret (min 32 chars) | placeholder in `.env.example` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh-token lifetime | `7d` |
| `THROTTLE_TTL_MS` | General rate-limit window in milliseconds | `60000` |
| `THROTTLE_LIMIT` | Maximum general API requests per window | `100` |
| `AUTH_THROTTLE_TTL_MS` | Authentication rate-limit window in milliseconds | `60000` |
| `AUTH_THROTTLE_LIMIT` | Maximum auth requests per window | `10` |
| `TRUST_PROXY` | Enable Express trust proxy behind a reverse proxy | `false` |

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

If port `5432` is already in use on your machine, override the host port without editing `docker-compose.yml`:

```powershell
$env:POSTGRES_HOST_PORT="5434"
docker compose up -d
```

Then point `DATABASE_URL` in `.env` to the same host port.

Apply database migrations:

```bash
npx prisma migrate dev --name init_user_and_refresh_session
```

Generate the Prisma client:

```bash
npm run prisma:generate
```

Apply production migrations on a deployed environment:

```bash
npm run prisma:migrate:deploy
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
npm run lint:fix
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

## Sprint 5 — Reliability and Error Handling (Complete)

- Global `x-request-id` middleware
- Standardized API error response format
- Global exception filter
- Structured validation error details
- Safe Prisma error normalization
- Reliability unit and e2e tests

## Sprint 6 — Structured Application Logging (Complete)

- HTTP request-completion logging middleware
- Structured JSON log entries with request ID correlation
- Built-in NestJS `Logger` usage
- Server-side logging for unknown and infrastructure errors
- Safe application startup logging
- Logging unit and e2e tests

## Sprint 7 — HTTP Security and Rate Limiting (Complete)

- Helmet security headers with Swagger-compatible CSP
- Global response compression
- General and authentication-specific rate limiting
- Standardized `429 Too Many Requests` responses
- Optional `TRUST_PROXY` for reverse-proxy deployments
- Explicit CORS-disabled posture
- Security and throttling unit and e2e tests

## Sprint 8 — Production Docker (Complete)

- Multi-stage production Dockerfile on Node 22 LTS slim
- `.dockerignore` for lean build contexts
- Non-root production runtime user
- Production Compose stack for API and PostgreSQL
- `.env.production.example` with documented placeholders
- One-off `prisma migrate deploy` workflow
- Node-based production API health checks
- Docker configuration unit tests
