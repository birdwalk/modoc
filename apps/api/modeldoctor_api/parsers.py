from __future__ import annotations

import struct
from pathlib import Path

from .models import MeshModel

PARSER_VERSION = "modeldoctor-native-0.1"


class ParseError(ValueError):
    pass


def parse_model(path: Path) -> tuple[MeshModel, str, str]:
    suffix = path.suffix.lower()
    data = path.read_bytes()
    if suffix == ".stl":
        return parse_stl(data), "native-stl", PARSER_VERSION
    if suffix == ".obj":
        return parse_obj(path.read_text(errors="replace")), "native-obj", PARSER_VERSION
    if suffix in {".glb", ".gltf"}:
        return parse_glb_with_trimesh(path), "trimesh", "optional"
    raise ParseError(f"Unsupported format '{suffix}'. Export to STL, OBJ or GLB for this MVP.")


def parse_stl(data: bytes) -> MeshModel:
    if len(data) < 15:
        raise ParseError("STL file is too small to contain geometry.")
    if _looks_binary_stl(data):
        return _parse_binary_stl(data)
    return _parse_ascii_stl(data.decode("utf-8", errors="replace"))


def _looks_binary_stl(data: bytes) -> bool:
    if len(data) < 84:
        return False
    tri_count = struct.unpack("<I", data[80:84])[0]
    return 84 + tri_count * 50 == len(data)


def _parse_binary_stl(data: bytes) -> MeshModel:
    tri_count = struct.unpack("<I", data[80:84])[0]
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    normals: list[tuple[float, float, float]] = []
    offset = 84
    for _ in range(tri_count):
        chunk = data[offset : offset + 50]
        if len(chunk) != 50:
            raise ParseError("Binary STL ended before all triangles were read.")
        values = struct.unpack("<12fH", chunk)
        normals.append((values[0], values[1], values[2]))
        base = len(vertices)
        vertices.extend([(values[3], values[4], values[5]), (values[6], values[7], values[8]), (values[9], values[10], values[11])])
        faces.append((base, base + 1, base + 2))
        offset += 50
    welded_vertices, welded_faces = _weld_exact_vertices(vertices, faces)
    return MeshModel(source_format="STL", vertices=welded_vertices, faces=welded_faces, normals=normals, source_metadata={"stl_encoding": "binary", "stl_vertices_welded": True})


def _parse_ascii_stl(text: str) -> MeshModel:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    normals: list[tuple[float, float, float]] = []
    current: list[int] = []
    for raw_line in text.splitlines():
        parts = raw_line.strip().split()
        if not parts:
            continue
        if parts[0] == "facet" and len(parts) >= 5 and parts[1] == "normal":
            normals.append((float(parts[2]), float(parts[3]), float(parts[4])))
        if parts[0] == "vertex" and len(parts) >= 4:
            vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
            current.append(len(vertices) - 1)
            if len(current) == 3:
                faces.append((current[0], current[1], current[2]))
                current = []
    if not faces:
        raise ParseError("ASCII STL did not contain any triangular facets.")
    welded_vertices, welded_faces = _weld_exact_vertices(vertices, faces)
    return MeshModel(source_format="STL", vertices=welded_vertices, faces=welded_faces, normals=normals, source_metadata={"stl_encoding": "ascii", "stl_vertices_welded": True})


def _weld_exact_vertices(vertices: list[tuple[float, float, float]], faces: list[tuple[int, int, int]]) -> tuple[list[tuple[float, float, float]], list[tuple[int, int, int]]]:
    mapping: dict[tuple[float, float, float], int] = {}
    welded: list[tuple[float, float, float]] = []
    remap: dict[int, int] = {}
    for idx, vertex in enumerate(vertices):
        key = (round(vertex[0], 9), round(vertex[1], 9), round(vertex[2], 9))
        if key not in mapping:
            mapping[key] = len(welded)
            welded.append(vertex)
        remap[idx] = mapping[key]
    return welded, [tuple(remap[i] for i in face) for face in faces]


def parse_obj(text: str) -> MeshModel:
    vertices: list[tuple[float, float, float]] = []
    vertex_colors: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int]] = []
    has_uv = False
    has_normals = False
    materials: set[str] = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if parts[0] == "v" and len(parts) >= 4:
            vertices.append((float(parts[1]), float(parts[2]), float(parts[3])))
            if len(parts) >= 7:
                vertex_colors.append(_normalise_color((float(parts[4]), float(parts[5]), float(parts[6]))))
            elif vertex_colors:
                vertex_colors.append((0.92, 0.96, 1.0))
        elif parts[0] == "vt":
            has_uv = True
        elif parts[0] == "vn":
            has_normals = True
        elif parts[0] == "usemtl" and len(parts) > 1:
            materials.add(parts[1])
        elif parts[0] == "f" and len(parts) >= 4:
            indices = [_parse_obj_index(token, len(vertices)) for token in parts[1:]]
            for i in range(1, len(indices) - 1):
                faces.append((indices[0], indices[i], indices[i + 1]))
    if not vertices or not faces:
        raise ParseError("OBJ file did not contain triangulatable polygon geometry.")
    return MeshModel(
        source_format="OBJ",
        vertices=vertices,
        faces=faces,
        vertex_colors=vertex_colors if len(vertex_colors) == len(vertices) else [],
        source_metadata={"has_uv": has_uv, "has_normals": has_normals, "materials": sorted(materials), "has_vertex_colors": len(vertex_colors) == len(vertices)},
    )


def _parse_obj_index(token: str, vertex_count: int) -> int:
    raw = token.split("/")[0]
    idx = int(raw)
    return idx - 1 if idx > 0 else vertex_count + idx


def parse_glb_with_trimesh(path: Path) -> MeshModel:
    try:
        import trimesh
    except Exception as exc:  # pragma: no cover
        raise ParseError("GLB support requires the optional trimesh dependency.") from exc
    try:
        loaded = trimesh.load(path, force="mesh")
    except Exception as exc:
        raise ParseError("GLB file could not be parsed safely.") from exc
    if loaded.vertices is None or loaded.faces is None or len(loaded.faces) == 0:
        raise ParseError("GLB did not contain triangular mesh geometry.")
    colors = []
    visual = getattr(loaded, "visual", None)
    vertex_colors = getattr(visual, "vertex_colors", None)
    if vertex_colors is not None and len(vertex_colors) == len(loaded.vertices):
        colors = [_normalise_color(tuple(map(float, color[:3]))) for color in vertex_colors.tolist()]
    return MeshModel(
        source_format="GLB",
        vertices=[tuple(map(float, v)) for v in loaded.vertices.tolist()],
        faces=[tuple(map(int, f)) for f in loaded.faces.tolist()],
        vertex_colors=colors,
        source_metadata={"loader": "trimesh", "has_vertex_colors": bool(colors)},
    )


def _normalise_color(color: tuple[float, float, float]) -> tuple[float, float, float]:
    if max(color) > 1.0:
        return tuple(max(0.0, min(1.0, value / 255.0)) for value in color)  # type: ignore[return-value]
    return tuple(max(0.0, min(1.0, value)) for value in color)  # type: ignore[return-value]
