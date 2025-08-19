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

  $products = wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock);
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
  $export_type = isset($_POST['export_type']) ? sanitize_text_field($_POST['export_type']) : 'all';
  $selected_products = isset($_POST['selected_products']) ? array_map('intval', $_POST['selected_products']) : array();

  // Get all products matching the search criteria
  $all_products = wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock);

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
    __('Current Stock', 'woocommerce-inventory-insights'),
    __('Product ID', 'woocommerce-inventory-insights')
  );

  // Add "Stock Needed" column only if min_stock is set
  if ($min_stock !== null) {
    array_splice($csv_headers, 3, 0, __('Stock Needed', 'woocommerce-inventory-insights'));
  }

  // Add export type and count to headers
  fputcsv($output, array(__('Export Type:', 'woocommerce-inventory-insights'), ucfirst($export_suffix)));
  fputcsv($output, array(__('Product Count:', 'woocommerce-inventory-insights'), count($products)));
  fputcsv($output, array(__('Export Date:', 'woocommerce-inventory-insights'), date('Y-m-d H:i:s')));
  fputcsv($output, array()); // Empty row

  // Add CSV headers
  fputcsv($output, $csv_headers);

  // Add product data
  foreach ($products as $product) {
    $csv_row = array(
      $product['name'],
      $product['sku'],
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
