from __future__ import annotations

from .models import MeshModel


SAFE_REPAIRS = {
    "DUPLICATE_VERTICES": "Remove exact duplicate vertices",
    "DUPLICATE_FACES": "Remove duplicate faces",
    "DEGENERATE_TRIANGLES": "Remove degenerate triangles",
    "MISSING_NORMALS": "Regenerate normals on export",
    "TINY_COMPONENTS": "Remove clearly insignificant disconnected components",
    "BOUNDARY_EDGES": "Close small simple boundary loops",
    "FAR_ORIGIN": "Move model geometry closer to world origin",
}


def apply_repairs(mesh: MeshModel, repair_ids: list[str]) -> tuple[MeshModel, list[str], list[str]]:
    repaired = mesh.model_copy(deep=True)
    applied: list[str] = []
    skipped: list[str] = []
    requested = set(repair_ids)
    if "SAFE_ALL" in requested:
        requested.update(SAFE_REPAIRS)

    if "DUPLICATE_VERTICES" in requested:
        before = (len(repaired.vertices), len(repaired.faces))
        repaired = remove_duplicate_vertices(repaired)
        if (len(repaired.vertices), len(repaired.faces)) != before:
            applied.append("DUPLICATE_VERTICES")
        else:
            skipped.append("DUPLICATE_VERTICES")
    if "DUPLICATE_FACES" in requested:
        before = len(repaired.faces)
        seen: set[tuple[int, int, int]] = set()
        faces = []
        for face in repaired.faces:
            key = tuple(sorted(face))
            if key not in seen:
                seen.add(key)
                faces.append(face)
        repaired.faces = faces
        if len(faces) < before:
            applied.append("DUPLICATE_FACES")
        else:
            skipped.append("DUPLICATE_FACES")
    if "DEGENERATE_TRIANGLES" in requested:
        from .geometry import face_area

        before = len(repaired.faces)
        repaired.faces = [face for face in repaired.faces if len(set(face)) == 3 and face_area(repaired.vertices, face) > 1e-12]
        if len(repaired.faces) < before:
            applied.append("DEGENERATE_TRIANGLES")
        else:
            skipped.append("DEGENERATE_TRIANGLES")
    if "MISSING_NORMALS" in requested:
        repaired.normals = []
        applied.append("MISSING_NORMALS")
    if "TINY_COMPONENTS" in requested:
        before = len(repaired.faces)
        repaired = remove_tiny_components(repaired)
        if len(repaired.faces) < before:
            repaired = remove_unused_vertices(repaired)
            applied.append("TINY_COMPONENTS")
        else:
            skipped.append("TINY_COMPONENTS")
    if "BOUNDARY_EDGES" in requested:
        before = len(repaired.faces)
        repaired = fill_simple_planar_holes(repaired)
        if len(repaired.faces) > before:
            applied.append("BOUNDARY_EDGES")
        else:
            skipped.append("BOUNDARY_EDGES")
    if "FAR_ORIGIN" in requested:
        before = tuple(repaired.vertices)
        repaired = center_near_origin(repaired)
        if tuple(repaired.vertices) != before:
            applied.append("FAR_ORIGIN")
        else:
            skipped.append("FAR_ORIGIN")

    unsupported = requested.difference(set(SAFE_REPAIRS), {"SAFE_ALL"})
    skipped.extend(sorted(unsupported))
    return repaired, applied, skipped


def remove_duplicate_vertices(mesh: MeshModel) -> MeshModel:
    mapping: dict[tuple[float, float, float], int] = {}
    new_vertices: list[tuple[float, float, float]] = []
    new_colors: list[tuple[float, float, float]] = []
    has_colors = len(mesh.vertex_colors) == len(mesh.vertices)
    remap: dict[int, int] = {}
    for idx, vertex in enumerate(mesh.vertices):
        if vertex not in mapping:
            mapping[vertex] = len(new_vertices)
            new_vertices.append(vertex)
            if has_colors:
                new_colors.append(mesh.vertex_colors[idx])
        remap[idx] = mapping[vertex]
    mesh.vertices = new_vertices
    mesh.vertex_colors = new_colors if has_colors else []
    mesh.faces = [tuple(remap[i] for i in face) for face in mesh.faces]
    return mesh


