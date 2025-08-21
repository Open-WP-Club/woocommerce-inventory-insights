<?php

/**
 * Helper Functions
 * 
 * @package WooCommerce Inventory Insights
 */

// Prevent direct access
if (!defined('ABSPATH')) {
  exit;
}

/**
 * Check if WooCommerce is active and loaded
 * 
 * @return bool
 */
function wc_inventory_insights_is_woocommerce_active()
{
  return class_exists('WooCommerce');
}

/**
 * Get plugin version
 * 
 * @return string
 */
function wc_inventory_insights_get_version()
{
  return WC_INVENTORY_INSIGHTS_VERSION;
}

/**
 * Get plugin directory path
 * 
 * @return string
 */
function wc_inventory_insights_get_plugin_dir()
{
  return WC_INVENTORY_INSIGHTS_PLUGIN_DIR;
}

/**
 * Get plugin directory URL
 * 
 * @return string
 */
function wc_inventory_insights_get_plugin_url()
{
  return WC_INVENTORY_INSIGHTS_PLUGIN_URL;
}

/**
 * Format stock quantity for display
 * 
 * @param int|null $stock_quantity Stock quantity
 * @return string Formatted stock quantity
 */
function wc_inventory_insights_format_stock_quantity($stock_quantity)
{
  if ($stock_quantity === null) {
    return __('N/A', 'woocommerce-inventory-insights');
  }

  return number_format_i18n($stock_quantity);
}

/**
 * Check if product has low stock based on threshold
 * 
 * @param int|null $stock_quantity Current stock quantity
 * @param int $threshold Minimum stock threshold
 * @return bool
 */
function wc_inventory_insights_is_low_stock($stock_quantity, $threshold)
{
  if ($stock_quantity === null) {
    return false;
  }

  return $stock_quantity < $threshold;
}

/**
 * Calculate needed stock quantity
 * 
 * @param int|null $current_stock Current stock quantity
 * @param int $min_stock Minimum required stock
 * @return int Needed stock quantity
 */
function wc_inventory_insights_calculate_needed_stock($current_stock, $min_stock)
{
  if ($current_stock === null) {
    return $min_stock;
  }

  return max(0, $min_stock - $current_stock);
}

/**
 * Get product thumbnail URL with fallback
 * 
 * @param WC_Product $product Product object
 * @param string $size Image size
 * @return string|false Image URL or false
 */
function wc_inventory_insights_get_product_image_url($product, $size = 'thumbnail')
{
  if (!$product) {
    return false;
  }

  $image_id = $product->get_image_id();
  if ($image_id) {
    return wp_get_attachment_image_url($image_id, $size);
  }

  // Return placeholder image URL if no image found
  return wc_placeholder_img_src($size);
}

/**
 * Sanitize and validate minimum stock input
 * 
 * @param mixed $input Raw input value
 * @return int|null Sanitized value or null
 */
function wc_inventory_insights_sanitize_min_stock($input)
{
  if ($input === '' || $input === null) {
    return null;
  }

  $value = intval($input);
  return $value >= 0 ? $value : null;
}

/**
 * Sanitize and validate product category input
 * 
 * @param mixed $input Raw input value
 * @return int|null Sanitized category ID or null
 */
function wc_inventory_insights_sanitize_product_category($input)
{
  if ($input === '' || $input === null) {
    return null;
  }

  $value = intval($input);

  // Verify that the category exists
  if ($value > 0) {
    $term = get_term($value, 'product_cat');
    if ($term && !is_wp_error($term)) {
      return $value;
    }
  }

  return null;
}

/**
 * Format filter label for display
 * 
 * @param string $type Filter type (tags|attributes)
 * @param string $value Filter value
 * @return string Formatted label
 */
function wc_inventory_insights_format_filter_label($type, $value)
{
  if ($type === 'tags') {
    $term = get_term($value, 'product_tag');
    return $term && !is_wp_error($term) ? $term->name : __('Unknown Tag', 'woocommerce-inventory-insights');
  }

  if ($type === 'attributes') {
    $parts = explode('|', $value);
    if (count($parts) === 2) {
      $attribute_name = $parts[0];
      $term_id = $parts[1];

      $attribute = wc_get_attribute($attribute_name);
      $term = get_term($term_id, wc_attribute_taxonomy_name($attribute_name));

      if ($attribute && $term && !is_wp_error($term)) {
        return $attribute->name . ': ' . $term->name;
      }
    }
    return __('Unknown Attribute', 'woocommerce-inventory-insights');
  }

  return __('Unknown Filter', 'woocommerce-inventory-insights');
}

/**
 * Format category label for display
 * 
 * @param int|null $category_id Category term ID
 * @return string Formatted category label
 */
function wc_inventory_insights_format_category_label($category_id)
{
  if ($category_id === null) {
    return __('All Categories', 'woocommerce-inventory-insights');
  }

  $term = get_term($category_id, 'product_cat');
  if ($term && !is_wp_error($term)) {
    return $term->name;
  }

  return __('Unknown Category', 'woocommerce-inventory-insights');
}

/**
 * Get category hierarchy path for display
 * 
 * @param int $category_id Category term ID
 * @return string Category path (e.g., "Electronics > Phones > Smartphones")
 */
function wc_inventory_insights_get_category_path($category_id)
{
  $path = array();
  $current_id = $category_id;

  while ($current_id > 0) {
    $term = get_term($current_id, 'product_cat');
    if (!$term || is_wp_error($term)) {
      break;
    }

    array_unshift($path, $term->name);
    $current_id = $term->parent;
  }

  return implode(' > ', $path);
}

/**
 * Build search summary for display
 * 
 * @param string $filter_type Filter type
 * @param string $filter_value Filter value
 * @param int|null $min_stock Minimum stock threshold
 * @param int|null $product_category Product category ID
 * @return string Search summary
 */
function wc_inventory_insights_build_search_summary($filter_type, $filter_value, $min_stock = null, $product_category = null)
{
  $parts = array();

  // Add filter type and value
  $filter_label = wc_inventory_insights_format_filter_label($filter_type, $filter_value);
  $parts[] = $filter_label;

  // Add category if specified
  if ($product_category !== null) {
    $category_label = wc_inventory_insights_format_category_label($product_category);
    $parts[] = sprintf(__('in %s', 'woocommerce-inventory-insights'), $category_label);
  }

  // Add stock threshold if specified
  if ($min_stock !== null) {
    $parts[] = sprintf(__('with stock below %d', 'woocommerce-inventory-insights'), $min_stock);
  }

  return implode(' ', $parts);
}

/**
 * Log debug message if WP_DEBUG is enabled
 * 
 * @param string $message Debug message
 * @param mixed $data Additional data to log
 */
function wc_inventory_insights_debug_log($message, $data = null)
{
  if (defined('WP_DEBUG') && WP_DEBUG) {
    $log_message = '[WC Inventory Insights] ' . $message;
    if ($data !== null) {
      $log_message .= ' Data: ' . print_r($data, true);
    }
    error_log($log_message);
  }
}
