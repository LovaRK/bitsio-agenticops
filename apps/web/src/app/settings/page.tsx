'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Settings, Server, Cloud, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'runtime' | 'splunk'>('runtime')

  const { data: runtime, isLoading } = useQuery({
    queryKey: ['runtime'],
    queryFn: api.getRuntimeSettings,
  })

  const updateMutation = useMutation({
    mutationFn: api.updateRuntimeSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['runtime'] })
    },
  })

  const testMutation = useMutation({
    mutationFn: api.testRuntimeConnection,
  })

  const [formData, setFormData] = useState({
    model_provider: 'ollama',
    model_name: 'gemma:2b',
    local_mode: true,
    anthropic_api_key: '',
    openrouter_api_key: '',
  })

  const handleSave = () => {
    updateMutation.mutate({
      model_provider: formData.model_provider,
      model_name: formData.model_name,
      local_mode: formData.local_mode,
      anthropic_api_key: formData.anthropic_api_key || undefined,
      openrouter_api_key: formData.openrouter_api_key || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
                <Settings className="w-5 h-5 text-gray-600" />
              </Link>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('runtime')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 ${
              activeTab === 'runtime'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Runtime Configuration
          </button>
          <button
            onClick={() => setActiveTab('splunk')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 ${
              activeTab === 'splunk'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Splunk Connection
          </button>
        </div>

        {activeTab === 'runtime' && (
          <div className="space-y-6">
            {/* Current Status */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium mb-4">Current Status</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Inference</p>
                    <p className="font-medium">{runtime?.inference || 'LOCAL'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Cloud className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Cloud Access</p>
                    <p className="font-medium">{runtime?.cloud_access || 'DISABLED'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Model</p>
                    <p className="font-medium">{runtime?.model || 'gemma:2b'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Provider</p>
                    <p className="font-medium">{runtime?.provider || 'ollama'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Configuration */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-medium mb-4">Model Configuration</h2>

              {/* Local Mode Toggle */}
              <div className="mb-6">
                <label className="flex items-center justify-between p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium">Local Mode (Default)</p>
                      <p className="text-sm text-gray-500">Use Ollama with Gemma4 for inference</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.local_mode}
                    onChange={(e) => setFormData({ ...formData, local_mode: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                </label>
              </div>

              {/* Model Provider */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model Provider
                </label>
                <select
                  value={formData.model_provider}
                  onChange={(e) => setFormData({ ...formData, model_provider: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  disabled={formData.local_mode}
                >
                  <option value="ollama">Ollama (Local)</option>
                  <option value="anthropic">Anthropic (Cloud)</option>
                  <option value="openrouter">OpenRouter (Development)</option>
                </select>
              </div>

              {/* Model Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Model Name
                </label>
                <input
                  type="text"
                  value={formData.model_name}
                  onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  placeholder="gemma:2b"
                />
              </div>

              {/* API Keys (shown when not in local mode) */}
              {!formData.local_mode && (
                <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
                  {formData.model_provider === 'anthropic' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="w-4 h-4 inline mr-1" />
                        Anthropic API Key
                      </label>
                      <input
                        type="password"
                        value={formData.anthropic_api_key}
                        onChange={(e) => setFormData({ ...formData, anthropic_api_key: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        placeholder="sk-ant-..."
                      />
                    </div>
                  )}
                  {formData.model_provider === 'openrouter' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Key className="w-4 h-4 inline mr-1" />
                        OpenRouter API Key
                      </label>
                      <input
                        type="password"
                        value={formData.openrouter_api_key}
                        onChange={(e) => setFormData({ ...formData, openrouter_api_key: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                        placeholder="sk-or-..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {testMutation.isPending ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {testMutation.isSuccess && (
                <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  {testMutation.data?.message}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'splunk' && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-medium mb-4">Splunk Connection</h2>
            <p className="text-gray-500">
              Configure Splunk MCP connection settings. (Coming soon)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}