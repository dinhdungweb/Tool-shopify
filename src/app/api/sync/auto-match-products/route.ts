import { NextRequest, NextResponse } from "next/server";
import { SyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreContextOrDefault } from "@/lib/store-context";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ProductMatchRow {
  nhanh_id: string;
  nhanh_name: string;
  nhanh_sku: string | null;
  nhanh_barcode: string | null;
  nhanh_price: any;
  shopify_id: string;
  shopify_title: string;
  shopify_sku: string | null;
  shopify_barcode: string | null;
}

/** Auto-match products between Nhanh and Shopify by exact normalized SKU. */
export async function POST(request: NextRequest) {
  let job: { id: string } | null = null;

  try {
    const { dryRun = false } = await request.json().catch(() => ({ dryRun: false }));
    const { storeId } = await getStoreContextOrDefault(request);
    job = await prisma.backgroundJob.create({
      data: {
        type: "AUTO_MATCH_PRODUCTS",
        storeId,
        total: 0,
        status: "RUNNING",
        metadata: { dryRun },
      },
      select: { id: true },
    });

    const startTime = Date.now();
    const matches = await prisma.$queryRaw<ProductMatchRow[]>`
      SELECT
        np.id AS nhanh_id,
        np.name AS nhanh_name,
        np.sku AS nhanh_sku,
        np.barcode AS nhanh_barcode,
        np.price AS nhanh_price,
        sp."shopifyId" AS shopify_id,
        sp.title AS shopify_title,
        sp.sku AS shopify_sku,
        sp.barcode AS shopify_barcode
      FROM nhanh_products np
      LEFT JOIN product_mappings pm ON (
        pm."nhanhProductId" = np.id
        AND pm."storeId" = ${storeId}
      )
      INNER JOIN shopify_products sp ON (
        sp."storeId" = ${storeId}
        AND LOWER(TRIM(np.sku)) = LOWER(TRIM(sp.sku))
        AND np.sku IS NOT NULL
        AND sp.sku IS NOT NULL
        AND TRIM(np.sku) <> ''
        AND TRIM(sp.sku) <> ''
      )
      WHERE np."storeId" = ${storeId}
        AND pm.id IS NULL
    `;

    const byNhanh = new Map<string, ProductMatchRow[]>();
    const byShopify = new Map<string, ProductMatchRow[]>();
    for (const match of matches) {
      byNhanh.set(match.nhanh_id, [...(byNhanh.get(match.nhanh_id) || []), match]);
      byShopify.set(match.shopify_id, [...(byShopify.get(match.shopify_id) || []), match]);
    }

    const exactMatches = Array.from(byNhanh.values())
      .filter((candidates) => {
        if (candidates.length !== 1) return false;
        return byShopify.get(candidates[0].shopify_id)?.length === 1;
      })
      .map((candidates) => candidates[0]);
    const skipped = Math.max(
      byNhanh.size - exactMatches.length,
      byShopify.size - exactMatches.length
    );

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        total: exactMatches.length,
        processed: exactMatches.length,
        metadata: {
          dryRun,
          potentialMatches: matches.length,
          exactMatches: exactMatches.length,
          skipped,
        },
      },
    }).catch(() => {});

    let createdCount = 0;
    if (!dryRun) {
      const batchSize = 500;
      for (let offset = 0; offset < exactMatches.length; offset += batchSize) {
        const batch = exactMatches.slice(offset, offset + batchSize);
        const created = await prisma.productMapping.createMany({
          data: batch.map((match) => ({
            storeId,
            nhanhProductId: match.nhanh_id,
            nhanhProductName: match.nhanh_name,
            nhanhSku: match.nhanh_sku,
            nhanhBarcode: match.nhanh_barcode,
            nhanhPrice: match.nhanh_price || 0,
            shopifyProductId: match.shopify_id,
            // Each local ShopifyProduct row represents a Shopify variant.
            shopifyVariantId: match.shopify_id,
            shopifyProductTitle: match.shopify_title,
            shopifySku: match.shopify_sku,
            shopifyBarcode: match.shopify_barcode,
            syncStatus: SyncStatus.PENDING,
          })),
          skipDuplicates: true,
        });
        createdCount += created.count;

        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: {
            successful: createdCount,
            metadata: {
              dryRun,
              potentialMatches: matches.length,
              exactMatches: exactMatches.length,
              created: createdCount,
              batches: Math.floor(offset / batchSize) + 1,
              totalBatches: Math.ceil(exactMatches.length / batchSize),
            },
          },
        }).catch(() => {});
      }
    }

    const durationSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    const durationFormatted = durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
    const speed = (exactMatches.length / durationSeconds).toFixed(1);

    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        total: exactMatches.length,
        processed: exactMatches.length,
        successful: dryRun ? 0 : createdCount,
        failed: 0,
        completedAt: new Date(),
        metadata: {
          dryRun,
          potentialMatches: matches.length,
          exactMatches: exactMatches.length,
          created: dryRun ? 0 : createdCount,
          skipped,
          duration: durationFormatted,
          speed: `${speed} products/sec`,
          method: "SQL JOIN by SKU",
        },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        total: matches.length,
        matched: exactMatches.length,
        failed: 0,
        skipped,
        details: exactMatches.slice(0, 100).map((match) => ({
          nhanhProduct: { id: match.nhanh_id, name: match.nhanh_name, sku: match.nhanh_sku },
          shopifyProduct: { id: match.shopify_id, title: match.shopify_title, sku: match.shopify_sku },
          status: "matched",
        })),
        dryRun,
        jobId: job.id,
        duration: durationFormatted,
        method: "SQL JOIN by SKU",
        message: dryRun
          ? `Dry run completed in ${durationFormatted}: ${exactMatches.length} potential matches found`
          : `Auto-match completed in ${durationFormatted}: ${createdCount} products matched by SKU`,
      },
    });
  } catch (error: any) {
    if (job?.id) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: error.message, completedAt: new Date() },
      }).catch(() => {});
    }
    return NextResponse.json(
      { success: false, error: error.message || "Failed to auto-match products" },
      { status: 500 }
    );
  }
}
