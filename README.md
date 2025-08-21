# WooCommerce Inventory Insights

## Description

WooCommerce Inventory Insights is a simple yet powerful plugin that allows administrators to quickly check stock levels of products based on their tags, attributes, or categories. This is especially useful for wholesale businesses that need to monitor inventory levels and make ordering decisions.

## Features

- **Filter by Product Tags** - Search products by any product tag
- **Filter by Product Attributes** - Search products by any product attribute (color, size, brand, etc.)
- **Filter by Product Categories** - Optional category filter with hierarchical display
- **Flexible Stock Monitoring** - Set minimum stock thresholds or view all products
- **Enhanced Results Display** - See product image, name, SKU, categories, current stock, and needed quantities
- **CSV Export** - Export search results including categories for wholesale ordering
- **Bulk Selection** - Select specific products for targeted export
- **One-Click Product Editing** - Direct links to edit products from results
- **Recent Searches** - Save and reload previous searches with all filters
- **No Data Storage** - Each search is independent, no persistent configuration needed

## Requirements

- WordPress 5.0 or higher
- WooCommerce 5.0 or higher
- PHP 7.4 or higher

## Installation

1. Download the plugin files
2. Upload the `woocommerce-inventory-insights` folder to `/wp-content/plugins/`
3. Activate the plugin through the 'Plugins' menu in WordPress
4. Go to **WooCommerce → Inventory Insights** to start using the plugin

## How to Use

1. **Select Filter Type**: Choose between "Product Tags" or "Product Attributes"
2. **Choose Filter Value**: Select the specific tag or attribute you want to monitor
3. **Select Category (Optional)**: Choose a product category to further narrow results
4. **Set Threshold (Optional)**: Enter a minimum stock number, or leave empty to see all products
5. **Search**: Click "Search Products" to see results
6. **Export (Optional)**: Click "Export to CSV" to download results for ordering

## Filter Combinations

You can combine filters for precise inventory monitoring:

- **Tags + Categories**: Monitor products with specific tags within certain categories
- **Attributes + Categories**: Track products with specific attributes in particular categories  
- **Any Filter + Stock Threshold**: Find products below your reorder point
- **Recent Searches**: Quickly reload previous filter combinations

## Category Features

- **Hierarchical Display**: Categories show parent-child relationships with proper indentation
- **Smart Loading**: Category dropdown only shows categories containing products that match your selected filters
- **Enhanced Export**: CSV exports include all product categories for better organization

## Use Cases

- **Wholesale Ordering**: Check which products need restocking before placing wholesale orders
- **Seasonal Inventory**: Monitor seasonal products by tags within specific categories
- **Brand Management**: Track inventory levels by brand using product attributes
- **Category Monitoring**: Keep track of specific product categories or collections
- **Supplier Coordination**: Export low-stock products with category information to share with suppliers
- **Multi-Filter Analysis**: Combine tags, attributes, and categories for detailed inventory insights

## Export Options

- **Export All Results**: Download complete search results as CSV
- **Export Selected**: Choose specific products from results for targeted export
- **Category Information**: All exports include product categories for better organization

## Recent Searches

- **Automatic Saving**: All searches are automatically saved for quick access
- **Load Last Search**: One-click to reload and re-execute your most recent search
- **Search History**: Access up to 10 previous searches with full filter restoration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This plugin is licensed under the GPL v2 or later.
