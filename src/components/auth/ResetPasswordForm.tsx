"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect } from "react";
import { Loader } from "@/components/ui/loader";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
      setVerifying(false);
      return;
    }

    // Verify token
    fetch(`/api/auth/reset-password?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEmail(data.email);
        } else {
          setError(data.error || "Invalid or expired reset link");
        }
      })
      .catch(() => {
        setError("Failed to verify reset link");
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/signin");
      }, 2000);
    } catch (err) {
      setError("Failed to reset password. Please try again.");
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col flex-1 lg:w-1/2 w-full items-center justify-center">
        <div className="text-center">
          <Loader size="lg" text="Verifying reset link..." />
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col flex-1 lg:w-1/2 w-full">
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
          <div className="p-6 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800">
            <h2 className="mb-2 text-lg font-semibold text-success-800 dark:text-success-400">
              Password Reset Successful!
            </h2>
            <p className="text-sm text-success-700 dark:text-success-300">
              Your password has been reset successfully. Redirecting to sign in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !token) {
    return (
      <div className="flex flex-col flex-1 lg:w-1/2 w-full">
        <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
          <Link
            href="/signin"
            className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ChevronLeftIcon />
            Back to sign in
          </Link>
        </div>
        <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
          <div className="p-6 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
            <h2 className="mb-2 text-lg font-semibold text-error-800 dark:text-error-400">
              Invalid Reset Link
            </h2>
            <p className="text-sm text-error-700 dark:text-error-300">{error}</p>
            <Link
              href="/forgot-password"
              className="inline-block mt-4 text-sm text-brand-500 hover:text-brand-600"
            >
              Request a new reset link →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/signin"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to sign in
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Reset Password
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your new password for <strong>{email}</strong>
            </p>
          </div>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800">
                <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <Label>
                  New Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>
              <div>
                <Label>
                  Confirm Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <span
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showConfirmPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>
              <div>
                <Button type="submit" className="w-full" size="sm" disabled={loading}>
                  {loading ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
