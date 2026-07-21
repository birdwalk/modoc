from __future__ import annotations

import csv
import json
from pathlib import Path

from .geometry import face_normal
from .models import GeometryIssue, InspectionRun, MeshModel


def write_ascii_stl(mesh: MeshModel, path: Path, name: str = "modeldoctor_repaired") -> None:
    lines = [f"solid {name}"]
    for face in mesh.faces:
        n = face_normal(mesh.vertices, face)
        lines.append(f"  facet normal {n[0]:.9g} {n[1]:.9g} {n[2]:.9g}")
        lines.append("    outer loop")
        for idx in face:
            v = mesh.vertices[idx]
            lines.append(f"      vertex {v[0]:.9g} {v[1]:.9g} {v[2]:.9g}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append(f"endsolid {name}")
    path.write_text("\n".join(lines), encoding="utf-8")


def write_obj(mesh: MeshModel, path: Path, name: str = "modoc_repaired") -> None:
    lines = [f"o {name}"]
    for index, vertex in enumerate(mesh.vertices):
        if len(mesh.vertex_colors) == len(mesh.vertices):
            color = mesh.vertex_colors[index]
            lines.append(f"v {vertex[0]:.9g} {vertex[1]:.9g} {vertex[2]:.9g} {color[0]:.9g} {color[1]:.9g} {color[2]:.9g}")
        else:
            lines.append(f"v {vertex[0]:.9g} {vertex[1]:.9g} {vertex[2]:.9g}")
    normals = [face_normal(mesh.vertices, face) for face in mesh.faces]
    for normal in normals:
        lines.append(f"vn {normal[0]:.9g} {normal[1]:.9g} {normal[2]:.9g}")
    for normal_index, face in enumerate(mesh.faces, start=1):
        a, b, c = (idx + 1 for idx in face)
        lines.append(f"f {a}//{normal_index} {b}//{normal_index} {c}//{normal_index}")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_run_json(run: InspectionRun, path: Path) -> None:
    path.write_text(run.model_dump_json(indent=2), encoding="utf-8")


def write_issues_csv(issues: list[GeometryIssue], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "rule_id", "severity", "category", "summary", "occurrences", "repair_available", "manual_review"])
        for issue in issues:
            writer.writerow([issue.id, issue.rule_id, issue.severity.value, issue.category, issue.summary, issue.occurrence_count, issue.automatic_repair_available, issue.requires_manual_review])


def viewer_arrays(mesh: MeshModel, max_faces: int | None = None) -> tuple[list[float], list[int], list[float]]:
    faces = mesh.faces
    if max_faces and len(faces) > max_faces:
        stride = max(1, len(faces) // max_faces)
        faces = faces[::stride][:max_faces]
        used = sorted({idx for face in faces for idx in face})
        remap = {old: new for new, old in enumerate(used)}
        vertices_for_view = [mesh.vertices[idx] for idx in used]
        faces = [tuple(remap[idx] for idx in face) for face in faces]
        colors_for_view = [mesh.vertex_colors[idx] for idx in used] if len(mesh.vertex_colors) == len(mesh.vertices) else []
    else:
        vertices_for_view = mesh.vertices
        colors_for_view = mesh.vertex_colors if len(mesh.vertex_colors) == len(mesh.vertices) else []
    vertices = [coord for vertex in vertices_for_view for coord in vertex]
    indices = [idx for face in faces for idx in face]
    colors = [component for color in colors_for_view for component in color]
    return vertices, indices, colors
