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
 * @param int|null $product_category Product category ID (null = all categories)
 * @return array Array of product data
 */
function wc_inventory_insights_search_products($filter_type, $filter_value, $min_stock = null, $product_category = null)
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

  // Build tax_query array
  $tax_query = array();

  // Set up taxonomy query based on filter type
  if ($filter_type === 'tags') {
    $tax_query[] = array(
      'taxonomy' => 'product_tag',
      'field' => 'term_id',
      'terms' => $filter_value,
    );
  } elseif ($filter_type === 'attributes') {
    $parts = explode('|', $filter_value);
    if (count($parts) === 2) {
      $attribute_name = $parts[0];
      $term_id = $parts[1];

      $tax_query[] = array(
        'taxonomy' => wc_attribute_taxonomy_name($attribute_name),
        'field' => 'term_id',
        'terms' => $term_id,
      );
    }
  }

  // Add category filter if specified
  if ($product_category !== null) {
    $tax_query[] = array(
      'taxonomy' => 'product_cat',
      'field' => 'term_id',
      'terms' => $product_category,
    );
  }

  // Apply tax_query if we have any taxonomy filters
  if (!empty($tax_query)) {
    if (count($tax_query) > 1) {
      $tax_query['relation'] = 'AND';
    }
    $args['tax_query'] = $tax_query;
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
      // Get product categories
      $product_categories = wp_get_post_terms($product->get_id(), 'product_cat', array('fields' => 'names'));
      $categories_list = is_array($product_categories) ? implode(', ', $product_categories) : '';

      $products[] = array(
        'id' => $product->get_id(),
        'name' => $product->get_name(),
        'sku' => $product->get_sku(),
        'stock_quantity' => $stock_quantity,
        'categories' => $categories_list,
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
 * Get all product categories with hierarchy (no counts for performance)
 * 
 * @return array Array of hierarchical category data
 */
function wc_inventory_insights_get_product_categories()
{
  $categories = get_terms(array(
    'taxonomy' => 'product_cat',
    'hide_empty' => true,
    'orderby' => 'name',
    'order' => 'ASC',
  ));

  if (is_wp_error($categories)) {
    return array();
  }

  return wc_inventory_insights_build_category_hierarchy($categories);
}

/**
 * Build hierarchical category structure for display
 * 
 * @param array $categories Flat array of category terms
 * @return array Hierarchical array of categories with indentation
 */
function wc_inventory_insights_build_category_hierarchy($categories)
{
  $hierarchy = array();
  $children = array();
  $indexed_categories = array();

  // Index categories by ID for easier lookup
  foreach ($categories as $category) {
    $indexed_categories[$category->term_id] = $category;
    if ($category->parent != 0) {
      $children[$category->parent][] = $category;
    }
  }

  // Sort children arrays by name
  foreach ($children as &$child_array) {
    usort($child_array, function ($a, $b) {
      return strcmp($a->name, $b->name);
    });
  }

  // Build hierarchy starting with top-level categories (sorted by name)
  $top_level = array();
  foreach ($categories as $category) {
    if ($category->parent == 0) {
      $top_level[] = $category;
    }
  }

  usort($top_level, function ($a, $b) {
    return strcmp($a->name, $b->name);
  });

  foreach ($top_level as $category) {
    $hierarchy[] = array(
      'id' => $category->term_id,
      'name' => $category->name,
      'level' => 0,
      'display_name' => $category->name
    );

    // Add children recursively
    if (isset($children[$category->term_id])) {
      wc_inventory_insights_add_category_children_recursive($hierarchy, $children, $category->term_id, 1);
    }
  }

  return $hierarchy;
}

/**
 * Recursively add category children with proper indentation
 * 
 * @param array &$hierarchy Reference to hierarchy array
 * @param array $children Array of children organized by parent ID
 * @param int $parent_id Parent category ID
 * @param int $level Current nesting level
 */
function wc_inventory_insights_add_category_children_recursive(&$hierarchy, $children, $parent_id, $level)
{
  if (!isset($children[$parent_id])) {
    return;
  }

  foreach ($children[$parent_id] as $child) {
    // Create indentation based on level
    $indent = str_repeat('— ', $level);

    $hierarchy[] = array(
      'id' => $child->term_id,
      'name' => $child->name,
      'level' => $level,
      'display_name' => $indent . $child->name
    );

    // Add grandchildren if they exist
    if (isset($children[$child->term_id])) {
      wc_inventory_insights_add_category_children_recursive($hierarchy, $children, $child->term_id, $level + 1);
    }
  }
}

/**
 * Validate search parameters
 * 
 * @param string $filter_type Filter type
 * @param string $filter_value Filter value
 * @param int|null $min_stock Minimum stock threshold
 * @param int|null $product_category Product category ID
 * @return array|true Array of errors or true if valid
 */
function wc_inventory_insights_validate_search_params($filter_type, $filter_value, $min_stock, $product_category = null)
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

  // Validate product category (optional)
  if ($product_category !== null && $product_category < 0) {
    $errors[] = __('Invalid product category.', 'woocommerce-inventory-insights');
  }

  return empty($errors) ? true : $errors;
}
