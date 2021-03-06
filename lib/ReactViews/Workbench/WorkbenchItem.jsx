'use strict';

import AbsPercentageWorkbenchSection from './Controls/AbsPercentageWorkbenchSection';
import classNames from 'classnames';
import ConceptViewer from './Controls/ConceptViewer';
import defined from 'terriajs-cesium/Source/Core/defined';
import Legend from './Controls/Legend';
import ObserveModelMixin from './../ObserveModelMixin';
import OpacitySection from './Controls/OpacitySection';
import ColorScaleRangeSection from './Controls/ColorScaleRangeSection';
import React from 'react';
import ShortReport from './Controls/ShortReport';
import Styles from './workbench-item.scss';
import ViewingControls from './Controls/ViewingControls';
import Icon from "../Icon.jsx";
import {sortable} from 'react-anything-sortable';

const WorkbenchItem = React.createClass({
    mixins: [ObserveModelMixin],

    propTypes: {
        style: React.PropTypes.object,
        className: React.PropTypes.string,
        onMouseDown: React.PropTypes.func.isRequired,
        onTouchStart: React.PropTypes.func.isRequired,
        item: React.PropTypes.object.isRequired,
        viewState: React.PropTypes.object.isRequired,
        setWrapperState: React.PropTypes.func
    },

    toggleDisplay() {
        this.props.item.isLegendVisible = !this.props.item.isLegendVisible;
    },

    openModal() {
        this.props.setWrapperState({
            modalWindowIsOpen: true,
            activeTab: 1,
            previewed: this.props.item,
        });
    },

    toggleVisibility() {
        this.props.item.isShown = !this.props.item.isShown;
    },

    render() {
        const workbenchItem = this.props.item;
        return (
            <li
                style={this.props.style}
                className={classNames(this.props.className, Styles.workbenchItem,{[Styles.isOpen]: workbenchItem.isLegendVisible})}>
                <ul className={Styles.header}>
                    <If condition={workbenchItem.supportsToggleShown}>
                        <li className={Styles.visibilityColumn}>
                            <button type='button'
                                    onClick={this.toggleVisibility}
                                    title="Data show/hide"
                                    className={Styles.btnVisibility}>
                                    {workbenchItem.isShown ? <Icon glyph={Icon.GLYPHS.checkboxOn}/> : <Icon glyph={Icon.GLYPHS.checkboxOff}/>}
                            </button>
                        </li>
                    </If>
                    <li className={Styles.nameColumn}>
                        <div
                            onMouseDown={this.props.onMouseDown}
                            onTouchStart={this.props.onTouchStart}
                            className={Styles.draggable}>
                            <If condition={!workbenchItem.isMappable}>
                                <span className={Styles.iconLineChart}><Icon glyph={Icon.GLYPHS.lineChart}/></span>
                            </If>
                            {workbenchItem.name}
                        </div>
                    </li>
                    <li className={Styles.toggleColumn}>
                        <button type='button'
                                onClick={this.toggleDisplay}>
                                {workbenchItem.isLegendVisible ? <Icon glyph={Icon.GLYPHS.opened}/> : <Icon glyph={Icon.GLYPHS.closed}/>}
                        </button>
                    </li>
                    <li className={Styles.headerClearfix} />
                </ul>

                <If condition={workbenchItem.isLegendVisible}>
                    <div className={Styles.inner}>
                        <ViewingControls item={workbenchItem} viewState={this.props.viewState}/>
                        <OpacitySection item={workbenchItem}/>
                        <ColorScaleRangeSection item={workbenchItem}/>
                        <If condition={workbenchItem.type === 'abs-itt'}>
                            <AbsPercentageWorkbenchSection item={workbenchItem}/>
                        </If>
                        <Legend item={workbenchItem}/>
                        <If condition={(defined(workbenchItem.concepts) && workbenchItem.concepts.length > 0)}>
                            <ConceptViewer item={workbenchItem}/>
                        </If>
                        <If condition={workbenchItem.shortReport || (workbenchItem.shortReportSections && workbenchItem.shortReportSections.length)}>
                            <ShortReport item={workbenchItem}/>
                        </If>
                    </div>
                </If>
            </li>
        );
    }
});

module.exports = sortable(WorkbenchItem);
