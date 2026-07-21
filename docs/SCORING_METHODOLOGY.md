# Scoring Methodology

Each score starts at 100. Deterministic issue severities subtract capped penalties:

- INFO: 0
- LOW: 3
- MODERATE: 8
- HIGH: 18
- BLOCKING: 35

Use-case scores apply additional weights. Boundary and non-manifold edges matter more for 3D printing and CAD handoff. Missing UVs matter more for rendering and game assets. Duplicate vertices and dense cleanup issues matter more for game assets.

Scores are decision aids, not proof that a model is manufacturable, printable or production-ready.
