"use client";

import { useEffect, useState } from "react";

export default function TestPagination() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function testAPI() {
    setLoading(true);
    try {
      const response = await fetch("/api/nhanh/customers?page=1&limit=50");
      const result = await response.json();
      console.log("API Response:", result);
      setData(result);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    testAPI();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pagination Test</h1>
      
      {loading && <p>Loading...</p>}
      
      {data && (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="font-semibold mb-2">API Response:</h2>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="font-semibold mb-2">Parsed Data:</h2>
            <ul className="space-y-1 text-sm">
              <li>Success: {data.success ? "✅" : "❌"}</li>
              <li>Customers Count: {data.data?.customers?.length || 0}</li>
              <li>Total: {data.data?.total || 0}</li>
              <li>Page: {data.data?.page || 0}</li>
              <li>Limit: {data.data?.limit || 0}</li>
              <li>Has More: {data.data?.hasMore ? "✅ Yes" : "❌ No"}</li>
              <li>Has Next Cursor: {data.data?.next ? "✅ Yes" : "❌ No"}</li>
              {data.data?.next && (
                <li>Next Cursor: {JSON.stringify(data.data.next)}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
