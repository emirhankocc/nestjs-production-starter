import { readFileSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), 'utf8');
}

describe('Production Docker configuration', () => {
  const dockerfile = readProjectFile('Dockerfile');
  const dockerignore = readProjectFile('.dockerignore');
  const productionCompose = readProjectFile('docker-compose.production.yml');

  it('uses a multi-stage Dockerfile', () => {
    expect(dockerfile).toMatch(/FROM .+ AS dependencies/i);
    expect(dockerfile).toMatch(/FROM .+ AS build/i);
    expect(dockerfile).toMatch(/FROM .+ AS production/i);
  });

  it('runs the compiled application as a non-root user', () => {
    expect(dockerfile).toMatch(/USER nestjs/i);
    expect(dockerfile).toMatch(/CMD \["node", "dist\/src\/main\.js"\]/);
    expect(dockerfile).not.toMatch(/USER root/i);
    expect(dockerfile).not.toMatch(/start:dev/);
  });

  it('uses migrate deploy tooling instead of development migration commands', () => {
    expect(dockerfile).toMatch(/prisma@7\.8\.0/);
    expect(dockerfile).not.toMatch(/prisma migrate dev/);
    expect(dockerfile).not.toMatch(/prisma db push/);
  });

  it('excludes local environment files from the Docker build context', () => {
    expect(dockerignore).toMatch(/^\.env$/m);
    expect(dockerignore).toMatch(/^\.env\.\*$/m);
  });

  it('does not expose demo PostgreSQL credentials directly in production Compose', () => {
    expect(productionCompose).toMatch(/\$\{POSTGRES_PASSWORD\}/);
    expect(productionCompose).not.toMatch(/POSTGRES_PASSWORD:\s*postgres\b/);
  });

  it('defines API and PostgreSQL health checks in production Compose', () => {
    expect(productionCompose).toMatch(/healthcheck:/g);
    expect(productionCompose).toMatch(/pg_isready/);
    expect(productionCompose).toMatch(/docker-healthcheck\.mjs/);
  });

  it('does not mount source code in the production API service', () => {
    const apiSection = productionCompose.split('api:')[1] ?? '';

    expect(apiSection).not.toMatch(/type:\s*bind/);
    expect(apiSection).not.toMatch(/\/src:/);
    expect(apiSection).not.toMatch(/node_modules:/);
  });

  it('does not publish PostgreSQL publicly by default in production Compose', () => {
    const postgresSection = productionCompose.split('api:')[0];

    expect(postgresSection).not.toMatch(/^\s*ports:/m);
  });
});
