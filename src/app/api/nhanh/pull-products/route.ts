// API Route: Pull Products from Nhanh and save to database
import { NextRequest, NextResponse } from "next/server";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    console.log("Starting to pull products from Nhanh...");

    // Fetch all products from Nhanh
    const products = await nhanhProductAPI.getAllProducts(100);

    console.log(`Fetched ${products.length} products from Nhanh`);

    let created = 0;
    let updated = 0;

    // Save to database
    for (const product of products) {
      try {
        const existing = await prisma.nhanhProduct.findUnique({
          where: { id: product.id },
        });

        if (existing) {
          await prisma.nhanhProduct.update({
            where: { id: product.id },
            data: {
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              price: product.price,
              comparePrice: product.comparePrice,
              quantity: product.quantity,
              categoryId: product.categoryId,
              categoryName: product.categoryName,
              brandId: product.brandId,
              brandName: product.brandName,
              description: product.description,
              images: product.images || [],
              lastPulledAt: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.nhanhProduct.create({
            data: {
              id: product.id,
              name: product.name,
              sku: product.sku,
              barcode: product.barcode,
              price: product.price,
              comparePrice: product.comparePrice,
              quantity: product.quantity,
              categoryId: product.categoryId,
              categoryName: product.categoryName,
              brandId: product.brandId,
              brandName: product.brandName,
              description: product.description,
              images: product.images || [],
              lastPulledAt: new Date(),
            },
          });
          created++;
        }
      } catch (error) {
        console.error(`Error saving product ${product.id}:`, error);
      }
    }

    console.log(`Pull completed: ${created} created, ${updated} updated`);

    return NextResponse.json({
      success: true,
      data: {
        total: products.length,
        created,
        updated,
      },
    });
  } catch (error: any) {
    console.error("Error pulling products:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull products",
      },
      { status: 500 }
    );
  }
}
