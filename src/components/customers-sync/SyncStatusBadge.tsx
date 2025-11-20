import { SyncStatus } from "@/types/mapping";
import Badge from "../ui/badge/Badge";

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

export default function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const statusConfig = {
    [SyncStatus.UNMAPPED]: {
      color: "light" as const,
      label: "Not Mapped",
    },
    [SyncStatus.PENDING]: {
      color: "warning" as const,
      label: "Pending",
    },
    [SyncStatus.SYNCED]: {
      color: "success" as const,
      label: "Synced",
    },
    [SyncStatus.FAILED]: {
      color: "error" as const,
      label: "Failed",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge size="sm" color={config.color}>
      {config.label}
    </Badge>
  );
}
