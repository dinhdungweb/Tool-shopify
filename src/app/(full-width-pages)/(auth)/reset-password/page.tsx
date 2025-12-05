import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password | Shopify Sync",
  description: "Create a new password",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
