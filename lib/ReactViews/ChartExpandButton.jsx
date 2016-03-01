'use strict';

import React from 'react';

import defined from 'terriajs-cesium/Source/Core/defined';

import CatalogGroup from '../Models/CatalogGroup';
import CsvCatalogItem from '../Models/CsvCatalogItem';
import Dropdown from './Dropdown';
import raiseErrorToUser from '../Models/raiseErrorToUser';

const ChartExpandButton = React.createClass({

    propTypes: {
        terria: React.PropTypes.object,
        sources: React.PropTypes.array,
        sourceNames: React.PropTypes.array,
        catalogItem: React.PropTypes.object,
        feature: React.PropTypes.object,
        chartTitle: React.PropTypes.string,
        columnNames: React.PropTypes.array,
        columnUnits: React.PropTypes.array,
        xColumn: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
        yColumns: React.PropTypes.array
    },

    expandButton() {
        expand(this.props, this.props.sources[this.props.sources.length - 1]);
    },

    expandDropdown(selected, sourceIndex) {
        expand(this.props, this.props.sources[sourceIndex]);
    },

    render() {
        if (!defined(this.props.sources)) {
            return null;
        }
        if (defined(this.props.sourceNames)) {
            const sourceNameObjects = this.props.sourceNames.map(name=>{ return {name: name}; });
            return (
                <div className='chart-expand'>
                    <Dropdown selectOption={this.expandDropdown} options={sourceNameObjects}>Expand</Dropdown>
                </div>
            );
        }

        return (
            <button className='btn btn--chart-expand' onClick={this.expandButton}>Expand</button>
        );
    }

});

function expand(props, url) {
    const terria = props.terria;
    const newCatalogItem = new CsvCatalogItem(terria, url);
    newCatalogItem.name = props.feature.name + (props.chartTitle ? (' ' + props.chartTitle) : '') + ' (' + props.catalogItem.name + ')';
    newCatalogItem.id = newCatalogItem.name;
    const group = terria.catalog.upsertCatalogGroup(CatalogGroup, 'Chart Data', 'A group for chart data.');
    group.isOpen = true;
    const existingChartItemIds = group.items.map(item=>item.uniqueId);
    const existingIndex = existingChartItemIds.indexOf(newCatalogItem.uniqueId);
    let existingColors;
    let activeConcepts;
    if (existingIndex >= 0) {
        // First, keep a copy of the active items and colors used, so we can keep them the same with the new chart.
        const oldCatalogItem = group.items[existingIndex];
        activeConcepts = oldCatalogItem.tableStructure.columns.map(column=>column.isActive);
        existingColors = oldCatalogItem.tableStructure.columns.map(column=>column.color);
        oldCatalogItem.isEnabled = false;
        group.remove(oldCatalogItem);
    }
    group.add(newCatalogItem);
    newCatalogItem.isLoading = true;
    terria.catalog.chartableItems.push(newCatalogItem);  // Notify the chart panel so it shows "loading".
    newCatalogItem.isEnabled = true;  // This loads it as well.
    // Is there a better way to set up an action to occur once the file has loaded?
    newCatalogItem.load().then(function() {
        // Enclose in try-catch rather than otherwise so that if load itself fails, we don't do this at all.
        try {
            const tableStructure = newCatalogItem.tableStructure;
            tableStructure.sourceFeature = props.feature;
            if (defined(props.columnNames)) {
                tableStructure.columns.forEach((column, columnNumber)=>{
                    if (props.columnNames[columnNumber]) {
                        column.name = props.columnNames[columnNumber];
                    }
                    if (props.columnUnits[columnNumber]) {
                        column.units = props.columnUnits[columnNumber];
                    }
                });
            }
            // Activate columns at the end, so that units and names flow through to the chart panel.
            if (defined(existingColors) && defined(activeConcepts)) {
                tableStructure.columns.forEach((column, columnNumber)=>{
                    column.isActive = activeConcepts[columnNumber];
                    column.color = existingColors[columnNumber];
                });
            } else if (defined(props.yColumns)) {
                const activeColumns = props.yColumns.map(nameOrIndex=>tableStructure.getColumnWithNameOrIndex(nameOrIndex));
                tableStructure.columns.forEach(column=>{
                    column.isActive = activeColumns.indexOf(column) >= 0;
                });
            }
        } catch(e) {
            // This does not actually make it to the user.
            return raiseErrorToUser(terria, e);
        }
    });
}

module.exports = ChartExpandButton;