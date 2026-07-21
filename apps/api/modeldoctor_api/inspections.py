from __future__ import annotations

import math
from collections import Counter, defaultdict

from .geometry import bounding_box_for_refs, connected_components, edge_map, face_area, face_normal
from .models import GeometryIssue, IssueGeometryReference, MeshModel, RepairRisk, Severity


def run_inspections(mesh: MeshModel, intended_use: str) -> list[GeometryIssue]:
    issues: list[GeometryIssue] = []
    issue_index = 1

    def add(issue: GeometryIssue) -> None:
        nonlocal issue_index
        issue.id = f"issue-{issue_index:03d}"
        issue_index += 1
        issues.append(issue)

    if not mesh.vertices or not mesh.faces:
        add(_issue("EMPTY_GEOMETRY", "Empty geometry", "parse", Severity.BLOCKING, "No usable mesh geometry was found.", "The parser returned zero vertices or zero faces.", [], [], [], True))
        return issues

    bad_vertices = [i for i, v in enumerate(mesh.vertices) if not all(math.isfinite(coord) for coord in v)]
    if bad_vertices:
        add(_issue("INVALID_COORDINATES", "NaN or infinite coordinates", "parse", Severity.BLOCKING, "Some vertices contain non-finite coordinates.", "Geometry kernels cannot reliably process NaN or infinite values.", [], [], bad_vertices, False))

    vertex_positions = Counter(mesh.vertices)
    duplicate_vertices = [i for i, v in enumerate(mesh.vertices) if vertex_positions[v] > 1]
    if duplicate_vertices:
        add(_issue("DUPLICATE_VERTICES", "Duplicate vertices", "topology", Severity.LOW, f"{len(duplicate_vertices)} vertices share exact coordinates.", "Exact duplicate vertices add complexity and can hide cracks before welding.", [], [], duplicate_vertices[:500], True, RepairRisk.SAFE))

    canonical_faces = [tuple(sorted(f)) for f in mesh.faces]
    face_counts = Counter(canonical_faces)
    duplicate_faces = [i for i, f in enumerate(canonical_faces) if face_counts[f] > 1]
    if duplicate_faces:
        add(_issue("DUPLICATE_FACES", "Duplicate faces", "topology", Severity.LOW, f"{len(duplicate_faces)} duplicate face entries were detected.", "Duplicate faces can cause z-fighting and confuse slicers or renderers.", duplicate_faces[:500], [], [], True, RepairRisk.SAFE))

    degenerate = [i for i, f in enumerate(mesh.faces) if len(set(f)) < 3 or face_area(mesh.vertices, f) <= 1e-12]
    if degenerate:
        sev = Severity.MODERATE if len(degenerate) > 20 else Severity.LOW
        add(_issue("DEGENERATE_TRIANGLES", "Degenerate triangles", "surface_quality", sev, f"{len(degenerate)} zero-area or collapsed triangles were found.", "Degenerate faces have no meaningful surface area and may break normals, volume and repair operations.", degenerate[:500], [], [], True, RepairRisk.SAFE))

    edges = edge_map(mesh.faces)
    boundary_edges = [edge for edge, face_ids in edges.items() if len(face_ids) == 1]
    if boundary_edges:
        sev = Severity.BLOCKING if intended_use == "3d_printing" else Severity.HIGH
        vertex_ids = sorted({i for edge in boundary_edges[:500] for i in edge})
        add(_issue("BOUNDARY_EDGES", "Boundary edges / open holes", "watertightness", sev, f"{len(boundary_edges)} boundary edges indicate open mesh regions.", "A watertight solid should have every edge shared by exactly two faces. Boundary edges usually mean holes or open surfaces. MODOC only closes small planar loops automatically; complex openings require review.", [], boundary_edges[:500], vertex_ids, True, RepairRisk.LOW_RISK, True))

    non_manifold = [edge for edge, face_ids in edges.items() if len(face_ids) > 2]
    if non_manifold:
        vertex_ids = sorted({i for edge in non_manifold[:500] for i in edge})
        add(_issue("NON_MANIFOLD_EDGES", "Non-manifold edges", "topology", Severity.HIGH, f"{len(non_manifold)} edges are shared by more than two faces.", "Non-manifold edges do not describe a clean solid boundary and commonly fail in printing and CAD handoff.", [], non_manifold[:500], vertex_ids, False, None, True))

    components = connected_components(mesh.faces)
    if len(components) > 1:
        face_refs = [face for comp in components[1:8] for face in comp[:80]]
        sev = Severity.MODERATE if intended_use in {"3d_printing", "cnc"} else Severity.LOW
        add(_issue("DISCONNECTED_SHELLS", "Disconnected shells", "topology", sev, f"{len(components)} disconnected mesh shells were found.", "Multiple shells may be intentional assemblies, but tiny or hidden shells often indicate stray geometry.", face_refs, [], [], False, None, True, {"shell_count": len(components)}))
        face_counts = [len(c) for c in components]
        tiny = [c for c in components if len(c) <= max(2, int(max(face_counts) * 0.03))]
        if tiny:
            refs = [face for comp in tiny for face in comp]
            add(_issue("TINY_COMPONENTS", "Tiny disconnected components", "cleanup", Severity.MODERATE, f"{len(tiny)} very small disconnected shell candidates were found.", "Tiny floating components can be accidental debris and may create failed prints or unexpected render artifacts.", refs[:500], [], [], True, RepairRisk.LOW_RISK, True))

    normals = [face_normal(mesh.vertices, f) for f in mesh.faces]
    zero_normals = [i for i, n in enumerate(normals) if n == (0.0, 0.0, 0.0)]
    if zero_normals:
        add(_issue("MISSING_NORMALS", "Missing or invalid normals", "surface_quality", Severity.LOW, "Some faces cannot produce valid normals.", "Normals are derived from face winding. Collapsed or malformed faces produce invalid normals.", zero_normals[:500], [], [], True, RepairRisk.SAFE))

    if mesh.source_format in {"OBJ", "GLB"} and not mesh.source_metadata.get("has_uv", False):
        add(_issue("MISSING_UV", "Missing UV coordinates", "rendering", Severity.MODERATE if intended_use in {"rendering", "game_asset"} else Severity.INFO, "No UV coordinates were found for a scene-oriented format.", "Missing UVs matter for textured rendering but may not matter for 3D printing.", [], [], [], False))

    bbox_vertices = set(range(len(mesh.vertices)))
    bbox = bounding_box_for_refs(mesh.vertices, bbox_vertices)
    max_dim = max(bbox.size.x, bbox.size.y, bbox.size.z)
    min_dim = min(d for d in [bbox.size.x, bbox.size.y, bbox.size.z] if d > 0) if max_dim > 0 else 0
    if max_dim > 10000 or (0 < max_dim < 0.1):
        add(_issue("SUSPICIOUS_SCALE", "Suspicious model scale", "scale", Severity.MODERATE, "The model dimensions are unusually small or large.", "Units are ambiguous in STL/OBJ. Extreme dimensions often indicate an inches/mm or meters/mm mismatch.", [], [], [], False, None, True, {"max_dimension": max_dim}))
    if min_dim and min_dim < max_dim * 0.01:
        add(_issue("THIN_WALL_CANDIDATE", "Thin-wall candidate", "printability", Severity.MODERATE, "One bounding-box axis is much thinner than the largest axis.", "This is an approximate signal that the model may contain thin walls or sheet-like geometry.", [], [], [], False, None, True, {"min_dimension": min_dim, "max_dimension": max_dim}))

    centroid = tuple(sum(v[i] for v in mesh.vertices) / len(mesh.vertices) for i in range(3))
    if math.sqrt(sum(c * c for c in centroid)) > max(1000, max_dim * 10):
        add(_issue("FAR_ORIGIN", "Model origin unusually far from geometry", "scene", Severity.LOW, "The model appears far from the world origin.", "Large origin offsets can make navigation, snapping and export workflows awkward.", [], [], [], True, RepairRisk.LOW_RISK, True, {"centroid": centroid}))

    return issues


