"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { SettingsSnapshot } from "@/lib/api";
import { updateModelSettings } from "@/lib/api";
import { emitAppAlert } from "@/lib/uiAlerts";
import { TOOLTIP } from "@/lib/uiTooltips";

type ModelSettingsPanelProps = {
  settings: SettingsSnapshot;
};

export function ModelSettingsPanel({ settings }: ModelSettingsPanelProps) {
  const router = useRouter();

  const [useCloud, setUseCloud] = useState(settings.model?.use_cloud || false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCloudWarning, setShowCloudWarning] = useState(false);

  const modelProvider = settings.model?.provider || "ollama";
  const runtimeMode = settings.runtime?.mode || "LOCAL_INTEGRATION";
  const cloudDisabled = runtimeMode === "LOCAL_DEV" || modelProvider === "ollama";

  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [useCloud]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateModelSettings({
        use_cloud: useCloud,
      });
      setMessage("Model settings updated successfully.");
      emitAppAlert({
        level: "success",
        message: useCloud ? "Cloud models enabled for opt-in." : "Reverted to local models by default.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update model settings.");
      emitAppAlert({
        level: "error",
        message: "Failed to update model settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleCloudToggle(enabled: boolean) {
    if (enabled && !useCloud) {
      setShowCloudWarning(true);
    } else {
      setUseCloud(enabled);
    }
  }

  const modeIndicator = useCloud ? "☁️ Cloud Mode Enabled" : "🔒 Running in Local Mode";
  const modeDescription = useCloud
    ? "System can use cloud models for processing when explicitly requested."
    : "System runs exclusively on local models for maximum privacy and data control.";

  return (
    <>
      <article className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Model Settings</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Indicator */}
          <div className="md:col-span-2 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Current Mode</p>
            <p className="mt-2 text-sm font-semibold text-on-surface">{modeIndicator}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{modeDescription}</p>
          </div>

          {/* Runtime Mode Info */}
          <div className="md:col-span-2">
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">
              Runtime Mode (Read-Only)
              <input
                readOnly
                value={runtimeMode}
                className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              />
            </label>
          </div>

          {/* Cloud Provider Info */}
          <div className="md:col-span-2">
            <label className="text-xs text-on-surface-variant uppercase tracking-wider">
              Model Provider (Read-Only)
              <input
                readOnly
                value={modelProvider === "anthropic" ? "Anthropic (Claude)" : modelProvider}
                className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
              />
            </label>
          </div>

          {/* Local vs Cloud Radio Buttons */}
          <div className="md:col-span-2 space-y-3">
            <p className="text-xs text-on-surface-variant uppercase tracking-wider">Privacy Mode</p>

            <div className="flex items-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 cursor-pointer hover:border-outline-variant/50 transition-colors"
              onClick={() => handleCloudToggle(false)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCloudToggle(false);
                }
              }}
            >
              <input
                type="radio"
                name="privacy-mode"
                value="local"
                checked={!useCloud}
                onChange={() => handleCloudToggle(false)}
                disabled={saving || cloudDisabled}
                className="w-4 h-4"
              />
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-on-surface">🔒 Local Only (Recommended)</p>
                <p className="text-xs text-on-surface-variant">
                  All AI processing stays on your infrastructure. No data leaves your environment.
                </p>
              </div>
            </div>

            <div
              className={`flex items-center rounded-lg border transition-colors px-4 py-3 cursor-pointer ${
                cloudDisabled
                  ? "border-outline-variant/30 opacity-50 bg-surface-container-lowest cursor-not-allowed"
                  : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant/50"
              }`}
              onClick={() => !cloudDisabled && handleCloudToggle(true)}
              role="button"
              tabIndex={cloudDisabled ? -1 : 0}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !cloudDisabled) {
                  e.preventDefault();
                  handleCloudToggle(true);
                }
              }}
            >
              <input
                type="radio"
                name="privacy-mode"
                value="cloud"
                checked={useCloud}
                onChange={() => handleCloudToggle(true)}
                disabled={saving || cloudDisabled}
                className="w-4 h-4"
              />
              <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-on-surface">☁️ Allow Cloud Models (Opt-in)</p>
                <p className="text-xs text-on-surface-variant">
                  Enable cloud model support for advanced reasoning tasks. Data may be sent to external API providers.
                </p>
              </div>
            </div>

            {cloudDisabled && (
              <p className="md:col-span-2 text-xs text-on-surface-variant italic">
                Cloud mode unavailable: not configured in current runtime or model provider.
              </p>
            )}
          </div>

          {/* Warning Banner for Cloud Enablement */}
          {useCloud && (
            <div className="md:col-span-2 rounded-lg border border-warning/30 bg-warning-container/20 px-4 py-3">
              <p className="text-xs font-semibold text-warning">⚠️ Cloud Mode Enabled</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                By enabling cloud models, some data may be sent to external API services for processing. Ensure your
                organization allows this before enabling.
              </p>
            </div>
          )}

          {message ? <p className="md:col-span-2 text-xs text-secondary">{message}</p> : null}
          {error ? <p className="md:col-span-2 text-xs text-error">{error}</p> : null}

          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || cloudDisabled}
              title={TOOLTIP.settings.apply}
              className="rounded-lg border border-primary/25 bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-colors hover:bg-primary-container/90 disabled:opacity-60"
            >
              <span className="inline-flex items-center gap-2">
                {saving ? (
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                ) : null}
                {saving ? "Saving..." : "Save Settings"}
              </span>
            </button>
          </div>
        </div>
      </article>

      {showCloudWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-outline-variant/20 bg-surface-container p-6 shadow-2xl">
            <h4 className="text-base font-bold text-on-surface">Enable Cloud Models?</h4>
            <p className="mt-3 text-sm text-on-surface-variant">
              You are about to enable cloud model support. This allows the system to use external AI APIs when
              explicitly requested.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-xs text-on-surface-variant">
              <li>Data Privacy: Some incident data may be sent to cloud API providers</li>
              <li>Compliance: Ensure this is compliant with your data governance policies</li>
              <li>Cost: Cloud API usage may incur charges</li>
              <li>Control: You can disable this at any time</li>
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface"
                onClick={() => {
                  setShowCloudWarning(false);
                  setUseCloud(false);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg border border-warning/25 bg-warning-container px-4 py-2 text-xs font-bold text-on-warning-container transition-colors hover:bg-warning-container/90 disabled:opacity-60"
                onClick={() => {
                  setShowCloudWarning(false);
                  setUseCloud(true);
                }}
                disabled={saving}
              >
                I Understand, Enable Cloud
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
