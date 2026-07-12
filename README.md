# NestJS Production Starter

A production-oriented NestJS backend starter built with TypeScript, PostgreSQL, Prisma, JWT and Docker.

## Status

Sprint 2 (Database Foundation) is complete.

The project currently provides environment configuration, API versioning, request validation, Swagger documentation, PostgreSQL via Docker Compose, Prisma ORM integration and a database-aware health-check endpoint.

Authentication, authorization and user endpoints are planned for later sprints and are not implemented yet.

## Current Functionality (Sprint 2)

- Environment configuration with `@nestjs/config`
- Startup validation of environment variables with Joi
- Global API prefix and URI versioning
- Global `ValidationPipe` with whitelist and transformation
- Swagger API documentation at `/docs`
- PostgreSQL development database via Docker Compose
- Prisma ORM with `User` and `RefreshSession` models
- Initial database migration
- Global `PrismaService` with lifecycle-managed connections
- Health-check endpoint with database connectivity status at `GET /api/v1/health`

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
