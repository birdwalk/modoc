"use client";

import { AlertTriangle, CheckCircle2, CircleDot } from "lucide-react";
import { useMemo, useState } from "react";
import type { Issue } from "../lib/types";
import { useInspectionStore } from "../store/useInspectionStore";

const severityClass: Record<string, string> = {
  BLOCKING: "text-red-600 border-red-500",
  HIGH: "text-red-600 border-red-400",
  MODERATE: "text-amber-600 border-amber-400",
  LOW: "text-sky-600 border-sky-400",
  INFO: "text-slate-500 border-slate-300"
};

export function IssueList({ issues }: { issues: Issue[] }) {
  const selected = useInspectionStore((s) => s.selectedIssueId);
  const select = useInspectionStore((s) => s.selectIssue);
  const [severity, setSeverity] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [query, setQuery] = useState("");
  const types = useMemo(() => Array.from(new Set(issues.map((issue) => issue.rule_id))).sort(), [issues]);
  const filtered = useMemo(() => {
    const severityRank: Record<string, number> = { BLOCKING: 5, HIGH: 4, MODERATE: 3, LOW: 2, INFO: 1 };
    return issues
      .filter((issue) => severity === "ALL" || issue.severity === severity)
      .filter((issue) => type === "ALL" || issue.rule_id === type)
      .filter((issue) => `${issue.rule_name} ${issue.summary} ${issue.rule_id}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);
  }, [issues, query, severity, type]);
  return (
    <div className="h-full overflow-auto border-r border-white/80 bg-white/60 shadow-[10px_0_36px_rgba(15,23,42,0.05)] backdrop-blur-xl scrollbar">
      <div className="border-b border-slate-200/80 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase text-slate-900">Inspections</h2>
        <p className="text-xs text-slate-500">{issues.length} deterministic issue groups</p>
        <div className="mt-3 grid gap-2">
          <input className="h-8 border border-slate-200 bg-white px-2 text-xs text-slate-900" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" aria-label="Search issues" />
          <div className="grid grid-cols-2 gap-2">
            <select className="h-8 border border-slate-200 bg-white px-2 text-xs text-slate-900" value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity">
              {["ALL", "BLOCKING", "HIGH", "MODERATE", "LOW", "INFO"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select className="h-8 border border-slate-200 bg-white px-2 text-xs text-slate-900" value={type} onChange={(event) => setType(event.target.value)} aria-label="Filter by issue type">
              <option value="ALL">ALL TYPES</option>
              {types.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="divide-y divide-slate-200/80">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-emerald-700">No issues detected by the MVP rule set.</div>
        ) : (
          filtered.map((issue) => (
            <button
              key={issue.id}
              onClick={() => select(issue.id)}
              className={`block w-full border-l-2 px-4 py-3 text-left transition hover:bg-white/80 ${severityClass[issue.severity]} ${selected === issue.id ? "bg-white shadow-inner" : "bg-white/25"}`}
            >
              <div className="flex items-start gap-2">
                {issue.automatic_repair_available ? <CheckCircle2 className="mt-0.5 shrink-0" size={15} /> : issue.requires_manual_review ? <AlertTriangle className="mt-0.5 shrink-0" size={15} /> : <CircleDot className="mt-0.5 shrink-0" size={15} />}
                <div>
                  <div className="text-sm font-medium text-slate-950">{issue.rule_name}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-600">{issue.summary}</div>
                  <div className="mt-2 text-[11px] uppercase text-slate-500">{issue.severity} / {issue.category} / {issue.occurrence_count} affected</div>
                  <div className="mt-1 text-[11px] text-slate-500">{issue.automatic_repair_available ? "Auto-fix available" : issue.requires_manual_review ? "Manual review" : "Inspect evidence"}</div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
