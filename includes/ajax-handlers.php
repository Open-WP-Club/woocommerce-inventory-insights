<?php

/**
 * AJAX Handlers
 * 
 * @package WooCommerce Inventory Insights
 */

// Prevent direct access
if (!defined('ABSPATH')) {
  exit;
}

// Register AJAX handlers
add_action('wp_ajax_wc_inventory_insights_get_filter_values', 'wc_inventory_insights_get_filter_values');
add_action('wp_ajax_wc_inventory_insights_get_categories', 'wc_inventory_insights_get_categories');
add_action('wp_ajax_wc_inventory_insights_search', 'wc_inventory_insights_handle_ajax_search');
add_action('wp_ajax_wc_inventory_insights_export', 'wc_inventory_insights_handle_csv_export');

/**
 * Get filter values via AJAX
 */
function wc_inventory_insights_get_filter_values()
{
  if (!wp_verify_nonce($_POST['nonce'], 'wc_inventory_insights_nonce')) {
    wp_die('Security check failed');
  }

  $filter_type = sanitize_text_field($_POST['filter_type']);
  $values = array();

  if ($filter_type === 'tags') {
    $tags = get_terms(array(
      'taxonomy' => 'product_tag',
      'hide_empty' => true,
    ));

    foreach ($tags as $tag) {
      $values[] = array(
        'value' => $tag->term_id,
        'label' => $tag->name . ' (' . $tag->count . ' products)'
      );
    }
  } elseif ($filter_type === 'attributes') {
    $attributes = wc_get_attribute_taxonomies();

    foreach ($attributes as $attribute) {
      $terms = get_terms(array(
        'taxonomy' => wc_attribute_taxonomy_name($attribute->attribute_name),
        'hide_empty' => true,
      ));

      foreach ($terms as $term) {
        $values[] = array(
          'value' => $attribute->attribute_name . '|' . $term->term_id,
          'label' => $attribute->attribute_label . ': ' . $term->name . ' (' . $term->count . ' products)'
        );
      }
    }
  }

  wp_send_json_success($values);
}

/**
 * Get product categories with hierarchy via AJAX
 */
function wc_inventory_insights_get_categories()
{
  if (!wp_verify_nonce($_POST['nonce'], 'wc_inventory_insights_nonce')) {
    wp_die('Security check failed');
  }

  // Get optional filter parameters to limit categories
  $filter_type = isset($_POST['filter_type']) ? sanitize_text_field($_POST['filter_type']) : '';
  $filter_value = isset($_POST['filter_value']) ? sanitize_text_field($_POST['filter_value']) : '';

  $args = array(
    'taxonomy' => 'product_cat',
    'hide_empty' => true,
    'orderby' => 'name',
    'order' => 'ASC',
  );

  // If filter is provided, get categories that contain products with that filter
  if (!empty($filter_type) && !empty($filter_value)) {
    $product_ids = wc_inventory_insights_get_filtered_product_ids($filter_type, $filter_value);

    if (!empty($product_ids)) {
      $args['object_ids'] = $product_ids;
    } else {
      // No products found with this filter, return empty
      wp_send_json_success(array());
      return;
    }
  }

  $categories = get_terms($args);

  if (is_wp_error($categories)) {
    wp_send_json_error('Failed to load categories');
    return;
  }

  // Build hierarchical structure using function from search-functions.php
  $categories_hierarchy = wc_inventory_insights_build_category_hierarchy($categories);

  // Convert format for AJAX response
  $hierarchical_categories = array();
  foreach ($categories_hierarchy as $category) {
    $hierarchical_categories[] = array(
      'value' => $category['id'],
      'label' => $category['display_name']
    );
  }

  wp_send_json_success($hierarchical_categories);
}

/**
 * Get product IDs that match the given filter
 * 
 * @param string $filter_type Filter type (tags|attributes)
 * @param string $filter_value Filter value
 * @return array Array of product IDs
 */
