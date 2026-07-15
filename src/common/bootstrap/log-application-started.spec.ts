import { buildApplicationStartedLog } from './log-application-started';

describe('buildApplicationStartedLog', () => {
  it('builds safe startup log data without secrets', () => {
    const log = buildApplicationStartedLog({
      port: 3000,
      apiPrefix: 'api',
      apiVersion: '1',
      environment: 'development',
    });

    expect(log).toEqual({
      event: 'application_started',
      port: 3000,
      apiPrefix: 'api',
      apiVersion: '1',
      environment: 'development',
    });

    const serialized = JSON.stringify(log);
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toContain('JWT_ACCESS_SECRET');
    expect(serialized).not.toContain('postgres');
  });
});
