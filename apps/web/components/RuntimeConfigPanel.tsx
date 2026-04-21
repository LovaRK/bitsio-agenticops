"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { SettingsSnapshot } from "@/lib/api";
import { checkRuntimeConnections, updateRuntimeConfig } from "@/lib/api";
import { emitAppAlert } from "@/lib/uiAlerts";
import { TOOLTIP } from "@/lib/uiTooltips";

type RuntimeConfigPanelProps = {
  settings: SettingsSnapshot;
};

type ModelProvider = "ollama" | "anthropic" | "stub";
type AdapterMode = "mcp" | "native" | "auto";
type RuntimeMode = "LOCAL_DEV" | "LOCAL_INTEGRATION" | "CLOUD_MODEL_TEST" | "CLOUD_LIVE";

const OLLAMA_MODELS = ["qwen2.5:14b", "llama3.1:8b", "mistral:7b-instruct"];
const ANTHROPIC_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20251001"];

function ToggleRow(props: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  testId: string;
}) {
  return (
    <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-3">
      <div>
        <p className="text-sm font-semibold text-on-surface">{props.label}</p>
        <p className="text-xs text-on-surface-variant">{props.description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={props.checked}
        data-testid={props.testId}
        onClick={() => props.onChange(!props.checked)}
        disabled={props.disabled}
        className={`relative inline-flex h-7 w-12 items-center rounded-full border transition-all disabled:opacity-50 ${
          props.checked
            ? "bg-primary border-primary"
            : "bg-surface-container border-outline-variant/30"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            props.checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

export function RuntimeConfigPanel({ settings }: RuntimeConfigPanelProps) {
  const router = useRouter();

  const initialMode: RuntimeMode = settings.runtime?.mode || "LOCAL_DEV";
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(initialMode);
  const [lastAppliedMode, setLastAppliedMode] = useState<RuntimeMode>(initialMode);
  const [showCloudLiveConfirm, setShowCloudLiveConfirm] = useState(false);
  const [modelProvider, setModelProvider] = useState<ModelProvider>(
    (settings.model.provider as ModelProvider) || "ollama",
  );
  const [modelName, setModelName] = useState(settings.model.name);
  const [adapterMode, setAdapterMode] = useState<AdapterMode>(
    (settings.splunk.adapter_mode as AdapterMode) || "auto",
  );
  const [mockMode, setMockMode] = useState(settings.model.mock_mode);
  const [liveDataMode, setLiveDataMode] = useState(settings.splunk.live_mode);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionReport, setConnectionReport] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const modelCandidates = modelProvider === "anthropic" ? ANTHROPIC_MODELS : OLLAMA_MODELS;

  useEffect(() => {
    setConnectionReport(null);
    setConnectionOk(null);
    setError(null);
  }, [runtimeMode, modelProvider, modelName, adapterMode, mockMode, liveDataMode]);

  const helperText = useMemo(() => {
    if (runtimeMode === "LOCAL_DEV") {
      return "Local Dev uses local Ollama model + mock data for fastest safe development.";
    }
    if (runtimeMode === "LOCAL_INTEGRATION") {
      return "Local Integration uses local Ollama model with live Splunk for connector validation.";
    }
    if (runtimeMode === "CLOUD_MODEL_TEST") {
      return "Cloud Model Test uses Claude with mock data to validate reasoning quality without live data dependency.";
    }
    return "Cloud Live uses Claude + live Splunk for production-like end-to-end behavior.";
  }, [runtimeMode]);

  function applyRuntimeMode(next: RuntimeMode) {
    setRuntimeMode(next);

    if (next === "LOCAL_DEV") {
      setModelProvider("ollama");
      setModelName("qwen2.5:14b");
      setMockMode(false);
      setLiveDataMode(false);
      setAdapterMode("auto");
      return;
    }

    if (next === "LOCAL_INTEGRATION") {
      setModelProvider("ollama");
      setModelName("qwen2.5:14b");
      setMockMode(false);
      setLiveDataMode(true);
      setAdapterMode("native");
      return;
    }

    if (next === "CLOUD_MODEL_TEST") {
      setModelProvider("anthropic");
      setModelName("claude-haiku-4-5-20251001");
      setMockMode(false);
      setLiveDataMode(false);
      setAdapterMode("auto");
      return;
    }

    setModelProvider("anthropic");
    setModelName("claude-haiku-4-5-20251001");
    setMockMode(false);
    setLiveDataMode(true);
    setAdapterMode("native");
  }

  async function performApply() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await updateRuntimeConfig({
        runtime_mode: runtimeMode,
        model_provider: modelProvider,
        model_name: modelName.trim(),
        splunk_adapter_mode: adapterMode,
        model_mock_mode: mockMode,
        splunk_live_mode: liveDataMode,
      });
      setLastAppliedMode(runtimeMode);
      const tunnelNote =
        result.tunnel_message && result.tunnel_status
          ? ` Tunnel: ${result.tunnel_status} (${result.tunnel_message})`
          : "";
      setMessage(`Runtime updated successfully.${tunnelNote}`);
      emitAppAlert({
        level: "success",
        message: `Runtime mode applied: ${runtimeMode}.`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update runtime config.");
      emitAppAlert({
        level: "error",
        message: "Failed to apply runtime config. See details in settings panel.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleApply() {
    const requiresCloudLiveConfirmation =
      runtimeMode === "CLOUD_LIVE" && lastAppliedMode !== "CLOUD_LIVE";
    if (requiresCloudLiveConfirmation) {
      setShowCloudLiveConfirm(true);
      return;
    }
    await performApply();
  }

  async function handleTestConnections() {
    setTesting(true);
    setError(null);
    setConnectionReport(null);
    setConnectionOk(null);

    try {
      const result = await checkRuntimeConnections();
      const summary = [
        `Model: ${result.model.connected ? "Connected" : "Not connected"} (${result.model.detail})`,
        `Splunk: ${result.splunk.connected ? "Connected" : "Not connected"} (${result.splunk.detail})`,
      ].join(" | ");
      setConnectionReport(summary);
      setConnectionOk(result.model.connected && result.splunk.connected);
      emitAppAlert({
        level: result.model.connected && result.splunk.connected ? "success" : "warning",
        message: result.model.connected && result.splunk.connected
          ? "Runtime connections are healthy."
          : "One or more runtime connections are not healthy.",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run connection test.");
      emitAppAlert({
        level: "error",
        message: "Connection test failed. Verify API endpoint and active services.",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <>
      <article className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Runtime Control</h3>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-xs text-on-surface-variant uppercase tracking-wider md:col-span-2">
          Runtime Mode
          <select
            value={runtimeMode}
            onChange={(e) => applyRuntimeMode(e.target.value as RuntimeMode)}
            disabled={saving || testing}
            title={TOOLTIP.settings.mode}
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
            data-testid="runtime-scenario-select"
          >
            <option value="LOCAL_DEV">Local Dev (Local LLM + Mock Data)</option>
            <option value="LOCAL_INTEGRATION">Local Integration (Local LLM + Live Splunk)</option>
            <option value="CLOUD_MODEL_TEST">Cloud Model Test (Claude + Mock Data)</option>
            <option value="CLOUD_LIVE">Cloud Live (Claude + Live Splunk)</option>
          </select>
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Runtime Profile
          <input
            readOnly
            value={modelProvider === "anthropic" ? "Cloud" : "Local"}
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
            data-testid="runtime-profile-select"
          />
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Splunk Adapter Mode
          <select
            value={adapterMode}
            onChange={(e) => setAdapterMode(e.target.value as AdapterMode)}
            disabled={saving || testing || !liveDataMode}
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
          >
            <option value="auto">auto</option>
            <option value="mcp">mcp (/services/mcp/*)</option>
            <option value="native">native (/services/search/jobs/export)</option>
          </select>
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Model Provider
          <select
            value={modelProvider}
            onChange={(e) => setModelProvider(e.target.value as ModelProvider)}
            disabled
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
          >
            <option value="ollama">ollama (local)</option>
            <option value="anthropic">anthropic (cloud)</option>
            <option value="stub">stub (test)</option>
          </select>
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Model Name
          <input
            value={modelName}
            onChange={(e) => setModelName(e.target.value)}
            list="model-candidate-list"
            placeholder="Pick from list or type custom model"
            disabled
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
          />
          <datalist id="model-candidate-list">
            {modelCandidates.map((candidate) => (
              <option key={candidate} value={candidate} />
            ))}
          </datalist>
        </label>

        <ToggleRow
          label="Enable Model Mock Mode"
          description="Use deterministic stub responses instead of live model calls."
          checked={mockMode}
          onChange={setMockMode}
          disabled={saving || testing || runtimeMode !== "LOCAL_DEV"}
          testId="toggle-model-mock-mode"
        />

        <ToggleRow
          label="Use Live Splunk Data"
          description="When OFF, the app uses local seeded mock incidents for safe demos."
          checked={liveDataMode}
          onChange={setLiveDataMode}
          disabled={saving || testing || runtimeMode === "LOCAL_DEV" || runtimeMode === "CLOUD_MODEL_TEST"}
          testId="toggle-live-splunk-mode"
        />

        <p className="md:col-span-2 text-xs text-on-surface-variant">{helperText}</p>

        {message ? <p className="md:col-span-2 text-xs text-secondary">{message}</p> : null}
        {connectionReport ? (
          <p
            className={`md:col-span-2 text-xs ${
              connectionOk === false ? "text-error" : "text-secondary"
            }`}
          >
            {connectionReport}
          </p>
        ) : null}
        {error ? <p className="md:col-span-2 text-xs text-error">{error}</p> : null}

        <div className="md:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleTestConnections}
            disabled={saving || testing}
            title={TOOLTIP.settings.testConnections}
            className="rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {testing ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">network_check</span>
              )}
              {testing ? "Testing..." : "Test Connections"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleApply}
            disabled={saving || testing}
            title={TOOLTIP.settings.apply}
            className="rounded-lg border border-primary/25 bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-colors hover:bg-primary-container/90 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {saving ? (
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              ) : null}
              {saving ? "Applying..." : "Apply Runtime Changes"}
            </span>
          </button>
        </div>
        </div>
      </article>

      {showCloudLiveConfirm ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-outline-variant/20 bg-surface-container p-6 shadow-2xl">
            <h4 className="text-base font-bold text-on-surface">Confirm Cloud Live Mode</h4>
            <p className="mt-3 text-sm text-on-surface-variant">
              You are switching to <strong className="text-on-surface">Cloud Live</strong>. This uses live
              Splunk data and cloud model inference, which may incur usage cost and operate on production-like
              telemetry.
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-on-surface-variant">
              <li>Model provider: Anthropic (Claude)</li>
              <li>Data source: Live Splunk</li>
              <li>Adapter mode: {adapterMode}</li>
            </ul>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-outline-variant/30 px-4 py-2 text-xs font-bold text-on-surface"
                onClick={() => setShowCloudLiveConfirm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg border border-primary/25 bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container transition-colors hover:bg-primary-container/90 disabled:opacity-60"
                onClick={async () => {
                  setShowCloudLiveConfirm(false);
                  await performApply();
                }}
                disabled={saving}
              >
                Confirm & Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
