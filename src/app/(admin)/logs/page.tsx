"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast/ToastContainer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Select from "@/components/form/Select";
import Input from "@/components/form/input/InputField";
import Badge from "@/components/ui/badge/Badge";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  source?: string;
  metadata?: any;
}

export default function LogsPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState({
    level: "all",
    source: "all",
    search: "",
  });
  const [limit, setLimit] = useState(100);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "System Logs | Sync Dashboard";
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filter, limit]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadLogs, 3000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  async function loadLogs() {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        level: filter.level,
        source: filter.source,
        search: filter.search,
      });

      const response = await fetch(`/api/logs?${params}`);
      const result = await response.json();

      if (result.success) {
        setLogs(result.data.logs);
      } else {
        showToast(`Error loading logs: ${result.error}`, "error");
      }
    } catch (error: any) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  }

  function scrollToBottom() {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function clearLogs() {
    if (confirm("Are you sure you want to clear old logs? This will keep only the last 100 entries.")) {
      fetch("/api/logs", { method: "DELETE" })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            showToast("Logs cleared successfully", "success");
            loadLogs();
          } else {
            showToast(`Error clearing logs: ${result.error}`, "error");
          }
        })
        .catch((error) => {
          showToast(`Error: ${error.message}`, "error");
        });
    }
  }

  function exportLogs() {
    const logText = logs
      .map((log) => `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ""}${log.message}`)
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Logs exported successfully", "success");
  }

  function getLevelBadgeColor(level: string): "error" | "warning" | "info" | "light" {
    switch (level) {
      case "error":
        return "error";
      case "warn":
        return "warning";
      case "info":
        return "info";
      case "debug":
      default:
        return "light";
    }
  }

  function getLevelIcon(level: string) {
    switch (level) {
      case "error":
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "warn":
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case "info":
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "debug":
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      default:
        return null;
    }
  }

  const sources = Array.from(new Set(logs.map((log) => log.source).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
      </div>
    );
  }

  return (
    <>
      <PageBreadcrumb pageTitle="System Logs" />
      
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Monitor system activities and debug issues
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant={autoRefresh ? "primary" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              startIcon={
                <div className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-white animate-pulse" : "bg-gray-400"}`}></div>
              }
            >
              {autoRefresh ? "Auto Refresh ON" : "Auto Refresh OFF"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={scrollToBottom}
              startIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              }
            >
              Scroll to Bottom
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={exportLogs}
              startIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            >
              Export
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={clearLogs}
              className="bg-error-500 hover:bg-error-600"
              startIcon={
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              }
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Log Level
              </label>
              <Select
                options={[
                  { value: "all", label: "All Levels" },
                  { value: "error", label: "Error" },
                  { value: "warn", label: "Warning" },
                  { value: "info", label: "Info" },
                  { value: "debug", label: "Debug" },
                ]}
                defaultValue={filter.level}
                onChange={(value) => setFilter({ ...filter, level: value })}
                placeholder="Select level"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Source
              </label>
              <Select
                options={[
                  { value: "all", label: "All Sources" },
                  ...sources.map((source) => ({ value: source || "", label: source || "" })),
                ]}
                defaultValue={filter.source}
                onChange={(value) => setFilter({ ...filter, source: value })}
                placeholder="Select source"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Search
              </label>
              <Input
                type="text"
                placeholder="Search logs..."
                defaultValue={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Limit
              </label>
              <Select
                options={[
                  { value: "50", label: "50 logs" },
                  { value: "100", label: "100 logs" },
                  { value: "200", label: "200 logs" },
                  { value: "500", label: "500 logs" },
                ]}
                defaultValue={limit.toString()}
                onChange={(value) => setLimit(Number(value))}
                placeholder="Select limit"
              />
            </div>
          </div>
        </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/20">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Logs</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{logs.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/20">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Errors</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {logs.filter((log) => log.level === "error").length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/20">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Warnings</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {logs.filter((log) => log.level === "warn").length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/20">
              <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Info</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {logs.filter((log) => log.level === "info").length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Log Entries ({logs.length})
          </h2>
        </div>

        <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No logs found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                No logs match your current filters.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/20">
                  <div className="flex items-start gap-3">
                    <Badge
                      color={getLevelBadgeColor(log.level)}
                      variant="light"
                      size="sm"
                      startIcon={getLevelIcon(log.level)}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                        {log.source && (
                          <>
                            <span>•</span>
                            <span className="font-medium">{log.source}</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">
                        {log.message}
                      </p>
                      {log.metadata && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                            Show metadata
                          </summary>
                          <pre className="mt-2 overflow-x-auto custom-scrollbar rounded-lg bg-gray-100 p-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
      </div>
    </>
  );
}
