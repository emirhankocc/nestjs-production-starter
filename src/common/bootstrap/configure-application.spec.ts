import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import { configureApplication } from './configure-application';
import { configureSecurityMiddleware } from './configure-security.middleware';
import { createHelmetOptions } from '../security/helmet.config';

jest.mock('helmet', () => jest.fn(() => jest.fn()));
jest.mock('compression', () => jest.fn(() => jest.fn()));

const mockedHelmet = jest.mocked(helmet);
const mockedCompression = jest.mocked(compression);

describe('configureSecurityMiddleware', () => {
  let app: NestExpressApplication;
  let setMock: jest.Mock;
  let useMock: jest.Mock;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    setMock = jest.fn();
    useMock = jest.fn();

    app = {
      set: setMock,
      use: useMock,
    } as unknown as NestExpressApplication;

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'TRUST_PROXY') {
          return defaultValue ?? false;
        }

        return defaultValue;
      }),
    };
  });

  it('does not enable trust proxy by default', () => {
    configureSecurityMiddleware(app, configService as unknown as ConfigService);

    expect(setMock).not.toHaveBeenCalled();
  });

  it('enables trust proxy only when TRUST_PROXY is true', () => {
    configService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        if (key === 'TRUST_PROXY') {
          return true;
        }

        return defaultValue;
      },
    );

    configureSecurityMiddleware(app, configService as unknown as ConfigService);

    expect(setMock).toHaveBeenCalledWith('trust proxy', 1);
  });

  it('registers helmet and compression middleware', () => {
    configureSecurityMiddleware(app, configService as unknown as ConfigService);

    expect(mockedHelmet).toHaveBeenCalledWith(createHelmetOptions());
    expect(mockedCompression).toHaveBeenCalledWith();
    expect(useMock).toHaveBeenCalledTimes(2);
  });
});

describe('configureApplication', () => {
  let app: INestApplication;
  let setGlobalPrefixSpy: jest.SpyInstance;
  let enableVersioningSpy: jest.SpyInstance;
  let useGlobalFiltersSpy: jest.SpyInstance;
  let useGlobalPipesSpy: jest.SpyInstance;
  let useSpy: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    const expressApp = app as NestExpressApplication;

    setGlobalPrefixSpy = jest
      .spyOn(app, 'setGlobalPrefix')
      .mockImplementation(() => app);
    enableVersioningSpy = jest
      .spyOn(app, 'enableVersioning')
      .mockImplementation(() => app);
    useGlobalFiltersSpy = jest
      .spyOn(app, 'useGlobalFilters')
      .mockImplementation(() => app);
    useGlobalPipesSpy = jest
      .spyOn(app, 'useGlobalPipes')
      .mockImplementation(() => app);
    useSpy = jest.spyOn(expressApp, 'use').mockImplementation(() => expressApp);
  });

  it('applies security middleware before global application configuration', () => {
    configureApplication(app, {
      get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
    } as unknown as ConfigService);

    expect(useSpy).toHaveBeenCalled();
    expect(setGlobalPrefixSpy).toHaveBeenCalledWith('api');
    expect(enableVersioningSpy).toHaveBeenCalled();
    expect(useGlobalFiltersSpy).toHaveBeenCalled();
    expect(useGlobalPipesSpy).toHaveBeenCalled();
  });
});
