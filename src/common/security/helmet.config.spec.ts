import { createHelmetOptions } from './helmet.config';

describe('createHelmetOptions', () => {
  it('enables CSP with the minimum Swagger-compatible directives', () => {
    const options = createHelmetOptions();

    expect(options.contentSecurityPolicy).toBeDefined();
    expect(JSON.stringify(options)).toContain("'unsafe-inline'");
    expect(JSON.stringify(options)).toContain("'none'");
  });

  it('hides framework information and relaxes COEP for Swagger', () => {
    const options = createHelmetOptions();

    expect(options.hidePoweredBy).toBe(true);
    expect(options.crossOriginEmbedderPolicy).toBe(false);
  });
});
