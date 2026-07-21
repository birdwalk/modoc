from __future__ import annotations

from pathlib import Path

from .exporters import write_ascii_stl
from .models import MeshModel


def ensure_demo_models(root: Path) -> dict[str, Path]:
    defective = root / "sample-data" / "defective-models"
    clean = root / "sample-data" / "clean-models"
    defective.mkdir(parents=True, exist_ok=True)
    clean.mkdir(parents=True, exist_ok=True)
    demos = {
        "clean-cube": clean / "clean-cube.stl",
        "missing-face-cube": defective / "cube-missing-face.stl",
        "multi-defect-demo": defective / "multi-defect-demo.stl",
        "duplicate-vertices": defective / "duplicate-vertices.stl",
        "disconnected-shells": defective / "disconnected-shells.stl",
        "tiny-floating-component": defective / "tiny-floating-component.stl",
        "thin-wall": defective / "thin-wall.stl",
        "non-manifold-edge": defective / "non-manifold-edge.stl",
        "flipped-normal": defective / "flipped-normal.stl",
        "self-intersection-candidate": defective / "self-intersection-candidate.stl",
        "high-poly-decimation-candidate": defective / "high-poly-decimation-candidate.stl",
    }
    if not all(path.exists() for path in demos.values()):
        write_ascii_stl(_cube(), demos["clean-cube"], "clean_cube")
        write_ascii_stl(_cube(missing_top=True), demos["missing-face-cube"], "cube_missing_face")
        write_ascii_stl(_multi_defect(), demos["multi-defect-demo"], "multi_defect_demo")
        write_ascii_stl(_cube(duplicate=True), demos["duplicate-vertices"], "duplicate_vertices")
        write_ascii_stl(_two_cubes(), demos["disconnected-shells"], "disconnected_shells")
        write_ascii_stl(_tiny_component(), demos["tiny-floating-component"], "tiny_component")
        write_ascii_stl(_thin_wall(), demos["thin-wall"], "thin_wall")
        write_ascii_stl(_non_manifold(), demos["non-manifold-edge"], "non_manifold_edge")
        write_ascii_stl(_cube(flipped=True), demos["flipped-normal"], "flipped_normal")
        write_ascii_stl(_intersecting_triangles(), demos["self-intersection-candidate"], "self_intersection_candidate")
        write_ascii_stl(_grid(28), demos["high-poly-decimation-candidate"], "high_poly")
    return demos


def _cube(offset=(0.0, 0.0, 0.0), size=1.0, missing_top=False, duplicate=False, flipped=False) -> MeshModel:
    x, y, z = offset
    s = size
    v = [(x, y, z), (x + s, y, z), (x + s, y + s, z), (x, y + s, z), (x, y, z + s), (x + s, y, z + s), (x + s, y + s, z + s), (x, y + s, z + s)]
    f = [(0, 2, 1), (0, 3, 2), (4, 5, 6), (4, 6, 7), (0, 1, 5), (0, 5, 4), (1, 2, 6), (1, 6, 5), (2, 3, 7), (2, 7, 6), (3, 0, 4), (3, 4, 7)]
    if missing_top:
        f = f[:2] + f[4:]
    if flipped:
        f[0] = tuple(reversed(f[0]))
    if duplicate:
        v.append(v[0])
        f.append((8, 2, 1))
    return MeshModel(source_format="STL", vertices=v, faces=f)


def _two_cubes() -> MeshModel:
    a = _cube()
    b = _cube((2.2, 0, 0), 0.75)
    return MeshModel(source_format="STL", vertices=a.vertices + b.vertices, faces=a.faces + [tuple(i + len(a.vertices) for i in face) for face in b.faces])


def _tiny_component() -> MeshModel:
    a = _cube()
    b = _cube((1.8, 1.8, 1.8), 0.05)
    return MeshModel(source_format="STL", vertices=a.vertices + b.vertices, faces=a.faces + [tuple(i + len(a.vertices) for i in face) for face in b.faces])


def _thin_wall() -> MeshModel:
    return _cube(size=1.0, missing_top=True).model_copy(update={"vertices": [(x, y, z * 0.025) for x, y, z in _cube(size=1.0, missing_top=True).vertices]})


def _non_manifold() -> MeshModel:
    mesh = _cube(missing_top=True)
    mesh.vertices.append((0.5, 0.5, 1.8))
    mesh.faces.extend([(4, 5, 8), (5, 4, 8)])
    return mesh


def _intersecting_triangles() -> MeshModel:
    return MeshModel(source_format="STL", vertices=[(0, 0, 0), (1, 1, 0), (0, 1, 1), (1, 0, 1), (0, 1, 0), (1, 0, 0)], faces=[(0, 1, 2), (3, 4, 5)])


def _grid(n: int) -> MeshModel:
    vertices = []
    for y in range(n + 1):
        for x in range(n + 1):
            vertices.append((x / n, y / n, 0.02 * ((x + y) % 2)))
    faces = []
    for y in range(n):
        for x in range(n):
            i = y * (n + 1) + x
            faces.append((i, i + 1, i + n + 1))
            faces.append((i + 1, i + n + 2, i + n + 1))
    return MeshModel(source_format="STL", vertices=vertices, faces=faces)


def _multi_defect() -> MeshModel:
    base = _cube(missing_top=True, duplicate=True)
    tiny = _cube((1.4, 1.4, 1.4), 0.06)
    offset = len(base.vertices)
    vertices = base.vertices + tiny.vertices + [(0.25, 0.25, 0.0)]
    faces = base.faces + [tuple(i + offset for i in face) for face in tiny.faces]
    faces.append((len(vertices) - 1, len(vertices) - 1, 2))
    faces.append(faces[0])
    return MeshModel(source_format="STL", vertices=vertices, faces=faces)
