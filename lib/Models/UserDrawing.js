'use strict';

var MapInteractionMode = require('../Models/MapInteractionMode');

var DeveloperError = require('terriajs-cesium/Source/Core/DeveloperError');
var defined = require('terriajs-cesium/Source/Core/defined');
var defaultValue = require('terriajs-cesium/Source/Core/defaultValue');
var Color = require('terriajs-cesium/Source/Core/Color');
var PolylineGlowMaterialProperty = require('terriajs-cesium/Source/DataSources/PolylineGlowMaterialProperty');
var CustomDataSource = require('terriajs-cesium/Source/DataSources/CustomDataSource');
var CallbackProperty = require('terriajs-cesium/Source/DataSources/CallbackProperty');
var PolygonHierarchy = require('terriajs-cesium/Source/Core/PolygonHierarchy');
var knockout = require('terriajs-cesium/Source/ThirdParty/knockout');
var Entity = require('terriajs-cesium/Source/DataSources/Entity.js');
var when = require('terriajs-cesium/Source/ThirdParty/when');
var Cartesian3 = require('terriajs-cesium/Source/Core/Cartesian3');

/**
 * Callback for when a point is clicked.
 * @callback PointClickedCallback
 * @param {CustomDataSource} customDataSource Contains all point entities that user has selected so far
 */

/**
 * Callback for when clean up is happening, i.e., for done or cancel.
 * @callback CleanUpCallback
 */

/**
 * Callback for when the dialog is displayed, to provide a custom message
 * @callback MakeDialogMessageCallback
 * @return {String} Message to add to dialog
 */

/**
 * @alias UserDrawing
 * @constructor
 *
 * For user drawings, which includes lines and/or a polygon
 * @param {Object} options Object with the following properties:
 * @param {Terria} options.terria The Terria instance.
 * @param {String} [options.messageHeader="Draw on Map"] Heading for the dialog which pops up when in user drawing mode
 * @param {Bool}   [options.allowPolygon=true] Let the user click on first point to close loop
 * @param {PointClickedCallback} [options.onPointClicked] Way to subscribe to point clicks
 * @param {CleanUpCallback} [options.onCleanUp] Way to add own cleanup
 * @param {MakeDialogMessageCallback} [options.onMakeDialogMessage] Way to customise dialog message
 */
var UserDrawing = function(options) {

    options = defaultValue(options, defaultValue.EMPTY_OBJECT);
    if (!defined(options.terria)) {
        throw new DeveloperError('Terria instance is required.');
    }

    /**
     * Text that appears at the top of the dialog when drawmode is active.
     * @type {String}
     * @default "Draw on Map"
     */
    this.messageHeader = defaultValue(options.messageHeader, "Draw on Map");

    /**
     * If true, user can click on first point to close the line, turning it into a polygon.
     * @type {Bool}
     * @default true
     */
    this.allowPolygon = defaultValue(options.allowPolygon, true);

    /**
     * Callback that occurs when point is clicked (may be added or removed). Function takes a CustomDataSource which is
     * a list of PointEntities.
     * @type {PointClickedCallback}
     * @default undefined
     */
    this.onPointClicked = options.onPointClicked;

    /**
     * Callback that occurs on clean up, i.e. when drawing is done or cancelled.
     * @type {CleanUpCallback}
     * @default undefined
     */
    this.onCleanUp = options.onCleanUp;

    /**
     * Callback that occurs when the dialog is redrawn, to add additional information to dialog.
     * @type {MakeDialogMessageCallback}
     * @default undefined
     */
    this.onMakeDialogMessage = options.onMakeDialogMessage;

    /**
     * Instance of Terria
     * @type {Terria}
     * @default undefined
     */
    this.terria = options.terria;

    /**
     * Storage for points that will be drawn
     * @type {CustomDataSource}
     */
    this.pointEntities = new CustomDataSource('Points');

    /**
     * Storage for line that connects the points, and polygon if the first and last point are the same
     * @type {CustomDataSource}
     */
    this.otherEntities = new CustomDataSource('Lines and polygons');

    /**
     * Polygon that will be drawn if the user drawing is a closed shape
     * @type {Entity}
     */
    this.polygon = undefined;

    /**
     * Whether to interpret user clicks as drawing
     * @type {Bool}
     */
    this.inDrawMode = false;

    /**
     * Whether the first and last point in the user drawing are the same
     * @type {Bool}
     */
    this.closeLoop = false;

    /**
     * SVG element for point drawn when user clicks.
     * http://stackoverflow.com/questions/24869733/how-to-draw-custom-dynamic-billboards-in-cesium-js
     */
    var svgDataDeclare = "data:image/svg+xml,";
    var svgPrefix = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" xml:space="preserve">';
    var svgCircle = '<circle cx="10" cy="10" r="5" stroke="rgb(0,170,215)" stroke-width="4" fill="white" /> ';
    var svgSuffix = "</svg>";
    var svgString = svgPrefix + svgCircle + svgSuffix;

    // create the cesium entity
    this.svgPoint = svgDataDeclare + svgString;
};

