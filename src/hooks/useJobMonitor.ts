"use client";

import { useEffect, useRef, useCallback } from "react";

interface JobMonitorOptions {
  onJobCompleted?: (job: any) => void;
  onJobFailed?: (job: any) => void;
  pollInterval?: number;
  enabled?: boolean;
}

export function useJobMonitor(options: JobMonitorOptions = {}) {
  const {
    onJobCompleted,
    onJobFailed,
    pollInterval = 3000,
    enabled = true,
  } = options;

  const trackedJobsRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkJobs = useCallback(async () => {
    try {
      const response = await fetch("/api/sync/job-progress?all=true&limit=50");
      const result = await response.json();

      if (result.success && result.data.jobs) {
        const jobs = result.data.jobs;

        jobs.forEach((job: any) => {
          const wasTracked = trackedJobsRef.current.has(job.id);

          // Track running jobs
          if (job.status === "RUNNING") {
            trackedJobsRef.current.add(job.id);
          }

          // Detect completion
          if (wasTracked && job.status === "COMPLETED") {
            trackedJobsRef.current.delete(job.id);
            onJobCompleted?.(job);
          }

          // Detect failure
          if (wasTracked && job.status === "FAILED") {
            trackedJobsRef.current.delete(job.id);
            onJobFailed?.(job);
          }
        });

        // Clean up old tracked jobs that are no longer in the list
        const currentJobIds = new Set(jobs.map((j: any) => j.id));
        trackedJobsRef.current.forEach((id) => {
          if (!currentJobIds.has(id)) {
            trackedJobsRef.current.delete(id);
          }
        });
      }
    } catch (error) {
      console.error("Error checking jobs:", error);
    }
  }, [onJobCompleted, onJobFailed]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check
    checkJobs();

    // Set up polling
    intervalRef.current = setInterval(checkJobs, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, pollInterval, checkJobs]);

  return {
    checkJobs,
  };
}
