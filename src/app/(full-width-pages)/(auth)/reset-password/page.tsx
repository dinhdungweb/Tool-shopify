import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Metadata } from "next";
import { Suspense } from "react";
import { Loader } from "@/components/ui/loader";

export const metadata: Metadata = {
  title: "Reset Password | Shopify Sync",
  description: "Create a new password",
};

function LoadingFallback() {
  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full items-center justify-center">
      <div className="text-center">
        <Loader size="lg" text="Loading..." />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
