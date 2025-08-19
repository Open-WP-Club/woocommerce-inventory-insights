/**
 * Admin JavaScript for WooCommerce Inventory Insights
 */

jQuery(document).ready(function($) {
    'use strict';
    
    var currentResults = [];
    var isSearching = false;
    
    // Initialize the plugin
    initInventoryInsights();
    
    /**
     * Initialize plugin functionality
     */
    function initInventoryInsights() {
        bindFilterTypeChange();
        bindFormSubmission();
        bindExportButton();
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
        
        currentResults = data.products || [];
        $resultsContent.html(data.html || '<div class="no-results">No results found.</div>');
        
        // Show export button if we have results
        if (currentResults.length > 0) {
            $exportBtn.show();
        }
        
        // Scroll to results
        $('html, body').animate({
            scrollTop: $('#search-results').offset().top - 50
        }, 500);
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
    function bindExportButton() {
        $(document).on('click', '#export-csv-btn', function() {
            if (currentResults.length === 0) {
                showError('No data to export.');
                return;
            }
            
            exportToCSV();
        });
    }
    
    /**
     * Export current results to CSV
     */
    function exportToCSV() {
        var $btn = $('#export-csv-btn');
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
        var map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
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