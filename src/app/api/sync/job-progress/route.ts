// API Route: Get/Update Background Job Progress
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/sync/job-progress?type=PRODUCT_SYNC
 * GET /api/sync/job-progress?all=true - Get all jobs
 * Get latest job progress for a specific type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const jobId = searchParams.get("jobId");
    const all = searchParams.get("all");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get all jobs (for tracking page)
    if (all === "true") {
      const page = parseInt(searchParams.get("page") || "1");
      const skip = (page - 1) * limit;

      const [jobs, totalCount, runningCount] = await Promise.all([
        prisma.backgroundJob.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.backgroundJob.count(),
        prisma.backgroundJob.count({
          where: { status: "RUNNING" },
        }),
      ]);

      const stats = await prisma.backgroundJob.groupBy({
        by: ["type"],
        _count: { id: true },
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          jobs,
          totalCount,
          runningCount,
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          stats,
        },
      });
    }

    if (jobId) {
      // Get specific job by ID
      const job = await prisma.backgroundJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        return NextResponse.json(
          { success: false, error: "Job not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: job,
      });
    }

    if (!type) {
      return NextResponse.json(
        { success: false, error: "type, jobId, or all=true is required" },
        { status: 400 }
      );
    }

    // Get latest job of this type
    const job = await prisma.backgroundJob.findFirst({
      where: { type },
      orderBy: { createdAt: "desc" },
    });

    // Also get running jobs count
    const runningJobs = await prisma.backgroundJob.count({
      where: {
        type,
        status: "RUNNING",
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        latestJob: job,
        hasRunningJob: runningJobs > 0,
      },
    });
  } catch (error: any) {
    console.error("Error getting job progress:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sync/job-progress
 * Create a new background job
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, total, metadata } = body;

    if (!type || total === undefined) {
      return NextResponse.json(
        { success: false, error: "type and total are required" },
        { status: 400 }
      );
    }

    // Cancel any existing running jobs of this type
    await prisma.backgroundJob.updateMany({
      where: {
        type,
        status: "RUNNING",
      },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        error: "Cancelled by new job",
      },
    });

    // Create new job
    const job = await prisma.backgroundJob.create({
      data: {
        type,
        total,
        status: "RUNNING",
        metadata: metadata || {},
      },
    });

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sync/job-progress
 * Update job progress
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, processed, successful, failed, status, error, metadata } = body;

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: "jobId is required" },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (processed !== undefined) updateData.processed = processed;
    if (successful !== undefined) updateData.successful = successful;
    if (failed !== undefined) updateData.failed = failed;
    if (status) updateData.status = status;
    if (error) updateData.error = error;
    if (metadata) updateData.metadata = metadata;

    if (status === "COMPLETED" || status === "FAILED") {
      updateData.completedAt = new Date();
    }

    const job = await prisma.backgroundJob.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    console.error("Error updating job:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
