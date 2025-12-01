// API Route: System Logs
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const level = searchParams.get("level") || "all";
    const source = searchParams.get("source") || "all";
    const search = searchParams.get("search") || "";

    // Build where clause
    const where: any = {};

    // For now, we'll use BackgroundJob as logs
    // In the future, you can create a separate SystemLog model
    const jobs = await prisma.backgroundJob.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    // Transform jobs to log format
    const logs = jobs.map((job) => ({
      id: job.id,
      timestamp: job.createdAt.toISOString(),
      level: job.status === "FAILED" ? "error" : job.status === "COMPLETED" ? "info" : "debug",
      message: `${job.type}: ${job.status} (${job.processed}/${job.total})`,
      source: job.type,
      metadata: {
        jobId: job.id,
        type: job.type,
        status: job.status,
        total: job.total,
        processed: job.processed,
        successful: job.successful,
        failed: job.failed,
        error: job.error,
        ...(job.metadata as object || {}),
      },
    }));

    // Apply filters
    let filteredLogs = logs;

    if (level !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    if (source !== "all") {
      filteredLogs = filteredLogs.filter((log) => log.source === source);
    }

    if (search) {
      filteredLogs = filteredLogs.filter((log) =>
        log.message.toLowerCase().includes(search.toLowerCase())
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: filteredLogs,
        total: filteredLogs.length,
      },
    });
  } catch (error: any) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Keep last 100 jobs, delete all others
    const recentJobs = await prisma.backgroundJob.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    const recentIds = recentJobs.map((j) => j.id);

    // Delete all jobs except the recent 100
    await prisma.backgroundJob.deleteMany({
      where: {
        id: { notIn: recentIds },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Logs cleared successfully",
    });
  } catch (error: any) {
    console.error("Error clearing logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
