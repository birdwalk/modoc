import type { InspectionRun, Issue, Metrics, Severity } from "./types";

export type ProcessingMode = "real_time" | "visualisation" | "manufacturing";

export type RepairLevel = "safe_automatic" | "user_approved" | "manual_review";

export type AnalysisStep =
  | "Uploading"
  | "Validating"
  | "Extracting geometry"
  | "Analysing mesh"
  | "Detecting issues"
  | "Calculating health score"
  | "Preparing report"
  | "Completed"
  | "Failed";

export type RepairabilityStatus = "safe_repairs_available" | "review_required" | "manual_only" | "no_repairs_needed";

export interface FileSummary {
  fileName: string;
  fileType: string;
  originalFileSize: number | null;
  objectCount: number;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  triangleCount: number;
  boundingBoxDimensions: string;
  materialCount: number;
  connectedComponentCount: number;
}

export interface HealthDeduction {
  label: string;
  points: number;
}

export interface HealthSummary {
  overallHealthScore: number;
  grade: "Excellent" | "Good" | "Needs attention" | "Poor" | "Critical";
  criticalIssueCount: number;
  warningCount: number;
  informationCount: number;
  passedCheckCount: number;
  repairabilityStatus: RepairabilityStatus;
  deductions: HealthDeduction[];
}

export interface AnalysisIssue {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: Severity;
  affectedElementCount: number;
  estimatedLocation: string;
  confidence: number;
  recommendedAction: string;
  autoFixAvailability: boolean;
  repairRisk: string;
  status: "open" | "selected" | "repair_available" | "manual_review" | "resolved";
}

export interface GeometryAnalysisResult {
  fileSummary: FileSummary;
  healthSummary: HealthSummary;
  issues: AnalysisIssue[];
  processingMode: ProcessingMode;
  processingLog: string[];
}

const severityPenalty: Record<Severity, number> = {
  INFO: 0,
  LOW: 3,
  MODERATE: 8,
  HIGH: 18,
  BLOCKING: 35
};

const ruleLabels: Record<string, string> = {
  NON_MANIFOLD_EDGES: "Non-manifold edges",
  BOUNDARY_EDGES: "Open boundaries",
  DUPLICATE_VERTICES: "Duplicate vertices",
  DUPLICATE_FACES: "Duplicate faces",
  DEGENERATE_TRIANGLES: "Degenerate geometry",
  DISCONNECTED_SHELLS: "Disconnected components",
  TINY_COMPONENTS: "Tiny disconnected components",
  THIN_WALL_CANDIDATE: "Thin-wall warnings",
  SUSPICIOUS_SCALE: "Scale or unit warning",
  MISSING_UV: "Missing UVs",
  MISSING_NORMALS: "Normal problems"
};

export function gradeForScore(score: number): HealthSummary["grade"] {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 60) return "Needs attention";
  if (score >= 40) return "Poor";
  return "Critical";
}

export function calculateHealthDeductions(issues: Issue[]): HealthDeduction[] {
  const grouped = new Map<string, number>();
  for (const issue of issues) {
    const label = ruleLabels[issue.rule_id] ?? issue.rule_name;
    grouped.set(label, (grouped.get(label) ?? 0) + severityPenalty[issue.severity]);
  }
  return [...grouped.entries()]
    .filter(([, points]) => points > 0)
    .map(([label, points]) => ({ label, points }))
    .sort((a, b) => b.points - a.points);
}

export function toAnalysisResult(run: InspectionRun, mode: ProcessingMode): GeometryAnalysisResult {
  const metrics: Metrics = run.metrics;
  const criticalIssueCount = run.issues.filter((issue) => issue.severity === "BLOCKING" || issue.severity === "HIGH").length;
  const warningCount = run.issues.filter((issue) => issue.severity === "MODERATE" || issue.severity === "LOW").length;
  const informationCount = run.issues.filter((issue) => issue.severity === "INFO").length;
  const repairable = run.issues.filter((issue) => issue.automatic_repair_available);
  const manual = run.issues.filter((issue) => issue.requires_manual_review);
  return {
    fileSummary: {
      fileName: metrics.filename,
      fileType: metrics.format,
      originalFileSize: null,
      objectCount: Math.max(1, metrics.shell_count),
      vertexCount: metrics.vertex_count,
      edgeCount: metrics.edge_count,
      faceCount: metrics.face_count,
      triangleCount: metrics.face_count,
      boundingBoxDimensions: `${metrics.bounding_box.size.x.toFixed(2)} x ${metrics.bounding_box.size.y.toFixed(2)} x ${metrics.bounding_box.size.z.toFixed(2)}`,
      materialCount: 0,
      connectedComponentCount: metrics.shell_count
    },
    healthSummary: {
      overallHealthScore: run.health_scores.selected_use_score,
      grade: gradeForScore(run.health_scores.selected_use_score),
      criticalIssueCount,
      warningCount,
      informationCount,
      passedCheckCount: Math.max(0, 16 - run.issues.length),
      repairabilityStatus: repairable.length ? "safe_repairs_available" : manual.length ? "review_required" : run.issues.length ? "manual_only" : "no_repairs_needed",
      deductions: calculateHealthDeductions(run.issues)
    },
    issues: run.issues.map((issue) => ({
      id: issue.id,
      type: issue.rule_id,
      title: issue.rule_name,
      description: issue.summary,
      severity: issue.severity,
      affectedElementCount: issue.occurrence_count,
      estimatedLocation: issue.affected.bounding_region ? "Bounding region" : issue.affected.edge_indices.length ? "Edges" : issue.affected.face_indices.length ? "Faces" : issue.affected.vertex_indices.length ? "Vertices" : "Model-level",
      confidence: issue.confidence,
      recommendedAction: issue.automatic_repair_available ? "Apply safe automatic repair." : issue.requires_manual_review ? "Review manually before changing geometry." : "Inspect evidence and rerun analysis after edits.",
      autoFixAvailability: issue.automatic_repair_available,
      repairRisk: issue.repair_risk ?? "Manual review",
      status: issue.automatic_repair_available ? "repair_available" : issue.requires_manual_review ? "manual_review" : "open"
    })),
    processingMode: mode,
    processingLog: run.audit_trail
  };
}

export const analysisSteps: AnalysisStep[] = [
  "Uploading",
  "Validating",
  "Extracting geometry",
  "Analysing mesh",
  "Detecting issues",
  "Calculating health score",
  "Preparing report",
  "Completed"
];
