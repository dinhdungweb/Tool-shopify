import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";
import { Suspense } from "react";
import { Loader } from "@/components/ui/loader";

export const metadata: Metadata = {
  title: "Sign In | Shopify Sync",
  description: "Sign in to your account",
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

export default function SignIn() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SignInForm />
    </Suspense>
  );
}
