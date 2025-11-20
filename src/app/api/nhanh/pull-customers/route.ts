import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for long-running operation

/**
 * POST /api/nhanh/pull-customers
 * Pull all customers from Nhanh.vn and save to database
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Starting to pull customers from Nhanh.vn...");
    
    // Get all customers from Nhanh.vn
    const allCustomers = await nhanhAPI.getAllCustomers(100);
    console.log(`Fetched ${allCustomers.length} customers from Nhanh.vn`);

    // Save to database using upsert
    let created = 0;
    let updated = 0;
    
    for (const customer of allCustomers) {
      const result = await prisma.nhanhCustomer.upsert({
        where: { id: customer.id },
        create: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone || null,
          email: customer.email || null,
          totalSpent: customer.totalSpent,
          address: customer.address || null,
          city: customer.city || null,
          district: customer.district || null,
          ward: customer.ward || null,
          lastPulledAt: new Date(),
        },
        update: {
          name: customer.name,
          phone: customer.phone || null,
          email: customer.email || null,
          totalSpent: customer.totalSpent,
          address: customer.address || null,
          city: customer.city || null,
          district: customer.district || null,
          ward: customer.ward || null,
          lastPulledAt: new Date(),
        },
      });
      
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++;
      } else {
        updated++;
      }
    }

    console.log(`Pull completed: ${created} created, ${updated} updated`);

    return NextResponse.json({
      success: true,
      data: {
        total: allCustomers.length,
        created,
        updated,
      },
    });
  } catch (error: any) {
    console.error("Error pulling customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull customers from Nhanh.vn",
      },
      { status: 500 }
    );
  }
}
