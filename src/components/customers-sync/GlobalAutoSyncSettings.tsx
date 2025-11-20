"use client";

import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";

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
  [CRON_PRESETS.EVERY_HOUR]: "Mỗi giờ",
  [CRON_PRESETS.EVERY_2_HOURS]: "Mỗi 2 giờ",
  [CRON_PRESETS.EVERY_6_HOURS]: "Mỗi 6 giờ",
  [CRON_PRESETS.EVERY_12_HOURS]: "Mỗi 12 giờ",
  [CRON_PRESETS.DAILY_2AM]: "Hàng ngày lúc 2h sáng",
  [CRON_PRESETS.DAILY_MIDNIGHT]: "Hàng ngày lúc 0h",
  [CRON_PRESETS.WEEKLY_SUNDAY]: "Hàng tuần (Chủ nhật)",
  [CRON_PRESETS.MONTHLY]: "Hàng tháng (ngày 1)",
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
        alert("Vui lòng chọn hoặc nhập lịch đồng bộ");
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
          ? `Đã bật đồng bộ tự động!\nLịch: ${CRON_PRESET_LABELS[finalSchedule] || finalSchedule}\nSẽ đồng bộ ${syncedCount} khách hàng`
          : "Đã tắt đồng bộ tự động"
      );
      onClose();
    } catch (error: any) {
      console.error("Error saving config:", error);
      alert("Lỗi khi lưu cài đặt: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl mx-4">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
            <svg
              className="h-6 w-6 text-purple-600 dark:text-purple-400"
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
              Cài đặt đồng bộ tự động
            </h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Tự động đồng bộ {syncedCount} khách hàng đã mapping
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-purple-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white/90">
                Bật đồng bộ tự động
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tự động đồng bộ tất cả khách hàng đã mapping theo lịch
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                enabled ? "bg-purple-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

            {/* Schedule Selection */}
            {enabled && (
              <>
              <div>
                <label className="text-sm font-medium text-gray-900 dark:text-white/90 block mb-2">
                  Chọn lịch đồng bộ
                </label>
                <div className="flex items-center space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!useCustom}
                      onChange={() => setUseCustom(false)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Lịch có sẵn
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={useCustom}
                      onChange={() => setUseCustom(true)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Tùy chỉnh (Cron)
                    </span>
                  </label>
                </div>

                {!useCustom ? (
                  <select
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    {Object.entries(CRON_PRESETS).map(([key, value]) => (
                      <option key={key} value={value}>
                        {CRON_PRESET_LABELS[value]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={customSchedule}
                      onChange={(e) => setCustomSchedule(e.target.value)}
                      placeholder="0 */6 * * *"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Cron expression (ví dụ: "0 */6 * * *" = mỗi 6 giờ)
                    </p>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 dark:bg-purple-900/20 dark:border-purple-800">
                <h4 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
                  ℹ️ Thông tin
                </h4>
                <ul className="text-sm text-purple-800 dark:text-purple-400 space-y-1">
                  <li>• Sẽ đồng bộ tất cả {syncedCount} khách hàng đã mapping</li>
                  <li>• Múi giờ: Asia/Ho_Chi_Minh (GMT+7)</li>
                  <li>• Dữ liệu tự động cập nhật từ Nhanh.vn sang Shopify</li>
                  <li>• Có thể xem logs trong database (bảng sync_logs)</li>
                </ul>
              </div>
            </>
          )}

            {/* Save Button */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
