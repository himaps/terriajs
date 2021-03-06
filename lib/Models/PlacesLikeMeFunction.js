'use strict';

/*global require*/
var CatalogFunction = require('./CatalogFunction');
var CsvCatalogItem = require('./CsvCatalogItem');
var defined = require('terriajs-cesium/Source/Core/defined');
var defineProperties = require('terriajs-cesium/Source/Core/defineProperties');
var extendLoad = require('./extendLoad');
var inherit = require('../Core/inherit');
var invokeTerriaAnalyticsService = require('./invokeTerriaAnalyticsService');
var TerriaError = require('../Core/TerriaError');
var RegionDataParameter = require('./RegionDataParameter');
var RegionParameter = require('./RegionParameter');
var RegionTypeParameter = require('./RegionTypeParameter');
var RuntimeError = require('terriajs-cesium/Source/Core/RuntimeError');
var updateRectangleFromRegion = require('./updateRectangleFromRegion');

var PlacesLikeMeFunction = function(terria) {
    CatalogFunction.call(this, terria);

    this.url = undefined;
    this.name = "Regions like this";
    this.description = "Identifies regions that are _most like_ a given region according to a given set of characteristics.";

    this._regionTypeParameter = new RegionTypeParameter({
        terria: this.terria,
        id: 'regionType',
        name: 'Region Type',
        description: 'The type of region to analyze.'
    });

    this._regionParameter = new RegionParameter({
        terria: this.terria,
        id: 'region',
        name: 'Region',
        description: 'The region to analyze.  The analysis will determine which regions are most similar to this one.',
        regionProvider: this._regionTypeParameter
    });

    this._dataParameter = new RegionDataParameter({
        terria: this.terria,
        id: 'data',
        name: 'Characteristics',
        description: "The region characteristics to include in the analysis.",
        regionProvider: this._regionTypeParameter
    });

    this._parameters = [
        this._regionTypeParameter,
        this._regionParameter,
        this._dataParameter
    ];
};

inherit(CatalogFunction, PlacesLikeMeFunction);

defineProperties(PlacesLikeMeFunction.prototype, {
    /**
     * Gets the type of data member represented by this instance.
     * @memberOf PlacesLikeMeFunction.prototype
     * @type {String}
     */
    type : {
        get : function() {
            return 'places-like-me-function';
        }
    },

    /**
     * Gets a human-readable name for this type of data source, 'Spatial Detailing'.
     * @memberOf PlacesLikeMeFunction.prototype
     * @type {String}
     */
    typeName : {
        get : function() {
            return 'Places Like Me';
        }
    },

    /**
     * Gets the parameters used to {@link CatalogProcess#invoke} to this function.
     * @memberOf PlacesLikeMeFunction
     * @type {CatalogProcessParameters[]}
     */
    parameters : {
        get : function() {
            return this._parameters;
        }
    }
});

PlacesLikeMeFunction.prototype.load = function() {
};

/**
 * Invokes the process.
 * @param {Object} parameterValues The parameter values for the process.  Each required parameter in {@link CatalogProcess#parameters} must have a corresponding key in this object.
 * @return {ResultPendingCatalogItem} The result of invoking this process.  Because the process typically proceeds asynchronously, the result is a temporary
 *         catalog item that resolves to the real one once the process finishes.
 */
PlacesLikeMeFunction.prototype.invoke = function(parameterValues) {
    if (!defined(parameterValues)) {
        parameterValues = this.applyParameterDefaultValues(this.parameterValues);
    }
    var region = this._regionParameter.getValue(parameterValues);
    var data = this._dataParameter.getValue(parameterValues);

    if (!defined(region)) {
        throw new TerriaError({
            title: 'Region not selected',
            message: 'You must select a Region.'
        });
    }

    var request = {
        algorithm: 'placeslikeme',
        boundaries_name: parameterValues.regionType.regionType,
        region_codes: data.regionCodes,
        columns: data.columnHeadings,
        table: data.table,
        parameters: {
            query: region.id
        }
    };

    var regionProvider = parameterValues[this._regionTypeParameter.id];
    var regionIndex = regionProvider.regions.indexOf(region);

    var regionName = parameterValues.region.id;
    if (regionIndex >= 0) {
        regionName = regionProvider.regionNames[regionIndex] || regionName;
    }

    var name = 'Places like ' + regionName;

    var that = this;
    return invokeTerriaAnalyticsService(this.terria, name, this.url, request).then(function(invocationResult) {
        var result = invocationResult.result;

        var csv = parameterValues.regionType.aliases[0] + ',Likeness\n';

        var likeness = result.likeness;
        if (data.regionCodes.length !== likeness.length) {
            throw new RuntimeError('The list of likenesses and the list of region codes do not contain the same number of elements.');
        }

        for (var i = 0; i < data.regionCodes.length; ++i) {
            csv += data.regionCodes[i] + ',' + Math.pow(likeness[i], 3) + '\n';  // Note: to bring out contrast, we are taking the cube of the likeness. Remove.
        }

        var catalogItem = new CsvCatalogItem(that.terria);
        catalogItem.name = name;
        catalogItem.data = csv;
        catalogItem.dataUrl = invocationResult.url;
        catalogItem.tableStyle.colorBins = 40;
        catalogItem.tableStyle.colorMap = [
            {"color": "rgba(255,255,255,1.00)", "offset": 0},
            {"color": "rgba(191, 191, 255, 1.0)", "offset": 0.5},
            {"color": "rgba(0, 0, 255, 1.0)", "offset": 1}
        ];
            // {"color": "rgba(255,255,255,1.00)", "offset": 0},
            // {"color": "rgba(0,0,255,1.0)", "offset": 1}
        var description = 'This is the result of invoking "' + that.name + '" at ' + invocationResult.startDate + ' with these parameters:\n\n';
        description += ' * ' + parameterValues.regionType.regionType + ' Region: ' + regionName + ' (' + parameterValues.region.id + ')\n';
        description += ' * Characteristics: ' + data.columnHeadings.join(', ') + '\n';

        catalogItem.description = description;

        extendLoad(catalogItem, function() {
            return updateRectangleFromRegion(catalogItem, parameterValues.regionType, region);
        });

        catalogItem.isEnabled = true;
    });
};

module.exports = PlacesLikeMeFunction;
