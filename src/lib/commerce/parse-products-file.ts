import * as XLSX from 'xlsx';
import type { ProductVariantItem, NutritionRow, TaxConfig } from '@/types';

export interface ParsedStoreProduct {
  name: string;
  short_code: string;
  category: string;
  description: string;
  food_type: 'veg' | 'non-veg' | 'others';
  list_price: number;
  sale_price: number;
  tax_config: TaxConfig;
  variants_config: ProductVariantItem[];
  nutrition_table: NutritionRow[];
  images: string[];
}

export interface ParseProductsResult {
  products: ParsedStoreProduct[];
  categoriesToCreate: string[];
  variantsToCreate: { label: string; options: string[] }[];
  totalRows: number;
  error?: string;
}

export function parseProductsBuffer(buffer: ArrayBuffer | Uint8Array): ParseProductsResult {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { products: [], categoriesToCreate: [], variantsToCreate: [], totalRows: 0, error: 'File contains no sheets' };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return { products: [], categoriesToCreate: [], variantsToCreate: [], totalRows: 0, error: 'No data rows found in spreadsheet' };
    }

    const categoriesSet = new Set<string>();
    const variantsMap = new Map<string, Set<string>>();

    // Group rows by Product Name
    const productGroups = new Map<string, {
      masterRow: Record<string, any>;
      variants: ProductVariantItem[];
      images: Set<string>;
    }>();

    for (const row of rawRows) {
      // Flexible key matching for column names
      const name = String(row['Product Name'] || row['product_name'] || row['Name'] || row['name'] || '').trim();
      if (!name) continue;

      const groupKey = name.toLowerCase();

      if (!productGroups.has(groupKey)) {
        productGroups.set(groupKey, {
          masterRow: row,
          variants: [],
          images: new Set<string>(),
        });
      }

      const group = productGroups.get(groupKey)!;

      // Extract image URL
      const imgUrl = String(row['Image URL'] || row['image_url'] || row['Image'] || row['image'] || '').trim();
      if (imgUrl) {
        for (const url of imgUrl.split(/[,;\s]+/)) {
          if (url.startsWith('http://') || url.startsWith('https://')) {
            group.images.add(url);
          }
        }
      }

      // Extract Category
      const cat = String(row['Category'] || row['category'] || '').trim();
      if (cat) {
        categoriesSet.add(cat);
      }

      // Extract Variant
      const vLabel = String(row['Variant Label'] || row['variant_label'] || row['Variant'] || '').trim();
      const vValue = String(row['Variant Value'] || row['variant_value'] || row['Option'] || '').trim();

      if (vLabel && vValue) {
        if (!variantsMap.has(vLabel)) {
          variantsMap.set(vLabel, new Set<string>());
        }
        variantsMap.get(vLabel)!.add(vValue);

        const vListPrice = parseFloat(row['Variant List Price (₹)'] || row['Variant List Price'] || row['List Price (₹)'] || row['List Price'] || '0') || 0;
        const vSalePrice = parseFloat(row['Variant Sale Price (₹)'] || row['Variant Sale Price'] || row['Sale Price (₹)'] || row['Sale Price'] || '0') || vListPrice;

        group.variants.push({
          variant_label: vLabel,
          value: vValue,
          list_price: vListPrice,
          sale_price: vSalePrice,
        });
      }
    }

    // Convert grouped products into ParsedStoreProduct array
    const products: ParsedStoreProduct[] = [];

    for (const [_, group] of productGroups) {
      const row = group.masterRow;
      const name = String(row['Product Name'] || row['product_name'] || row['Name'] || '').trim();
      const shortCode = String(row['Short Code / SKU'] || row['short_code'] || row['SKU'] || '').trim() ||
        `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const category = String(row['Category'] || row['category'] || '').trim();
      const description = String(row['Description'] || row['description'] || '').trim();

      // Food type
      let foodType: 'veg' | 'non-veg' | 'others' = 'others';
      const rawFoodType = String(row['Food Type'] || row['food_type'] || '').trim().toLowerCase();
      if (rawFoodType.includes('non') || rawFoodType === 'nonveg' || rawFoodType === 'non-veg') {
        foodType = 'non-veg';
      } else if (rawFoodType.includes('veg')) {
        foodType = 'veg';
      }

      // Prices
      const listPrice = parseFloat(row['List Price (₹)'] || row['List Price'] || row['list_price'] || '0') || 0;
      const salePrice = parseFloat(row['Sale Price (₹)'] || row['Sale Price'] || row['sale_price'] || '0') || listPrice;

      // Tax
      const rawTaxType = String(row['Tax Type'] || row['tax_type'] || '').toLowerCase();
      const taxInclusive = rawTaxType.includes('incl') || !rawTaxType.includes('excl');
      const taxPercentage = parseFloat(row['Tax %'] || row['Tax Percentage'] || row['tax_percentage'] || '18') || 0;
      const cgst = parseFloat(row['CGST %'] || row['cgst'] || String(taxPercentage / 2)) || 0;
      const sgst = parseFloat(row['SGST %'] || row['sgst'] || String(taxPercentage / 2)) || 0;

      // Nutrition Table
      const nutritionTable: NutritionRow[] = [];
      const energy = String(row['Energy (kcal)'] || row['Energy'] || '').trim();
      if (energy) nutritionTable.push({ heading: 'Energy', composition: energy });

      const protein = String(row['Protein (g)'] || row['Protein'] || '').trim();
      if (protein) nutritionTable.push({ heading: 'Protein', composition: protein });

      const carbs = String(row['Carbohydrates (g)'] || row['Carbs'] || '').trim();
      if (carbs) nutritionTable.push({ heading: 'Carbohydrates', composition: carbs });

      const fat = String(row['Fat (g)'] || row['Fat'] || '').trim();
      if (fat) nutritionTable.push({ heading: 'Fat', composition: fat });

      products.push({
        name,
        short_code: shortCode,
        category,
        description,
        food_type: foodType,
        list_price: listPrice,
        sale_price: salePrice,
        tax_config: {
          inclusive: taxInclusive,
          tax_percentage: taxPercentage,
          cgst,
          sgst,
        },
        variants_config: group.variants,
        nutrition_table: nutritionTable,
        images: Array.from(group.images),
      });
    }

    const categoriesToCreate = Array.from(categoriesSet);
    const variantsToCreate = Array.from(variantsMap.entries()).map(([label, optsSet]) => ({
      label,
      options: Array.from(optsSet),
    }));

    return {
      products,
      categoriesToCreate,
      variantsToCreate,
      totalRows: rawRows.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to parse file';
    return {
      products: [],
      categoriesToCreate: [],
      variantsToCreate: [],
      totalRows: 0,
      error: msg,
    };
  }
}