def remove_unused_vertices(mesh: MeshModel) -> MeshModel:
    used = sorted({idx for face in mesh.faces for idx in face})
    remap = {old: new for new, old in enumerate(used)}
    has_colors = len(mesh.vertex_colors) == len(mesh.vertices)
    mesh.vertices = [mesh.vertices[idx] for idx in used]
    mesh.vertex_colors = [mesh.vertex_colors[idx] for idx in used] if has_colors else []
    mesh.faces = [tuple(remap[idx] for idx in face) for face in mesh.faces]
    return mesh


def remove_tiny_components(mesh: MeshModel) -> MeshModel:
    from .geometry import connected_components

    components = connected_components(mesh.faces)
    if len(components) <= 1:
        return mesh
    largest = max(len(component) for component in components)
    keep_faces: set[int] = set()
    for component in components:
        if len(component) > max(2, int(largest * 0.03)):
            keep_faces.update(component)
    if len(keep_faces) == len(mesh.faces):
        return mesh
    mesh.faces = [face for idx, face in enumerate(mesh.faces) if idx in keep_faces]
    return mesh


def fill_simple_planar_holes(mesh: MeshModel, max_loop_vertices: int = 12) -> MeshModel:
    loops = boundary_loops(mesh)
    for loop in loops:
        if len(loop) < 3 or len(loop) > max_loop_vertices:
            continue
        if not is_nearly_planar(mesh, loop):
            continue
        center = tuple(sum(mesh.vertices[idx][axis] for idx in loop) / len(loop) for axis in range(3))
        center_index = len(mesh.vertices)
        mesh.vertices.append(center)  # type: ignore[arg-type]
        if len(mesh.vertex_colors) == center_index:
            mesh.vertex_colors.append(tuple(sum(mesh.vertex_colors[idx][axis] for idx in loop) / len(loop) for axis in range(3)))  # type: ignore[arg-type]
        for idx, current in enumerate(loop):
            nxt = loop[(idx + 1) % len(loop)]
            mesh.faces.append((current, nxt, center_index))
    return mesh


def center_near_origin(mesh: MeshModel) -> MeshModel:
    if not mesh.vertices:
        return mesh
    centroid = tuple(sum(vertex[axis] for vertex in mesh.vertices) / len(mesh.vertices) for axis in range(3))
    mesh.vertices = [tuple(vertex[axis] - centroid[axis] for axis in range(3)) for vertex in mesh.vertices]  # type: ignore[list-item]
    return mesh


def boundary_loops(mesh: MeshModel) -> list[list[int]]:
    from collections import defaultdict

    from .geometry import edge_map

    boundaries = [edge for edge, faces in edge_map(mesh.faces).items() if len(faces) == 1]
    adjacency: dict[int, list[int]] = defaultdict(list)
    for a, b in boundaries:
        adjacency[a].append(b)
        adjacency[b].append(a)
    unused = {tuple(sorted(edge)) for edge in boundaries}
    loops: list[list[int]] = []
    while unused:
        start_edge = unused.pop()
        start, current = start_edge
        loop = [start, current]
        previous = start
        while current != start:
            candidates = [v for v in adjacency[current] if v != previous]
            if not candidates:
                break
            nxt = candidates[0]
            edge = tuple(sorted((current, nxt)))
            if edge in unused:
                unused.remove(edge)
            previous, current = current, nxt
            if current != start:
                loop.append(current)
            if len(loop) > 64:
                break
        if len(loop) >= 3 and current == start:
            loops.append(loop)
    return loops


def is_nearly_planar(mesh: MeshModel, loop: list[int], tolerance: float = 1e-5) -> bool:
    from .geometry import cross, dot, length, vector_sub

    points = [mesh.vertices[idx] for idx in loop]
    origin = points[0]
    normal = None
    for idx in range(1, len(points) - 1):
        candidate = cross(vector_sub(points[idx], origin), vector_sub(points[idx + 1], origin))
        if length(candidate) > 1e-12:
            normal = candidate
            break
    if normal is None:
        return False
    normal_length = length(normal)
    return all(abs(dot(vector_sub(point, origin), normal)) / normal_length <= tolerance for point in points)
