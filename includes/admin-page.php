<?php

/**
 * Admin Page Functions
 * 
 * @package WooCommerce Inventory Insights
 */

// Prevent direct access
if (!defined('ABSPATH')) {
  exit;
}

/**
 * Admin page content
 */
function wc_inventory_insights_admin_page()
{
?>
  <div class="wrap">
    <h1><?php _e('WooCommerce Inventory Insights', 'woocommerce-inventory-insights'); ?></h1>
    <p><?php _e('Monitor product stock levels by tags and attributes to help with wholesale ordering decisions.', 'woocommerce-inventory-insights'); ?></p>

    <!-- Recent Searches -->
    <div id="recent-searches-section" style="display: none;">
      <h3><?php _e('Recent Searches', 'woocommerce-inventory-insights'); ?></h3>
      <div class="recent-searches-controls">
        <select id="recent-searches-dropdown">
          <option value=""><?php _e('Select a recent search...', 'woocommerce-inventory-insights'); ?></option>
        </select>
        <button type="button" class="button" id="load-recent-search"><?php _e('Load Search', 'woocommerce-inventory-insights'); ?></button>
        <button type="button" class="button" id="clear-search-history"><?php _e('Clear History', 'woocommerce-inventory-insights'); ?></button>
        <button type="button" class="button button-primary" id="load-last-search">
          <?php _e('Load Last Search', 'woocommerce-inventory-insights'); ?>
        </button>
      </div>
      <div id="last-search-preview" class="last-search-preview"></div>
    </div>

    <div class="wc-inventory-insights-search-form">
      <form id="inventory-search-form">
        <table class="form-table">
          <tr>
            <th scope="row">
              <label for="filter_type"><?php _e('Filter Type', 'woocommerce-inventory-insights'); ?></label>
            </th>
            <td>
              <select id="filter_type" name="filter_type" required>
                <option value=""><?php _e('Select filter type...', 'woocommerce-inventory-insights'); ?></option>
                <option value="tags"><?php _e('Product Tags', 'woocommerce-inventory-insights'); ?></option>
                <option value="attributes"><?php _e('Product Attributes', 'woocommerce-inventory-insights'); ?></option>
              </select>
            </td>
          </tr>
          <tr id="filter_value_row" style="display: none;">
            <th scope="row">
              <label for="filter_value"><?php _e('Select Value', 'woocommerce-inventory-insights'); ?></label>
            </th>
            <td>
              <select id="filter_value" name="filter_value" required>
                <option value=""><?php _e('Select...', 'woocommerce-inventory-insights'); ?></option>
              </select>
            </td>
          </tr>
          <tr>
            <th scope="row">
              <label for="product_category"><?php _e('Product Category (Optional)', 'woocommerce-inventory-insights'); ?></label>
            </th>
            <td>
              <select id="product_category" name="product_category">
                <option value=""><?php _e('All Categories', 'woocommerce-inventory-insights'); ?></option>
              </select>
              <p class="description"><?php _e('Optional: Filter results by a specific product category. Categories will be filtered based on your selected tag/attribute.', 'woocommerce-inventory-insights'); ?></p>
            </td>
          </tr>
          <tr>
            <th scope="row">
              <label for="min_stock"><?php _e('Minimum Stock Threshold', 'woocommerce-inventory-insights'); ?></label>
            </th>
            <td>
              <input type="number" id="min_stock" name="min_stock" min="0" step="1" placeholder="<?php _e('Leave empty to show all products', 'woocommerce-inventory-insights'); ?>">
              <p class="description"><?php _e('Products with stock below this number will be shown. Leave empty to show all products with the selected tag/attribute.', 'woocommerce-inventory-insights'); ?></p>
            </td>
          </tr>
        </table>

        <p class="submit">
          <button type="submit" class="button button-primary" id="search-btn">
            <?php _e('Search Products', 'woocommerce-inventory-insights'); ?>
          </button>
        </p>
      </form>
    </div>

    <div id="search-results" style="display: none;">
      <div class="results-header">
        <div class="results-title-section">
          <h2><?php _e('Search Results', 'woocommerce-inventory-insights'); ?></h2>
          <span id="results-count" class="results-count"></span>
        </div>
        <div class="results-controls">
          <label for="sort-options"><?php _e('Sort by:', 'woocommerce-inventory-insights'); ?></label>
          <select id="sort-options" style="display: none;">
            <option value="stock_asc"><?php _e('Stock (Low to High)', 'woocommerce-inventory-insights'); ?></option>
            <option value="stock_desc"><?php _e('Stock (High to Low)', 'woocommerce-inventory-insights'); ?></option>
            <option value="name_asc"><?php _e('Product Name (A-Z)', 'woocommerce-inventory-insights'); ?></option>
            <option value="name_desc"><?php _e('Product Name (Z-A)', 'woocommerce-inventory-insights'); ?></option>
            <option value="sku_asc"><?php _e('SKU (A-Z)', 'woocommerce-inventory-insights'); ?></option>
            <option value="sku_desc"><?php _e('SKU (Z-A)', 'woocommerce-inventory-insights'); ?></option>
          </select>
          <div class="bulk-actions" style="display: none;">
            <button type="button" class="button" id="select-all-btn"><?php _e('Select All', 'woocommerce-inventory-insights'); ?></button>
            <button type="button" class="button" id="deselect-all-btn"><?php _e('Deselect All', 'woocommerce-inventory-insights'); ?></button>
            <button type="button" class="button" id="export-selected-btn"><?php _e('Export Selected', 'woocommerce-inventory-insights'); ?></button>
          </div>
          <button type="button" class="button" id="export-csv-btn" style="display: none;">
            <?php _e('Export All to CSV', 'woocommerce-inventory-insights'); ?>
          </button>
        </div>
      </div>
      <div id="results-content"></div>
    </div>
  </div>
<?php
}

