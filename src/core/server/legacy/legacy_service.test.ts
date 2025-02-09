/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

jest.mock('../../../legacy/server/osd_server');
jest.mock('./cluster_manager');

import { BehaviorSubject, throwError } from 'rxjs';
import { REPO_ROOT } from '@osd/dev-utils';

// @ts-expect-error js file to remove TS dependency on cli
import { ClusterManager as MockClusterManager } from './cluster_manager';
import OsdServer from '../../../legacy/server/osd_server';
import { Config, Env, ObjectToConfigAdapter } from '../config';
import { BasePathProxyServer } from '../http';
import { DiscoveredPlugin } from '../plugins';

import { getEnvOptions, configServiceMock } from '../config/mocks';
import { loggingSystemMock } from '../logging/logging_system.mock';
import { contextServiceMock } from '../context/context_service.mock';
import { httpServiceMock } from '../http/http_service.mock';
import { uiSettingsServiceMock } from '../ui_settings/ui_settings_service.mock';
import { savedObjectsServiceMock } from '../saved_objects/saved_objects_service.mock';
import { capabilitiesServiceMock } from '../capabilities/capabilities_service.mock';
import { httpResourcesMock } from '../http_resources/http_resources_service.mock';
import { setupMock as renderingServiceMock } from '../rendering/__mocks__/rendering_service';
import { environmentServiceMock } from '../environment/environment_service.mock';
import { LegacyServiceSetupDeps, LegacyServiceStartDeps } from './types';
import { LegacyService } from './legacy_service';
import { coreMock } from '../mocks';
import { statusServiceMock } from '../status/status_service.mock';
import { auditTrailServiceMock } from '../audit_trail/audit_trail_service.mock';
import { loggingServiceMock } from '../logging/logging_service.mock';
import { metricsServiceMock } from '../metrics/metrics_service.mock';

const MockOsdServer: jest.Mock<OsdServer> = OsdServer as any;

let coreId: symbol;
let env: Env;
let config$: BehaviorSubject<Config>;

let setupDeps: LegacyServiceSetupDeps;

let startDeps: LegacyServiceStartDeps;

const logger = loggingSystemMock.create();
let configService: ReturnType<typeof configServiceMock.create>;
let environmentSetup: ReturnType<typeof environmentServiceMock.createSetupContract>;

