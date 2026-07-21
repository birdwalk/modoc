# Architecture

ADR-001: Use a monorepo with `apps/api`, `apps/web`, shared packages, workers, sample data and docs.

ADR-002: The FastAPI backend is the source of truth for parsing, metrics, inspection, repair and artifact generation. The browser receives viewer payloads and selected issue geometry only.

ADR-003: Storage uses a local filesystem adapter for the MVP, with immutable inspection runs in process memory. Production should replace this with PostgreSQL metadata and object storage.

ADR-004: Mesh analysis and future B-rep analysis are separate domains behind shared concepts: model version, inspection run, issue, repair operation and generated artifact.

Technical assumptions: STL and OBJ are enough for the first vertical slice; GLB is optional through `trimesh`; STEP waits until mesh workflow is stable; AI explanations must degrade to deterministic templates.

First vertical slice: load defective STL demo, parse, compute metrics, detect core defects, display highlights, explain, apply safe repair, re-run, compare, export STL/PDF/JSON/CSV.

High-risk operations: hole filling, self-intersection repair, watertight remeshing, shell deletion, decimation and STEP topology healing.

MVP exclusions: STEP, proprietary CAD, manufacturing validation, injection molding checks, machining simulation, FEA, authentication and multi-tenant storage.
