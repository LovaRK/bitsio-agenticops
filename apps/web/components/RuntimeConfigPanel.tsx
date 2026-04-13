"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { SettingsSnapshot } from "@/lib/api";
import { checkRuntimeConnections, updateRuntimeConfig } from "@/lib/api";

type RuntimeConfigPanelProps = {
  settings: SettingsSnapshot;
};

type ModelProvider = "ollama" | "anthropic" | "stub";
type AdapterMode = "mcp" | "native" | "auto";
type RuntimeProfile = "local" | "cloud";
type RuntimeScenario = "local_mock" | "local_live" | "cloud_live";

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

  const initialProvider = (settings.model.provider as ModelProvider) || "ollama";
  const initialAdapterMode = (settings.splunk.adapter_mode as AdapterMode) || "auto";
  const initialProfile: RuntimeProfile =
    initialProvider === "anthropic" || settings.splunk.live_mode ? "cloud" : "local";

  const [profile, setProfile] = useState<RuntimeProfile>(initialProfile);
  const [modelProvider, setModelProvider] = useState<ModelProvider>(initialProvider);
  const [modelName, setModelName] = useState(settings.model.name);
  const [adapterMode, setAdapterMode] = useState<AdapterMode>(initialAdapterMode);
  const [mockMode, setMockMode] = useState(settings.model.mock_mode);
  const [liveDataMode, setLiveDataMode] = useState(settings.splunk.live_mode);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionReport, setConnectionReport] = useState<string | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  const modelCandidates = modelProvider === "anthropic" ? ANTHROPIC_MODELS : OLLAMA_MODELS;
  const activeScenario: RuntimeScenario =
    !liveDataMode
      ? "local_mock"
      : modelProvider === "anthropic" && !mockMode
        ? "cloud_live"
        : "local_live";

  useEffect(() => {
    setConnectionReport(null);
    setConnectionOk(null);
    setError(null);
  }, [profile, modelProvider, modelName, adapterMode, mockMode, liveDataMode]);

  const helperText = useMemo(() => {
    if (profile === "local") {
      return "Local profile keeps everything development-safe: local model runtime and seeded mock Splunk flow by default.";
    }
    return "Cloud profile targets production-like runtime: cloud model and live Splunk data with adapter mode control.";
  }, [profile]);

  function applyProfile(next: RuntimeProfile) {
    setProfile(next);
    if (next === "local") {
      setModelProvider("ollama");
      setModelName((prev) => (prev ? prev : "qwen2.5:14b"));
      setMockMode(true);
      setLiveDataMode(false);
      setAdapterMode("auto");
      return;
    }

    setModelProvider("anthropic");
    setModelName("claude-haiku-4-5-20251001");
    setMockMode(false);
    setLiveDataMode(true);
    if (adapterMode === "auto") {
      setAdapterMode("native");
    }
  }

  function applyScenario(next: RuntimeScenario) {
    if (next === "local_mock") {
      setProfile("local");
      setModelProvider("ollama");
      setModelName("qwen2.5:14b");
      setMockMode(true);
      setLiveDataMode(false);
      setAdapterMode("auto");
      return;
    }

    if (next === "local_live") {
      setProfile("local");
      setModelProvider("ollama");
      setModelName((prev) => prev || "qwen2.5:14b");
      setMockMode(false);
      setLiveDataMode(true);
      setAdapterMode("native");
      return;
    }

    setProfile("cloud");
    setModelProvider("anthropic");
    setModelName("claude-haiku-4-5-20251001");
    setMockMode(false);
    setLiveDataMode(true);
    setAdapterMode("native");
  }

  async function handleApply() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await updateRuntimeConfig({
        model_provider: modelProvider,
        model_name: modelName.trim(),
        splunk_adapter_mode: adapterMode,
        model_mock_mode: mockMode,
        splunk_live_mode: liveDataMode,
      });
      setMessage("Runtime updated successfully.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update runtime config.");
    } finally {
      setSaving(false);
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run connection test.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <article className="bg-surface-container-low border border-outline-variant/10 rounded-xl overflow-hidden">
      <div className="px-6 py-4 bg-surface-container border-b border-outline-variant/10">
        <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Runtime Control</h3>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-xs text-on-surface-variant uppercase tracking-wider md:col-span-2">
          Scenario Preset
          <select
            value={activeScenario}
            onChange={(e) => applyScenario(e.target.value as RuntimeScenario)}
            disabled={saving || testing}
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
            data-testid="runtime-scenario-select"
          >
            <option value="local_mock">Local Mock (best for UI/build speed)</option>
            <option value="local_live">Local Model + Live Splunk (best for integration)</option>
            <option value="cloud_live">Cloud Model + Live Splunk (best for demo/production-like)</option>
          </select>
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Runtime Profile
          <select
            value={profile}
            onChange={(e) => applyProfile(e.target.value as RuntimeProfile)}
            disabled={saving || testing}
            className="mt-2 w-full rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
            data-testid="runtime-profile-select"
          >
            <option value="local">Local Dev (safe defaults)</option>
            <option value="cloud">Cloud Live (production-like)</option>
          </select>
        </label>

        <label className="text-xs text-on-surface-variant uppercase tracking-wider">
          Splunk Adapter Mode
          <select
            value={adapterMode}
            onChange={(e) => setAdapterMode(e.target.value as AdapterMode)}
            disabled={saving || testing}
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
            disabled={saving || testing}
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
            disabled={saving || testing}
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
          disabled={saving || testing}
          testId="toggle-model-mock-mode"
        />

        <ToggleRow
          label="Use Live Splunk Data"
          description="When OFF, the app uses local seeded mock incidents for safe demos."
          checked={liveDataMode}
          onChange={setLiveDataMode}
          disabled={saving || testing}
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
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
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
  );
}