/**
 * Start interpreting user clicks as placing or removing points.
 */
UserDrawing.prototype.enterDrawMode = function() {

    // If we have finished a polygon, don't allow more points to be drawn. In future, perhaps support multiple polygons.
    if (this.inDrawMode || this.closeLoop) {
        // Do nothing
        return;
    }

    this.inDrawMode = true;

    if (defined(this.terria.cesium)) {
        this.terria.cesium.viewer.canvas.setAttribute("style", "cursor: crosshair");
    } else if (defined(this.terria.leaflet)) {
        document.getElementById("cesiumContainer").setAttribute("style", "cursor: crosshair");
    }

    // Cancel any feature picking already in progress.
    this.terria.pickedFeatures = undefined;
    var that = this;

    // Line will show up once user has drawn some points. Vertices of line are user points.
    this.otherEntities.entities.add({
        name: 'Line',
        polyline: {
                    positions: new CallbackProperty(function(date, result) {
                        var pos = that._getPointsForShape();
                        if (that.closeLoop) {
                            pos.push(pos[0]);
                        }
                        return pos;
                    }, false),

                    material : new PolylineGlowMaterialProperty({
                        color : new Color(0.0, 0.0, 0.0, 0.1),
                        glowPower : 0.25
                    }),
                    width: 20
                  }
    });
    this.terria.dataSources.add(this.pointEntities);
    this.terria.dataSources.add(this.otherEntities);

    // Listen for user clicks on map
    const pickPointMode = new MapInteractionMode({
        message: this._getDialogMessage(),
        buttonText: this._getButtonText(),
        onCancel: function() {
            that.terria.mapInteractionModeStack.pop();
            that._cleanUp();
        }
    });
    this.terria.mapInteractionModeStack.push(pickPointMode);

    // Handle what happens when user picks a point
    knockout.getObservable(pickPointMode, 'pickedFeatures').subscribe(function(pickedFeatures) {
        when(pickedFeatures.allFeaturesAvailablePromise, function() {
            if (defined(pickedFeatures.pickPosition)) {
                var pickedPoint = pickedFeatures.pickPosition;
                var firstPointEntity = new Entity({
                    name: 'First Point',
                    position: pickedPoint,
                    billboard : {
                        image : that.svgPoint,
                        eyeOffset : new Cartesian3(0.0, 0.0, -50.0)
                    }
                });

                that.pointEntities.entities.add(firstPointEntity);
                that._prepareToAddNewPoint();
                if (typeof that.onPointClicked === "function") {
                    that.onPointClicked(that.pointEntities);
                }
            }
        });
    });
};

/**
 * Create the HTML message in the dialog box.
 * Example:
 *
 *     Measuring Tool
 *     373.45 km
 *     Click to add another point
 *
 * @private
 */
UserDrawing.prototype._getDialogMessage = function() {

    var message = "<strong>" + this.messageHeader + "</strong></br>";

    var innerMessage = "";
    if (typeof this.onMakeDialogMessage === "function") {
        innerMessage = this.onMakeDialogMessage();
    }
    if (innerMessage !== "") {
        message += innerMessage + "</br>";
    }

    var word = "a";
    if (this.pointEntities.entities.values.length > 0) {
        word = "another";
    }
    message += "<i>Click to add " + word + " point</i>";
    // htmlToReactParser will fail if html doesn't have only one root element.
    return "<div>" + message + "</div>";
};

/**
 * Figure out the text for the dialog button.
 * @private
 */
UserDrawing.prototype._getButtonText = function() {
    var buttonText = "Cancel";
    if (this.pointEntities.entities.values.length >= 2) {
        buttonText = "Done";
    }
    return buttonText;
};

/**
 * User has finished or cancelled; restore initial state.
 * @private
 */
UserDrawing.prototype._cleanUp = function() {
    this.terria.dataSources.remove(this.pointEntities);
    this.pointEntities = new CustomDataSource('Points');
    this.terria.dataSources.remove(this.otherEntities);
    this.otherEntities = new CustomDataSource('Lines and polygons');

    this.inDrawMode = false;
    this.closeLoop = false;

    // Return cursor to original state
    if (defined(this.terria.cesium)) {
        this.terria.cesium.viewer.canvas.setAttribute("style", "cursor: auto");
    } else if (defined(this.terria.leaflet)) {
        document.getElementById("cesiumContainer").setAttribute("style", "cursor: auto");
    }

    // Allow client to clean up too
    if (typeof this.onCleanUp === "function") {
        this.onCleanUp();
    }
};

