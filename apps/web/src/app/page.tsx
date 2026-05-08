'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Activity, Settings, BarChart3, Shield, Server } from 'lucide-react'
import Link from 'next/link'

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Icon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default function HomePage() {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: api.getHealth,
    refetchInterval: 30000,
  })

  const { data: runtime } = useQuery({
    queryKey: ['runtime'],
    queryFn: api.getRuntimeSettings,
  })

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-semibold">BitsIO Telemetry Value Agent</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium">Inference:</span>{' '}
                <span className={runtime?.inference === 'LOCAL' ? 'text-green-600' : 'text-blue-600'}>
                  {runtime?.inference || 'LOADING'}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                <span className="font-medium">Model:</span> {runtime?.model || 'gemma:2b'}
              </div>
              <Link
                href="/settings"
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status */}
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-sm text-gray-600">
              Status: {health?.status || 'loading...'}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Events" value="--" icon={Activity} />
          <StatCard title="Error Rate" value="--" icon={BarChart3} />
          <StatCard title="Cost Estimate" value="--" icon={Server} />
          <StatCard title="Anomaly Score" value="--" icon={Shield} />
        </div>

        {/* Dashboard Placeholder */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">Dashboard Coming Soon</h2>
          <p className="text-gray-500 mb-4">
            Telemetry insights and analysis will appear here once connected to Splunk.
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure Settings
          </Link>
        </div>
      </div>
    </main>
  )
}