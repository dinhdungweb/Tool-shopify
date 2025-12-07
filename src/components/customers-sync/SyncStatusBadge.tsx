import { SyncStatus } from "@/types/mapping";
import Badge from "../ui/badge/Badge";

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

export default function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const statusConfig: Record<string, { color: "light" | "warning" | "success" | "error" | "primary"; label: string }> = {
    UNMAPPED: {
      color: "light" as const,
      label: "Not Mapped",
    },
    PENDING: {
      color: "warning" as const,
      label: "Pending",
    },
    SYNCED: {
      color: "success" as const,
      label: "Synced",
    },
    FAILED: {
      color: "error" as const,
      label: "Failed",
    },
    PENDING_APPROVAL: {
      color: "primary" as const,
      label: "Cần Duyệt",
    },
  };

  const config = statusConfig[status as string] || statusConfig.PENDING;

  return (
    <Badge size="sm" color={config.color}>
      {config.label}
    </Badge>
  );
}