beforeEach(() => {
  coreId = Symbol();
  env = Env.createDefault(REPO_ROOT, getEnvOptions());
  configService = configServiceMock.create();
  environmentSetup = environmentServiceMock.createSetupContract();

  MockOsdServer.prototype.ready = jest.fn().mockReturnValue(Promise.resolve());
  MockOsdServer.prototype.listen = jest.fn();

  setupDeps = {
    core: {
      capabilities: capabilitiesServiceMock.createSetupContract(),
      context: contextServiceMock.createSetupContract(),
      opensearch: { legacy: {} } as any,
      uiSettings: uiSettingsServiceMock.createSetupContract(),
      http: {
        ...httpServiceMock.createInternalSetupContract(),
        auth: {
          getAuthHeaders: () => undefined,
        } as any,
      },
      httpResources: httpResourcesMock.createSetupContract(),
      savedObjects: savedObjectsServiceMock.createInternalSetupContract(),
      plugins: {
        initialized: true,
        contracts: new Map([['plugin-id', 'plugin-value']]),
      },
      rendering: renderingServiceMock,
      environment: environmentSetup,
      status: statusServiceMock.createInternalSetupContract(),
      auditTrail: auditTrailServiceMock.createSetupContract(),
      logging: loggingServiceMock.createInternalSetupContract(),
      metrics: metricsServiceMock.createInternalSetupContract(),
    },
    plugins: { 'plugin-id': 'plugin-value' },
    uiPlugins: {
      public: new Map([['plugin-id', {} as DiscoveredPlugin]]),
      internal: new Map([
        [
          'plugin-id',
          {
            requiredBundles: [],
            publicTargetDir: 'path/to/target/public',
            publicAssetsDir: '/plugins/name/assets/',
          },
        ],
      ]),
      browserConfigs: new Map(),
    },
  };

  startDeps = {
    core: {
      ...coreMock.createInternalStart(),
      plugins: { contracts: new Map() },
    },
    plugins: {},
  };

  config$ = new BehaviorSubject<Config>(
    new ObjectToConfigAdapter({
      opensearch: { hosts: ['http://127.0.0.1'] },
      server: { autoListen: true },
    })
  );

  configService.getConfig$.mockReturnValue(config$);
  configService.getUsedPaths.mockResolvedValue(['foo.bar']);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('once LegacyService is set up with connection info', () => {
  test('creates legacy osdServer and calls `listen`.', async () => {
    configService.atPath.mockReturnValue(new BehaviorSubject({ autoListen: true }));
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService,
    });

    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);

    expect(MockOsdServer).toHaveBeenCalledTimes(1);
    expect(MockOsdServer).toHaveBeenCalledWith(
      { path: { autoListen: true }, server: { autoListen: true } }, // Because of the mock, path also gets the value
      expect.objectContaining({ get: expect.any(Function) }),
      expect.any(Object)
    );
    expect(MockOsdServer.mock.calls[0][1].get()).toEqual(
      expect.objectContaining({
        path: expect.objectContaining({ autoListen: true }),
        server: expect.objectContaining({ autoListen: true }),
      })
    );

    const [mockOsdServer] = MockOsdServer.mock.instances;
    expect(mockOsdServer.listen).toHaveBeenCalledTimes(1);
    expect(mockOsdServer.close).not.toHaveBeenCalled();
  });

  test('creates legacy osdServer but does not call `listen` if `autoListen: false`.', async () => {
    configService.atPath.mockReturnValue(new BehaviorSubject({ autoListen: false }));

    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });
    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);

    expect(MockOsdServer).toHaveBeenCalledTimes(1);
    expect(MockOsdServer).toHaveBeenCalledWith(
      { path: { autoListen: false }, server: { autoListen: true } },
      expect.objectContaining({ get: expect.any(Function) }),
      expect.any(Object)
    );

    const legacyConfig = MockOsdServer.mock.calls[0][1].get();
    expect(legacyConfig.path.autoListen).toBe(false);
    expect(legacyConfig.server.autoListen).toBe(true);

    const [mockOsdServer] = MockOsdServer.mock.instances;
    expect(mockOsdServer.ready).toHaveBeenCalledTimes(1);
    expect(mockOsdServer.listen).not.toHaveBeenCalled();
    expect(mockOsdServer.close).not.toHaveBeenCalled();
  });

  test('creates legacy osdServer and closes it if `listen` fails.', async () => {
    configService.atPath.mockReturnValue(new BehaviorSubject({ autoListen: true }));
    MockOsdServer.prototype.listen.mockRejectedValue(new Error('something failed'));
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });

    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await expect(legacyService.start(startDeps)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"something failed"`
    );

    const [mockOsdServer] = MockOsdServer.mock.instances;
    expect(mockOsdServer.listen).toHaveBeenCalled();
    expect(mockOsdServer.close).toHaveBeenCalled();
  });

  test('throws if fails to retrieve initial config.', async () => {
    configService.getConfig$.mockReturnValue(throwError(new Error('something failed')));
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });

    await expect(legacyService.setupLegacyConfig()).rejects.toThrowErrorMatchingInlineSnapshot(
      `"something failed"`
    );
    await expect(legacyService.setup(setupDeps)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Legacy config not initialized yet. Ensure LegacyService.setupLegacyConfig() is called before LegacyService.setup()"`
    );
    await expect(legacyService.start(startDeps)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Legacy service is not setup yet."`
    );

    expect(MockOsdServer).not.toHaveBeenCalled();
    expect(MockClusterManager).not.toHaveBeenCalled();
  });

  test('reconfigures logging configuration if new config is received.', async () => {
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });
    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);

    const [mockOsdServer] = MockOsdServer.mock.instances as Array<jest.Mocked<OsdServer>>;
    expect(mockOsdServer.applyLoggingConfiguration).not.toHaveBeenCalled();

    config$.next(new ObjectToConfigAdapter({ logging: { verbose: true } }));

    expect(mockOsdServer.applyLoggingConfiguration.mock.calls).toMatchSnapshot(
      `applyLoggingConfiguration params`
    );
  });

  test('logs error if re-configuring fails.', async () => {
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });
    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);

    const [mockOsdServer] = MockOsdServer.mock.instances as Array<jest.Mocked<OsdServer>>;
    expect(mockOsdServer.applyLoggingConfiguration).not.toHaveBeenCalled();
    expect(loggingSystemMock.collect(logger).error).toEqual([]);

    const configError = new Error('something went wrong');
    mockOsdServer.applyLoggingConfiguration.mockImplementation(() => {
      throw configError;
    });

    config$.next(new ObjectToConfigAdapter({ logging: { verbose: true } }));

    expect(loggingSystemMock.collect(logger).error).toEqual([[configError]]);
  });

  test('logs error if config service fails.', async () => {
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });
    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);

    const [mockOsdServer] = MockOsdServer.mock.instances;
    expect(mockOsdServer.applyLoggingConfiguration).not.toHaveBeenCalled();
    expect(loggingSystemMock.collect(logger).error).toEqual([]);

    const configError = new Error('something went wrong');
    config$.error(configError);

    expect(mockOsdServer.applyLoggingConfiguration).not.toHaveBeenCalled();
    expect(loggingSystemMock.collect(logger).error).toEqual([[configError]]);
  });
});

