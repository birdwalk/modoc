"use client";

import { useState } from "react";
import { Download, Hammer, MessageSquareText } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { applySafeFixes, artifactUrl, askCopilot, createReport, previewSafeFixes } from "../lib/api";
import type { ProcessingMode } from "../lib/analysis";
import { toAnalysisResult } from "../lib/analysis";
import { evaluateModelReadiness } from "../lib/readiness";
import type { InspectionRun } from "../lib/types";
import { useInspectionStore } from "../store/useInspectionStore";

export function IssueDetails({ run, processingMode }: { run: InspectionRun; processingMode: ProcessingMode }) {
  const [showPreview, setShowPreview] = useState(false);
  const selectedId = useInspectionStore((s) => s.selectedIssueId);
  const setRepaired = useInspectionStore((s) => s.setRepaired);
  const resetRepairs = useInspectionStore((s) => s.resetRepairs);
  const repaired = useInspectionStore((s) => s.repaired);
  const issue = run.issues.find((item) => item.id === selectedId) ?? run.issues[0];
  const repairableCount = run.issues.filter((item) => item.automatic_repair_available).length;
  const reviewCount = run.issues.filter((item) => item.requires_manual_review && !item.automatic_repair_available).length;
  const preview = useMutation({ mutationFn: () => previewSafeFixes(run.id), onSuccess: () => setShowPreview(true) });
  const repair = useMutation({ mutationFn: () => applySafeFixes(run.id), onSuccess: (result) => { setShowPreview(false); setRepaired(result); } });
  const report = useMutation({ mutationFn: () => createReport(run.id) });
  const copilot = useMutation({ mutationFn: () => askCopilot(run.id, "Is this model ready for 3D printing?") });
  const readiness = evaluateModelReadiness(toAnalysisResult(run, processingMode), processingMode);
  const repairBusy = preview.isPending || repair.isPending;

  return (
    <aside className="h-full overflow-auto border-l border-white/80 bg-white/65 p-4 shadow-[-10px_0_36px_rgba(15,23,42,0.05)] backdrop-blur-xl scrollbar">
      <h2 className="text-sm font-semibold uppercase text-slate-900">Selected Issue</h2>
      {issue ? (
        <div className="mt-3 space-y-4">
          <div>
            <div className="text-lg font-semibold text-slate-950">{issue.rule_name}</div>
            <div className="text-xs uppercase text-slate-500">{issue.id} / {issue.severity}</div>
          </div>
          <div className="grid gap-2">
            <ExplanationCard title="Engineering logic" text={issue.technical_explanation} />
            <ExplanationCard title="Plain language" text={issue.plain_language_explanation || issue.summary} />
            <ExplanationCard title="What it can cause" text={issue.workflow_impact || "This can create unreliable behavior in downstream production tools."} />
            <ExplanationCard title="Recommended action" text={issue.recommended_action || "Inspect the highlighted evidence and choose a repair strategy."} />
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Metric label="Occurrences" value={issue.occurrence_count.toString()} />
            <Metric label="Confidence" value={`${Math.round(issue.confidence * 100)}%`} />
            <Metric label="Repair" value={issue.automatic_repair_available ? issue.repair_risk ?? "Available" : "Manual"} />
            <Metric label="Review" value={issue.requires_manual_review ? "Required" : "No"} />
          </dl>
          <div className="border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <div className="font-semibold">Detected risk before repair</div>
            <p className="mt-1">{readiness.risksBeforeRepair[0] ?? "No blocking risk detected by the current rule set."}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">Select an issue to inspect its evidence.</p>
      )}
      <div className="mt-5 grid gap-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric label="Auto-repairable" value={`${repairableCount} issue groups`} />
          <Metric label="Needs approval" value={`${reviewCount} issue groups`} />
        </div>
        <button className="inline-flex h-12 items-center justify-center gap-2 border border-emerald-500 bg-emerald-500 px-3 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(16,185,129,0.22)] disabled:opacity-50" onClick={() => preview.mutate()} disabled={repairBusy || run.issues.length === 0}>
          <Hammer size={16} />
          {run.issues.length === 0 ? "No Repair Needed" : preview.isPending ? "Creating repair plan..." : repair.isPending ? "Repairing..." : "Repair Safe Issues"}
        </button>
        <button className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white text-sm text-slate-700 shadow-sm disabled:opacity-50" onClick={resetRepairs} disabled={!repaired}>
          Reset All Repairs
        </button>
        <p className="text-xs leading-5 text-slate-500">MODOC repairs deterministic issues automatically. Geometry changes that may alter design intent are listed as approval or manual-review work.</p>
        <button className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white text-sm text-slate-700 shadow-sm" onClick={() => copilot.mutate()}>
          <MessageSquareText size={16} />
          Ask Copilot
        </button>
        <button className="inline-flex h-10 items-center justify-center gap-2 border border-slate-200 bg-white text-sm text-slate-700 shadow-sm" onClick={() => report.mutate()}>
          <Download size={16} />
          Prepare Downloads
        </button>
      </div>
      {preview.error ? <p className="mt-3 text-sm text-red-600">{preview.error.message}</p> : null}
      {repair.error ? <p className="mt-3 text-sm text-red-600">{repair.error.message}</p> : null}
      {repair.data ? (
        <div className="mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
          <div className="font-medium text-emerald-700">Repair artifact ready</div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Metric label="Original score" value={`${repair.data.before_health_score}/100 actual`} />
            <Metric label="Repaired score" value={`${repair.data.after_health_score}/100 actual`} />
            <Metric label="Original triangles" value={`${repair.data.before_metrics.face_count.toLocaleString()} actual`} />
            <Metric label="Remaining issues" value={`${repair.data.after_run.issues.length} actual`} />
          </div>
          <a className="mt-3 inline-flex h-10 items-center justify-center gap-2 border border-sky-500 bg-sky-500 px-3 text-sm font-semibold text-white shadow-sm" href={artifactUrl(repair.data.artifact_id)} download>
            <Download size={16} />
            Download repaired file
          </a>
          <ReadinessSummary run={repair.data.after_run} processingMode={processingMode} />
        </div>
      ) : null}
      {report.data ? (
        <div className="mt-4 border border-slate-200 bg-white p-3 text-sm">
          <div className="font-medium text-slate-950">Report exports</div>
          <a className="mt-2 block text-sky-700 underline" href={artifactUrl(report.data.pdf)}>PDF report</a>
          <a className="block text-sky-700 underline" href={artifactUrl(report.data.json)}>JSON results</a>
          <a className="block text-sky-700 underline" href={artifactUrl(report.data.csv)}>CSV issue list</a>
        </div>
      ) : null}
      {copilot.data ? (
        <div className="mt-4 border border-sky-100 bg-sky-50 p-3 text-sm leading-6 text-slate-700">
          <div className="font-medium text-sky-800">Grounded answer ({copilot.data.source})</div>
          <p className="mt-2">{copilot.data.summary}</p>
          <p className="mt-2 text-xs text-slate-500">{copilot.data.disclaimer}</p>
        </div>
      ) : null}
      {showPreview && preview.data ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl border border-white/80 bg-white/95 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Confirm safe repair plan</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">MODOC will only apply deterministic operations listed as safe or low risk.</p>
              </div>
              <span className={`whitespace-nowrap border px-2 py-1 text-xs font-semibold ${preview.data.geometry_will_change ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {preview.data.geometry_will_change ? "Geometry will change" : "No safe change predicted"}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <Metric label="Score now" value={`${preview.data.score_before}/100 actual`} />
              <Metric label="Estimated after" value={`${preview.data.score_after_estimate}/100 estimated`} />
              <Metric label="Remaining issues" value={`${preview.data.remaining_issues.length} estimated`} />
            </div>
            <div className="mt-4 max-h-56 overflow-auto border border-slate-200 bg-slate-50">
              {preview.data.operations.length ? preview.data.operations.map((operation) => (
                <div key={operation.id} className="border-b border-slate-200 p-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-900">
                    <span>{operation.description}</span>
                    <span className="text-xs uppercase text-slate-500">{operation.risk_level.replaceAll("_", " ")}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {operation.repair_type.replaceAll("_", " ")} / {operation.before_count.toLocaleString()} affected elements / {operation.auto_fix_eligible ? "one-click eligible" : "approval required"}
                  </div>
                </div>
              )) : <div className="p-3 text-sm text-slate-600">No eligible safe repair operations were found for this result.</div>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button className="h-10 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => setShowPreview(false)} disabled={repair.isPending}>Cancel</button>
              <button className="h-10 border border-emerald-500 bg-emerald-500 px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={() => repair.mutate()} disabled={repair.isPending || !preview.data.geometry_will_change || !preview.data.operations.some((operation) => operation.auto_fix_eligible)}>
                {repair.isPending ? "Applying..." : "Apply safe repairs"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function ReadinessSummary({ run, processingMode }: { run: InspectionRun; processingMode: ProcessingMode }) {
  const readiness = evaluateModelReadiness(toAnalysisResult(run, processingMode), processingMode);
  return (
    <div className="mt-3 border border-white/70 bg-white/70 p-3 text-xs text-slate-700">
      <div className="font-semibold text-slate-950">{readiness.status.replaceAll("_", " ")}</div>
      <p className="mt-1">{readiness.message}</p>
      {readiness.benefitsAfterRepair.slice(0, 3).map((benefit) => <div key={benefit} className="mt-1">OK - {benefit}</div>)}
    </div>
  );
}

function ExplanationCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-slate-200 bg-white/70 p-3 text-sm leading-6 text-slate-700">
      <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
      <p className="mt-1">{text}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-200 bg-white/70 p-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium text-slate-950">{value}</dd>
    </div>
  );
}
