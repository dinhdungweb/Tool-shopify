/**
 * Export data to CSV file
 */
export function exportToCSV(data: any[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) {
    alert("No data to export");
    return;
  }

  // If columns not specified, use all keys from first object
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

  // Create CSV header
  const header = cols.map(col => `"${col.label}"`).join(",");

  // Create CSV rows
  const rows = data.map(item => {
    return cols.map(col => {
      const value = item[col.key];
      
      // Handle different data types
      if (value === null || value === undefined) {
        return '""';
      }
      
      if (typeof value === 'object') {
        return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      }
      
      // Escape quotes and wrap in quotes
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(",");
  });

  // Combine header and rows
  const csv = [header, ...rows].join("\n");

  // Create blob and download
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // Add BOM for Excel
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleString("vi-VN");
}

/**
 * Format currency for export
 */
export function formatCurrencyForExport(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}
