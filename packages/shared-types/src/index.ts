export type IntendedUse = "3d_printing" | "rendering" | "game_asset" | "ar_vr" | "cnc" | "general";

export type ProcessingStage =
  | "QUEUED"
  | "VALIDATING_FILE"
  | "PARSING_GEOMETRY"
  | "BUILDING_TOPOLOGY"
  | "COMPUTING_METRICS"
  | "RUNNING_INSPECTIONS"
  | "GENERATING_VIEWER_ASSET"
  | "GENERATING_EXPLANATION"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";
