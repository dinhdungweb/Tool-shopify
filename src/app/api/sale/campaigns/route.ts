// API Route: Sale Campaigns CRUD
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/sale/campaigns
 * List all campaigns with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const targetType = searchParams.get("targetType");
    const search = searchParams.get("search");

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    const [campaigns, total] = await Promise.all([
      prisma.saleCampaign.findMany({
        where,
        include: {
          _count: {
            select: { priceChanges: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.saleCampaign.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error("Error fetching campaigns:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch campaigns",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sale/campaigns
 * Create new campaign
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      description,
      discountType,
      discountValue,
      targetType,
      targetIds,
      productType,
      collectionTitle,
      scheduleType,
      startDate,
      endDate,
    } = body;

    // Validation
    if (!name || !discountType || !discountValue || !targetType) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields",
        },
        { status: 400 }
      );
    }

    if (discountValue <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Discount value must be greater than 0",
        },
        { status: 400 }
      );
    }

    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return NextResponse.json(
        {
          success: false,
          error: "Percentage discount cannot exceed 100%",
        },
        { status: 400 }
      );
    }

    if (targetType === "PRODUCT" && (!targetIds || targetIds.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Product IDs are required for PRODUCT target type",
        },
        { status: 400 }
      );
    }

    if (targetType === "COLLECTION" && (!targetIds || targetIds.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Collection ID is required for COLLECTION target type",
        },
        { status: 400 }
      );
    }

    if (targetType === "PRODUCT_TYPE" && !productType) {
      return NextResponse.json(
        {
          success: false,
          error: "Product type is required for PRODUCT_TYPE target type",
        },
        { status: 400 }
      );
    }

    if (scheduleType === "SCHEDULED" && !startDate) {
      return NextResponse.json(
        {
          success: false,
          error: "Start date is required for scheduled campaigns",
        },
        { status: 400 }
      );
    }

    const campaign = await prisma.saleCampaign.create({
      data: {
        name,
        description,
        discountType,
        discountValue,
        targetType,
        targetIds: targetIds || [],
        productType,
        collectionTitle,
        scheduleType,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: scheduleType === "SCHEDULED" ? "SCHEDULED" : "DRAFT",
      },
    });

    return NextResponse.json({
      success: true,
      data: campaign,
    });
  } catch (error: any) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create campaign",
      },
      { status: 500 }
    );
  }
}
