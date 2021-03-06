var createReactClass = require('create-react-class');
var React = require('react');
var _ = require('lodash');
var PropTypes = require('prop-types');
var DataMixins = require('../mixins/DataMixins');
var TableActions = require('../table/TableActions');
var TableStore = require('../table/TableStore');
var Utils = require('../utils/Utils');

var iconClasses = {
    advancedFilterOn: 'fa fa-check-square-o',
    advancedFilterOff: 'fa fa-square-o',
    deselectAll: 'fa fa-minus-square-o',
    pageLeft: 'fa fa-chevron-left',
    pageRight: 'fa fa-chevron-right',
    rowsCollapsed: 'fa fa-chevron-right',
    rowsExpanded: 'fa fa-chevron-down',
    selectAll: 'fa fa fa-square-o',
    selectOn: 'fa fa-check-square-o',
    selectOff: 'fa fa-square-o',
    sortAsc: 'fa fa-sort-asc',
    sortDesc: 'fa fa-sort-desc',
    sortInactive: 'fa fa-sort',
    statusOn: 'fa fa-circle',
    statusOff: 'fa fa-circle-o'
};

module.exports = createReactClass({
    displayName: 'Table',

    propTypes: {
        componentId: PropTypes.string.isRequired,
        dataFormatter: PropTypes.func,
        definition: PropTypes.object.isRequired,
        filters: PropTypes.object,
        iconClasses: PropTypes.object,
        loadingIconClasses: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.array
        ]),
        noResultsText: PropTypes.string,
        quickFilterPlaceholder: PropTypes.string,
        selectedRowPredicate: PropTypes.object
    },

    getDefaultProps: function() {
        return {
            noResultsText: 'No results found.',
            quickFilterPlaceholder: 'Filter'
        };
    },

    mixins: [
        DataMixins.dataRequest,
        DataMixins.destroySelfOnUnmount(TableActions),
        DataMixins.eventSubscription(TableStore)
    ],

    quickFilterEnabled: false,

    getInitialState: function() {
        this.selectionEnabled = _.some(this.props.definition.cols, function(col) {return col.dataType === 'select'; }) ? true : false;
        this.quickFilterEnabled = _.some(this.props.definition.cols, function(col) {return col.quickFilter === true; }) ? true : false;
        this.iconClasses = _.merge(_.clone(iconClasses), this.props.iconClasses);

        return {
            loading: true,
            data: null,
            dataError: false,
            selectedItems: {},
            advancedFilters: this.props.definition.advancedFilters || null
        };
    },

    /**
     * Puts the table in a loading state and triggers the table's request data action.
     */
    requestData: function() {
        this.setState({
            loading: true,
            dataError: false
        });
        TableActions.requestData(this.props.componentId, this.props.definition, this.props.dataFormatter, this.props.filters);
    },

    /**
     * Handle store change event.
     */
    onDataReceived: function() {
        var table = TableStore.getInstance(this.props.componentId);
        var data = table.getData();
        var colDefs = table.getColDefinitions();

        if (!data) {
            this.onError();
            return;
        }

        this.setState({
            colDefinitions: colDefs,
            colSortDirections: this.getColSortDirections(colDefs),
            dataCount: table.getDataCount(),
            data: data,
            quickFilterValue: table.getQuickFilterValue(),
            filteredData: table.getFilteredData(),
            loading: false,
            pagination: table.getPaginationData(),
            rowClick: table.getRowClickData(),
            selectedItems: this.selectionEnabled ? table.getSelectedItems() : null,
            sortColIndex: table.getSortColIndex()
        });
    },

    /**
     * Handle request error.
     */
    onError: function() {
        this.setState({loading: false, dataError: true});
    },

    /**
     * Creates the quick filter input for searching/filtering through the table data if any of the columns have
     * quickFilter set to true.
     * @returns {XML} - A React input element.
     */
    getQuickFilter: function() {
        if (!this.quickFilterEnabled || this.state.loading) {
            return null;
        }
        return <input ref="filter" className="quick-filter" type="search" placeholder={this.props.quickFilterPlaceholder} value={this.state.quickFilterValue} onChange={this.handleQuickFilterChange} />;
    },

    /**
     * Builds the markup for the advanced filters.
     * @returns {ReactElement} - A React div element containing all of the advanced filters.
     */
    getAdvancedFilters: function() {
        if (!this.state.advancedFilters || _.isEmpty(this.state.advancedFilters) || this.state.loading) {
            return null;
        }

        var filtersMarkup = _.map(this.state.advancedFilters, function(filter, index) {
            return this.getAdvancedFilterItemMarkup(filter, index);
        }, this);

        return (
            <div className="advanced-filters">
                {filtersMarkup}
            </div>
        );
    },

    /**
     * Builds the markup for a single advanced filter item.
     * @param {Object} filter - One of the advanced filter items.
     * @param {Number} index - The position of the filter in the advancedFilters array.
     * @returns {ReactElement} - A React div element containing an advanced filter item.
     */
    getAdvancedFilterItemMarkup: function(filter, index) {
        var filterIconClass = Utils.classSet({
            [this.iconClasses.advancedFilterOn]: filter.checked,
            [this.iconClasses.advancedFilterOff]: !filter.checked
        });
        return (
            <div key={index} onClick={this.handleAdvancedFilterToggle.bind(this, filter)} className="advanced-filter-item no-select">
                {filter.label}
                <i className={filterIconClass} />
            </div>
        );
    },

    /**
     * Creates pagination controls if the table has data and pagination was definied in the table definition.
     * @returns {XML} - A React div element containing the pagination controls.
     */
    getPaginationControls: function() {
        if (!this.state.data || !this.state.data.length || !this.state.pagination) {
            return null;
        }

        var handlePageLeftClick;
        var handlePageRightClick;
        var len = this.state.dataCount;
        var cursor = this.state.pagination.cursor + 1;
        var size = this.state.pagination.size;
        var lastDisplayedVal = cursor + size - 1 > len ? len : cursor + size - 1;

        var disableLeft = cursor === 1;
        var disableRight = cursor + size - 1 >= len;

        if (!disableLeft) {
            handlePageLeftClick = this.handlePageLeftClick;
        }

        if (!disableRight) {
            handlePageRightClick = this.handlePageRightClick;
        }

        var leftControl = Utils.classSet('left-control', {
            'disabled': disableLeft,
            'hide': disableLeft && disableRight
        });
        var rightControl = Utils.classSet('right-control', {
            'disabled': disableRight,
            'hide': disableLeft && disableRight
        });

        return (
            <div className="pagination-controls no-select clear-fix">
                {cursor}
                <span>-</span>
                {lastDisplayedVal}
                <span>&nbsp;of&nbsp;</span>
                {this.state.dataCount}
                <i className={leftControl + ' ' + this.iconClasses.pageLeft} onClick={handlePageLeftClick} />
                <i className={rightControl + ' ' + this.iconClasses.pageRight} onClick={handlePageRightClick} />
            </div>
        );
    },

    /**
     * Creates an array for the table to easily access column sorting directions.
     * @param {Object} colDefinitions - The tables column definitions that were sent in with the table definition.
     * @returns {Array} - The list of sort directions ordered by column index.
     */
    getColSortDirections: function(colDefinitions) {
        return colDefinitions.map(function(colData) {
            var direction = colData.sortDirection;

            if (direction === 'ascending' || direction === 'descending') {
                return direction;
            }
            return 'off';
        });
    },

    /**
     * Creates a table row.
     * @param {Object} rowData - The data element to build a table row from.
     * @param {Number} index - The current row index.
     * @returns {XML} - A React table row.
     */
    getTableRowItem: function(rowData, index) {
        var handleRowClick;
        var onMouseDown;

        var rowClasses = Utils.classSet('text-select', {
            'hover-enabled': this.state.rowClick,
            'error-row': rowData.isError,
            [rowData.className]: rowData.className,
            'row-selected': this.props.selectedRowPredicate ? _.findIndex([rowData], this.props.selectedRowPredicate) === 0 : false
        });

        if (rowData.shownByAdvancedFilters) {
            rowClasses += ' table-filter-' + rowData.shownByAdvancedFilters.join(' table-filter-');
        }

        var row = _.map(this.state.colDefinitions, function(val, colIndex) {
            var hoverProperty = val.hoverProperty ? (typeof val.hoverProperty === 'function' ? val.hoverProperty(rowData) : rowData[val.hoverProperty]) : null;
            var dataType = val.dataType;
            var dataProperty = val.dataProperty;

            // For specific data types (time, status, percent, duration), the formatted value is contained in a different field.
            if (dataType === 'time' || dataType === 'status') {
                dataProperty = dataProperty + 'Timestamp';
            }
            else if (dataType === 'percent') {
                dataProperty = dataProperty + 'Percent';
            }
            else if (dataType === 'duration') {
                dataProperty = dataProperty + 'Duration';
            }

            return this.getTableData(rowData[dataProperty], val, hoverProperty, colIndex, rowData.online);
        }.bind(this));

        if (this.state.rowClick) {
            handleRowClick = this.handleRowClick;
            onMouseDown = this.onMouseDown;
        }
        return (
            <tr key={'tr-' + index}
                className={rowClasses}
                onClick={handleRowClick}
                onMouseDown={onMouseDown}>
                {row}
            </tr>
        );
    },

    /**
     * Creates a table header.
     * @param {Object} colData - The associated column definition from the definition on props.
     * @param {Number} index - The column index to build a table header element for.
     * @returns {XML} - A React table header element.
     */
    getTableHeaderItem: function(colData, index) {
        var icon, onClick;
        var headerClasses = 'no-select';

        if (colData.dataType === 'select' && this.state.data && this.state.data.length) {
            icon = this.getBulkSelectionIcon(colData);
            onClick = this.handleBulkSelectClick.bind(this, icon.props.title === 'Deselect All');
            headerClasses += ' select-column-th';
        }
        else if (colData.sortDirection && this.state.data && this.state.data.length) {
            icon = this.getSortIcon(index);
            onClick = this.handleSortClick.bind(this, index);
            headerClasses += ' indicator';
        }

        return (
            <th className={headerClasses}
                title={colData.headerLabel}
                key={`th-${index}`}
                style={{width: colData.width}}
                onClick={onClick}>
                <span>{colData.headerLabel}</span>
                {icon}
            </th>
        );
    },

    /**
     * Creates the bulk select/deselect icon if the column has a dataType of select.
     * @param {Object} colData - The associated column definition from the definition on props.
     * @returns {XML} - A React icon element.
     */
    getBulkSelectionIcon: function(colData) {
        var filteredData = this.state.filteredData;
        var match = _.some(filteredData, function(data) {
            return this.state.selectedItems[data[colData.dataProperty]];
        }.bind(this));
        var iconClassString = match ? this.iconClasses.deselectAll : this.iconClasses.selectAll;

        return <i className={iconClassString} title={match ? 'Deselect All' : 'Select All'} />;
    },

    /**
     * Creates the sorting indicator for the table headers that have sorting enabled.
     * @param {number} index - The associated column index that the icon will be placed in.
     * @returns {XML} - A React icon element.
     */
    getSortIcon: function(index) {
        var classes = {
            'sorting-indicator': true
        };

        if (this.state.sortColIndex === index) {
            classes.active = true;

            if (this.state.colSortDirections[index] === 'ascending') {
                classes[this.iconClasses.sortAsc] = true;
                classes.asc = true;
            }
            else {
                classes[this.iconClasses.sortDesc] = true;
                classes.desc = true;
            }
        }
        else {
            classes[this.iconClasses.sortInactive] = true;
            classes['sort-inactive'] = true;
        }

        return <i className={Utils.classSet(classes)} />;
    },

    /**
     * Creates a table data element.
     * @param  {Mixed}  val        The value for the current cell
     * @param  {Object} meta       Details about the value (format, type, etc).
     * @param  {Mixed=} hoverValue Optional value to show in hover state of cell.
     * @param  {Number} index      The current column index.
     * @param  {Bool}   online     Online field for the current row
     * @return {Object}            A React table data element.
     */
    getTableData: function(val, meta, hoverValue, index, online) {
        var afterIcon, iconClassString;
        var contentClasses = 'content';

        // This is a select column
        if (meta.dataType === 'select') {
            iconClassString = this.state.selectedItems && this.state.selectedItems[val] ? this.iconClasses.selectOn + ' on' : this.iconClasses.selectOff + ' off';

            return (
                <td className="select-column-td no-select"
                    title={this.state.selectedItems && this.state.selectedItems[val] ? "Deselect" : "Select"}
                    key={'td-' + index}
                    onClick={this.handleSelectClick}>
                    <i className={iconClassString} />
                </td>
            );
        }
        else if(meta.dataType === 'action'){
            var clickWrapper = _.bind(function(evt){
                evt.stopPropagation();
                var row = evt.currentTarget.parentNode;
                // The row index is off by one due to the table row that wraps the table header items.
                var rowIdx = row.rowIndex - 1;
                var rowData = this.state.data[rowIdx];
                meta.onClick(evt, rowData, this.props, this.state, rowIdx);
            }, this);
            return <td className="action-column-td no-select" onClick={clickWrapper} key={'td-' + index}>{meta.markup}</td>;
        }

        if (meta.dataType === 'status') {
            contentClasses += ' before-icon';
            iconClassString = online ? this.iconClasses.statusOn + ' status-on' : this.iconClasses.statusOff + ' status-off';

            afterIcon = <i className={'after-icon ' + iconClassString} />;
        }
        hoverValue = hoverValue || val;

        return (
            <td className="status" key={'td-' + index}>
                <span className={contentClasses} title={hoverValue}>{val}</span>
                {afterIcon}
            </td>
        );
    },

    /**
     * Filters out the rows that do not contain the input within any of the columns that have quickFilter enabled.
     * @param {Object} e - The simulated React event.
     */
    handleQuickFilterChange: function(e) {
        TableActions.filter(this.props.componentId, e.target.value);
    },

    /**
     * Triggers advanced filtering of the table's data.
     * @param {Object} filter - One of the advanced filter items.
     */
    handleAdvancedFilterToggle: function(filter) {
        if (filter.checked === null) {
            filter.checked = false;
        }

        filter.checked = !filter.checked;

        TableActions.advancedFilter(this.props.componentId, this.state.advancedFilters);
    },

    /**
     * Paginate to the left.
     */
    handlePageLeftClick: function() {
        TableActions.paginate(this.props.componentId, 'left');
    },

    /**
     * Paginate to the right.
     */
    handlePageRightClick: function() {
        TableActions.paginate(this.props.componentId, 'right');
    },

    /**
     * Activates the column and sorts on the current sort direction of that column if it was not already active.
     * If the column is already the active sorting column, it will change the direction of the sort.
     * @param {Number} index - The column index that was clicked.
     */
    handleSortClick: function(index) {
        var direction;

        if (this.state.sortColIndex === index) {
            direction = this.state.colSortDirections[index] === 'ascending' ? 'descending' : 'ascending';
        }
        else {
            direction = this.state.colSortDirections[index];
        }

        TableActions.sortChange(this.props.componentId, index, direction);
    },

    /**
     * Tracks the mouse down x value to detect dragging on a table row to highlight text.
     * @param {Object} e - Simulated React event.
     */
    onMouseDown: function(e) {
        this.mouseDownX = e.clientX;
    },

    /**
     * Will trigger the rowClick's callback function if a drag hasn't occurred.
     * @param {Object} e - Simulated React event.
     */
    handleRowClick: function(e) {
        // Do not allow the click functionality to be triggered when the user is highlighting text.
        if (this.mouseDownX && Math.abs(this.mouseDownX - e.clientX) > 10) {
            this.mouseDownX = null;
            return;
        }
        if (typeof this.state.rowClick.callback !== 'function') {
            throw new Error('The rowClick property in a table declaration must be a function and was received with a type of ' +
                typeof this.state.rowClick + '.');
        }
        else {
            // The row index is off by one due to the table row that wraps the table header items.
            this.state.rowClick.callback(e, this.props, this.state, e.currentTarget.rowIndex - 1);
        }
    },

    /**
     * Bulk toggle selection for table rows.
     * @param {Boolean} deselect - If there are selected items in the filtered data set, we need to deselect them.
     * @param {Object} e - Simulated React event.
     */
    handleBulkSelectClick: function(deselect, e) {
        e.stopPropagation();
        TableActions.toggleBulkSelect(this.props.componentId, deselect);
    },

    /**
     * Toggle selection for a single table row.
     * @param {Object} e - Simulated React event.
     */
    handleSelectClick: function(e) {
        e.stopPropagation();
        // The row index is off by one due to the table row that wraps the table header items.
        TableActions.toggleRowSelect(this.props.componentId, e.currentTarget.parentNode.rowIndex - 1);
    },

    render: function() {
        var containerClasses = Utils.classSet('data-container', {
                'masked-darker': this.state.loading || this.state.dataError,
                error: this.state.dataError
            }),
            thead, tbody, paginationControls, noResults;

        var quickFilter = this.getQuickFilter();

        var advancedFiltersMarkup = this.getAdvancedFilters();

        if (this.state.data) {
            thead = this.state.colDefinitions.map(this.getTableHeaderItem);
            tbody = this.state.data.map(this.getTableRowItem);
            paginationControls = this.getPaginationControls();
        }

        if (this.state.data && !this.state.data.length) {
            noResults = <div className="no-results">{this.props.noResultsText}</div>;
        }

        return (
            <div className="data-component table-component no-select">
                <div className={containerClasses}>
                    <i className={Utils.getLoaderClasses(this.state.loading, this.props.loadingIconClasses)} />
                    {quickFilter}
                    {advancedFiltersMarkup}
                    {paginationControls}
                    <table>
                        <thead><tr>{thead}</tr></thead>
                        <tbody>{tbody}</tbody>
                    </table>
                    {noResults}
                </div>
            </div>
        );
    },
});
