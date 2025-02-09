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

import { i18n } from '@osd/i18n';
import {
  getFormatService,
  getNotifications,
  getOpenSearchDashboardsLegacy,
} from './opensearch_dashboards_services';
import { truncatedColorMaps } from '../../charts/public';
import { tooltipFormatter } from './tooltip_formatter';
import { mapTooltipProvider, ORIGIN, lazyLoadMapsLegacyModules } from '../../maps_legacy/public';

export function createRegionMapVisualization({
  regionmapsConfig,
  uiSettings,
  BaseMapsVisualization,
  getServiceSettings,
}) {
  return class RegionMapsVisualization extends BaseMapsVisualization {
    constructor(container, vis) {
      super(container, vis);
      this._vis = this.vis;
      this._choroplethLayer = null;
      this._tooltipFormatter = mapTooltipProvider(container, tooltipFormatter);
    }

    async render(opensearchResponse, visParams) {
      getOpenSearchDashboardsLegacy().loadFontAwesome();
      await super.render(opensearchResponse, visParams);
      if (this._choroplethLayer) {
        await this._choroplethLayer.whenDataLoaded();
      }
    }

    async _updateData(table) {
      this._chartData = table;
      const termColumn = this._params.bucket ? table.columns[this._params.bucket.accessor] : null;
      const valueColumn = table.columns[this._params.metric.accessor];
      let results;
      if (!this._hasColumns() || !table.rows.length) {
        results = [];
      } else {
        results = table.rows.map((row) => {
          const term = row[termColumn.id];
          const value = row[valueColumn.id];
          return { term: term, value: value };
        });
      }

      const selectedLayer = await this._loadConfig(this._params.selectedLayer);
      if (!this._params.selectedJoinField && selectedLayer) {
        this._params.selectedJoinField = selectedLayer.fields[0];
      }

      if (!selectedLayer) {
        return;
      }

      await this._updateChoroplethLayerForNewMetrics(
        selectedLayer.name,
        selectedLayer.attribution,
        this._params.showAllShapes,
        results
      );

      const metricFieldFormatter = getFormatService().deserialize(this._params.metric.format);

      this._choroplethLayer.setMetrics(results, metricFieldFormatter, valueColumn.name);
      if (termColumn && valueColumn) {
        this._choroplethLayer.setTooltipFormatter(
          this._tooltipFormatter,
          metricFieldFormatter,
          termColumn.name,
          valueColumn.name
        );
      }

      this._opensearchDashboardsMap.useUiStateFromVisualization(this._vis);
    }

    async _loadConfig(fileLayerConfig) {
      // Load the selected layer from the metadata-service.
      // Do not use the selectedLayer from the visState.
      // These settings are stored in the URL and can be used to inject dirty display content.

      const { escape } = await import('lodash');

      if (
        fileLayerConfig.isEMS || //Hosted by EMS. Metadata needs to be resolved through EMS
        (fileLayerConfig.layerId && fileLayerConfig.layerId.startsWith(`${ORIGIN.EMS}.`)) //fallback for older saved objects
      ) {
        const serviceSettings = await getServiceSettings();
        return await serviceSettings.loadFileLayerConfig(fileLayerConfig);
      }

      //Configured in the opensearch_dashboards.yml. Needs to be resolved through the settings.
      const configuredLayer = regionmapsConfig.layers.find(
        (layer) => layer.name === fileLayerConfig.name
      );

      if (configuredLayer) {
        return {
          ...configuredLayer,
          attribution: escape(configuredLayer.attribution ? configuredLayer.attribution : ''),
        };
      }

      return null;
    }

    async _updateParams() {
      await super._updateParams();

      const selectedLayer = await this._loadConfig(this._params.selectedLayer);

      if (!this._params.selectedJoinField && selectedLayer) {
        this._params.selectedJoinField = selectedLayer.fields[0];
      }

      if (!this._params.selectedJoinField || !selectedLayer) {
        return;
      }

      await this._updateChoroplethLayerForNewProperties(
        selectedLayer.name,
        selectedLayer.attribution,
        this._params.showAllShapes
      );

      const metricFieldFormatter = getFormatService().deserialize(this._params.metric.format);

      this._choroplethLayer.setJoinField(this._params.selectedJoinField.name);
      this._choroplethLayer.setColorRamp(truncatedColorMaps[this._params.colorSchema].value);
      this._choroplethLayer.setLineWeight(this._params.outlineWeight);
      this._choroplethLayer.setTooltipFormatter(
        this._tooltipFormatter,
        metricFieldFormatter,
        this._metricLabel
      );
    }

    async _updateChoroplethLayerForNewMetrics(name, attribution, showAllData, newMetrics) {
      if (
        this._choroplethLayer &&
        this._choroplethLayer.canReuseInstanceForNewMetrics(name, showAllData, newMetrics)
      ) {
        return;
      }
      await this._recreateChoroplethLayer(name, attribution, showAllData);
    }

    async _updateChoroplethLayerForNewProperties(name, attribution, showAllData) {
      if (this._choroplethLayer && this._choroplethLayer.canReuseInstance(name, showAllData)) {
        return;
      }
      await this._recreateChoroplethLayer(name, attribution, showAllData);
    }

    async _recreateChoroplethLayer(name, attribution, showAllData) {
      const selectedLayer = await this._loadConfig(this._params.selectedLayer);
      this._opensearchDashboardsMap.removeLayer(this._choroplethLayer);

      if (this._choroplethLayer) {
        this._choroplethLayer = this._choroplethLayer.cloneChoroplethLayerForNewData(
          name,
          attribution,
          selectedLayer.format,
          showAllData,
          selectedLayer.meta,
          selectedLayer,
          await getServiceSettings(),
          (await lazyLoadMapsLegacyModules()).L
        );
      } else {
        const { ChoroplethLayer } = await import('./choropleth_layer');
        this._choroplethLayer = new ChoroplethLayer(
          name,
          attribution,
          selectedLayer.format,
          showAllData,
          selectedLayer.meta,
          selectedLayer,
          await getServiceSettings(),
          (await lazyLoadMapsLegacyModules()).L
        );
      }

      this._choroplethLayer.on('select', (event) => {
        const { rows, columns } = this._chartData;
        const rowIndex = rows.findIndex((row) => row[columns[0].id] === event);
        this._vis.API.events.filter({
          table: this._chartData,
          column: 0,
          row: rowIndex,
          value: event,
        });
      });

      this._choroplethLayer.on('styleChanged', (event) => {
        const shouldShowWarning =
          this._params.isDisplayWarning && uiSettings.get('visualization:regionmap:showWarnings');
        if (event.mismatches.length > 0 && shouldShowWarning) {
          getNotifications().toasts.addWarning({
            title: i18n.translate('regionMap.visualization.unableToShowMismatchesWarningTitle', {
              defaultMessage:
                'Unable to show {mismatchesLength} {oneMismatch, plural, one {result} other {results}} on map',
              values: {
                mismatchesLength: event.mismatches.length,
                oneMismatch: event.mismatches.length > 1 ? 0 : 1,
              },
            }),
            text: i18n.translate('regionMap.visualization.unableToShowMismatchesWarningText', {
              defaultMessage:
                "Ensure that each of these term matches a shape on that shape's join field: {mismatches}",
              values: {
                mismatches: event.mismatches ? event.mismatches.join(', ') : '',
              },
            }),
          });
        }
      });

      this._opensearchDashboardsMap.addLayer(this._choroplethLayer);
    }

    _hasColumns() {
      return this._chartData && this._chartData.columns.length === 2;
    }
  };
}
