import { Logger } from '@nestjs/common';
import { ApplicationStartedLog } from '../logging/logging.types';

export function buildApplicationStartedLog(config: {
  port: number;
  apiPrefix: string;
  apiVersion: string;
  environment: string;
}): ApplicationStartedLog {
  return {
    event: 'application_started',
    port: config.port,
    apiPrefix: config.apiPrefix,
    apiVersion: config.apiVersion,
    environment: config.environment,
  };
}

export function logApplicationStarted(
  logger: Logger,
  config: {
    port: number;
    apiPrefix: string;
    apiVersion: string;
    environment: string;
  },
): void {
  logger.log(JSON.stringify(buildApplicationStartedLog(config)));
}
