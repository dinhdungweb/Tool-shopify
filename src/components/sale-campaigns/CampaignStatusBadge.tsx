// Campaign Status Badge Component
import { CampaignStatus } from "@/types/sale";

interface CampaignStatusBadgeProps {
  status: CampaignStatus;
}

export default function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      case "SCHEDULED":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "APPLYING":
        return "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400";
      case "ACTIVE":
        return "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400";
      case "REVERTING":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "COMPLETED":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      case "CANCELLED":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      case "FAILED":
        return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case "DRAFT":
        return "Draft";
      case "SCHEDULED":
        return "Scheduled";
      case "APPLYING":
        return "Applying...";
      case "ACTIVE":
        return "Active";
      case "REVERTING":
        return "Reverting...";
      case "COMPLETED":
        return "Completed";
      case "CANCELLED":
        return "Cancelled";
      case "FAILED":
        return "Failed";
      default:
        return status;
    }
  };

  const getDotStyles = () => {
    switch (status) {
      case "ACTIVE":
        return "bg-success-500";
      case "SCHEDULED":
        return "bg-blue-500";
      case "APPLYING":
        return "bg-warning-500 animate-pulse";
      case "REVERTING":
        return "bg-purple-500 animate-pulse";
      case "FAILED":
        return "bg-red-600";
      case "COMPLETED":
      case "CANCELLED":
      case "DRAFT":
      default:
        return "bg-gray-400";
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyles()}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${getDotStyles()}`} />
      {getStatusLabel()}
    </span>
  );
}