function wc_inventory_insights_get_filtered_product_ids($filter_type, $filter_value)
{
  $args = array(
    'post_type' => array('product', 'product_variation'),
    'post_status' => 'publish',
    'posts_per_page' => -1,
    'fields' => 'ids',
    'meta_query' => array(
      array(
        'key' => '_manage_stock',
        'value' => 'yes',
      ),
    ),
  );

  // Set up taxonomy query based on filter type
  if ($filter_type === 'tags') {
    $args['tax_query'] = array(
      array(
        'taxonomy' => 'product_tag',
        'field' => 'term_id',
        'terms' => $filter_value,
      ),
    );
  } elseif ($filter_type === 'attributes') {
    $parts = explode('|', $filter_value);
    if (count($parts) === 2) {
      $attribute_name = $parts[0];
      $term_id = $parts[1];

      $args['tax_query'] = array(
        array(
          'taxonomy' => wc_attribute_taxonomy_name($attribute_name),
          'field' => 'term_id',
          'terms' => $term_id,
        ),
      );
    }
  }

  $query = new WP_Query($args);
  return $query->posts;
}

// Note: Category hierarchy functions are defined in search-functions.php

/**
 * Handle AJAX search
 */
function wc_inventory_insights_handle_ajax_search()
{
  if (!wp_verify_nonce($_POST['nonce'], 'wc_inventory_insights_nonce')) {
    wp_die('Security check failed');
  }

  $filter_type = sanitize_text_field($_POST['filter_type']);
  $filter_value = sanitize_text_field($_POST['filter_value']);
  $min_stock = isset($_POST['min_stock']) && $_POST['min_stock'] !== '' ? intval($_POST['min_stock']) : null;
  $product_category = isset($_POST['product_category']) && $_POST['product_category'] !== '' ? intval($_POST['product_category']) : null;

  $products = wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock, $product_category);
  $html = wc_inventory_insights_generate_results_html($products, $min_stock);

  wp_send_json_success(array(
    'products' => $products,
    'html' => $html
  ));
}

/**
 * Handle CSV export
 */
function wc_inventory_insights_handle_csv_export()
{
  if (!wp_verify_nonce($_POST['nonce'], 'wc_inventory_insights_nonce')) {
    wp_die('Security check failed');
  }

  $filter_type = sanitize_text_field($_POST['filter_type']);
  $filter_value = sanitize_text_field($_POST['filter_value']);
  $min_stock = isset($_POST['min_stock']) && $_POST['min_stock'] !== '' ? intval($_POST['min_stock']) : null;
  $product_category = isset($_POST['product_category']) && $_POST['product_category'] !== '' ? intval($_POST['product_category']) : null;
  $export_type = isset($_POST['export_type']) ? sanitize_text_field($_POST['export_type']) : 'all';
  $selected_products = isset($_POST['selected_products']) ? array_map('intval', $_POST['selected_products']) : array();

  // Get all products matching the search criteria
  $all_products = wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock, $product_category);

  // Filter products based on export type
  if ($export_type === 'selected' && !empty($selected_products)) {
    $products = array_filter($all_products, function ($product) use ($selected_products) {
      return in_array($product['id'], $selected_products);
    });
  } else {
    $products = $all_products;
  }

  // Generate filename
  $export_suffix = ($export_type === 'selected') ? 'selected' : 'all';
  $filename = 'inventory-insights-' . $export_suffix . '-' . date('Y-m-d-H-i-s') . '.csv';

  // Set headers for CSV download
  header('Content-Type: text/csv');
  header('Content-Disposition: attachment; filename="' . $filename . '"');
  header('Pragma: no-cache');
  header('Expires: 0');

  // Open output stream
  $output = fopen('php://output', 'w');

  // Prepare CSV headers
  $csv_headers = array(
    __('Product Name', 'woocommerce-inventory-insights'),
    __('SKU', 'woocommerce-inventory-insights'),
    __('Categories', 'woocommerce-inventory-insights'),
    __('Current Stock', 'woocommerce-inventory-insights'),
    __('Product ID', 'woocommerce-inventory-insights')
  );

  // Add "Stock Needed" column only if min_stock is set
  if ($min_stock !== null) {
    array_splice($csv_headers, 4, 0, __('Stock Needed', 'woocommerce-inventory-insights'));
  }

  // Add CSV headers
  fputcsv($output, $csv_headers);

  // Add product data
  foreach ($products as $product) {
    $csv_row = array(
      $product['name'],
      $product['sku'],
      $product['categories'],
      $product['stock_quantity'],
    );

    // Add stock needed if min_stock is set
    if ($min_stock !== null) {
      $needed = max(0, $min_stock - $product['stock_quantity']);
      $csv_row[] = $needed;
    }

    $csv_row[] = $product['id'];

    fputcsv($output, $csv_row);
  }

  fclose($output);
  exit;
}
