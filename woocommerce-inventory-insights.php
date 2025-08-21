<?php

/**
 * Plugin Name: WooCommerce Inventory Insights
 * Plugin URI: https://github.com/Open-WP-Club/woocommerce-inventory-insights
 * Description: Monitor WooCommerce product stock levels by tags and attributes to help with wholesale ordering decisions.
 * Version: 1.2.1
 * Author: Open WP Club
 * Author URI: https://github.com/Open-WP-Club
 * Text Domain: woocommerce-inventory-insights
 * Domain Path: /languages
 * Requires at least: 5.0
 * Tested up to: 6.6
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 * WC tested up to: 9.0
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */

// Prevent direct access
if (!defined('ABSPATH')) {
  exit;
}

// Define plugin constants
define('WC_INVENTORY_INSIGHTS_VERSION', '1.2.1');
define('WC_INVENTORY_INSIGHTS_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WC_INVENTORY_INSIGHTS_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Declare HPOS compatibility
 */
add_action('before_woocommerce_init', function () {
  if (class_exists('\Automattic\WooCommerce\Utilities\FeaturesUtil')) {
    \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
  }
});

/**
 * Initialize the plugin
 */
function wc_inventory_insights_init()
{
  // Check if WooCommerce is active
  if (!class_exists('WooCommerce')) {
    add_action('admin_notices', 'wc_inventory_insights_woocommerce_missing_notice');
    return;
  }

  // Load plugin files
  require_once WC_INVENTORY_INSIGHTS_PLUGIN_DIR . 'includes/helper-functions.php';
  require_once WC_INVENTORY_INSIGHTS_PLUGIN_DIR . 'includes/search-functions.php';
  require_once WC_INVENTORY_INSIGHTS_PLUGIN_DIR . 'includes/ajax-handlers.php';

  // Initialize admin functionality
  if (is_admin()) {
    require_once WC_INVENTORY_INSIGHTS_PLUGIN_DIR . 'includes/admin-page.php';
    add_action('admin_menu', 'wc_inventory_insights_add_admin_menu');
    add_action('admin_enqueue_scripts', 'wc_inventory_insights_enqueue_admin_scripts');
  }
}
add_action('plugins_loaded', 'wc_inventory_insights_init');

/**
 * Show notice if WooCommerce is not active
 */
function wc_inventory_insights_woocommerce_missing_notice()
{
?>
  <div class="notice notice-error">
    <p><?php _e('WooCommerce Inventory Insights requires WooCommerce to be installed and activated.', 'woocommerce-inventory-insights'); ?></p>
  </div>
<?php
}

/**
 * Add admin menu
 */
function wc_inventory_insights_add_admin_menu()
{
  add_submenu_page(
    'woocommerce',
    __('Inventory Insights', 'woocommerce-inventory-insights'),
    __('Inventory Insights', 'woocommerce-inventory-insights'),
    'manage_woocommerce',
    'wc-inventory-insights',
    'wc_inventory_insights_admin_page'
  );
}

/**
 * Enqueue admin scripts and styles
 */
function wc_inventory_insights_enqueue_admin_scripts($hook)
{
  if ($hook !== 'woocommerce_page_wc-inventory-insights') {
    return;
  }

  wp_enqueue_style(
    'wc-inventory-insights-admin',
    WC_INVENTORY_INSIGHTS_PLUGIN_URL . 'assets/admin.css',
    array(),
    WC_INVENTORY_INSIGHTS_VERSION
  );

  wp_enqueue_script(
    'wc-inventory-insights-admin',
    WC_INVENTORY_INSIGHTS_PLUGIN_URL . 'assets/admin.js',
    array('jquery'),
    WC_INVENTORY_INSIGHTS_VERSION,
    true
  );

  wp_localize_script('wc-inventory-insights-admin', 'wcInventoryInsights', array(
    'ajaxurl' => admin_url('admin-ajax.php'),
    'nonce' => wp_create_nonce('wc_inventory_insights_nonce'),
    'loading_text' => __('Searching...', 'woocommerce-inventory-insights'),
    'export_text' => __('Exporting...', 'woocommerce-inventory-insights')
  ));
}
