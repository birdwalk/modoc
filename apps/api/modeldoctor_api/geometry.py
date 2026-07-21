from __future__ import annotations

import hashlib
import math
from collections import defaultdict, deque

from .models import BoundingBox, MeshModel, ModelMetrics, Vec3


def vector_sub(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def cross(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float, float]:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def dot(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def length(v: tuple[float, float, float]) -> float:
    return math.sqrt(dot(v, v))


def face_area(vertices: list[tuple[float, float, float]], face: tuple[int, int, int]) -> float:
    a, b, c = (vertices[face[0]], vertices[face[1]], vertices[face[2]])
    return 0.5 * length(cross(vector_sub(b, a), vector_sub(c, a)))


def face_normal(vertices: list[tuple[float, float, float]], face: tuple[int, int, int]) -> tuple[float, float, float]:
    a, b, c = (vertices[face[0]], vertices[face[1]], vertices[face[2]])
    n = cross(vector_sub(b, a), vector_sub(c, a))
    n_len = length(n)
    if n_len == 0:
        return (0.0, 0.0, 0.0)
    return (n[0] / n_len, n[1] / n_len, n[2] / n_len)


def undirected_edges(face: tuple[int, int, int]) -> list[tuple[int, int]]:
    return [tuple(sorted((face[0], face[1]))), tuple(sorted((face[1], face[2]))), tuple(sorted((face[2], face[0])))]


def edge_map(faces: list[tuple[int, int, int]]) -> dict[tuple[int, int], list[int]]:
    edges: dict[tuple[int, int], list[int]] = defaultdict(list)
    for idx, face in enumerate(faces):
        for edge in undirected_edges(face):
            edges[edge].append(idx)
    return dict(edges)


def connected_components(faces: list[tuple[int, int, int]]) -> list[list[int]]:
    edges = edge_map(faces)
    adjacency: dict[int, set[int]] = defaultdict(set)
    for face_indices in edges.values():
        for a in face_indices:
            adjacency[a].update(i for i in face_indices if i != a)
    remaining = set(range(len(faces)))
    components: list[list[int]] = []
    while remaining:
        start = remaining.pop()
        queue: deque[int] = deque([start])
        component = [start]
        while queue:
            current = queue.popleft()
            for nxt in adjacency[current]:
                if nxt in remaining:
                    remaining.remove(nxt)
                    component.append(nxt)
                    queue.append(nxt)
        components.append(component)
    return components


def bounding_box_for_vertices(vertices: list[tuple[float, float, float]]) -> BoundingBox:
    if not vertices:
        zero = Vec3(x=0, y=0, z=0)
        return BoundingBox(min=zero, max=zero, size=zero)
    xs, ys, zs = zip(*vertices)
    mn = Vec3(x=min(xs), y=min(ys), z=min(zs))
    mx = Vec3(x=max(xs), y=max(ys), z=max(zs))
    return BoundingBox(min=mn, max=mx, size=Vec3(x=mx.x - mn.x, y=mx.y - mn.y, z=mx.z - mn.z))


def bounding_box_for_refs(vertices: list[tuple[float, float, float]], indices: set[int]) -> BoundingBox:
    return bounding_box_for_vertices([vertices[i] for i in indices if 0 <= i < len(vertices)])


def signed_volume(mesh: MeshModel) -> float | None:
    if any(len(edge_faces) != 2 for edge_faces in edge_map(mesh.faces).values()):
        return None
    volume = 0.0
    for face in mesh.faces:
        a, b, c = (mesh.vertices[face[0]], mesh.vertices[face[1]], mesh.vertices[face[2]])
        volume += dot(a, cross(b, c)) / 6.0
    return abs(volume)


def geometry_hash(mesh: MeshModel) -> str:
    hasher = hashlib.sha256()
    for vertex in mesh.vertices:
        hasher.update(f"{vertex[0]:.9f},{vertex[1]:.9f},{vertex[2]:.9f};".encode())
    for face in mesh.faces:
        hasher.update(f"{face[0]},{face[1]},{face[2]};".encode())
    return hasher.hexdigest()


def compute_metrics(mesh: MeshModel, filename: str, parser: str, parser_version: str) -> ModelMetrics:
    edges = edge_map(mesh.faces)
    bbox = bounding_box_for_vertices(mesh.vertices)
    volume = signed_volume(mesh)
    surface_area = sum(face_area(mesh.vertices, face) for face in mesh.faces)
    face_count = len(mesh.faces)
    complexity = "small"
    if face_count > 250_000:
        complexity = "very_large"
    elif face_count > 75_000:
        complexity = "large"
    elif face_count > 10_000:
        complexity = "moderate"
    return ModelMetrics(
        filename=filename,
        format=mesh.source_format,
        units=mesh.units,
        vertex_count=len(mesh.vertices),
        edge_count=len(edges),
        face_count=face_count,
        shell_count=len(connected_components(mesh.faces)) if mesh.faces else 0,
        bounding_box=bbox,
        watertight=bool(mesh.faces) and all(len(edge_faces) == 2 for edge_faces in edges.values()),
        volume=volume,
        surface_area=surface_area,
        geometry_hash=geometry_hash(mesh),
        estimated_file_complexity=complexity,
        parser=parser,
        parser_version=parser_version,
    )
