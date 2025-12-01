/**
 * Format duration in seconds to human-readable string
 * @param seconds Duration in seconds (can be string or number)
 * @returns Formatted string like "5m 30s" or "1h 23m"
 */
export function formatDuration(seconds: number | string): string {
  const sec = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  
  if (sec < 60) {
    return `${Math.round(sec)}s`;
  }
  
  if (sec < 3600) {
    const minutes = Math.floor(sec / 60);
    const remainingSeconds = Math.round(sec % 60);
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }
  
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}
