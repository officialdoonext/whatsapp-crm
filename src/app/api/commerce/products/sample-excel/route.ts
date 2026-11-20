import { NextResponse } from 'next/server';
import {
  generateSampleProductsWorkbook,
  generateSampleProductsCsv,
} from '@/lib/commerce/sample-products-data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format')?.toLowerCase();

    if (format === 'csv') {
      const csvContent = generateSampleProductsCsv();
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="sample_products_50.csv"',
        },
      });
    }

    // Default: Excel .xlsx workbook
    const buffer = generateSampleProductsWorkbook();
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="sample_products_50.xlsx"',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate sample file';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
