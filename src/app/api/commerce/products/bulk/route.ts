import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import { parseProductsBuffer, type ParsedStoreProduct } from '@/lib/commerce/parse-products-file';

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');

    let productsToImport: ParsedStoreProduct[] = [];
    let categoriesToProcess: string[] = [];
    let variantsToProcess: { label: string; options: string[] }[] = [];

    const contentType = request.headers.get('content-type') || '';

    // A. If uploaded as FormData file
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const buffer = await file.arrayBuffer();
      const parseResult = parseProductsBuffer(buffer);

      if (parseResult.error || parseResult.products.length === 0) {
        return NextResponse.json(
          { error: parseResult.error || 'No valid product rows found in file' },
          { status: 400 }
        );
      }

      productsToImport = parseResult.products;
      categoriesToProcess = parseResult.categoriesToCreate;
      variantsToProcess = parseResult.variantsToCreate;
    } else {
      // B. If submitted as JSON
      const body = await request.json();
      productsToImport = body.products || [];
      categoriesToProcess = body.categoriesToCreate || [];
      variantsToProcess = body.variantsToCreate || [];
    }

    if (productsToImport.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 });
    }

    // 1. Process & Auto-create Categories
    let categoriesCreatedCount = 0;
    if (categoriesToProcess.length > 0) {
      // Fetch existing categories
      const { data: existingCats } = await supabase
        .from('commerce_categories')
        .select('name')
        .eq('account_id', accountId);

      const existingCatNames = new Set(
        (existingCats || []).map((c) => c.name.trim().toLowerCase())
      );

      for (const catName of categoriesToProcess) {
        const trimmed = catName.trim();
        if (!trimmed || existingCatNames.has(trimmed.toLowerCase())) continue;

        const slug = trimmed
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');

        const { error: catErr } = await supabase.from('commerce_categories').insert({
          account_id: accountId,
          name: trimmed,
          slug,
        });

        if (!catErr) {
          categoriesCreatedCount++;
          existingCatNames.add(trimmed.toLowerCase());
        }
      }
    }

    // 2. Process & Auto-create / Update Variants
    let variantsCreatedCount = 0;
    if (variantsToProcess.length > 0) {
      // Fetch existing variants
      const { data: existingVars } = await supabase
        .from('commerce_variants')
        .select('id, label, options')
        .eq('account_id', accountId);

      const existingVarMap = new Map(
        (existingVars || []).map((v) => [v.label.trim().toLowerCase(), v])
      );

      for (const item of variantsToProcess) {
        const labelTrimmed = item.label.trim();
        if (!labelTrimmed) continue;

        const key = labelTrimmed.toLowerCase();
        const existing = existingVarMap.get(key);

        if (!existing) {
          // Create new variant
          const { error: vErr } = await supabase.from('commerce_variants').insert({
            account_id: accountId,
            label: labelTrimmed,
            options: item.options || [],
          });
          if (!vErr) variantsCreatedCount++;
        } else {
          // Merge new option values
          const merged = Array.from(new Set([...(existing.options || []), ...item.options]));
          if (merged.length > (existing.options || []).length) {
            await supabase
              .from('commerce_variants')
              .update({ options: merged, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          }
        }
      }
    }

    // 3. Insert or Update Store Products
    let importedProductsCount = 0;
    for (const p of productsToImport) {
      const primaryImage = p.images && p.images.length > 0 ? p.images[0] : null;

      const payload = {
        account_id: accountId,
        name: p.name,
        short_code: p.short_code,
        description: p.description || null,
        list_price: p.list_price || 0,
        sale_price: p.sale_price || p.list_price || 0,
        food_type: p.food_type || 'others',
        tax_config: p.tax_config || { inclusive: true },
        variants_config: p.variants_config || [],
        nutrition_table: p.nutrition_table || [],
        images: p.images || [],
        image_url: primaryImage,
        category: p.category || null,
        is_active: true,
        metadata: {
          short_code: p.short_code,
          food_type: p.food_type,
          list_price: p.list_price,
          sale_price: p.sale_price,
          tax_config: p.tax_config,
          variants: p.variants_config,
          nutrition_table: p.nutrition_table,
          images: p.images,
        },
        updated_at: new Date().toISOString(),
      };

      // Try insert into store_products
      const { error: spErr } = await supabase.from('store_products').insert(payload);

      if (spErr && spErr.code === '42P01') {
        // Fallback to commerce_products with catalog_id = 'default'
        await supabase.from('commerce_products').upsert(
          {
            ...payload,
            catalog_id: 'default',
            retailer_id: p.short_code,
            price: p.sale_price || p.list_price || 0,
            currency: 'INR',
            availability: 'in stock',
          },
          { onConflict: 'account_id,retailer_id' }
        );
      }

      importedProductsCount++;
    }

    return NextResponse.json({
      success: true,
      importedCount: importedProductsCount,
      categoriesCreatedCount,
      variantsCreatedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bulk import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
