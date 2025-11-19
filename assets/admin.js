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
        // Don't load categories on page load - load them conditionally
        bindFilterTypeChange();
        bindFilterValueChange(); // New: bind filter value changes
        bindFormSubmission();
        bindExportButtons();
        bindRecentSearches();
        bindSortOptions();
        bindBulkSelection();
    }
    
    /**
     * Load product categories conditionally based on selected filter
     * 
     * @param {string} filterType Selected filter type (optional)
     * @param {string} filterValue Selected filter value (optional)
     */
    function loadProductCategories(filterType, filterValue) {
        var $categorySelect = $('#product_category');
        
        // If no filter is selected, show basic "All Categories" option
        if (!filterType || !filterValue) {
            $categorySelect.html('<option value="">All Categories</option>').prop('disabled', false);
            return;
        }
        
        // Show loading state with context
        var loadingText = (filterType && filterValue) ? 
            'Loading categories for selected filter...' : 
            'Loading categories...';
        $categorySelect.html('<option value="">' + loadingText + '</option>').prop('disabled', true);
        
        var requestData = {
            action: 'wc_inventory_insights_get_categories',
            nonce: wcInventoryInsights.nonce
        };
        
        // Add filter parameters if provided
        if (filterType && filterValue) {
            requestData.filter_type = filterType;
            requestData.filter_value = filterValue;
        }
        
        $.post(wcInventoryInsights.ajaxurl, requestData)
        .done(function(response) {
            if (response.success && response.data) {
                debugLog('Categories loaded', 'Found ' + response.data.length + ' categories for filter: ' + filterType + '=' + filterValue);
                populateCategories(response.data);
            } else {
                // If no categories found for this filter, show message
                debugLog('No categories found for filter', filterType + '=' + filterValue);
                $categorySelect.html('<option value="">No categories found for this filter</option>');
            }
        })
        .fail(function() {
            showError('Failed to load categories. Please check your connection.');
            $categorySelect.html('<option value="">All Categories</option>');
        })
        .always(function() {
            $categorySelect.prop('disabled', false);
        });
    }
    
    /**
     * Populate category dropdown with hierarchical structure
     */
    function populateCategories(categories) {
        var $categorySelect = $('#product_category');
        var options = '<option value="">All Categories</option>';
        
        $.each(categories, function(index, category) {
            options += '<option value="' + escapeHtml(category.value) + '">' + escapeHtml(category.label) + '</option>';
        });
        
        $categorySelect.html(options);
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
            product_category: searchData.product_category,
            min_stock: searchData.min_stock,
            label: generateSearchLabel(searchData),
            timestamp: Date.now()
        };
        
        // Remove if already exists
        recentSearches = recentSearches.filter(function(item) {
            return !(item.filter_type === search.filter_type && 
                    item.filter_value === search.filter_value && 
                    item.product_category === search.product_category &&
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
        var categoryText = '';
        var thresholdText = searchData.min_stock ? ' (threshold: ' + searchData.min_stock + ')' : ' (all products)';
        
        // Add category info if selected
        if (searchData.product_category) {
            var categoryOptionText = $('#product_category option:selected').text();
            if (categoryOptionText && categoryOptionText !== 'All Categories') {
                categoryText = ' in ' + categoryOptionText;
            }
        }
        
        return filterText + categoryText + thresholdText;
    }
    
    /**
     * Update recent searches dropdown
     */
    function updateRecentSearchesDropdown() {
        var $dropdown = $('#recent-searches-dropdown');
        var $section = $('#recent-searches-section');
        var $lastSearchBtn = $('#load-last-search');
        var $lastSearchPreview = $('#last-search-preview');
        
        if (recentSearches.length > 0) {
            var options = '<option value="">Select a recent search...</option>';
            $.each(recentSearches, function(index, search) {
                options += '<option value="' + index + '">' + escapeHtml(search.label) + '</option>';
            });
            $dropdown.html(options);
            
            // Update last search preview and button
            var lastSearch = recentSearches[0];
            $lastSearchPreview.text('Last search: ' + escapeHtml(lastSearch.label));
            $lastSearchBtn.show();
            
            $section.show();
        } else {
            $section.hide();
            $lastSearchBtn.hide();
            $lastSearchPreview.text('');
        }
    }
    
    /**
     * Bind recent searches functionality
     */
    function bindRecentSearches() {
        // Load last search directly
        $('#load-last-search').on('click', function() {
            if (recentSearches.length > 0) {
                var lastSearch = recentSearches[0];
                loadSearchIntoForm(lastSearch);
                
                // Auto-execute the search after a brief delay to allow form to populate
                setTimeout(function() {
                    $('#inventory-search-form').submit();
                }, 600);
            }
        });
        
        // Load recent search from dropdown
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
        $('#min_stock').val(search.min_stock || '');
        
        // Wait for filter values to load, then set the values and load categories
        setTimeout(function() {
            $('#filter_value').val(search.filter_value);
            
            // Load categories based on the filter, then set category value
            if (search.filter_type && search.filter_value) {
                loadProductCategories(search.filter_type, search.filter_value);
                
                // Wait a bit more for categories to load, then set the category
                setTimeout(function() {
                    $('#product_category').val(search.product_category || '');
                }, 300);
            } else {
                $('#product_category').val(search.product_category || '');
            }
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
            
            // Reset categories when filter type changes
            loadProductCategories(); // Load basic "All Categories"
        });
    }
    
    /**
     * Handle filter value change - load categories based on selected filter
     */
    function bindFilterValueChange() {
        $('#filter_value').on('change', function() {
            var filterType = $('#filter_type').val();
            var filterValue = $(this).val();
            
            // Load categories filtered by the selected tag/attribute
            if (filterType && filterValue) {
                loadProductCategories(filterType, filterValue);
            } else {
                loadProductCategories(); // Load basic "All Categories"
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
            product_category: $('#product_category').val(),
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
        
        // min_stock and product_category are optional, but if provided must be valid
        if (data.min_stock !== '' && (isNaN(data.min_stock) || parseInt(data.min_stock) < 0)) {
            showError('Minimum stock must be a positive number.');
            return false;
        }
        
        if (data.product_category !== '' && (isNaN(data.product_category) || parseInt(data.product_category) < 0)) {
            showError('Invalid product category selected.');
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
            product_category: formData.product_category,
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
        html += '<th>Categories</th>';
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
            
            // Product name with edit link
            html += '<td><strong><a href="' + escapeHtml(product.edit_url) + '" target="_blank">' + escapeHtml(product.name) + '</a></strong></td>';
            
            // SKU
            html += '<td>' + escapeHtml(product.sku || '-') + '</td>';
            
            // Categories
            html += '<td>' + escapeHtml(product.categories || '-') + '</td>';
            
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
            
            // Actions: Quantity controls or Enable Stock button
            html += '<td class="actions-column">';
            if (!product.managing_stock) {
                html += '<button class="button button-small enable-stock-btn" data-product-id="' + product.id + '">Enable Stock</button>';
            } else {
                html += '<div class="quantity-controls">';
                html += '<button class="button button-small quantity-decrease" data-product-id="' + product.id + '" title="Decrease quantity">-</button>';
                html += '<input type="number" class="quantity-input" data-product-id="' + product.id + '" value="' + product.stock_quantity + '" min="0" />';
                html += '<button class="button button-small quantity-increase" data-product-id="' + product.id + '" title="Increase quantity">+</button>';
                html += '</div>';
            }
            html += '</td>';
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
        $form.append(createHiddenInput('product_category', $('#product_category').val()));
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
     * Handle quantity increase button clicks
     */
    $(document).on('click', '.quantity-increase', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var productId = $btn.data('product-id');
        var $input = $('.quantity-input[data-product-id="' + productId + '"]');
        var currentValue = parseInt($input.val()) || 0;
        var newValue = currentValue + 1;

        $input.val(newValue);
        updateProductQuantity(productId, newValue);
    });

    /**
     * Handle quantity decrease button clicks
     */
    $(document).on('click', '.quantity-decrease', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var productId = $btn.data('product-id');
        var $input = $('.quantity-input[data-product-id="' + productId + '"]');
        var currentValue = parseInt($input.val()) || 0;
        var newValue = Math.max(0, currentValue - 1);

        $input.val(newValue);
        updateProductQuantity(productId, newValue);
    });

    /**
     * Handle manual quantity input changes
     */
    $(document).on('change', '.quantity-input', function(e) {
        var $input = $(this);
        var productId = $input.data('product-id');
        var newValue = parseInt($input.val()) || 0;

        if (newValue < 0) {
            newValue = 0;
            $input.val(newValue);
        }

        updateProductQuantity(productId, newValue);
    });

    /**
     * Update product quantity via AJAX
     */
    function updateProductQuantity(productId, quantity) {
        $.post(wcInventoryInsights.ajaxurl, {
            action: 'wc_inventory_insights_update_quantity',
            product_id: productId,
            quantity: quantity,
            nonce: wcInventoryInsights.nonce
        })
        .done(function(response) {
            if (response.success) {
                // Update the stock display in the current stock column
                var $row = $('tr[data-product-id="' + productId + '"]');
                var $stockCell = $row.find('td').eq(5); // Current Stock column
                var minStock = $('#min_stock').val();

                // Update stock quantity display
                if (minStock && minStock !== '' && quantity < parseInt(minStock)) {
                    $stockCell.html('<span class="stock-below-threshold">' + quantity + '</span>');
                } else {
                    $stockCell.html('<span>' + quantity + '</span>');
                }

                // Update stock needed column if it exists
                if (minStock && minStock !== '') {
                    var $neededCell = $row.find('td').eq(6); // Stock Needed column
                    var needed = Math.max(0, parseInt(minStock) - quantity);
                    if (needed > 0) {
                        $neededCell.html('<span class="stock-needed">+' + needed + '</span>');
                    } else {
                        $neededCell.html('-');
                    }
                }

                // Update currentResults array to keep it in sync
                for (var i = 0; i < currentResults.length; i++) {
                    if (currentResults[i].id == productId) {
                        currentResults[i].stock_quantity = quantity;
                        break;
                    }
                }

                // Show brief success indicator
                var $input = $('.quantity-input[data-product-id="' + productId + '"]');
                $input.addClass('quantity-updated');
                setTimeout(function() {
                    $input.removeClass('quantity-updated');
                }, 1000);
            } else {
                alert('Error: ' + (response.data && response.data.message ? response.data.message : 'Failed to update quantity.'));
            }
        })
        .fail(function() {
            alert('Failed to update quantity. Please try again.');
        });
    }

    /**
     * Handle enable stock management button clicks
     */
    $(document).on('click', '.enable-stock-btn', function(e) {
        e.preventDefault();
        var $btn = $(this);
        var productId = $btn.data('product-id');
        var $row = $btn.closest('tr');
        var productName = $row.find('strong').first().text();

        // Prompt for stock quantity
        var stockQty = prompt('Enable stock management for "' + productName + '"\n\nEnter initial stock quantity:', '0');

        // User cancelled
        if (stockQty === null) {
            return;
        }

        // Validate input
        stockQty = parseInt(stockQty);
        if (isNaN(stockQty) || stockQty < 0) {
            alert('Please enter a valid stock quantity (0 or greater).');
            return;
        }

        // Disable button and show loading
        var originalText = $btn.text();
        $btn.prop('disabled', true).text('Enabling...');

        // Send AJAX request
        $.post(wcInventoryInsights.ajaxurl, {
            action: 'wc_inventory_insights_enable_stock',
            product_id: productId,
            stock_quantity: stockQty,
            nonce: wcInventoryInsights.nonce
        })
        .done(function(response) {
            if (response.success) {
                // Update the row to show stock is now managed
                $row.attr('data-managing-stock', '1');

                // Update stock quantity cell
                var $stockCell = $row.find('td').eq(5); // Current Stock column
                $stockCell.html('<span>' + stockQty + '</span>');

                // Update stock needed cell if it exists
                var minStock = $('#min_stock').val();
                if (minStock && minStock !== '') {
                    var $neededCell = $row.find('td').eq(6); // Stock Needed column
                    var needed = Math.max(0, parseInt(minStock) - stockQty);
                    if (needed > 0) {
                        $neededCell.html('<span class="stock-needed">+' + needed + '</span>');
                    } else {
                        $neededCell.html('-');
                    }
                }

                // Replace the enable button with quantity controls
                var $actionsCell = $btn.closest('td');
                var quantityControlsHtml = '<div class="quantity-controls">' +
                    '<button class="button button-small quantity-decrease" data-product-id="' + productId + '" title="Decrease quantity">-</button>' +
                    '<input type="number" class="quantity-input" data-product-id="' + productId + '" value="' + stockQty + '" min="0" />' +
                    '<button class="button button-small quantity-increase" data-product-id="' + productId + '" title="Increase quantity">+</button>' +
                    '</div>';
                $actionsCell.html(quantityControlsHtml);

                // Update currentResults array
                for (var i = 0; i < currentResults.length; i++) {
                    if (currentResults[i].id == productId) {
                        currentResults[i].managing_stock = true;
                        currentResults[i].stock_quantity = stockQty;
                        break;
                    }
                }

                // Show success message
                var $success = $('<div class="notice notice-success is-dismissible" style="margin: 10px 0;"><p>Stock management enabled for "' + escapeHtml(productName) + '" with initial quantity: ' + stockQty + '</p></div>');
                $('#search-results').prepend($success);
                setTimeout(function() {
                    $success.fadeOut(300, function() { $(this).remove(); });
                }, 3000);
            } else {
                alert('Error: ' + (response.data.message || 'Failed to enable stock management.'));
                $btn.prop('disabled', false).text(originalText);
            }
        })
        .fail(function() {
            alert('Failed to enable stock management. Please try again.');
            $btn.prop('disabled', false).text(originalText);
        });
    });

    /**
     * Debug logging
     */
    function debugLog(message, data) {
        if (window.console && window.console.log) {
            console.log('[WC Inventory Insights] ' + message, data || '');
        }
    }
});