/**
 * Generate HTML for search results
 */
function wc_inventory_insights_generate_results_html($products, $min_stock)
{
  if (empty($products)) {
    if ($min_stock > 0) {
      return '<div class="no-results">' . __('No products found below the specified stock threshold.', 'woocommerce-inventory-insights') . '</div>';
    } else {
      return '<div class="no-results">' . __('No products found with the selected criteria.', 'woocommerce-inventory-insights') . '</div>';
    }
  }

  $html = '<table class="inventory-results-table">';
  $html .= '<thead>';
  $html .= '<tr>';
  $html .= '<th class="bulk-select-column"><input type="checkbox" id="select-all-checkbox" title="' . __('Select All', 'woocommerce-inventory-insights') . '"></th>';
  $html .= '<th>' . __('Image', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('Product Name', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('SKU', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('Categories', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('Current Stock', 'woocommerce-inventory-insights') . '</th>';

  // Only show "Stock Needed" column if min_stock is set
  if ($min_stock > 0) {
    $html .= '<th>' . __('Stock Needed', 'woocommerce-inventory-insights') . '</th>';
  }

  $html .= '<th>' . __('Actions', 'woocommerce-inventory-insights') . '</th>';
  $html .= '</tr>';
  $html .= '</thead>';
  $html .= '<tbody>';

  foreach ($products as $product) {
    $html .= '<tr data-product-id="' . esc_attr($product['id']) . '" data-managing-stock="' . esc_attr($product['managing_stock'] ? '1' : '0') . '">';

    // Bulk selection checkbox
    $html .= '<td class="bulk-select-column"><input type="checkbox" class="product-checkbox" value="' . esc_attr($product['id']) . '"></td>';

    // Product image
    $html .= '<td>';
    if ($product['image_url']) {
      $html .= '<img src="' . esc_url($product['image_url']) . '" class="product-image" alt="' . esc_attr($product['name']) . '">';
    } else {
      $html .= '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>';
    }
    $html .= '</td>';

    // Product name with edit link
    $html .= '<td><strong><a href="' . esc_url($product['edit_url']) . '" target="_blank">' . esc_html($product['name']) . '</a></strong></td>';

    // SKU
    $html .= '<td>' . esc_html($product['sku'] ?: '-') . '</td>';

    // Categories
    $html .= '<td>' . esc_html($product['categories'] ?: '-') . '</td>';

    // Current stock - highlight if below threshold or show stock management disabled
    if (!$product['managing_stock']) {
      $html .= '<td><span class="stock-not-managed">' . __('Not managed', 'woocommerce-inventory-insights') . '</span></td>';
    } else {
      $stock_class = ($min_stock > 0 && $product['stock_quantity'] < $min_stock) ? 'stock-below-threshold' : '';
      $html .= '<td><span class="' . $stock_class . '">' . esc_html($product['stock_quantity']) . '</span></td>';
    }

    // Stock needed (only if min_stock is set)
    if ($min_stock > 0) {
      if (!$product['managing_stock']) {
        $html .= '<td><span class="stock-not-managed">-</span></td>';
      } else {
        $needed = max(0, $min_stock - $product['stock_quantity']);
        if ($needed > 0) {
          $html .= '<td><span class="stock-needed">+' . esc_html($needed) . '</span></td>';
        } else {
          $html .= '<td>-</td>';
        }
      }
    }

    // Actions: Quantity controls or Enable Stock button
    $html .= '<td class="actions-column">';
    if (!$product['managing_stock']) {
      $html .= '<button class="button button-small enable-stock-btn" data-product-id="' . esc_attr($product['id']) . '">' . __('Enable Stock', 'woocommerce-inventory-insights') . '</button>';
    } else {
      $html .= '<div class="quantity-controls">';
      $html .= '<button class="button button-small quantity-decrease" data-product-id="' . esc_attr($product['id']) . '" title="' . __('Decrease quantity', 'woocommerce-inventory-insights') . '">-</button>';
      $html .= '<input type="number" class="quantity-input" data-product-id="' . esc_attr($product['id']) . '" value="' . esc_attr($product['stock_quantity']) . '" min="0" />';
      $html .= '<button class="button button-small quantity-increase" data-product-id="' . esc_attr($product['id']) . '" title="' . __('Increase quantity', 'woocommerce-inventory-insights') . '">+</button>';
      $html .= '</div>';
    }
    $html .= '</td>';
    $html .= '</tr>';
  }

  $html .= '</tbody>';
  $html .= '</table>';

  return $html;
}
