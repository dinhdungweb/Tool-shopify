import type { Metadata } from "next";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import JobTrackingTable from "@/components/job-tracking/JobTrackingTable";

export const metadata: Metadata = {
  title: "Job Tracking | Sync Dashboard",
  description: "Monitor all background jobs - sync, pull, auto-match",
};

export default function JobTrackingPage() {
  return (
    <>
      <PageBreadcrumb pageTitle="Job Tracking" />
      <JobTrackingTable />
    </>
  );
}
