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

import { PluginFunctionalProviderContext } from 'test/plugin_functional/services';

export const testDashboardInput = {
  panels: {
    '1': {
      gridData: {
        w: 24,
        h: 15,
        x: 0,
        y: 15,
        i: '1',
      },
      type: 'HELLO_WORLD_EMBEDDABLE',
      explicitInput: {
        id: '1',
      },
    },
    '822cd0f0-ce7c-419d-aeaa-1171cf452745': {
      gridData: {
        w: 24,
        h: 15,
        x: 0,
        y: 0,
        i: '822cd0f0-ce7c-419d-aeaa-1171cf452745',
      },
      type: 'visualization',
      explicitInput: {
        id: '822cd0f0-ce7c-419d-aeaa-1171cf452745',
        savedObjectId: '3fe22200-3dcb-11e8-8660-4d65aa086b3c',
      },
    },
    '66f0a265-7b06-4974-accd-d05f74f7aa82': {
      gridData: {
        w: 24,
        h: 15,
        x: 24,
        y: 0,
        i: '66f0a265-7b06-4974-accd-d05f74f7aa82',
      },
      type: 'visualization',
      explicitInput: {
        id: '66f0a265-7b06-4974-accd-d05f74f7aa82',
        savedObjectId: '4c0f47e0-3dcd-11e8-8660-4d65aa086b3c',
      },
    },
    'b2861741-40b9-4dc8-b82b-080c6e29a551': {
      gridData: {
        w: 24,
        h: 15,
        x: 0,
        y: 15,
        i: 'b2861741-40b9-4dc8-b82b-080c6e29a551',
      },
      type: 'search',
      explicitInput: {
        id: 'b2861741-40b9-4dc8-b82b-080c6e29a551',
        savedObjectId: 'be5accf0-3dca-11e8-8660-4d65aa086b3c',
      },
    },
  },
  isEmbeddedExternally: false,
  isFullScreenMode: false,
  filters: [],
  useMargins: true,
  id: '',
  hidePanelTitles: false,
  query: {
    query: '',
    language: 'kuery',
  },
  timeRange: {
    from: '2017-10-01T20:20:36.275Z',
    to: '2019-02-04T21:20:55.548Z',
  },
  refreshConfig: {
    value: 0,
    pause: true,
  },
  viewMode: 'edit',
  lastReloadRequestTime: 1556569306103,
  title: 'New Dashboard',
  description: '',
};

// eslint-disable-next-line import/no-default-export
export default function ({ getService, getPageObjects }: PluginFunctionalProviderContext) {
  const opensearchArchiver = getService('opensearchArchiver');
  const testSubjects = getService('testSubjects');
  const pieChart = getService('pieChart');
  const browser = getService('browser');
  const dashboardExpect = getService('dashboardExpect');
  const PageObjects = getPageObjects(['common']);

  describe('dashboard container', () => {
    before(async () => {
      await opensearchArchiver.loadIfNeeded(
        '../functional/fixtures/opensearch_archiver/dashboard/current/data'
      );
      await opensearchArchiver.loadIfNeeded(
        '../functional/fixtures/opensearch_archiver/dashboard/current/opensearch_dashboards'
      );
      await PageObjects.common.navigateToApp('dashboardEmbeddableExamples');
      await testSubjects.click('dashboardEmbeddableByValue');
      await updateInput(JSON.stringify(testDashboardInput, null, 4));
    });

    it('pie charts', async () => {
      await pieChart.expectPieSliceCount(5);
    });

    it('markdown', async () => {
      await dashboardExpect.markdownWithValuesExists(["I'm a markdown!"]);
    });

    it('saved search', async () => {
      await dashboardExpect.savedSearchRowCount(50);
    });
  });

  async function updateInput(input: string) {
    const editorWrapper = await (
      await testSubjects.find('dashboardEmbeddableByValueInputEditor')
    ).findByClassName('ace_editor');
    const editorId = await editorWrapper.getAttribute('id');
    await browser.execute(
      (_editorId: string, _input: string) => {
        return (window as any).ace.edit(_editorId).setValue(_input);
      },
      editorId,
      input
    );
    await testSubjects.click('dashboardEmbeddableByValueInputSubmit');
  }
}
