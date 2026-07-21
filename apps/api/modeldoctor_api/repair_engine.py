from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .exporters import write_obj
from .geometry import bounding_box_for_refs, connected_components, edge_map, face_area
from .inspections import run_inspections
from .models import GeometryIssue, MeshModel
from .parsers import parse_model
from .repairs import apply_repairs


@dataclass(frozen=True)
class GeometrySnapshot:
    vertex_count: int
    face_count: int
    component_count: int


@dataclass
class RepairOperation:
    id: str
    issue_id: str
    repair_type: str
    description: str
    risk_level: str
    auto_fix_eligible: bool
    before_count: int
    after_count: int | None = None
    status: str = "PENDING"
    error_details: str | None = None
    geometry_modified: bool = False


@dataclass
class RepairPlan:
    operations: list[RepairOperation] = field(default_factory=list)


@dataclass
class RepairValidationResult:
    valid: bool
    message: str
    exported_path: Path | None = None


@dataclass
class EngineRepairResult:
    original_snapshot: GeometrySnapshot
    repaired_snapshot: GeometrySnapshot
    repaired_mesh: MeshModel
    plan: RepairPlan
    applied_repairs: list[str]
    skipped_repairs: list[str]
    failed_repairs: list[str]
    remaining_issues: list[GeometryIssue]
    validation: RepairValidationResult


class GeometryRepairEngine:
    def analyseGeometry(self, mesh: MeshModel, intended_use: str) -> list[GeometryIssue]:
        return run_inspections(mesh, intended_use)

    def createRepairPlan(self, issues: list[GeometryIssue]) -> RepairPlan:
        operations: list[RepairOperation] = []
        eligible_rules = {
            "DUPLICATE_VERTICES": ("merge_duplicate_vertices", "Merge exact duplicate vertices and reindex faces.", "SAFE"),
            "DUPLICATE_FACES": ("remove_duplicate_faces", "Remove repeated triangles with the same vertex set.", "SAFE"),
            "DEGENERATE_TRIANGLES": ("remove_degenerate_faces", "Remove zero-area or collapsed faces.", "SAFE"),
            "MISSING_NORMALS": ("recalculate_normals", "Regenerate normals during OBJ export.", "SAFE"),
            "TINY_COMPONENTS": ("remove_tiny_components", "Remove clearly insignificant disconnected fragments.", "LOW_RISK"),
            "BOUNDARY_EDGES": ("close_safe_holes", "Close only small simple boundary loops.", "LOW_RISK"),
            "FAR_ORIGIN": ("center_origin", "Move the model geometry closer to the world origin.", "LOW_RISK"),
            "DISCONNECTED_SHELLS": ("review_shell_strategy", "Choose whether shells should remain separate, merge, or be removed.", "REVIEW_REQUIRED"),
            "NON_MANIFOLD_EDGES": ("rebuild_topology", "Rebuild ambiguous topology after user approval.", "REVIEW_REQUIRED"),
            "SELF_INTERSECTIONS": ("separate_intersections", "Separate or boolean-clean intersecting surfaces after user approval.", "REVIEW_REQUIRED"),
            "THIN_WALL_CANDIDATE": ("review_wall_thickness", "Check wall thickness against manufacturing tolerance before modifying geometry.", "REVIEW_REQUIRED"),
            "SUSPICIOUS_SCALE": ("confirm_units", "Confirm target units before scaling the model.", "REVIEW_REQUIRED"),
            "MISSING_UV": ("generate_uvs", "Generate or preserve UV layout depending on rendering workflow.", "REVIEW_REQUIRED"),
        }
        for issue in issues:
            if issue.rule_id not in eligible_rules:
                continue
            repair_type, description, risk = eligible_rules[issue.rule_id]
            operations.append(RepairOperation(
                id=f"repair-{issue.id}",
                issue_id=issue.id,
                repair_type=repair_type,
                description=description,
                risk_level=risk,
                auto_fix_eligible=risk in {"SAFE", "LOW_RISK"},
                before_count=issue.occurrence_count,
            ))
        return RepairPlan(operations=operations)

    def applySafeRepairs(self, mesh: MeshModel, issues: list[GeometryIssue], intended_use: str, export_path: Path) -> EngineRepairResult:
        original = snapshot(mesh)
        plan = self.createRepairPlan(issues)
        repair_ids = [issue.rule_id for issue in issues if any(op.issue_id == issue.id and op.auto_fix_eligible for op in plan.operations)]
        repaired, applied, skipped = apply_repairs(mesh, repair_ids)
        remaining = self.analyseGeometry(repaired, intended_use)
        repaired_snapshot = snapshot(repaired)
        for operation in plan.operations:
            operation.status = "APPLIED" if _operation_applied(operation.repair_type, applied) else "SKIPPED"
            operation.geometry_modified = operation.status == "APPLIED"
            operation.after_count = _remaining_count_for_operation(operation.repair_type, remaining)
        validation = self.exportRepairedModel(repaired, export_path) if original != repaired_snapshot else RepairValidationResult(False, "No safe repair modified geometry.")
        return EngineRepairResult(
            original_snapshot=original,
            repaired_snapshot=repaired_snapshot,
            repaired_mesh=repaired,
            plan=plan,
            applied_repairs=applied,
            skipped_repairs=skipped,
            failed_repairs=[] if validation.valid else ["OBJ_EXPORT_VALIDATION"],
            remaining_issues=remaining,
            validation=validation,
        )

    def applySelectedRepairs(self, mesh: MeshModel, repair_ids: list[str], intended_use: str, export_path: Path) -> EngineRepairResult:
        issues = [issue for issue in self.analyseGeometry(mesh, intended_use) if issue.rule_id in repair_ids]
        return self.applySafeRepairs(mesh, issues, intended_use, export_path)

    def validateRepairResult(self, path: Path) -> RepairValidationResult:
        try:
            mesh, _, _ = parse_model(path)
            if not mesh.vertices or not mesh.faces:
                return RepairValidationResult(False, "Exported OBJ parsed but contained no geometry.", path)
        except Exception as exc:
            return RepairValidationResult(False, f"Exported OBJ failed revalidation: {exc}", path)
        return RepairValidationResult(True, "Exported OBJ revalidated successfully.", path)

    def exportRepairedModel(self, mesh: MeshModel, path: Path) -> RepairValidationResult:
        write_obj(mesh, path, "modoc_repaired")
        return self.validateRepairResult(path)


