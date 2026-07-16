import { HelmetOptions } from 'helmet';

/**
 * Helmet configuration for API and Swagger UI.
 *
 * CSP trade-off: Swagger UI requires inline scripts and styles. Allowing
 * 'unsafe-inline' for scriptSrc and styleSrc is the minimum practical
 * adjustment for a self-hosted /docs page. All other CSP directives remain
 * restrictive.
 */
export function createHelmetOptions(): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https://validator.swagger.io'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hidePoweredBy: true,
  };
}
