"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast/ToastContainer";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Badge from "@/components/ui/badge/Badge";
import LocationMappingTable, { LocationMappingTableRef } from "@/components/settings/LocationMappingTable";
import { Loader, SpinnerIcon } from "@/components/ui/loader";

export default function SettingsPage() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  // OAuth connection status
  const [oauthStatus, setOauthStatus] = useState({
    shopify: { connected: false, hasToken: false, hasStore: false },
    nhanh: { connected: false, hasToken: false, hasBusinessId: false },
  });
  const [connectingShopify, setConnectingShopify] = useState(false);
  const [connectingNhanh, setConnectingNhanh] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    document.title = "API Settings | Sync Dashboard";

    // Check for OAuth callback messages
    const shopifyStatus = searchParams.get("shopify");
    const nhanhStatus = searchParams.get("nhanh");
    const error = searchParams.get("error");

    if (shopifyStatus === "connected") {
      showToast("Shopify connected successfully!", "success");
    }
    if (nhanhStatus === "connected") {
      showToast("Nhanh.vn connected successfully!", "success");
    }
    if (error) {
      showToast(`Connection error: ${decodeURIComponent(error)}`, "error");
    }

    // Load OAuth status
    loadOAuthStatus();
  }, [searchParams]);

  async function loadOAuthStatus() {
    try {
      const response = await fetch("/api/auth/status");
      const result = await response.json();
      if (result.success) {
        setOauthStatus(result.data);
      }
    } catch (error) {
      console.error("Error loading OAuth status:", error);
    }
  }

  async function connectShopify() {
    const shop = prompt("Enter your Shopify store URL (e.g., your-store.myshopify.com):");
    if (!shop) return;

    setConnectingShopify(true);
    window.location.href = `/api/auth/shopify?shop=${encodeURIComponent(shop)}`;
  }

  async function connectNhanh() {
    setConnectingNhanh(true);
    window.location.href = "/api/auth/nhanh";
  }

  async function disconnectProvider(provider: "shopify" | "nhanh") {
    if (!confirm(`Are you sure you want to disconnect ${provider}?`)) return;

    setDisconnecting(provider);
    try {
      const response = await fetch(`/api/auth/status?provider=${provider}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (result.success) {
        showToast(`${provider} disconnected successfully`, "success");
        await loadOAuthStatus();
        await loadSettings();
      } else {
        showToast(`Failed to disconnect: ${result.error}`, "error");
      }
    } catch (error: any) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setDisconnecting(null);
    }
  }

  const [settings, setSettings] = useState({
    shopify: {
      storeUrl: "",
      accessToken: "",
    },
    nhanh: {
      apiUrl: "",
      appId: "",
      businessId: "",
      accessToken: "",
    },
    source: "environment" as "database" | "environment",
  });
  const [editMode, setEditMode] = useState(false);
  const [editedSettings, setEditedSettings] = useState({
    shopify: {
      storeUrl: "",
      accessToken: "",
    },
    nhanh: {
      apiUrl: "",
      appId: "",
      businessId: "",
      accessToken: "",
    },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testingNhanh, setTestingNhanh] = useState(false);
  const [testingShopify, setTestingShopify] = useState(false);
  const locationMappingRef = useRef<LocationMappingTableRef>(null);

  useEffect(() => {
    loadSettings();
  }, []);


  async function loadSettings() {
    try {
      const response = await fetch("/api/settings");
      const result = await response.json();

      if (result.success) {
        setSettings(result.data);
        setEditedSettings({
          shopify: {
            storeUrl: result.data.shopify.storeUrl,
            accessToken: "",
          },
          nhanh: {
            apiUrl: result.data.nhanh.apiUrl,
            appId: result.data.nhanh.appId,
            businessId: result.data.nhanh.businessId,
            accessToken: "",
          },
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);

      // Only send non-empty values
      const payload: any = {};

      if (editedSettings.shopify.storeUrl || editedSettings.shopify.accessToken) {
        payload.shopify = {};
        if (editedSettings.shopify.storeUrl) {
          payload.shopify.storeUrl = editedSettings.shopify.storeUrl;
        }
        if (editedSettings.shopify.accessToken) {
          payload.shopify.accessToken = editedSettings.shopify.accessToken;
        }
      }

      if (editedSettings.nhanh.apiUrl || editedSettings.nhanh.appId || editedSettings.nhanh.businessId || editedSettings.nhanh.accessToken) {
        payload.nhanh = {};
        if (editedSettings.nhanh.apiUrl) {
          payload.nhanh.apiUrl = editedSettings.nhanh.apiUrl;
        }
        if (editedSettings.nhanh.appId) {
          payload.nhanh.appId = editedSettings.nhanh.appId;
        }
        if (editedSettings.nhanh.businessId) {
          payload.nhanh.businessId = editedSettings.nhanh.businessId;
        }
        if (editedSettings.nhanh.accessToken) {
          payload.nhanh.accessToken = editedSettings.nhanh.accessToken;
        }
      }

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        showToast("Settings saved successfully!", "success");
        setEditMode(false);
        await loadSettings();
      } else {
        showToast(`Failed to save: ${result.error}`, "error");
      }
    } catch (error: any) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditMode(false);
    setEditedSettings({
      shopify: {
        storeUrl: settings.shopify.storeUrl,
        accessToken: "",
      },
      nhanh: {
        apiUrl: settings.nhanh.apiUrl,
        appId: settings.nhanh.appId,
        businessId: settings.nhanh.businessId,
        accessToken: "",
      },
    });
  }

  async function testNhanhConnection() {
    try {
      setTestingNhanh(true);
      const response = await fetch("/api/settings/test-nhanh");
      const result = await response.json();

      if (result.success) {
        showToast("Nhanh.vn connection successful!", "success");
      } else {
        showToast(`Nhanh.vn connection failed: ${result.error}`, "error");
      }
    } catch (error: any) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setTestingNhanh(false);
    }
  }

  async function testShopifyConnection() {
    try {
      setTestingShopify(true);
      const response = await fetch("/api/settings/test-shopify");
      const result = await response.json();

      if (result.success) {
        showToast("Shopify connection successful!", "success");
      } else {
        showToast(`Shopify connection failed: ${result.error}`, "error");
      }
    } catch (error: any) {
      showToast(`Error: ${error.message}`, "error");
    } finally {
      setTestingShopify(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!", "success", 2000);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <>
      <PageBreadcrumb pageTitle="API Settings" />

      <div className="space-y-6">
        {/* OAuth Connection Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Shopify OAuth Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <svg className="h-6 w-6 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 2.25a.75.75 0 01.75-.75h3.5a.75.75 0 010 1.5H17v2.457c2.09.72 3.588 2.706 3.588 5.043 0 .25-.009.499-.027.746l-.5 6a.75.75 0 01-.748.704H4.687a.75.75 0 01-.748-.704l-.5-6a7.556 7.556 0 01-.027-.746c0-2.337 1.499-4.323 3.588-5.043V3h-.75a.75.75 0 010-1.5h3.5a.75.75 0 01.75.75v3.128c.381-.084.777-.128 1.182-.128h.636c.405 0 .801.044 1.182.128V2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Shopify</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {oauthStatus.shopify.connected ? "Connected via OAuth" : "Not connected"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oauthStatus.shopify.connected ? (
                  <>
                    <Badge color="success">Connected</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectProvider("shopify")}
                      disabled={disconnecting === "shopify"}
                    >
                      {disconnecting === "shopify" ? <SpinnerIcon size="xs" /> : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={connectShopify}
                    disabled={connectingShopify}
                    startIcon={connectingShopify ? <SpinnerIcon size="xs" className="border-white border-t-transparent" /> : undefined}
                  >
                    {connectingShopify ? "Connecting..." : "Connect with OAuth"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Nhanh.vn OAuth Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                  <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Nhanh.vn</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {oauthStatus.nhanh.connected ? "Connected via OAuth" : "Not connected"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {oauthStatus.nhanh.connected ? (
                  <>
                    <Badge color="success">Connected</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => disconnectProvider("nhanh")}
                      disabled={disconnecting === "nhanh"}
                    >
                      {disconnecting === "nhanh" ? <SpinnerIcon size="xs" /> : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={connectNhanh}
                    disabled={connectingNhanh}
                    startIcon={connectingNhanh ? <SpinnerIcon size="xs" className="border-white border-t-transparent" /> : undefined}
                  >
                    {connectingNhanh ? "Connecting..." : "Connect with OAuth"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Manual Configuration Section */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Manual Configuration (Legacy)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure API credentials manually if OAuth is not available
                </p>
              </div>
              <svg className="h-5 w-5 text-gray-500 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>

            <div className="mt-6 space-y-6">
              {/* Header Actions */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure your API connections for Nhanh.vn and Shopify
                </p>

                {!editMode ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    startIcon={
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    }
                  >
                    Edit Settings
                  </Button>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={saveSettings}
                      disabled={saving}
                      startIcon={
                        saving ? (
                          <SpinnerIcon size="xs" className="border-white border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )
                      }
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Nhanh.vn Settings */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="border-b border-gray-200 p-4 sm:p-6 dark:border-gray-800">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Nhanh.vn API
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Configuration for Nhanh.vn POS system
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={testNhanhConnection}
                      disabled={testingNhanh}
                      startIcon={
                        testingNhanh ? (
                          <SpinnerIcon size="xs" className="border-white border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )
                      }
                    >
                      {testingNhanh ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {editMode ? (
                    <>
                      <EditableField
                        label="API URL"
                        value={editedSettings.nhanh.apiUrl}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          nhanh: { ...editedSettings.nhanh, apiUrl: value }
                        })}
                        placeholder="https://pos.open.nhanh.vn"
                      />
                      <EditableField
                        label="App ID"
                        value={editedSettings.nhanh.appId}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          nhanh: { ...editedSettings.nhanh, appId: value }
                        })}
                        placeholder="Your Nhanh app ID"
                      />
                      <EditableField
                        label="Business ID"
                        value={editedSettings.nhanh.businessId}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          nhanh: { ...editedSettings.nhanh, businessId: value }
                        })}
                        placeholder="Your Nhanh business ID"
                      />
                      <EditableField
                        label="Access Token"
                        value={editedSettings.nhanh.accessToken}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          nhanh: { ...editedSettings.nhanh, accessToken: value }
                        })}
                        placeholder="Enter new access token (leave empty to keep current)"
                        masked
                      />
                    </>
                  ) : (
                    <>
                      <SettingField
                        label="API URL"
                        value={settings.nhanh.apiUrl}
                        onCopy={() => copyToClipboard(settings.nhanh.apiUrl)}
                      />
                      <SettingField
                        label="App ID"
                        value={settings.nhanh.appId}
                        onCopy={() => copyToClipboard(settings.nhanh.appId)}
                      />
                      <SettingField
                        label="Business ID"
                        value={settings.nhanh.businessId}
                        onCopy={() => copyToClipboard(settings.nhanh.businessId)}
                      />
                      <SettingField
                        label="Access Token"
                        value={settings.nhanh.accessToken}
                        masked
                        onCopy={() => copyToClipboard(settings.nhanh.accessToken)}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Shopify Settings */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="border-b border-gray-200 p-4 sm:p-6 dark:border-gray-800">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Shopify API
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Configuration for Shopify store
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={testShopifyConnection}
                      disabled={testingShopify}
                      startIcon={
                        testingShopify ? (
                          <SpinnerIcon size="xs" className="border-white border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )
                      }
                    >
                      {testingShopify ? "Testing..." : "Test Connection"}
                    </Button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {editMode ? (
                    <>
                      <EditableField
                        label="Store URL"
                        value={editedSettings.shopify.storeUrl}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          shopify: { ...editedSettings.shopify, storeUrl: value }
                        })}
                        placeholder="your-store.myshopify.com"
                      />
                      <EditableField
                        label="Access Token"
                        value={editedSettings.shopify.accessToken}
                        onChange={(value) => setEditedSettings({
                          ...editedSettings,
                          shopify: { ...editedSettings.shopify, accessToken: value }
                        })}
                        placeholder="Enter new access token (leave empty to keep current)"
                        masked
                      />
                    </>
                  ) : (
                    <>
                      <SettingField
                        label="Store URL"
                        value={settings.shopify.storeUrl}
                        onCopy={() => copyToClipboard(settings.shopify.storeUrl)}
                      />
                      <SettingField
                        label="Access Token"
                        value={settings.shopify.accessToken}
                        masked
                        onCopy={() => copyToClipboard(settings.shopify.accessToken)}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Location Mapping Settings */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
                <div className="border-b border-gray-200 p-4 sm:p-6 dark:border-gray-800">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Multi-Location Inventory
                      </h2>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Map Nhanh.vn depots to Shopify locations for precise inventory syncing
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => locationMappingRef.current?.openModal()}
                      startIcon={
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      }
                    >
                      Add Mapping
                    </Button>
                  </div>
                </div>
                <div className="p-6">
                  <LocationMappingTable ref={locationMappingRef} />
                </div>
              </div>

            </div>
          </details>
        </div>

      </div>
    </>
  );
}

function SettingField({
  label,
  value,
  masked = false,
  onCopy,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onCopy: () => void;
}) {
  const [showValue, setShowValue] = useState(false);

  const displayValue = masked && !showValue
    ? "•".repeat(Math.min(value.length, 40))
    : value;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <code className="break-all">{displayValue || "(not set)"}</code>
        </div>
        {masked && value && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValue(!showValue)}
            className="px-3"
          >
            {showValue ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </Button>
        )}
        {value && (
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="px-3"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  masked = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  masked?: boolean;
}) {
  const [showValue, setShowValue] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            type={masked && !showValue ? "password" : "text"}
            placeholder={placeholder}
            defaultValue={localValue}
            onChange={handleChange}
          />
        </div>
        {masked && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValue(!showValue)}
            className="px-3"
          >
            {showValue ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
