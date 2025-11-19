# Product Display Fix - WooCommerce Inventory Insights

## Issue Summary
The plugin was only displaying 11 out of 29 products in a category, and draft products were not being shown despite a previous update to show all product statuses.

## Root Causes Identified

### 1. Stock Management Filter
**Location:** `includes/search-functions.php:29-34` and `includes/ajax-handlers.php:134-139`

The plugin was filtering products to only show those with stock management enabled:
```php
'meta_query' => array(
  array(
    'key' => '_manage_stock',
    'value' => 'yes',
  ),
),
```

**Impact:** Products without stock management enabled were completely excluded from results.

### 2. Null Stock Quantity Filter
**Location:** `includes/search-functions.php:91`

Even when products were retrieved, those with null stock quantities (products without stock management) were filtered out:
```php
if ($should_include && $stock_quantity !== null) {
```

**Impact:** Products without stock management that passed the initial query were still excluded.

### 3. Inconsistent Post Status Filter
**Location:** `includes/ajax-handlers.php:131`

The category loading function still used `'post_status' => 'publish'` instead of `'post_status' => 'any'`:
```php
'post_status' => 'publish',
```

**Impact:** When loading categories based on selected tags/attributes, only published products were considered, creating an inconsistency with the main search function.

## Solutions Implemented

### 1. Removed Stock Management Requirement
**Files Modified:** `includes/search-functions.php`, `includes/ajax-handlers.php`

Removed the `meta_query` that required `_manage_stock` to be 'yes'. This allows all products to be included in the query, regardless of whether they have stock management enabled.

### 2. Handle Products Without Stock Management
**File Modified:** `includes/search-functions.php`

Added logic to display products without stock management:
```php
$stock_quantity = $product->get_stock_quantity();
// Use 0 for products without stock management
$display_stock_quantity = $stock_quantity !== null ? $stock_quantity : 0;
```

Products without stock management now show a stock quantity of 0 instead of being excluded.

### 3. Updated Post Status for Category Loading
**File Modified:** `includes/ajax-handlers.php`

Changed the category loading function to use `'post_status' => 'any'` for consistency with the main search function. This ensures categories include all product statuses when filtering by tags/attributes.

## Changes Made

### includes/search-functions.php
- Removed `meta_query` requiring stock management (lines 29-34)
- Added `$display_stock_quantity` variable to handle null stock values (line 81)
- Updated condition to use `$display_stock_quantity` instead of checking for null (line 85)
- Removed `&& $stock_quantity !== null` check (line 87)
- Updated all references to use `$display_stock_quantity` for consistency (lines 96, 100)

### includes/ajax-handlers.php
- Changed `'post_status' => 'publish'` to `'post_status' => 'any'` (line 131)
- Removed `meta_query` requiring stock management (lines 134-139)

## Expected Behavior After Fix

1. **All 29 products** in the category should now be displayed (previously only 11)
2. **Draft products** are now visible in search results
3. **Products without stock management** are included and show stock quantity as 0
4. **Category filtering** is now consistent with product search in terms of which products are considered

## Testing Recommendations

1. Search for products in a category that has 29 products
2. Verify all 29 products are now displayed
3. Check that draft products appear in the results
4. Verify products without stock management show stock quantity as 0
5. Test category dropdown to ensure all categories with matching products appear

## Git Information

- **Branch:** `claude/fix-plugin-product-display-01Epp5zt2dzH5Ys3shwQivPo`
- **Commit:** b3cb960
- **Files Changed:** 2 files changed, 7 insertions(+), 17 deletions(-)
