import { readFileSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '..', '..');

function readProjectFile(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), 'utf8');
}

describe('GitHub Actions CI workflow', () => {
  const workflow = readProjectFile('.github/workflows/ci.yml');

  it('triggers on push and pull_request to main', () => {
    expect(workflow).toMatch(/on:\s*\n\s*push:/);
    expect(workflow).toMatch(/pull_request:/);
    expect(workflow).toMatch(/branches:\s*\n\s*- main/);
  });

  it('uses read-only permissions and concurrency cancellation', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(workflow).toMatch(/concurrency:/);
    expect(workflow).toMatch(/cancel-in-progress: true/);
  });

  it('runs quality checks with npm ci and prisma migrate deploy', () => {
    expect(workflow).toMatch(/run: npm ci/);
    expect(workflow).toMatch(/run: npx prisma migrate deploy/);
    expect(workflow).not.toMatch(/npm install/);
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(workflow).not.toMatch(/pull_request_target/);
  });

  it('configures PostgreSQL 16 with CI-safe environment values', () => {
    expect(workflow).toMatch(/image: postgres:16/);
    expect(workflow).toMatch(
      /DATABASE_URL: postgresql:\/\/postgres:postgres@localhost:5432\/nestjs_starter\?schema=public/,
    );
    expect(workflow).toMatch(
      /JWT_ACCESS_SECRET: ci-access-secret-at-least-32-characters-long/,
    );
    expect(workflow).not.toMatch(/\$\{\{ secrets\./);
  });

  it('sets job timeouts and runs docker build after quality', () => {
    expect(workflow).toMatch(/timeout-minutes: 15/);
    expect(workflow).toMatch(/timeout-minutes: 20/);
    expect(workflow).toMatch(/needs: quality/);
    expect(workflow).toMatch(/docker build -t nestjs-production-starter:ci \./);
    expect(workflow).not.toMatch(/setup-buildx-action/);
    expect(workflow).not.toMatch(/push: true/);
    expect(workflow).not.toMatch(/docker push/);
  });
});
