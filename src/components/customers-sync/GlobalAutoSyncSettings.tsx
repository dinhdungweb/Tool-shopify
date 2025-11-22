"use client";

import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Radio from "../form/input/Radio";
import Switch from "../form/switch/Switch";
import InputField from "../form/input/InputField";
import Button from "../ui/button/Button";
import Select from "../form/Select";

// Cron presets
const CRON_PRESETS = {
  EVERY_HOUR: "0 * * * *",
  EVERY_2_HOURS: "0 */2 * * *",
  EVERY_6_HOURS: "0 */6 * * *",
  EVERY_12_HOURS: "0 */12 * * *",
  DAILY_2AM: "0 2 * * *",
  DAILY_MIDNIGHT: "0 0 * * *",
  WEEKLY_SUNDAY: "0 0 * * 0",
  MONTHLY: "0 0 1 * *",
};

const CRON_PRESET_LABELS: Record<string, string> = {
  [CRON_PRESETS.EVERY_HOUR]: "Every hour",
  [CRON_PRESETS.EVERY_2_HOURS]: "Every 2 hours",
  [CRON_PRESETS.EVERY_6_HOURS]: "Every 6 hours",
  [CRON_PRESETS.EVERY_12_HOURS]: "Every 12 hours",
  [CRON_PRESETS.DAILY_2AM]: "Daily at 2 AM",
  [CRON_PRESETS.DAILY_MIDNIGHT]: "Daily at midnight",
  [CRON_PRESETS.WEEKLY_SUNDAY]: "Weekly (Sunday)",
  [CRON_PRESETS.MONTHLY]: "Monthly (1st day)",
};

interface GlobalAutoSyncSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  syncedCount: number;
}

export default function GlobalAutoSyncSettings({ isOpen, onClose, syncedCount }: GlobalAutoSyncSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [schedule, setSchedule] = useState(CRON_PRESETS.EVERY_6_HOURS);
  const [customSchedule, setCustomSchedule] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  async function loadConfig() {
    try {
      setLoading(true);
      const response = await fetch("/api/sync/schedule/global");
      const result = await response.json();

      if (result.success) {
        setEnabled(result.data.enabled);
        const isPreset = Object.values(CRON_PRESETS).includes(result.data.schedule);
        if (isPreset) {
          setSchedule(result.data.schedule);
          setUseCustom(false);
        } else {
          setCustomSchedule(result.data.schedule);
          setUseCustom(true);
        }
      }
    } catch (error: any) {
      console.error("Error loading config:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const finalSchedule = useCustom ? customSchedule : schedule;

      if (!finalSchedule.trim()) {
        alert("Please select or enter a sync schedule");
        return;
      }

      const response = await fetch("/api/sync/schedule/global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          schedule: finalSchedule,
        }),
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to save settings");
      }

      alert(
        enabled
          ? `Auto-sync enabled!\nSchedule: ${CRON_PRESET_LABELS[finalSchedule] || finalSchedule}\nWill sync ${syncedCount} customers`
          : "Auto-sync disabled"
      );
      onClose();
    } catch (error: any) {
      console.error("Error saving config:", error);
      alert("Error saving settings: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl mx-4">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900/20">
            <svg
              className="h-6 w-6 text-brand-600 dark:text-brand-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Auto-Sync Settings
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Automatically sync {syncedCount} mapped customers
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
              <Switch
                label="Enable Auto-Sync"
                defaultChecked={enabled}
                onChange={(checked) => setEnabled(checked)}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 ml-14">
                Automatically sync all mapped customers on schedule
              </p>
            </div>

            {/* Schedule Selection */}
            {enabled && (
              <>
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white/90 block mb-2">
                  Select Sync Schedule
                </label>
                <div className="flex items-center space-x-6 mb-4">
                  <Radio
                    id="preset-schedule"
                    name="schedule-type"
                    value="preset"
                    checked={!useCustom}
                    label="Preset Schedule"
                    onChange={() => setUseCustom(false)}
                  />
                  <Radio
                    id="custom-schedule"
                    name="schedule-type"
                    value="custom"
                    checked={useCustom}
                    label="Custom (Cron)"
                    onChange={() => setUseCustom(true)}
                  />
                </div>

                {!useCustom ? (
                  <Select
                    options={Object.entries(CRON_PRESETS).map(([key, value]) => ({
                      value: value,
                      label: CRON_PRESET_LABELS[value],
                    }))}
                    defaultValue={schedule}
                    onChange={(value) => setSchedule(value)}
                    placeholder="Select schedule"
                  />
                ) : (
                  <InputField
                    type="text"
                    placeholder="0 */6 * * *"
                    defaultValue={customSchedule}
                    onChange={(e) => setCustomSchedule(e.target.value)}
                    hint="Cron expression (e.g., '0 */6 * * *' = every 6 hours)"
                  />
                )}
              </div>

              {/* Info Box */}
              <div className="bg-brand-50 border border-brand-200 rounded-lg p-4 dark:bg-brand-900/20 dark:border-brand-800">
                <h4 className="text-sm font-medium text-brand-900 dark:text-brand-300 mb-2">
                  ℹ️ Information
                </h4>
                <ul className="text-sm text-brand-800 dark:text-brand-400 space-y-1">
                  <li>• Will sync all {syncedCount} mapped customers</li>
                  <li>• Timezone: Asia/Ho_Chi_Minh (GMT+7)</li>
                  <li>• Data automatically updates from Nhanh.vn to Shopify</li>
                  <li>• View logs in database (sync_logs table)</li>
                </ul>
              </div>
            </>
          )}

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Settings"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
