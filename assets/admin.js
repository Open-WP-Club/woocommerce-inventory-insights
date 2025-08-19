/**
 * Admin JavaScript for WooCommerce Inventory Insights
 */

jQuery(document).ready(function($) {
    'use strict';
    
    var currentResults = [];
    var isSearching = false;
    var recentSearches = [];
    var maxRecentSearches = 10;
    
    // Initialize the plugin
    initInventoryInsights();
    
    /**
     * Initialize plugin functionality
     */
    function initInventoryInsights() {
        loadRecentSearches();
        bindFilterTypeChange();
        bindFormSubmission();
        bindExportButtons();
        bindRecentSearches();
        bindSortOptions();
        bindBulkSelection();
    }
    
    /**
     * Load recent searches from localStorage
     */
    function loadRecentSearches() {
        try {
            var stored = localStorage.getItem('wc_inventory_insights_recent_searches');
            if (stored) {
                recentSearches = JSON.parse(stored);
                updateRecentSearchesDropdown();
            }
        } catch (e) {
            recentSearches = [];
        }
    }
    
    /**
     * Save recent searches to localStorage
     */
    function saveRecentSearches() {
        try {
            localStorage.setItem('wc_inventory_insights_recent_searches', JSON.stringify(recentSearches));
        } catch (e) {
            // localStorage not available
        }
    }
    
    /**
     * Add search to recent searches
     */
    function addToRecentSearches(searchData) {
        // Create search object
        var search = {
            filter_type: searchData.filter_type,
            filter_value: searchData.filter_value,
            min_stock: searchData.min_stock,
            label: generateSearchLabel(searchData),
            timestamp: Date.now()
        };
        
        // Remove if already exists
        recentSearches = recentSearches.filter(function(item) {
            return !(item.filter_type === search.filter_type && 
                    item.filter_value === search.filter_value && 
                    item.min_stock === search.min_stock);
        });
        
        // Add to beginning
        recentSearches.unshift(search);
        
        // Keep only max number
        if (recentSearches.length > maxRecentSearches) {
            recentSearches = recentSearches.slice(0, maxRecentSearches);
        }
        
        saveRecentSearches();
        updateRecentSearchesDropdown();
    }
    
    /**
     * Generate human-readable label for search
     */
    function generateSearchLabel(searchData) {
        var filterText = $('#filter_value option:selected').text() || searchData.filter_value;
        var thresholdText = searchData.min_stock ? ' (threshold: ' + searchData.min_stock + ')' : ' (all products)';
        return filterText + thresholdText;
    }
    
    /**
     * Update recent searches dropdown
     */
    function updateRecentSearchesDropdown() {
        var $dropdown = $('#recent-searches-dropdown');
        var $section = $('#recent-searches-section');
        
        if (recentSearches.length > 0) {
            var options = '<option value="">Select a recent search...</option>';
            $.each(recentSearches, function(index, search) {
                options += '<option value="' + index + '">' + escapeHtml(search.label) + '</option>';
            });
            $dropdown.html(options);
            $section.show();
        } else {
            $section.hide();
        }
    }
    
    /**
     * Bind recent searches functionality
     */
    function bindRecentSearches() {
        // Load recent search
        $('#load-recent-search').on('click', function() {
            var selectedIndex = $('#recent-searches-dropdown').val();
            if (selectedIndex !== '') {
                var search = recentSearches[parseInt(selectedIndex)];
                if (search) {
                    loadSearchIntoForm(search);
                }
            }
        });
        
        // Clear search history
        $('#clear-search-history').on('click', function() {
            if (confirm('Are you sure you want to clear all recent searches?')) {
                recentSearches = [];
                saveRecentSearches();
                updateRecentSearchesDropdown();
            }
        });
    }
    
    /**
     * Load search data into form
     */
    function loadSearchIntoForm(search) {
        $('#filter_type').val(search.filter_type).trigger('change');
        
        // Wait for filter values to load, then set the value
        setTimeout(function() {
            $('#filter_value').val(search.filter_value);
            $('#min_stock').val(search.min_stock || '');
        }, 500);
    }
    
    /**
     * Handle filter type change
     */
    function bindFilterTypeChange() {
        $('#filter_type').on('change', function() {
            var filterType = $(this).val();
            var $filterValueRow = $('#filter_value_row');
            var $filterValue = $('#filter_value');
            
            if (filterType) {
                $filterValueRow.show();
                loadFilterValues(filterType);
            } else {
                $filterValueRow.hide();
                clearResults();
            }
        });
    }
    
    /**
     * Load filter values based on selected type
     */
    function loadFilterValues(filterType) {
        var $filterValue = $('#filter_value');
        
        // Show loading state
        $filterValue.html('<option value="">Loading...</option>').prop('disabled', true);
        
        $.post(wcInventoryInsights.ajaxurl, {
            action: 'wc_inventory_insights_get_filter_values',
            filter_type: filterType,
            nonce: wcInventoryInsights.nonce
        })
        .done(function(response) {
            if (response.success && response.data) {
                populateFilterValues(response.data);
            } else {
                showError('Failed to load filter values. Please try again.');
            }
        })
        .fail(function() {
            showError('Failed to load filter values. Please check your connection.');
        })
        .always(function() {
            $filterValue.prop('disabled', false);
        });
    }
    
    /**
     * Populate filter value dropdown
     */
    function populateFilterValues(values) {
        var $filterValue = $('#filter_value');
        var options = '<option value="">Select...</option>';
        
        $.each(values, function(index, item) {
            options += '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
        });
        
        $filterValue.html(options);
    }
    
    /**
     * Bind sort options
     */
    function bindSortOptions() {
        $('#sort-options').on('change', function() {
            var sortBy = $(this).val();
            if (currentResults.length > 0) {
                sortResults(sortBy);
                updateResultsDisplay();
            }
        });
    }
    
    /**
     * Sort results array
     */
    function sortResults(sortBy) {
        currentResults.sort(function(a, b) {
            switch (sortBy) {
                case 'stock_asc':
                    return a.stock_quantity - b.stock_quantity;
                case 'stock_desc':
                    return b.stock_quantity - a.stock_quantity;
                case 'name_asc':
                    return a.name.localeCompare(b.name);
                case 'name_desc':
                    return b.name.localeCompare(a.name);
                case 'sku_asc':
                    return (a.sku || '').localeCompare(b.sku || '');
                case 'sku_desc':
                    return (b.sku || '').localeCompare(a.sku || '');
                default:
                    return 0;
            }
        });
    }
    
    /**
     * Update bulk action buttons visibility
     */
    function updateBulkActionButtons() {
        var checkedCount = $('.product-checkbox:checked').length;
        var $bulkActions = $('.bulk-actions');
        var $exportSelected = $('#export-selected-btn');
        
        if (checkedCount > 0) {
            $bulkActions.show();
            $exportSelected.text('Export Selected (' + checkedCount + ')');
        } else {
            $bulkActions.hide();
        }
    }
    
    /**
     * Update row selection visual state
     */
    function updateRowSelection() {
        $('.product-checkbox').each(function() {
            var $row = $(this).closest('tr');
            if ($(this).prop('checked')) {
                $row.addClass('selected');
            } else {
                $row.removeClass('selected');
            }
        });
    }
    
    /**
     * Update select all checkbox state
     */
    function updateSelectAllCheckbox() {
        var totalCheckboxes = $('.product-checkbox').length;
        var checkedCheckboxes = $('.product-checkbox:checked').length;
        
        var $selectAll = $('#select-all-checkbox');
        if (checkedCheckboxes === 0) {
            $selectAll.prop('indeterminate', false).prop('checked', false);
        } else if (checkedCheckboxes === totalCheckboxes) {
            $selectAll.prop('indeterminate', false).prop('checked', true);
        } else {
            $selectAll.prop('indeterminate', true).prop('checked', false);
        }
    }
    
    /**
     * Bind bulk selection functionality
     */
    function bindBulkSelection() {
        // Select all checkbox in header
        $(document).on('change', '#select-all-checkbox', function() {
            var isChecked = $(this).prop('checked');
            $('.product-checkbox').prop('checked', isChecked);
            updateRowSelection();
            updateBulkActionButtons();
        });
        
        // Individual product checkboxes
        $(document).on('change', '.product-checkbox', function() {
            updateRowSelection();
            updateSelectAllCheckbox();
            updateBulkActionButtons();
        });
        
        // Bulk action buttons
        $('#select-all-btn').on('click', function() {
            $('.product-checkbox').prop('checked', true);
            $('#select-all-checkbox').prop('checked', true);
            updateRowSelection();
            updateBulkActionButtons();
        });
        
        $('#deselect-all-btn').on('click', function() {
            $('.product-checkbox, #select-all-checkbox').prop('checked', false);
            updateRowSelection();
            updateBulkActionButtons();
        });
    }
    
    /**
     * Handle form submission
     */
    function bindFormSubmission() {
        $('#inventory-search-form').on('submit', function(e) {
            e.preventDefault();
            
            if (isSearching) {
                return false;
            }
            
            var formData = getFormData();
            if (!validateFormData(formData)) {
                return false;
            }
            
            performSearch(formData);
        });
    }
    
    /**
     * Get form data
     */
    function getFormData() {
        return {
            filter_type: $('#filter_type').val(),
            filter_value: $('#filter_value').val(),
            min_stock: $('#min_stock').val()
        };
    }
    
    /**
     * Validate form data
     */
    function validateFormData(data) {
        if (!data.filter_type) {
            showError('Please select a filter type.');
            return false;
        }
        
        if (!data.filter_value) {
            showError('Please select a filter value.');
            return false;
        }
        
        // min_stock is optional, but if provided must be valid
        if (data.min_stock !== '' && (isNaN(data.min_stock) || parseInt(data.min_stock) < 0)) {
            showError('Minimum stock must be a positive number.');
            return false;
        }
        
        return true;
    }
    
    /**
     * Perform product search
     */
    function performSearch(formData) {
        var $btn = $('#search-btn');
        var $results = $('#search-results');
        var $resultsContent = $('#results-content');
        var $exportBtn = $('#export-csv-btn');
        
        // Set loading state
        isSearching = true;
        $btn.addClass('loading').prop('disabled', true);
        $results.show();
        $resultsContent.html('<div class="results-loading">Searching products...</div>');
        $exportBtn.hide();
        
        // Perform AJAX search
        $.post(wcInventoryInsights.ajaxurl, {
            action: 'wc_inventory_insights_search',
            filter_type: formData.filter_type,
            filter_value: formData.filter_value,
            min_stock: formData.min_stock,
            nonce: wcInventoryInsights.nonce
        })
        .done(function(response) {
            if (response.success) {
                handleSearchSuccess(response.data);
            } else {
                handleSearchError(response.data || 'Search failed. Please try again.');
            }
        })
        .fail(function(xhr, status, error) {
            handleSearchError('Search failed: ' + error + '. Please try again.');
        })
        .always(function() {
            resetSearchButton();
        });
    }
    
    /**
     * Handle successful search
     */
    function handleSearchSuccess(data) {
        var $resultsContent = $('#results-content');
        var $exportBtn = $('#export-csv-btn');
        var $sortOptions = $('#sort-options');
        var $resultsCount = $('#results-count');
        
        currentResults = data.products || [];
        $resultsContent.html(data.html || '<div class="no-results">No results found.</div>');
        
        // Update results count
        var countText = currentResults.length === 1 ? 
            'Found 1 product' : 
            'Found ' + currentResults.length + ' products';
        $resultsCount.text(countText);
        
        // Show/hide controls based on results
        if (currentResults.length > 0) {
            $exportBtn.show();
            $sortOptions.show();
            $('.bulk-actions').hide(); // Hidden until items are selected
            
            // Reset sort to default
            $sortOptions.val('stock_asc');
            
            // Reset selection states
            $('#select-all-checkbox').prop('checked', false).prop('indeterminate', false);
            $('.product-checkbox').prop('checked', false);
            updateBulkActionButtons();
        } else {
            $exportBtn.hide();
            $sortOptions.hide();
            $('.bulk-actions').hide();
        }
        
        // Add to recent searches
        var formData = getFormData();
        addToRecentSearches(formData);
        
        // Scroll to results
        $('html, body').animate({
            scrollTop: $('#search-results').offset().top - 50
        }, 500);
    }
    
    /**
     * Update results display (for sorting)
     */
    function updateResultsDisplay() {
        var formData = getFormData();
        var html = generateResultsTable(currentResults, formData.min_stock);
        $('#results-content').html(html);
        
        // Reset selection states after re-rendering
        $('#select-all-checkbox').prop('checked', false).prop('indeterminate', false);
        updateBulkActionButtons();
    }
    
    /**
     * Generate results table HTML
     */
    function generateResultsTable(products, minStock) {
        if (products.length === 0) {
            return '<div class="no-results">No results found.</div>';
        }
        
        var html = '<table class="inventory-results-table">';
        html += '<thead><tr>';
        html += '<th class="bulk-select-column"><input type="checkbox" id="select-all-checkbox" title="Select All"></th>';
        html += '<th>Image</th>';
        html += '<th>Product Name</th>';
        html += '<th>SKU</th>';
        html += '<th>Current Stock</th>';
        
        if (minStock && minStock !== '') {
            html += '<th>Stock Needed</th>';
        }
        
        html += '<th>Actions</th>';
        html += '</tr></thead><tbody>';
        
        $.each(products, function(index, product) {
            html += '<tr data-product-id="' + product.id + '">';
            html += '<td class="bulk-select-column"><input type="checkbox" class="product-checkbox" value="' + product.id + '"></td>';
            
            // Product image
            html += '<td>';
            if (product.image_url) {
                html += '<img src="' + escapeHtml(product.image_url) + '" class="product-image" alt="' + escapeHtml(product.name) + '">';
            } else {
                html += '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>';
            }
            html += '</td>';
            
            // Product name
            html += '<td><strong>' + escapeHtml(product.name) + '</strong></td>';
            
            // SKU
            html += '<td>' + escapeHtml(product.sku || '-') + '</td>';
            
            // Current stock
            var stockClass = (minStock && minStock !== '' && product.stock_quantity < parseInt(minStock)) ? 'stock-below-threshold' : '';
            html += '<td><span class="' + stockClass + '">' + product.stock_quantity + '</span></td>';
            
            // Stock needed (if threshold set)
            if (minStock && minStock !== '') {
                var needed = Math.max(0, parseInt(minStock) - product.stock_quantity);
                if (needed > 0) {
                    html += '<td><span class="stock-needed">+' + needed + '</span></td>';
                } else {
                    html += '<td>-</td>';
                }
            }
            
            // Edit link
            html += '<td><a href="' + escapeHtml(product.edit_url) + '" class="button button-small">Edit Product</a></td>';
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    }
    
    /**
     * Handle search error
     */
    function handleSearchError(message) {
        $('#results-content').html('<div class="wc-inventory-error">' + escapeHtml(message) + '</div>');
    }
    
    /**
     * Reset search button
     */
    function resetSearchButton() {
        isSearching = false;
        $('#search-btn').removeClass('loading').prop('disabled', false);
    }
    
    /**
     * Handle CSV export
     */
    function bindExportButtons() {
        // Export all products
        $(document).on('click', '#export-csv-btn', function() {
            if (currentResults.length === 0) {
                showError('No data to export.');
                return;
            }
            exportToCSV('all');
        });
        
        // Export selected products
        $(document).on('click', '#export-selected-btn', function() {
            var selectedIds = getSelectedProductIds();
            if (selectedIds.length === 0) {
                showError('Please select products to export.');
                return;
            }
            exportToCSV('selected');
        });
    }
    
    /**
     * Get selected product IDs
     */
    function getSelectedProductIds() {
        var selectedIds = [];
        $('.product-checkbox:checked').each(function() {
            selectedIds.push($(this).val());
        });
        return selectedIds;
    }
    
    /**
     * Export current results to CSV
     */
    function exportToCSV(exportType) {
        var $btn = exportType === 'selected' ? $('#export-selected-btn') : $('#export-csv-btn');
        var originalText = $btn.text();
        
        // Set loading state
        $btn.prop('disabled', true).text(wcInventoryInsights.export_text);
        
        // Create hidden form for CSV export
        var $form = $('<form>', {
            method: 'POST',
            action: wcInventoryInsights.ajaxurl,
            style: 'display: none;'
        });
        
        // Add form fields
        $form.append(createHiddenInput('action', 'wc_inventory_insights_export'));
        $form.append(createHiddenInput('filter_type', $('#filter_type').val()));
        $form.append(createHiddenInput('filter_value', $('#filter_value').val()));
        $form.append(createHiddenInput('min_stock', $('#min_stock').val()));
        $form.append(createHiddenInput('export_type', exportType));
        
        // Add selected product IDs if exporting selected
        if (exportType === 'selected') {
            var selectedIds = getSelectedProductIds();
            $.each(selectedIds, function(index, id) {
                $form.append(createHiddenInput('selected_products[]', id));
            });
        }
        
        $form.append(createHiddenInput('nonce', wcInventoryInsights.nonce));
        
        // Submit form and cleanup
        $('body').append($form);
        $form.submit();
        $form.remove();
        
        // Reset button after delay
        setTimeout(function() {
            $btn.prop('disabled', false).text(originalText);
        }, 2000);
    }
    
    /**
     * Create hidden input element
     */
    function createHiddenInput(name, value) {
        return $('<input>', {
            type: 'hidden',
            name: name,
            value: value || ''
        });
    }
    
    /**
     * Clear search results
     */
    function clearResults() {
        $('#search-results').hide();
        $('#results-content').empty();
        $('#export-csv-btn').hide();
        currentResults = [];
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        // Remove existing error messages
        $('.wc-inventory-error').remove();
        
        // Create and show new error message
        var $error = $('<div class="wc-inventory-error">' + escapeHtml(message) + '</div>');
        $('#inventory-search-form').after($error);
        
        // Scroll to error
        $('html, body').animate({
            scrollTop: $error.offset().top - 50
        }, 300);
        
        // Auto-remove after 5 seconds
        setTimeout(function() {
            $error.fadeOut(300, function() {
                $error.remove();
            });
        }, 5000);
    }
    
    /**
     * Escape HTML characters
     */
    function escapeHtml(text) {
        // Convert to string first to handle non-string inputs (like integers)
        var textStr = String(text || '');
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return textStr.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
    
    /**
     * Debug logging
     */
    function debugLog(message, data) {
        if (window.console && window.console.log) {
            console.log('[WC Inventory Insights] ' + message, data || '');
        }
    }
});