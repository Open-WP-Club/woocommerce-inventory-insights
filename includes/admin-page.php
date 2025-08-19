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
        <h2><?php _e('Search Results', 'woocommerce-inventory-insights'); ?></h2>
        <button type="button" class="button" id="export-csv-btn" style="display: none;">
          <?php _e('Export to CSV', 'woocommerce-inventory-insights'); ?>
        </button>
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
  $html .= '<th>' . __('Image', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('Product Name', 'woocommerce-inventory-insights') . '</th>';
  $html .= '<th>' . __('SKU', 'woocommerce-inventory-insights') . '</th>';
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
    $html .= '<tr>';

    // Product image
    $html .= '<td>';
    if ($product['image_url']) {
      $html .= '<img src="' . esc_url($product['image_url']) . '" class="product-image" alt="' . esc_attr($product['name']) . '">';
    } else {
      $html .= '<div class="product-image" style="background: #f0f0f0; display: flex; align-items: center; justify-content: center; color: #999;">No Image</div>';
    }
    $html .= '</td>';

    // Product name
    $html .= '<td><strong>' . esc_html($product['name']) . '</strong></td>';

    // SKU
    $html .= '<td>' . esc_html($product['sku'] ?: '-') . '</td>';

    // Current stock - highlight if below threshold
    $stock_class = ($min_stock > 0 && $product['stock_quantity'] < $min_stock) ? 'stock-below-threshold' : '';
    $html .= '<td><span class="' . $stock_class . '">' . esc_html($product['stock_quantity']) . '</span></td>';

    // Stock needed (only if min_stock is set)
    if ($min_stock > 0) {
      $needed = max(0, $min_stock - $product['stock_quantity']);
      if ($needed > 0) {
        $html .= '<td><span class="stock-needed">+' . esc_html($needed) . '</span></td>';
      } else {
        $html .= '<td>-</td>';
      }
    }

    // Edit link
    $html .= '<td><a href="' . esc_url($product['edit_url']) . '" class="button button-small">' . __('Edit Product', 'woocommerce-inventory-insights') . '</a></td>';
    $html .= '</tr>';
  }

  $html .= '</tbody>';
  $html .= '</table>';

  return $html;
}
