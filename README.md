# NestJS Production Starter

A production-oriented NestJS backend starter built with TypeScript, PostgreSQL, Prisma, JWT and Docker.

## Status

The project currently contains only a verified NestJS baseline (Sprint 0).

Prisma, authentication, Swagger, Docker and database features are planned for later sprints and are not implemented yet.

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

## Installation

```bash
npm install
```

## Development

```bash
npm run start:dev
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
- Default `GET /` endpoint responds successfully
- Project scope and AI development rules defined in `PROJECT_SPEC.md` and `.cursor/rules/project.mdc`