/**
 * Called after a point has been added, this updates the MapInteractionModeStack with a listener for another point.
 * @private
 */
UserDrawing.prototype._mapInteractionModeUpdate = function() {
    this.terria.mapInteractionModeStack.pop();
    var that = this;
    const pickPointMode = new MapInteractionMode({
        message: this._getDialogMessage(),
        buttonText: this._getButtonText(),
        onCancel: function() {
            that.terria.mapInteractionModeStack.pop();
            that._cleanUp();
        }
    });
    this.terria.mapInteractionModeStack.push(pickPointMode);
    return pickPointMode;
};

/**
 * Called after a point has been added, prepares to add and draw another point, as well as updating the dialog.
 * @private
 */
UserDrawing.prototype._prepareToAddNewPoint = function() {
    var pickPointMode = this._mapInteractionModeUpdate();
    var that = this;

    knockout.getObservable(pickPointMode, 'pickedFeatures').subscribe(function(pickedFeatures) {
        when(pickedFeatures.allFeaturesAvailablePromise, function() {
            if (defined(pickedFeatures.pickPosition)) {
                var pickedPoint = pickedFeatures.pickPosition;
                // If existing point was picked, _clickedExistingPoint handles that, and returns true.
                if (!that._clickedExistingPoint(pickedFeatures.features)) {
                    // No existing point was picked, so add a new point
                    var pointEntity = new Entity({
                        name: 'Another Point',
                        position: pickedPoint,
                        billboard : {
                            image : that.svgPoint,
                            eyeOffset : new Cartesian3(0.0, 0.0, -50.0)
                        }
                    });
                    that.pointEntities.entities.add(pointEntity);
                    if (typeof that.onPointClicked === "function") {
                        that.onPointClicked(that.pointEntities);
                    }
                }
                that._prepareToAddNewPoint();
            }
        });
    });
};

/**
 * Return a list of the coords for the user drawing
 * @return {Array} An array of coordinates for the user-drawn shape
 * @private
 */
UserDrawing.prototype._getPointsForShape = function() {
    if (defined(this.pointEntities.entities)) {
        var pos = [];
        for (var i=0; i < this.pointEntities.entities.values.length; i++) {
            var obj = this.pointEntities.entities.values[i];
            if (defined(obj.position)) {
                var position = obj.position.getValue(this.terria.clock.currentTime);
                pos.push(position);
            }
        }
        return pos;
    }
};

/**
 * Find out if user clicked an existing point and handle appropriately.
 * @param {PickedFeatures} features Feature/s that are under the point the user picked
 * @return {Bool} Whether user had clicked an existing point
 * @private
 */
UserDrawing.prototype._clickedExistingPoint = function(features) {

    if (features.length < 1) {
        return false;
    }

    if ((features.length === 1) && (this.pointEntities.entities.values.indexOf(features[0]) === -1)) {
        // Damn leaflet sometimes puts in a feature that is not in our list.
        return false;
    }

    var that = this;

    features.forEach((feature)=> {
        var index = this.pointEntities.entities.values.indexOf(feature);

        // Index is zero if it's the first point, meaning we have a closed shape
        if (index === 0 && !this.closeLoop && this.allowPolygon) {
            this.polygon = this.otherEntities.entities.add({
                    name: 'User polygon',
                    polygon: {
                        hierarchy: new CallbackProperty(function(date, result) {
                            return new PolygonHierarchy(that._getPointsForShape());
                            }, false),
                        material: new Color(0.0, 0.666, 0.843, 0.25),
                        outlineColor: new Color(1.0, 1.0, 1.0, 1.0),
                        perPositionHeight: true
                   }
                });
            this.closeLoop = true;
            // A point has not been added, but conceptually it has because the first point is now also the last point.
            if (typeof that.onPointClicked === "function") {
                that.onPointClicked(that.pointEntities);
            }
            return;
        }
        else {
            this.pointEntities.entities.remove(feature);
            // If it gets down to 2 points, it should stop acting like a polygon.
            if (this.pointEntities.entities.values.length < 2 && this.closeLoop) {
                this.closeLoop = false;
                this.otherEntities.entities.remove(this.polygon);
            }
            // Also let client of UserDrawing know if a point has been removed.
            if (typeof that.onPointClicked === "function") {
                that.onPointClicked(that.pointEntities);
            }
            return;
        }
    });
    return true;
};


module.exports = UserDrawing;