def snapshot(mesh: MeshModel) -> GeometrySnapshot:
    return GeometrySnapshot(vertex_count=len(mesh.vertices), face_count=len(mesh.faces), component_count=len(connected_components(mesh.faces)) if mesh.faces else 0)


def _operation_applied(repair_type: str, applied: list[str]) -> bool:
    mapping = {
        "merge_duplicate_vertices": "DUPLICATE_VERTICES",
        "remove_duplicate_faces": "DUPLICATE_FACES",
        "remove_degenerate_faces": "DEGENERATE_TRIANGLES",
        "recalculate_normals": "MISSING_NORMALS",
        "remove_tiny_components": "TINY_COMPONENTS",
        "close_safe_holes": "BOUNDARY_EDGES",
        "center_origin": "FAR_ORIGIN",
    }
    return mapping.get(repair_type) in applied


def _remaining_count_for_operation(repair_type: str, issues: list[GeometryIssue]) -> int:
    mapping = {
        "merge_duplicate_vertices": "DUPLICATE_VERTICES",
        "remove_duplicate_faces": "DUPLICATE_FACES",
        "remove_degenerate_faces": "DEGENERATE_TRIANGLES",
        "recalculate_normals": "MISSING_NORMALS",
        "remove_tiny_components": "TINY_COMPONENTS",
        "close_safe_holes": "BOUNDARY_EDGES",
        "center_origin": "FAR_ORIGIN",
    }
    rule = mapping.get(repair_type)
    if rule is None:
        return sum(issue.occurrence_count for issue in issues)
    return sum(issue.occurrence_count for issue in issues if issue.rule_id == rule)
