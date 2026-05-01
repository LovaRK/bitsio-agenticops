"use client";

import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type {
  TierDistribution,
  SavingsStaircaseStage,
  TierName,
} from "@/types/telemetry-executive";

const TIER_COLORS: Record<TierName, string> = {
  Critical: "#4caf50",
  Important: "#2196f3",
  "Nice-to-Have": "#ff9800",
  Wasteful: "#f44336",
};

const TIER_NAMES: TierName[] = ["Critical", "Important", "Nice-to-Have", "Wasteful"];

function fmtM(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

interface LicenseAndStaircaseSectionProps {
  tierDistribution: TierDistribution;
  staircase: SavingsStaircaseStage[];
}

export function LicenseAndStaircaseSection({
  tierDistribution,
  staircase,
}: LicenseAndStaircaseSectionProps) {
  const licenseData = TIER_NAMES.map((t) => ({
    name: t,
    cost: tierDistribution[t].annual_cost_usd,
    color: TIER_COLORS[t],
  }));

  const staircaseData = staircase.map((s) => ({
    name: s.label,
    cost: s.annual_cost_usd,
    description: s.description,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-xl border border-outline-variant/10 bg-surface-container p-5 mb-6"
    >
      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-4">
        License Spend & Optimization Staircase
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* License spend by tier */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-1">Annual License Spend by Tier</p>
          <p className="text-xs text-on-surface-variant mb-4">
            Critical and Important tiers justify their spend. Nice-to-Have and Wasteful are targets
            for optimization.
          </p>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.08 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={licenseData} layout="vertical" margin={{ left: 0, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                type="number"
                tick={{ fontSize: 9, fill: "#9e9e9e" }}
                tickFormatter={fmtM}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fill: "#9e9e9e" }}
                width={90}
              />
              <Tooltip
                formatter={(val) => [fmtM(Number(val ?? 0)), "Annual Cost"]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="cost">
                {licenseData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </motion.div>
        </div>

        {/* 5-stage staircase */}
        <div>
          <p className="text-xs font-semibold text-on-surface mb-1">5-Stage Savings Staircase</p>
          <p className="text-xs text-on-surface-variant mb-4">
            Each bar shows the projected annual cost after applying the corresponding optimization
            stage.
          </p>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.18 }}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={staircaseData} margin={{ left: 0, right: 40, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 8, fill: "#9e9e9e" }}
                angle={-15}
                textAnchor="end"
                interval={0}
              />
              <YAxis tick={{ fontSize: 9, fill: "#9e9e9e" }} tickFormatter={fmtM} />
              <Tooltip
                formatter={(val) => [fmtM(Number(val ?? 0)), "Annual Cost"]}
                contentStyle={{
                  background: "#1e2130",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                }}
                labelFormatter={(label) => {
                  const key = String(label ?? "");
                  const entry = staircaseData.find((s) => s.name === key);
                  return entry?.description ?? key;
                }}
              />
              <Bar dataKey="cost" fill="#f44336" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