describe('once LegacyService is set up without connection info', () => {
  let legacyService: LegacyService;
  beforeEach(async () => {
    legacyService = new LegacyService({ coreId, env, logger, configService: configService as any });
    await legacyService.setupLegacyConfig();
    await legacyService.setup(setupDeps);
    await legacyService.start(startDeps);
  });

  test('creates legacy osdServer with `autoListen: false`.', () => {
    expect(MockOsdServer).toHaveBeenCalledTimes(1);
    expect(MockOsdServer).toHaveBeenCalledWith(
      { path: {}, server: { autoListen: true } },
      expect.objectContaining({ get: expect.any(Function) }),
      expect.any(Object)
    );
    expect(MockOsdServer.mock.calls[0][1].get()).toEqual(
      expect.objectContaining({
        server: expect.objectContaining({ autoListen: true }),
      })
    );
  });

  test('reconfigures logging configuration if new config is received.', async () => {
    const [mockOsdServer] = MockOsdServer.mock.instances as Array<jest.Mocked<OsdServer>>;
    expect(mockOsdServer.applyLoggingConfiguration).not.toHaveBeenCalled();

    config$.next(new ObjectToConfigAdapter({ logging: { verbose: true } }));

    expect(mockOsdServer.applyLoggingConfiguration.mock.calls).toMatchSnapshot(
      `applyLoggingConfiguration params`
    );
  });
});

describe('once LegacyService is set up in `devClusterMaster` mode', () => {
  beforeEach(() => {
    configService.atPath.mockImplementation((path) => {
      return new BehaviorSubject(
        path === 'dev' ? { basePathProxyTargetPort: 100500 } : { basePath: '/abc' }
      );
    });
  });

  test('creates ClusterManager without base path proxy.', async () => {
    const devClusterLegacyService = new LegacyService({
      coreId,
      env: Env.createDefault(
        REPO_ROOT,
        getEnvOptions({
          cliArgs: { silent: true, basePath: false },
          isDevClusterMaster: true,
        })
      ),
      logger,
      configService: configService as any,
    });

    await devClusterLegacyService.setupLegacyConfig();
    await devClusterLegacyService.setup(setupDeps);
    await devClusterLegacyService.start(startDeps);

    expect(MockClusterManager).toHaveBeenCalledTimes(1);
    expect(MockClusterManager).toHaveBeenCalledWith(
      expect.objectContaining({ silent: true, basePath: false }),
      expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
      }),
      undefined
    );
  });

  test('creates ClusterManager with base path proxy.', async () => {
    const devClusterLegacyService = new LegacyService({
      coreId,
      env: Env.createDefault(
        REPO_ROOT,
        getEnvOptions({
          cliArgs: { quiet: true, basePath: true },
          isDevClusterMaster: true,
        })
      ),
      logger,
      configService: configService as any,
    });

    await devClusterLegacyService.setupLegacyConfig();
    await devClusterLegacyService.setup(setupDeps);
    await devClusterLegacyService.start(startDeps);

    expect(MockClusterManager).toHaveBeenCalledTimes(1);
    expect(MockClusterManager).toHaveBeenCalledWith(
      expect.objectContaining({ quiet: true, basePath: true }),
      expect.objectContaining({
        get: expect.any(Function),
        set: expect.any(Function),
      }),
      expect.any(BasePathProxyServer)
    );
  });
});

describe('start', () => {
  test('Cannot start without setup phase', async () => {
    const legacyService = new LegacyService({
      coreId,
      env,
      logger,
      configService: configService as any,
    });
    await expect(legacyService.start(startDeps)).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Legacy service is not setup yet."`
    );
  });
});

test('Sets the server.uuid property on the legacy configuration', async () => {
  configService.atPath.mockReturnValue(new BehaviorSubject({ autoListen: true }));
  const legacyService = new LegacyService({
    coreId,
    env,
    logger,
    configService: configService as any,
  });

  environmentSetup.instanceUuid = 'UUID_FROM_SERVICE';

  const { legacyConfig } = await legacyService.setupLegacyConfig();
  await legacyService.setup(setupDeps);

  expect(legacyConfig.get('server.uuid')).toBe('UUID_FROM_SERVICE');
});
