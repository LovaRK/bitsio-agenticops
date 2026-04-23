"use client";

import { useState } from "react";

export interface SecurityFinding {
  id: string;
  category: "Detection" | "Investigation" | "Response";
  title: string;
  severity: "Critical" | "High" | "Medium";
  resolutionConfidencePercent: number;
  impactOnSavingsPercent: number;
  description: string;
  reasonCodes?: string[];
  decisionThresholds?: {
    ingestMinGbPerDay: number;
    searchCount90dMax: number;
    dashboardRefsMax: number;
    alertRefsMax: number;
    actual: {
      dailyIngestGb: number;
      searchCount90d: number;
      dashboardReferences: number;
      alertReferences: number;
    };
  };
  recommendedAction?: string;
  riskIfRemoved?: string;
  estimatedRealizedSavingsUsd?: number;
}

export function SecurityGapsList({ findings }: { findings: SecurityFinding[] }) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Detection"]));

  const groupedFindings = findings.reduce(
    (acc, finding) => {
      if (!acc[finding.category]) {
        acc[finding.category] = [];
      }
      acc[finding.category].push(finding);
      return acc;
    },
    {} as Record<string, SecurityFinding[]>
  );

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const severityColors = {
    Critical: "bg-error-container/20 text-error border-error/30",
    High: "bg-error-container/15 text-error border-error/20",
    Medium: "bg-tertiary-container/20 text-tertiary border-tertiary/30",
  };

  const categoryIcons = {
    Detection: "shield_detection",
    Investigation: "forensics",
    Response: "emergency_home",
  };

  const totalSavingsIfFixed = findings.reduce((sum, f) => sum + f.impactOnSavingsPercent, 0);

  return (
    <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
          Security & Compliance Gaps
        </p>
        <p className="text-xs text-on-surface-variant">
          Findings that improve data quality and protection posture
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-surface-container-lowest rounded-lg p-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Total Findings
          </p>
          <p className="text-2xl font-black text-on-surface">{findings.length}</p>
        </div>
        <div>
          <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
            Savings if Resolved
          </p>
          <p className="text-2xl font-black text-secondary">+{totalSavingsIfFixed}%</p>
        </div>
      </div>

      {/* Category sections */}
      <div className="space-y-3">
        {(["Detection", "Investigation", "Response"] as const).map((category) => {
          const categoryFindings = groupedFindings[category] || [];
          const isExpanded = expandedCategories.has(category);

          if (categoryFindings.length === 0) return null;

          return (
            <div key={category} className="border border-outline-variant/10 rounded-lg overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full px-4 py-3 bg-surface-container-lowest hover:bg-surface-container transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-lg">
                    {categoryIcons[category]}
                  </span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-on-surface">{category}</p>
                    <p className="text-xs text-on-surface-variant">{categoryFindings.length} finding(s)</p>
                  </div>
                </div>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>

              {/* Findings */}
              {isExpanded && (
                <div className="divide-y divide-outline-variant/10 bg-surface-container p-4 space-y-3">
                  {categoryFindings.map((finding) => (
                    <div key={finding.id} className="space-y-2 first:pt-0 pt-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-on-surface flex-1 leading-snug">{finding.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${severityColors[finding.severity]} whitespace-nowrap`}>
                          {finding.severity}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant leading-relaxed">{finding.description}</p>

                      {finding.reasonCodes?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {finding.reasonCodes.map((code) => (
                            <span
                              key={`${finding.id}-${code}`}
                              className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary-container/20 text-primary border border-primary/30"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
                            Resolution Confidence
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
                              <div
                                className="h-full bg-secondary"
                                style={{ width: `${finding.resolutionConfidencePercent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-bold text-on-surface">
                              {finding.resolutionConfidencePercent}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[9px] text-on-surface-variant uppercase font-bold tracking-wider mb-1">
                            Savings Impact
                          </p>
                          <p className="text-[10px] font-bold text-tertiary">
                            +{finding.impactOnSavingsPercent}% potential
                          </p>
                        </div>
                      </div>

                      {finding.decisionThresholds ? (
                        <div className="rounded-lg border border-outline-variant/15 bg-surface-container-lowest p-3">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant mb-2">
                            Detection thresholds (actual vs rule)
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-[11px] text-on-surface-variant">
                            <p>
                              Ingest/day:{" "}
                              <span className="text-on-surface font-semibold">
                                {finding.decisionThresholds.actual.dailyIngestGb.toFixed(3)} GB
                              </span>{" "}
                              (min {finding.decisionThresholds.ingestMinGbPerDay} GB)
                            </p>
                            <p>
                              Searches/90d:{" "}
                              <span className="text-on-surface font-semibold">
                                {finding.decisionThresholds.actual.searchCount90d}
                              </span>{" "}
                              (max {finding.decisionThresholds.searchCount90dMax})
                            </p>
                            <p>
                              Dashboard refs:{" "}
                              <span className="text-on-surface font-semibold">
                                {finding.decisionThresholds.actual.dashboardReferences}
                              </span>{" "}
                              (max {finding.decisionThresholds.dashboardRefsMax})
                            </p>
                            <p>
                              Alert refs:{" "}
                              <span className="text-on-surface font-semibold">
                                {finding.decisionThresholds.actual.alertReferences}
                              </span>{" "}
                              (max {finding.decisionThresholds.alertRefsMax})
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {(finding.recommendedAction || finding.riskIfRemoved || finding.estimatedRealizedSavingsUsd) ? (
                        <div className="rounded-lg border border-secondary/20 bg-secondary-container/10 p-3">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-on-surface-variant mb-2">
                            Remediation
                          </p>
                          {finding.recommendedAction ? (
                            <p className="text-xs text-on-surface-variant">
                              Action: <span className="text-on-surface font-semibold">{finding.recommendedAction}</span>
                            </p>
                          ) : null}
                          {finding.riskIfRemoved ? (
                            <p className="text-xs text-on-surface-variant mt-1">
                              Risk if removed: <span className="text-on-surface font-semibold">{finding.riskIfRemoved}</span>
                            </p>
                          ) : null}
                          {typeof finding.estimatedRealizedSavingsUsd === "number" ? (
                            <p className="text-xs text-on-surface-variant mt-1">
                              Estimated realized savings (phase-1):{" "}
                              <span className="text-secondary font-semibold">
                                ${finding.estimatedRealizedSavingsUsd.toLocaleString()}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Key insight */}
      <div className="p-3 bg-primary-container/10 border border-primary/20 rounded-lg">
        <p className="text-xs font-bold text-on-surface mb-1">💡 Key Insight</p>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Addressing the highest-impact security findings while implementing cost optimization can yield
          both improved data protection and up to {totalSavingsIfFixed}% additional savings.
        </p>
      </div>
    </div>
  );
}
