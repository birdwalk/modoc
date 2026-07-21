# Geometry Analysis

The MVP uses deterministic mesh checks only. It parses supported files into vertices, triangular faces, normals and metadata. It then builds an undirected edge map and connected components.

Implemented checks:

- Parse validity.
- Empty geometry.
- NaN or infinite coordinates.
- Duplicate vertices.
- Duplicate faces.
- Degenerate triangles and zero-area faces.
- Boundary edges and open holes.
- Non-manifold edges.
- Disconnected shells.
- Tiny disconnected components.
- Missing or invalid normals.
- Missing UV coordinates for scene formats.
- Suspicious scale.
- Thin-wall candidate based on bounding-box proportion.
- Origin far from geometry.

Candidate checks are labelled for manual review. The MVP does not claim mathematically complete self-intersection, UV-overlap or thin-wall validation.
