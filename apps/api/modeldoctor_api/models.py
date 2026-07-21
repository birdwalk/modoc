from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


class Severity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    BLOCKING = "BLOCKING"


class RepairRisk(str, Enum):
    SAFE = "SAFE"
    LOW_RISK = "LOW_RISK"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    DESTRUCTIVE = "DESTRUCTIVE"


class ProcessingStage(str, Enum):
    QUEUED = "QUEUED"
    VALIDATING_FILE = "VALIDATING_FILE"
    PARSING_GEOMETRY = "PARSING_GEOMETRY"
    BUILDING_TOPOLOGY = "BUILDING_TOPOLOGY"
    COMPUTING_METRICS = "COMPUTING_METRICS"
    RUNNING_INSPECTIONS = "RUNNING_INSPECTIONS"
    GENERATING_VIEWER_ASSET = "GENERATING_VIEWER_ASSET"
    GENERATING_EXPLANATION = "GENERATING_EXPLANATION"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Vec3(BaseModel):
    x: float
    y: float
    z: float


class BoundingBox(BaseModel):
    min: Vec3
    max: Vec3
    size: Vec3


class MeshModel(BaseModel):
    source_format: str
    vertices: list[tuple[float, float, float]]
    faces: list[tuple[int, int, int]]
    normals: list[tuple[float, float, float]] = []
    vertex_colors: list[tuple[float, float, float]] = Field(default_factory=list)
    units: str | None = None
    source_metadata: dict[str, Any] = Field(default_factory=dict)


class ModelMetrics(BaseModel):
    filename: str
    format: str
    units: str | None
    vertex_count: int
    edge_count: int
    face_count: int
    shell_count: int
    bounding_box: BoundingBox
    watertight: bool
    volume: float | None
    surface_area: float
    geometry_hash: str
    estimated_file_complexity: Literal["small", "moderate", "large", "very_large"]
    preview_simplified: bool = False
    parser: str
    parser_version: str


class IssueGeometryReference(BaseModel):
    face_indices: list[int] = Field(default_factory=list)
    edge_indices: list[tuple[int, int]] = Field(default_factory=list)
    vertex_indices: list[int] = Field(default_factory=list)
    bounding_region: BoundingBox | None = None


class GeometryIssue(BaseModel):
    id: str
    rule_id: str
    rule_name: str
    category: str
    severity: Severity
    summary: str
    technical_explanation: str
    plain_language_explanation: str = ""
    workflow_impact: str = ""
    recommended_action: str = ""
    affected: IssueGeometryReference
    occurrence_count: int
    confidence: float
    automatic_repair_available: bool
    repair_risk: RepairRisk | None = None
    supporting_measurements: dict[str, Any] = Field(default_factory=dict)
    viewer_highlight: dict[str, Any] = Field(default_factory=dict)
    requires_manual_review: bool = False


class HealthScores(BaseModel):
    general_geometry_health: int
    print_readiness: int
    rendering_game_readiness: int
    cad_handoff_readiness: int
    selected_use_score: int
    methodology: str


class InspectionRun(BaseModel):
    id: str
    model_id: str
    version_id: str
    intended_use: str
    status: ProcessingStage
    metrics: ModelMetrics
    issues: list[GeometryIssue]
    health_scores: HealthScores
    analysis_duration_ms: int
    created_at: str
    audit_trail: list[str]


class ViewerPayload(BaseModel):
    vertices: list[float]
    indices: list[int]
    vertex_colors: list[float] = Field(default_factory=list)
    issues: list[GeometryIssue]
    metrics: ModelMetrics


class RepairRequest(BaseModel):
    repair_ids: list[str]
    tolerance: float = 0.0


class RepairResult(BaseModel):
    id: str
    source_run_id: str
    version_id: str
    applied_repairs: list[str]
    skipped_repairs: list[str]
    before_metrics: ModelMetrics
    before_health_score: int
    after_health_score: int
    after_run: InspectionRun
    artifact_id: str
    audit_trail: list[str]


class CopilotRequest(BaseModel):
    question: str


class CopilotResponse(BaseModel):
    summary: str
    priority_issues: list[dict[str, str]]
    readiness_assessment: dict[str, Any]
    limitations: list[str]
    recommended_next_steps: list[str]
    disclaimer: str
    source: Literal["deterministic_fallback", "openai"]
    schema_version: str = "1.0"


class Artifact(BaseModel):
    id: str
    kind: str
    filename: str
    path: str
    content_type: str
