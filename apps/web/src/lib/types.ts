export type Severity = "INFO" | "LOW" | "MODERATE" | "HIGH" | "BLOCKING";

export type Vec3 = { x: number; y: number; z: number };

export type BoundingBox = { min: Vec3; max: Vec3; size: Vec3 };

export type Metrics = {
  filename: string;
  format: string;
  units: string | null;
  vertex_count: number;
  edge_count: number;
  face_count: number;
  shell_count: number;
  bounding_box: BoundingBox;
  watertight: boolean;
  volume: number | null;
  surface_area: number;
  geometry_hash: string;
  estimated_file_complexity: string;
  parser: string;
  parser_version: string;
};

export type Issue = {
  id: string;
  rule_id: string;
  rule_name: string;
  category: string;
  severity: Severity;
  summary: string;
  technical_explanation: string;
  plain_language_explanation: string;
  workflow_impact: string;
  recommended_action: string;
  affected: {
    face_indices: number[];
    edge_indices: [number, number][];
    vertex_indices: number[];
    bounding_region?: BoundingBox | null;
  };
  occurrence_count: number;
  confidence: number;
  automatic_repair_available: boolean;
  repair_risk?: string | null;
  supporting_measurements: Record<string, unknown>;
  viewer_highlight: { faces?: number[]; edges?: [number, number][]; vertices?: number[] };
  requires_manual_review: boolean;
};

export type InspectionRun = {
  id: string;
  model_id: string;
  version_id: string;
  intended_use: string;
  status: string;
  metrics: Metrics;
  issues: Issue[];
  health_scores: {
    general_geometry_health: number;
    print_readiness: number;
    rendering_game_readiness: number;
    cad_handoff_readiness: number;
    selected_use_score: number;
    methodology: string;
  };
  analysis_duration_ms: number;
  created_at: string;
  audit_trail: string[];
};

export type ViewerPayload = {
  vertices: number[];
  indices: number[];
  vertex_colors: number[];
  issues: Issue[];
  metrics: Metrics;
};

export type RepairResult = {
  id: string;
  source_run_id: string;
  version_id: string;
  applied_repairs: string[];
  skipped_repairs: string[];
  before_metrics: Metrics;
  before_health_score: number;
  after_health_score: number;
  after_run: InspectionRun;
  artifact_id: string;
};
