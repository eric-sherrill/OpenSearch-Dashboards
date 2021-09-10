/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
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

/*
 * Modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

import React from 'react';
import { injectedMetadataServiceMock } from '../../../public/mocks';
import { httpServiceMock } from '../../http/http_service.mock';
import { Template } from './template';
import { renderWithIntl } from 'test_utils/enzyme_helpers';

const http = httpServiceMock.createStartContract();
const injectedMetadata = injectedMetadataServiceMock.createSetupContract();

function mockProps() {
  return {
    uiPublicUrl: `${http.basePath}/ui`,
    locale: '',
    darkMode: true,
    i18n: () => '',
    bootstrapScriptUrl: `${http.basePath}/bootstrap.js`,
    strictCsp: true,
    injectedMetadata: {
      version: injectedMetadata.getOpenSearchDashboardsVersion(),
      buildNumber: 1,
      branch: injectedMetadata.getBasePath(),
      basePath: '',
      serverBasePath: '',
      env: {
        packageInfo: {
          version: '',
          branch: '',
          buildNum: 1,
          buildSha: '',
          dist: true,
        },
        mode: {
          name: 'production' as 'development' | 'production',
          dev: true,
          prod: false,
        },
      },
      anonymousStatusPage: injectedMetadata.getAnonymousStatusPage(),
      i18n: { translationsUrl: '' },
      csp: injectedMetadata.getCspConfig(),
      vars: injectedMetadata.getInjectedVars(),
      uiPlugins: injectedMetadata.getPlugins(),
      legacyMetadata: {
        uiSettings: {
          defaults: { legacyInjectedUiSettingDefaults: true },
          user: {},
        },
      },
      branding: injectedMetadata.getBranding(),
    },
  };
}

describe('Template', () => {
  it('renders with default OpenSearch loading logo', () => {
    const branding = {
      title: '',
    };
    injectedMetadata.getBranding.mockReturnValue(branding);
    const component = renderWithIntl(<Template metadata={mockProps()} />);
    expect(component).toMatchSnapshot();
  });

  it('renders with static logo with horizontal loading bar', () => {
    const branding = {
      logoUrl: '/',
      title: '',
    };
    injectedMetadata.getBranding.mockReturnValue(branding);
    const component = renderWithIntl(<Template metadata={mockProps()} />);
    expect(component).toMatchSnapshot();
  });

  it('renders with customized loading logo', () => {
    const branding = {
      logoUrl: '/',
      loadingLogoUrl: '/',
      title: '',
    };
    injectedMetadata.getBranding.mockReturnValue(branding);
    const component = renderWithIntl(<Template metadata={mockProps()} />);
    expect(component).toMatchSnapshot();
  });
});
