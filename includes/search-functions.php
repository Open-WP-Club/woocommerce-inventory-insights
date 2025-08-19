<?php

/**
 * Search Functions
 * 
 * @package WooCommerce Inventory Insights
 */

// Prevent direct access
if (!defined('ABSPATH')) {
  exit;
}

/**
 * Search products based on criteria
 * 
 * @param string $filter_type Type of filter (tags|attributes)
 * @param string $filter_value Selected tag/attribute value
 * @param int|null $min_stock Minimum stock threshold (null = show all)
 * @return array Array of product data
 */
function wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock = null)
{
  $args = array(
    'post_type' => array('product', 'product_variation'),
    'post_status' => 'publish',
    'posts_per_page' => -1,
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
  $products = array();

  foreach ($query->posts as $post) {
    $product = wc_get_product($post->ID);
    if (!$product) continue;

    $stock_quantity = $product->get_stock_quantity();

    // If no minimum stock is set, include all products
    // If minimum stock is set, only include products below threshold
    $should_include = ($min_stock === null) || ($stock_quantity !== null && $stock_quantity < $min_stock);

    if ($should_include && $stock_quantity !== null) {
      $products[] = array(
        'id' => $product->get_id(),
        'name' => $product->get_name(),
        'sku' => $product->get_sku(),
        'stock_quantity' => $stock_quantity,
        'image_url' => wp_get_attachment_image_url($product->get_image_id(), 'thumbnail'),
        'edit_url' => get_edit_post_link($product->get_id()),
        'needed_quantity' => $min_stock !== null ? max(0, $min_stock - $stock_quantity) : 0,
      );
    }
  }

  // Sort products by stock quantity (ascending)
  usort($products, function ($a, $b) {
    return $a['stock_quantity'] - $b['stock_quantity'];
  });

  return $products;
}

/**
 * Get all product tags with product counts
 * 
 * @return array Array of tag data
 */
function wc_inventory_insights_get_product_tags()
{
  $tags = get_terms(array(
    'taxonomy' => 'product_tag',
    'hide_empty' => true,
    'orderby' => 'name',
    'order' => 'ASC',
  ));

  $tag_data = array();
  foreach ($tags as $tag) {
    $tag_data[] = array(
      'id' => $tag->term_id,
      'name' => $tag->name,
      'count' => $tag->count,
    );
  }

  return $tag_data;
}

/**
 * Get all product attributes with their terms
 * 
 * @return array Array of attribute data
 */
function wc_inventory_insights_get_product_attributes()
{
  $attributes = wc_get_attribute_taxonomies();
  $attribute_data = array();

  foreach ($attributes as $attribute) {
    $terms = get_terms(array(
      'taxonomy' => wc_attribute_taxonomy_name($attribute->attribute_name),
      'hide_empty' => true,
      'orderby' => 'name',
      'order' => 'ASC',
    ));

    if (!empty($terms)) {
      foreach ($terms as $term) {
        $attribute_data[] = array(
          'attribute_name' => $attribute->attribute_name,
          'attribute_label' => $attribute->attribute_label,
          'term_id' => $term->term_id,
          'term_name' => $term->name,
          'count' => $term->count,
        );
      }
    }
  }

  return $attribute_data;
}

/**
 * Validate search parameters
 * 
 * @param string $filter_type Filter type
 * @param string $filter_value Filter value
 * @param int|null $min_stock Minimum stock threshold
 * @return array|true Array of errors or true if valid
 */
function wc_inventory_insights_validate_search_params($filter_type, $filter_value, $min_stock)
{
  $errors = array();

  // Validate filter type
  if (!in_array($filter_type, array('tags', 'attributes'))) {
    $errors[] = __('Invalid filter type.', 'woocommerce-inventory-insights');
  }

  // Validate filter value
  if (empty($filter_value)) {
    $errors[] = __('Please select a filter value.', 'woocommerce-inventory-insights');
  }

  // Validate minimum stock (optional)
  if ($min_stock !== null && $min_stock < 0) {
    $errors[] = __('Minimum stock must be a positive number.', 'woocommerce-inventory-insights');
  }

  return empty($errors) ? true : $errors;
}
