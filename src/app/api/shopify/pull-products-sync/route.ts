// API Route: Pull Products from Shopify and save to database
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes
export const revalidate = 0; // Disable caching

export async function POST(request: NextRequest) {
  try {
    console.log("Starting to pull ALL Shopify products with GraphQL...");

    const shopDomain = process.env.SHOPIFY_STORE_URL || "";
    const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
    const graphqlUrl = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

    let created = 0;
    let updated = 0;
    let failed = 0;
    let totalFetched = 0;
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;

    // Pull all products using GraphQL pagination
    while (hasNextPage) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);

      const query = `
        query getProducts($cursor: String) {
          products(first: 50, after: $cursor, query: "status:active") {
            edges {
              node {
                id
                title
                handle
                productType
                vendor
                tags
                status
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      barcode
                      price
                      compareAtPrice
                      inventoryQuantity
                    }
                  }
                }
                images(first: 10) {
                  edges {
                    node {
                      url
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      const response: any = await axios.post(
        graphqlUrl,
        {
          query,
          variables: { cursor },
        },
        {
          headers: {
            "X-Shopify-Access-Token": accessToken,
            "Content-Type": "application/json",
          },
        }
      );

      // Check for GraphQL errors
      if (response.data.errors) {
        console.error("GraphQL errors:", response.data.errors);
        throw new Error(response.data.errors.map((e: any) => e.message).join(", "));
      }

      const data: any = response.data.data;
      const products: any[] = data?.products?.edges || [];
      const pageInfo: any = data?.products?.pageInfo;

      if (products.length === 0) {
        break;
      }

      console.log(`Fetched ${products.length} products in page ${pageCount}`);

      // Process products in this batch - save each variant as a separate record
      for (const edge of products) {
        try {
          const product = edge.node;
          const variants = product.variants?.edges || [];

          if (variants.length > 0) {
            // Loop through all variants
            for (const variantEdge of variants) {
              try {
                const variant = variantEdge.node;

                // Extract numeric ID from GraphQL ID (gid://shopify/ProductVariant/123456)
                const variantId = variant.id.split("/").pop() || variant.id;

                // Build title with variant name
                const fullTitle =
                  variant.title && variant.title !== "Default Title"
                    ? `${product.title} - ${variant.title}`
                    : product.title;

                // Upsert each variant as a separate product record
                const result = await prisma.shopifyProduct.upsert({
                  where: { id: variantId },
                  create: {
                    id: variantId,
                    title: fullTitle,
                    handle: product.handle,
                    productType: product.productType,
                    vendor: product.vendor,
                    tags: product.tags || [],
                    variantId: variantId,
                    sku: variant.sku || "",
                    barcode: variant.barcode || "",
                    price: parseFloat(variant.price || "0"),
                    compareAtPrice: variant.compareAtPrice
                      ? parseFloat(variant.compareAtPrice)
                      : null,
                    inventoryQuantity: variant.inventoryQuantity || 0,
                    images: product.images?.edges?.map((img: any) => img.node.url) || [],
                    lastPulledAt: new Date(),
                  },
                  update: {
                    title: fullTitle,
                    handle: product.handle,
                    productType: product.productType,
                    vendor: product.vendor,
                    tags: product.tags || [],
                    sku: variant.sku || "",
                    barcode: variant.barcode || "",
                    price: parseFloat(variant.price || "0"),
                    compareAtPrice: variant.compareAtPrice
                      ? parseFloat(variant.compareAtPrice)
                      : null,
                    inventoryQuantity: variant.inventoryQuantity || 0,
                    images: product.images?.edges?.map((img: any) => img.node.url) || [],
                    lastPulledAt: new Date(),
                  },
                  select: { createdAt: true, updatedAt: true },
                });

                totalFetched++;

                // Check if it was created or updated
                if (result.createdAt.getTime() === result.updatedAt.getTime()) {
                  created++;
                } else {
                  updated++;
                }
              } catch (variantError: any) {
                console.error(
                  `Error upserting variant:`,
                  variantError
                );
                failed++;
              }
            }
          }
        } catch (error: any) {
          console.error(`Error processing product ${edge.node.id}:`, error);
          failed++;
        }
      }

      console.log(`Total variants so far: ${totalFetched}`);

      // Check for next page
      hasNextPage = pageInfo?.hasNextPage || false;
      cursor = pageInfo?.endCursor || null;

      console.log(`Page ${pageCount} completed. Has more pages: ${hasNextPage}`);

      // Small delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `✅ Pull completed! Total variants: ${totalFetched}, Created: ${created}, Updated: ${updated}, Failed: ${failed}`
    );

    return NextResponse.json({
      success: true,
      data: {
        total: totalFetched,
        created,
        updated,
        failed,
        message: `Pulled ${totalFetched} product variants from Shopify across ${pageCount} pages`,
      },
    });
  } catch (error: any) {
    console.error("❌ Error pulling Shopify products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull products",
      },
      { status: 500 }
    );
  }
}
