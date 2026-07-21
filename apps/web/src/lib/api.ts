import staticDemoData from "./staticDemoData.json";
import type { InspectionRun, Metrics, RepairResult, ViewerPayload } from "./types";

export type RepairPreviewOperation = {
  id: string;
  issue_id: string;
  repair_type: string;
  description: string;
  risk_level: string;
  auto_fix_eligible: boolean;
  before_count: number;
  after_count: number | null;
  status: string;
  error_details: string | null;
  geometry_modified: boolean;
};

export type RepairPreview = {
  operations: RepairPreviewOperation[];
  applied_repairs: string[];
  skipped_repairs: string[];
  before: Metrics;
  after_metrics: Metrics;
  remaining_issues: unknown[];
  geometry_will_change: boolean;
  score_before: number;
  score_after_estimate: number;
};

const configuredBase = process.env.NEXT_PUBLIC_API_BASE;
let activeApiBase = configuredBase ?? "http://127.0.0.1:8010";

function candidateBases() {
  return Array.from(new Set([
    activeApiBase,
    configuredBase,
    "http://127.0.0.1:8010",
    "http://localhost:8010",
    "http://127.0.0.1:8000",
    "http://localhost:8000"
  ].filter(Boolean) as string[]));
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const bases = candidateBases();
  let lastError: unknown = null;
  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(body.detail ?? response.statusText);
      }
      activeApiBase = base;
      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && !/Failed to fetch|NetworkError|Load failed/i.test(error.message)) {
        throw error;
      }
    }
  }
  throw new Error(`Could not reach MODOC API. Start the backend on 127.0.0.1:8010, then refresh. Last error: ${lastError instanceof Error ? lastError.message : "network unavailable"}`);
}

const demoRuns = staticDemoData.runs as Record<string, InspectionRun>;
const demoViewers = staticDemoData.viewers as Record<string, ViewerPayload>;

function staticDemoRun(demoId: string, intendedUse: string) {
  const run = demoRuns[demoId] ?? demoRuns["multi-defect-demo"];
  return {
    ...run,
    intended_use: intendedUse,
    created_at: new Date().toISOString()
  };
}

export async function loadDemo(intendedUse: string, demoId = "multi-defect-demo") {
  try {
    return await json<InspectionRun>(`/api/v1/demo-models/${demoId}/load?intended_use=${encodeURIComponent(intendedUse)}`, { method: "POST" });
  } catch {
    return staticDemoRun(demoId, intendedUse);
  }
}

export function checkApiHealth() {
  return json<{ status: string; service: string }>("/api/v1/health");
}

export function uploadModel(file: File, intendedUse: string) {
  const data = new FormData();
  data.append("file", file);
  return json<InspectionRun>(`/api/v1/models/upload?intended_use=${encodeURIComponent(intendedUse)}`, { method: "POST", body: data });
}

export async function getViewer(runId: string) {
  if (demoViewers[runId]) return demoViewers[runId];
  try {
    return await json<ViewerPayload>(`/api/v1/inspection-runs/${runId}/viewer`);
  } catch (error) {
    if (demoViewers[runId]) return demoViewers[runId];
    throw error;
  }
}

export function applySafeFixes(runId: string) {
  return json<RepairResult>(`/api/v1/inspection-runs/${runId}/repairs/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repair_ids: ["SAFE_ALL"], tolerance: 0 })
  });
}

export function previewSafeFixes(runId: string) {
  return json<RepairPreview>(`/api/v1/inspection-runs/${runId}/repairs/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repair_ids: ["SAFE_ALL"], tolerance: 0 })
  });
}

export function createReport(runId: string) {
  return json<Record<string, string>>(`/api/v1/inspection-runs/${runId}/reports`, { method: "POST" });
}

export function askCopilot(runId: string, question: string) {
  return json<{
    summary: string;
    priority_issues: { issue_id: string; why_it_matters: string; recommended_action: string }[];
    readiness_assessment: { status: string; reasoning: string[] };
    limitations: string[];
    recommended_next_steps: string[];
    disclaimer: string;
    source: string;
  }>(`/api/v1/inspection-runs/${runId}/copilot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
}

export function artifactUrl(id: string) {
  return `${activeApiBase}/api/v1/artifacts/${id}/download`;
}
