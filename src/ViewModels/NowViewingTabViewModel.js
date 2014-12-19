'use strict';

/*global require,ga*/
var defaultValue = require('../../third_party/cesium/Source/Core/defaultValue');

var ExplorerTabViewModel = require('./ExplorerTabViewModel');
var inherit = require('../Core/inherit');
var loadView = require('../Core/loadView');

var svgCheckboxChecked = require('../Core/svgCheckboxChecked');
var svgCheckboxUnchecked = require('../Core/svgCheckboxUnchecked');
var svgArrowDown = require('../Core/svgArrowDown');
var svgArrowRight = require('../Core/svgArrowRight');
var svgInfo = require('../Core/svgInfo');

var NowViewingTabViewModel = function(options) {
    ExplorerTabViewModel.call(this);

    this.name = 'Now Viewing';
    this.nowViewing = options.nowViewing;

    this.svgCheckboxChecked = defaultValue(options.svgCheckboxChecked, svgCheckboxChecked);
    this.svgCheckboxUnchecked = defaultValue(options.svgCheckboxUnchecked, svgCheckboxUnchecked);
    this.svgArrowDown = defaultValue(options.svgArrowDown, svgArrowDown);
    this.svgArrowRight = defaultValue(options.svgArrowRight, svgArrowRight);
    this.svgInfo = defaultValue(options.svgInfo, svgInfo);
};

inherit(ExplorerTabViewModel, NowViewingTabViewModel);

NowViewingTabViewModel.prototype.show = function(container) {
    loadView(require('fs').readFileSync(__dirname + '/../Views/NowViewingTab.html', 'utf8'), container, this);
};

NowViewingTabViewModel.prototype.showInfo = function(item) {
    ga('send', 'event', 'dataSource', 'info', item.name);
    // GeoDataInfoPopup.open({
    //     container : document.body,
    //     dataSource : item
    // });
};

module.exports = NowViewingTabViewModel;
