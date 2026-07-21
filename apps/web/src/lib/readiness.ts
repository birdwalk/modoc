import type { GeometryAnalysisResult, ProcessingMode } from "./analysis";

export type ReadinessStatus = "READY" | "READY_WITH_WARNINGS" | "NOT_READY" | "MANUAL_REVIEW_REQUIRED";

export interface ReadinessResult {
  status: ReadinessStatus;
  score: number;
  passedChecks: string[];
  failedChecks: string[];
  warnings: string[];
  blockingIssues: string[];
  benefitsAfterRepair: string[];
  risksBeforeRepair: string[];
  message: string;
}

export function evaluateModelReadiness(result: GeometryAnalysisResult, targetUseCase: ProcessingMode): ReadinessResult {
  const issues = result.issues;
  const blockingRules = targetUseCase === "manufacturing"
    ? ["BOUNDARY_EDGES", "NON_MANIFOLD_EDGES", "THIN_WALL_CANDIDATE"]
    : targetUseCase === "real_time"
      ? ["DEGENERATE_TRIANGLES", "MISSING_NORMALS"]
      : ["BOUNDARY_EDGES", "NON_MANIFOLD_EDGES", "DEGENERATE_TRIANGLES"];
  const blockingIssues = issues.filter((issue) => issue.severity === "BLOCKING" || blockingRules.includes(issue.type));
  const warnings = issues.filter((issue) => issue.severity === "MODERATE" || issue.severity === "LOW").map((issue) => issue.title);
  const failedChecks = blockingIssues.map((issue) => issue.title);
  const passedChecks = [
    result.fileSummary.vertexCount > 0 ? "Geometry extracted" : "",
    result.fileSummary.triangleCount > 0 ? "Triangle mesh present" : "",
    failedChecks.length === 0 ? "No blocking workflow issue detected" : ""
  ].filter(Boolean);
  let status: ReadinessStatus = "READY";
  if (blockingIssues.length) status = blockingIssues.some((issue) => issue.severity === "BLOCKING") ? "NOT_READY" : "MANUAL_REVIEW_REQUIRED";
  else if (warnings.length) status = "READY_WITH_WARNINGS";
  return {
    status,
    score: result.healthSummary.overallHealthScore,
    passedChecks,
    failedChecks,
    warnings,
    blockingIssues: blockingIssues.map((issue) => issue.title),
    benefitsAfterRepair: benefitsFor(targetUseCase),
    risksBeforeRepair: issues.slice(0, 5).map((issue) => riskFor(issue.type, targetUseCase)),
    message: messageFor(status, targetUseCase)
  };
}

function messageFor(status: ReadinessStatus, targetUseCase: ProcessingMode) {
  if (targetUseCase === "real_time") {
    if (status === "READY") return "Ready for Real-Time Use based on the checks performed.";
    if (status === "READY_WITH_WARNINGS") return "Ready for Real-Time Use with warnings that may affect performance or visuals.";
    return "Repairs or manual review are still required before real-time use.";
  }
  if (targetUseCase === "visualisation") {
    if (status === "READY") return "Ready for Visualisation based on the checks performed.";
    if (status === "READY_WITH_WARNINGS") return "Ready for Visualisation with warnings that may affect surface quality.";
    return "Repairs or manual review are still required before visualisation handoff.";
  }
  if (targetUseCase === "manufacturing") {
    if (status === "READY") return "Geometry Ready for Manufacturing Review based on the checks performed.";
    if (status === "READY_WITH_WARNINGS") return "Geometry ready for review with remaining warnings.";
    return "Manual review required before manufacturing preparation.";
  }
  if (status === "READY") return "Ready for 3D Printing based on the checks performed.";
  if (status === "READY_WITH_WARNINGS") return "Ready with warnings. Review remaining issues before slicing.";
  return "Repairs still required before 3D printing.";
}

function benefitsFor(targetUseCase: ProcessingMode) {
  if (targetUseCase === "real_time") return ["Reduced rendering cost", "Cleaner model structure", "Reduced floating fragments", "Improved normal consistency"];
  if (targetUseCase === "visualisation") return ["Improved shading", "Cleaner surface evidence", "Reduced visual artifacts", "Reduced duplicate geometry"];
  if (targetUseCase === "manufacturing") return ["Invalid topology reduced", "Disconnected fragments reviewed", "Scale checks completed", "Remaining tolerance warnings identified"];
  return ["Reduced risk of invalid slicing", "Closed safe open boundaries where possible", "Removed invalid duplicate geometry", "Improved surface consistency"];
}

function riskFor(issueType: string, targetUseCase: ProcessingMode) {
  if (issueType === "BOUNDARY_EDGES") return targetUseCase === "real_time" ? "Open edges may create visible gaps; repair small safe loops or review intentional openings." : "Open geometry may not represent a closed solid; repair small safe loops or review manually.";
  if (issueType === "DISCONNECTED_SHELLS" || issueType === "TINY_COMPONENTS") return "Disconnected parts may become floating geometry; remove tiny fragments and review larger shells.";
  if (issueType === "NON_MANIFOLD_EDGES") return "Ambiguous topology may cause unpredictable downstream processing; manual review is recommended.";
  if (issueType === "MISSING_NORMALS") return "Normal problems may cause broken lighting or incorrect surface interpretation; recalculate normals.";
  if (issueType === "DEGENERATE_TRIANGLES") return "Collapsed faces can break repair, export, and rendering operations; remove degenerate faces.";
  return "Detected geometry issue may affect the selected workflow; inspect evidence and repair safe items first.";
}
