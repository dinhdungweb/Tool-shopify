import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password | Shopify Sync",
  description: "Reset your password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
