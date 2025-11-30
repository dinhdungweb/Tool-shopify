import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const filter = searchParams.get("filter") || "all";
    const limit = parseInt(searchParams.get("limit") || "1000");

    // Build query based on filter
    const where: any = {};

    if (filter === "running") {
      where.status = "RUNNING";
    } else if (filter === "completed") {
      where.status = "COMPLETED";
    } else if (filter === "failed") {
      where.status = "FAILED";
    } else if (filter !== "all") {
      where.type = filter;
    }

    // Get jobs
    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Format data for export
    const exportData = jobs.map(job => {
      const duration = job.completedAt 
        ? Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
        : Math.round((Date.now() - new Date(job.startedAt).getTime()) / 1000);

      return {
        "Job ID": job.id,
        "Type": job.type.replace(/_/g, " "),
        "Status": job.status,
        "Total": job.total,
        "Processed": job.processed,
        "Successful": job.successful,
        "Failed": job.failed,
        "Progress %": job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0,
        "Duration (seconds)": duration,
        "Speed": job.metadata?.speed || "",
        "Started At": new Date(job.startedAt).toLocaleString("vi-VN"),
        "Completed At": job.completedAt 
          ? new Date(job.completedAt).toLocaleString("vi-VN")
          : "",
        "Error": job.error || "",
      };
    });

    return NextResponse.json({
      success: true,
      data: exportData,
      total: exportData.length,
    });
  } catch (error: any) {
    console.error("Error exporting jobs:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
