# Project Specification

## Project Name

NestJS Production Starter

## Goal

Build a reusable, production-oriented backend starter using NestJS, TypeScript, PostgreSQL, Prisma and Docker.

The project demonstrates backend architecture, authentication, authorization, validation, testing, API documentation and automated quality checks.

## Target Users

- Backend developers
- Full-stack developers
- SaaS developers
- Small software teams
- Developers learning production-oriented NestJS practices

## Version 1 Features

- Environment configuration and validation
- PostgreSQL integration
- Prisma ORM
- User registration
- User login
- JWT access tokens
- Refresh-token rotation
- Secure logout
- Password hashing
- USER and ADMIN roles
- Protected profile endpoint
- Admin-only endpoint
- Request validation
- Centralized exception handling
- Swagger documentation
- Health-check endpoint
- Docker Compose development environment
- Unit and integration tests
- GitHub Actions CI

## Non-Goals for Version 1

- Microservices
- Redis
- Message queues
- Kafka
- Kubernetes
- Social authentication
- Email verification
- Password reset
- Multi-factor authentication
- File uploads
- Payment processing
- Notification systems

## Technical Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- JWT
- Docker Compose
- Jest
- Swagger
- GitHub Actions

## Security Requirements

- Passwords must never be stored as plain text.
- Refresh tokens must never be stored as plain text.
- Secrets must never be committed.
- Input must be validated.
- Authorization must be enforced on the backend.
- Database models must not be returned directly from API endpoints.
- Authentication failure messages must not expose sensitive details.

## Quality Requirements

- Every completed sprint must pass lint, test and build.
- Unnecessary dependencies must not be installed.
- Modules must have clear responsibilities.
- Important authentication flows must be tested.
- Public endpoints and DTOs must be documented.
- Implementation decisions must be explainable in a technical interview.

## AI-Assisted Development

AI tools may be used for planning, implementation support, debugging and code review.

Architecture decisions, testing, verification and final responsibility remain with the project author.
