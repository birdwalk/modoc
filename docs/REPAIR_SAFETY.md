# Repair Safety

Repair risks:

- SAFE: exact duplicate removal and invalid derived normal regeneration.
- LOW_RISK: tiny disconnected component removal or origin movement, requiring review.
- REVIEW_REQUIRED: complex hole fill, shell deletion and transform application.
- DESTRUCTIVE: remesh, voxel reconstruction, heavy decimation or Boolean reconstruction.

Implemented repairs:

- Remove exact duplicate vertices.
- Remove duplicate faces.
- Remove degenerate triangles.
- Regenerate normals on STL export.

Every applied repair creates a new model version and artifact. The original upload is never overwritten.
