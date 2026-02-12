"use client";

import { useEffect, useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "../ui/table";
import Badge from "../ui/badge/Badge";
import Switch from "../form/switch/Switch";
import Select from "../form/Select";
import { Loader, SpinnerIcon } from "../ui/loader";

interface BackgroundJob {
  id: string;
  type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  error?: string;
  metadata?: {
    speed?: string;
    eta?: string;
    duration?: string;
    rateLimitHits?: number;
    estimatedSpeed?: string;
    estimatedTime?: string;
  };
}

const JOB_TYPE_LABELS: Record<string, string> = {
  PRODUCT_SYNC: "Product Sync",
  CUSTOMER_SYNC: "Customer Sync",
  PULL_SHOPIFY_PRODUCTS: "Pull Shopify Products",
  PULL_NHANH_PRODUCTS: "Pull Nhanh Products",
  PULL_SHOPIFY_CUSTOMERS: "Pull Shopify Customers",
  PULL_NHANH_CUSTOMERS: "Pull Nhanh Customers",
  AUTO_MATCH_PRODUCTS: "Auto Match Products",
  AUTO_MATCH_CUSTOMERS: "Auto Match Customers",
};

const STATUS_BADGE_CONFIG: Record<string, { color: "light" | "primary" | "success" | "error" | "warning"; icon?: string }> = {
  PENDING: { color: "light" },
  RUNNING: { color: "primary", icon: "pulse" },
  COMPLETED: { color: "success" },
  FAILED: { color: "error" },
  CANCELLED: { color: "warning" },
};

import { exportToCSV } from "@/lib/export-utils";

export default function JobTrackingTable() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCount, setRunningCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const fetchJobs = useCallback(async (page = 1) => {
    try {
      const response = await fetch(`/api/sync/job-progress?all=true&limit=${pageSize}&page=${page}`);
      const result = await response.json();

      if (result.success) {
        setJobs(result.data.jobs);
        setRunningCount(result.data.runningCount);
        setTotalPages(result.data.totalPages);
        setTotalCount(result.data.totalCount);
        setCurrentPage(result.data.currentPage);
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh when there are running jobs
  useEffect(() => {
    if (!autoRefresh || runningCount === 0) return;

    const interval = setInterval(() => fetchJobs(currentPage), 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, runningCount, fetchJobs, currentPage]);

  const filteredJobs = jobs.filter((job) => {
    if (filter === "all") return true;
    if (filter === "running") return job.status === "RUNNING";
    if (filter === "completed") return job.status === "COMPLETED";
    if (filter === "failed") return job.status === "FAILED";
    return job.type === filter;
  });

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function formatDuration(startedAt: string, completedAt?: string) {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  function getProgress(job: BackgroundJob) {
    if (job.total === 0) return 0;
    return Math.round((job.processed / job.total) * 100);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Background Jobs
              </h3>
              {runningCount > 0 && (
                <Badge
                  color="primary"
                  size="sm"
                  startIcon={<span className="h-2 w-2 animate-pulse rounded-full bg-brand-500"></span>}
                >
                  {runningCount} running
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor all background jobs including sync, pull, and auto-match operations
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto Refresh Toggle */}
            <Switch
              label="Auto refresh"
              defaultChecked={autoRefresh}
              onChange={setAutoRefresh}
            />

            {/* Refresh Button */}
            <button
              onClick={() => fetchJobs(currentPage)}
              disabled={loading}
              className="inline-flex h-[40px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              <svg
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>

            {/* Filter */}
            <div className="w-56">
              <Select
                options={[
                  { value: "all", label: "All Jobs" },
                  { value: "running", label: "Running" },
                  { value: "completed", label: "Completed" },
                  { value: "failed", label: "Failed" },
                  { value: "PRODUCT_SYNC", label: "Product Sync" },
                  { value: "CUSTOMER_SYNC", label: "Customer Sync" },
                  { value: "PULL_SHOPIFY_PRODUCTS", label: "Pull Shopify Products" },
                  { value: "PULL_NHANH_PRODUCTS", label: "Pull Nhanh Products" },
                  { value: "PULL_SHOPIFY_CUSTOMERS", label: "Pull Shopify Customers" },
                  { value: "PULL_NHANH_CUSTOMERS", label: "Pull Nhanh Customers" },
                  { value: "AUTO_MATCH_PRODUCTS", label: "Auto Match Products" },
                  { value: "AUTO_MATCH_CUSTOMERS", label: "Auto Match Customers" },
                ]}
                defaultValue={filter}
                onChange={setFilter}
                placeholder="Filter jobs"
                className="!h-[40px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="border-gray-100 dark:border-gray-800 border-y bg-gray-50 dark:bg-gray-900">
            <TableRow>
              <TableCell isHeader>Type</TableCell>
              <TableCell isHeader>Status</TableCell>
              <TableCell isHeader>Progress</TableCell>
              <TableCell isHeader>Results</TableCell>
              <TableCell isHeader>Speed</TableCell>
              <TableCell isHeader>Duration</TableCell>
              <TableCell isHeader>Started</TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Loader />
                </TableCell>
              </TableRow>
            ) : filteredJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-gray-500">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              filteredJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {job.status === "RUNNING" && (
                          <div className="h-2 w-2 animate-pulse rounded-full bg-brand-500"></div>
                        )}
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {JOB_TYPE_LABELS[job.type] || job.type}
                        </span>
                      </div>
                      {job.error && (
                        <span className="text-xs text-error-600 dark:text-error-400" title={job.error}>
                          {job.error.length > 50 ? job.error.substring(0, 50) + "..." : job.error}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      color={STATUS_BADGE_CONFIG[job.status]?.color || "light"}
                      size="sm"
                      startIcon={
                        job.status === "RUNNING" ? (
                          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500"></span>
                        ) : undefined
                      }
                    >
                      {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>{job.processed} / {job.total}</span>
                        <span>{getProgress(job)}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                        <div
                          className={`h-1.5 rounded-full transition-all ${job.status === "RUNNING"
                            ? "bg-brand-500"
                            : job.status === "COMPLETED"
                              ? "bg-success-500"
                              : job.status === "FAILED"
                                ? "bg-error-500"
                                : "bg-gray-400"
                            }`}
                          style={{ width: `${getProgress(job)}%` }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge color="success" size="sm">
                        ✓ {job.successful}
                      </Badge>
                      {job.failed > 0 && (
                        <Badge color="error" size="sm">
                          ✗ {job.failed}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {job.metadata?.speed || job.metadata?.estimatedSpeed || "-"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {job.metadata?.duration || formatDuration(job.startedAt, job.completedAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(job.startedAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Footer & Pagination */}
      <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            <span>
              Total: <strong>{totalCount}</strong> jobs
            </span>
            <span className="flex items-center gap-2">
              Running: <Badge color="primary" size="sm">{runningCount}</Badge>
            </span>
            <span className="flex items-center gap-2">
              Completed: <Badge color="success" size="sm">{jobs.filter((j) => j.status === "COMPLETED").length}</Badge>
            </span>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchJobs(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchJobs(pageNum)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                          ? "bg-brand-500 text-white"
                          : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => fetchJobs(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
