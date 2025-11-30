"use client";

import { useState, useEffect, useCallback } from "react";

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
  error?: string;
  metadata?: {
    speed?: string;
    eta?: string;
    duration?: string;
    rateLimitHits?: number;
  };
}

interface SyncProgressIndicatorProps {
  jobType: "PRODUCT_SYNC" | "CUSTOMER_SYNC";
  onComplete?: () => void;
  className?: string;
}

export default function SyncProgressIndicator({
  jobType,
  onComplete,
  className = "",
}: SyncProgressIndicatorProps) {
  const [job, setJob] = useState<BackgroundJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      const response = await fetch(`/api/sync/job-progress?type=${jobType}`);
      const result = await response.json();

      if (result.success && result.data?.latestJob) {
        const latestJob = result.data.latestJob;
        setJob(latestJob);

        // Check if job is still running
        if (latestJob.status === "RUNNING") {
          setIsPolling(true);
        } else {
          setIsPolling(false);
          // Call onComplete when job finishes
          if (latestJob.status === "COMPLETED" || latestJob.status === "FAILED") {
            onComplete?.();
          }
        }
      } else {
        setJob(null);
        setIsPolling(false);
      }
    } catch (error) {
      console.error("Error fetching job progress:", error);
    }
  }, [jobType, onComplete]);

  // Initial fetch
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  // Polling when job is running
  useEffect(() => {
    if (!isPolling) return;

    const interval = setInterval(fetchProgress, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [isPolling, fetchProgress]);

  // Don't show if no job or job is old (completed more than 30 seconds ago)
  if (!job) return null;
  
  const isRecent = job.completedAt 
    ? new Date().getTime() - new Date(job.completedAt).getTime() < 30000 
    : true;
  
  if (!isRecent && job.status !== "RUNNING") return null;

  const progress = job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;
  const isRunning = job.status === "RUNNING";
  const isCompleted = job.status === "COMPLETED";
  const isFailed = job.status === "FAILED";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isRunning
          ? "border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-900/20"
          : isCompleted
          ? "border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20"
          : isFailed
          ? "border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20"
          : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20"
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isRunning && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600"></div>
          )}
          {isCompleted && (
            <svg className="h-5 w-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {isFailed && (
            <svg className="h-5 w-5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className={`text-sm font-medium ${
            isRunning ? "text-brand-700 dark:text-brand-400" :
            isCompleted ? "text-success-700 dark:text-success-400" :
            isFailed ? "text-danger-700 dark:text-danger-400" :
            "text-gray-700 dark:text-gray-400"
          }`}>
            {isRunning ? "Syncing in progress..." : 
             isCompleted ? "Sync completed!" : 
             isFailed ? "Sync failed" : "Sync"}
          </span>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            isRunning ? "bg-brand-500" :
            isCompleted ? "bg-success-500" :
            isFailed ? "bg-danger-500" : "bg-gray-400"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
        <span>
          <span className="font-medium">{job.processed}</span> / {job.total} processed
        </span>
        <span className="text-success-600 dark:text-success-400">
          ✓ {job.successful} successful
        </span>
        {job.failed > 0 && (
          <span className="text-danger-600 dark:text-danger-400">
            ✗ {job.failed} failed
          </span>
        )}
        {job.metadata?.speed && isRunning && (
          <span>⚡ {job.metadata.speed}</span>
        )}
        {job.metadata?.eta && isRunning && (
          <span>⏱️ ETA: {job.metadata.eta}</span>
        )}
        {job.metadata?.duration && isCompleted && (
          <span>⏱️ {job.metadata.duration}</span>
        )}
      </div>

      {/* Error message */}
      {job.error && (
        <div className="mt-2 text-xs text-danger-600 dark:text-danger-400">
          Error: {job.error}
        </div>
      )}
    </div>
  );
}