def _issue(
    rule_id: str,
    rule_name: str,
    category: str,
    severity: Severity,
    summary: str,
    technical: str,
    faces: list[int],
    edges: list[tuple[int, int]],
    vertices: list[int],
    repair: bool,
    risk: RepairRisk | None = None,
    manual: bool = False,
    measurements: dict | None = None,
) -> GeometryIssue:
    plain, impact, action = issue_guidance(rule_id)
    return GeometryIssue(
        id="pending",
        rule_id=rule_id,
        rule_name=rule_name,
        category=category,
        severity=severity,
        summary=summary,
        technical_explanation=technical,
        plain_language_explanation=plain,
        workflow_impact=impact,
        recommended_action=action,
        affected=IssueGeometryReference(face_indices=faces, edge_indices=edges, vertex_indices=vertices),
        occurrence_count=max(len(faces), len(edges), len(vertices), 1),
        confidence=0.95 if not manual else 0.72,
        automatic_repair_available=repair,
        repair_risk=risk,
        supporting_measurements=measurements or {},
        viewer_highlight={"faces": faces[:1000], "edges": edges[:1000], "vertices": vertices[:1000]},
        requires_manual_review=manual,
    )


def issue_guidance(rule_id: str) -> tuple[str, str, str]:
    guidance = {
        "DUPLICATE_VERTICES": (
            "Some points sit in exactly the same place, like extra pins stacked on top of each other.",
            "This can hide cracks, slow game engines, and make repair tools do unnecessary work.",
            "Safe to merge exact duplicates before export.",
        ),
        "DUPLICATE_FACES": (
            "The same surface is drawn more than once in the same position.",
            "In rendering it can flicker as z-fighting; in printing it can confuse slicing and create rough toolpaths.",
            "Safe to remove repeated faces.",
        ),
        "DEGENERATE_TRIANGLES": (
            "Some triangles have collapsed into a line or a point, so they no longer describe a real surface.",
            "This can break normals, create black shading, and make slicers produce strange pauses or blobs.",
            "Safe to remove collapsed faces.",
        ),
        "BOUNDARY_EDGES": (
            "The mesh has open edges, which usually means a hole or an unclosed surface.",
            "For 3D printing, open holes can stop the slicer from knowing inside versus outside; that may create missing layers, messy infill, or nozzle dwell that leaves blobs.",
            "MODOC can close small simple holes automatically; complex openings need approval.",
        ),
        "NON_MANIFOLD_EDGES": (
            "Too many surfaces meet at the same edge, so the model does not describe one clean solid.",
            "CAD tools, slicers, and game importers may choose the wrong surface, fail boolean operations, or generate broken collisions.",
            "Review the affected area and rebuild or separate the topology.",
        ),
        "DISCONNECTED_SHELLS": (
            "The file contains separate floating parts instead of one connected body.",
            "This is fine for assemblies, but accidental fragments can print as debris, inflate polygon counts, or create unexpected collision pieces.",
            "Remove tiny debris automatically; approve merge, keep, or delete decisions for larger shells.",
        ),
        "TINY_COMPONENTS": (
            "Small loose fragments appear away from the main model.",
            "They can waste print time, create specks in renders, and add invisible polygons to game assets.",
            "Safe to remove clearly insignificant fragments.",
        ),
        "MISSING_NORMALS": (
            "Some surface directions cannot be calculated cleanly.",
            "Lighting may look inside-out, and exporters may guess the wrong side of a face.",
            "Regenerate normals after removing malformed faces.",
        ),
        "MISSING_UV": (
            "The model has no texture coordinates.",
            "Materials may render as flat colors or stretch incorrectly in game and visualisation tools.",
            "Generate UVs only after choosing the target rendering workflow.",
        ),
        "SUSPICIOUS_SCALE": (
            "The model looks unusually tiny or huge for its unit system.",
            "A millimeter/inch mismatch can make a print microscopic or enormous and can break camera clipping in viewers.",
            "Confirm units before scaling.",
        ),
        "THIN_WALL_CANDIDATE": (
            "One dimension is much thinner than the others, which may indicate fragile walls.",
            "Thin walls can fail to print, warp, or disappear after optimisation for games.",
            "Check target material, nozzle size, and tolerance before thickening.",
        ),
        "FAR_ORIGIN": (
            "The object is positioned far away from the scene center.",
            "This can make orbit controls, snapping, physics, and game imports feel broken.",
            "Safe to recenter a copied export while preserving the source run.",
        ),
    }
    return guidance.get(rule_id, (
        "MODOC found geometry that may not behave reliably in downstream tools.",
        "The practical risk depends on whether this model is for printing, games, rendering, or CAD handoff.",
        "Inspect the highlighted evidence and choose an appropriate repair strategy.",
    ))
