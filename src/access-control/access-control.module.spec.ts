import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { AccessControlModule } from './access-control.module';
import { AccessTokenGuard } from './guards/access-token.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthModule } from '../auth/auth.module';

function collectTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function readModuleImports(modulePath: string): string[] {
  const source = readFileSync(modulePath, 'utf8');
  const importMatches = source.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g);

  return [...importMatches].map((match) => match[1]);
}

describe('AccessControlModule boundaries', () => {
  it('does not import AuthModule, UsersModule or AdminModule', () => {
    const imports = readModuleImports(
      join(__dirname, 'access-control.module.ts'),
    );

    expect(imports).not.toContain('../auth/auth.module');
    expect(imports).not.toContain('../users/users.module');
    expect(imports).not.toContain('../admin/admin.module');
  });

  it('exports AccessTokenGuard and RolesGuard providers', () => {
    const metadata = Reflect.getMetadata('exports', AccessControlModule) as
      unknown[] | undefined;

    expect(metadata).toEqual(
      expect.arrayContaining([AccessTokenGuard, RolesGuard]),
    );
  });

  it('keeps AuthModule independent from AccessControlModule', () => {
    const imports = readModuleImports(
      join(__dirname, '../auth/auth.module.ts'),
    );

    expect(imports).not.toContain('../access-control/access-control.module');
  });

  it('contains no forwardRef usage under src/', () => {
    const srcDirectory = join(__dirname, '..');
    const sourceFiles = collectTypeScriptFiles(srcDirectory);
    const forwardRefUsages = sourceFiles
      .filter((filePath) => !filePath.endsWith('.spec.ts'))
      .map((filePath) => ({
        filePath,
        content: readFileSync(filePath, 'utf8'),
      }))
      .filter(({ content }) => /\bforwardRef\s*\(/.test(content));

    expect(forwardRefUsages).toEqual([]);
  });

  it('registers AuthModule without AccessControlModule in its import graph', () => {
    const authImports = Reflect.getMetadata('imports', AuthModule) as
      unknown[] | undefined;

    expect(authImports ?? []).not.toContain(AccessControlModule);
  });
});
