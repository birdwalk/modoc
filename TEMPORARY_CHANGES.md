# TEMPORARY_CHANGES

## Local filesystem storage
- Description: Uploaded files, generated reports, repaired models and demo-generated assets are stored under `MODELDOCTOR_STORAGE_DIR`.
- Reason: Hackathon MVP has no provisioned object store.
- Files affected: `apps/api/modeldoctor_api/storage.py`, `apps/api/modeldoctor_api/main.py`.
- Risk: Single-machine storage is not horizontally scalable.
- Production replacement: Object storage with signed URLs and tenant-scoped metadata in PostgreSQL.
- Reversion status: Temporary.

## Synchronous analysis
- Description: Inspection and repair run synchronously inside API requests.
- Reason: First vertical slice prioritizes a working deterministic workflow.
- Files affected: `apps/api/modeldoctor_api/main.py`.
- Risk: Large models can tie up API workers.
- Production replacement: Queue-backed worker service with cancellation and retry.
- Reversion status: Temporary.

## Simplified mesh parsers
- Description: Native STL and OBJ parsers cover the MVP; GLB uses `trimesh` only when installed.
- Reason: Avoid delaying the slice on heavy geometry stack integration.
- Files affected: `apps/api/modeldoctor_api/parsers.py`.
- Risk: OBJ material libraries, animation, complex glTF scene semantics and STEP B-rep are not fully represented.
- Production replacement: Hardened parser adapters with trimesh, meshio and Open Cascade.
- Reversion status: Temporary.

## Heavy geometry dependencies omitted from runnable local requirements
- Description: NumPy, trimesh, meshio and Open3D are not installed by default in `apps/api/requirements.txt` for this Python 3.14 environment.
- Reason: NumPy attempted a source build because compatible wheels were unavailable, blocking the runnable vertical slice.
- Files affected: `apps/api/requirements.txt`, `apps/api/modeldoctor_api/parsers.py`.
- Risk: GLB support is only available if `trimesh` is installed separately in a compatible runtime.
- Production replacement: Pin a Python version with supported wheels, install the full geometry stack, and run parser conformance tests.
- Reversion status: Temporary.

## In-memory metadata index
- Description: Projects, models, inspection runs and artifacts are indexed in memory and mirrored by files.
- Reason: Greenfield hackathon setup without database credentials.
- Files affected: `apps/api/modeldoctor_api/storage.py`.
- Risk: Metadata resets on API restart except file artifacts.
- Production replacement: PostgreSQL with immutable inspection records.
- Reversion status: Temporary.

## Deterministic AI fallback
- Description: Copilot explanations use deterministic templates unless `OPENAI_API_KEY` integration is completed.
- Reason: The app must remain usable without credentials.
- Files affected: `apps/api/modeldoctor_api/copilot.py`.
- Risk: Less nuanced explanations.
- Production replacement: OpenAI Responses API with strict schema validation.
- Reversion status: Temporary.

## PDF screenshots omitted
- Description: PDF reports include issue summaries and audit data but not viewer screenshots.
- Reason: Browser screenshot capture is frontend-owned in this slice.
- Files affected: `apps/api/modeldoctor_api/reports.py`.
- Risk: Reports are less visual than the final product vision.
- Production replacement: Store selected viewer screenshots as generated artifacts and embed them.
- Reversion status: Temporary.

## Authentication bypass
- Description: API has CORS and path-safety controls but no login or organization authorization.
- Reason: Single-user hackathon demo.
- Files affected: `apps/api/modeldoctor_api/main.py`.
- Risk: Not suitable for multi-tenant production.
- Production replacement: Authenticated organizations, role checks and per-tenant storage policies.
- Reversion status: Temporary.

## Synchronous UI progress stepper
- File path: `apps/web/src/components/UploadPanel.tsx`
- Description: The frontend shows the full MODOC processing pipeline while the current backend completes analysis synchronously in one request.
- Why it was introduced: Competition users need clear workflow feedback before queue-backed stage telemetry exists.
- Production replacement required: Backend job records with real per-stage status polling or server-sent events.
- Risk if left unchanged: Users may interpret synchronous request progress as granular worker telemetry.

## Marketing product-preview metrics
- File path: `apps/web/src/app/page.tsx`
- Description: The landing-page product preview uses static sample metrics before a real file is loaded.
- Why it was introduced: The homepage needs an immediate visual product preview for competition judging.
- Production replacement required: Use the latest real demo inspection result or a bundled deterministic fixture result.
- Risk if left unchanged: Preview numbers could be mistaken for live analysis if not treated as illustrative.

## Local GeometryAnalysisEngine only
- File path: `apps/api/modeldoctor_api/engines.py`
- Description: `GeometryAnalysisEngine` currently has a local parser-backed implementation only.
- Why it was introduced: Establishes the adapter boundary without adding heavy processing dependencies.
- Production replacement required: Worker-backed implementations for Trimesh, Open3D, Blender Python, Open Cascade or cloud workers.
- Risk if left unchanged: Large CAD/mesh analysis remains synchronous and limited to the local MVP parser set.

## Simplified hole triangulation
- File path: `apps/api/modeldoctor_api/repairs.py`
- Temporary behaviour: MODOC closes only small nearly planar boundary loops with a center-fan triangulation.
- Reason: Provides a real deterministic safe repair for simple holes without introducing heavy remeshing dependencies.
- Production replacement: Robust constrained triangulation with loop orientation, self-intersection checks, silhouette-change estimation and user approval for ambiguous holes.
- Risk if left unchanged: Some intentional small openings may be closed, while complex holes remain unrepaired.

## Approximate readiness evaluator
- File path: `apps/web/src/lib/readiness.ts`
- Temporary behaviour: Readiness status is derived from deterministic issue categories and selected workflow, not slicer simulation, CAD validation or manufacturing tolerance analysis.
- Reason: Competition MVP needs honest readiness messaging backed by available checks.
- Production replacement: Backend readiness service using persisted analysis, tolerance settings, target workflow profiles and parser-specific evidence.
- Risk if left unchanged: Readiness remains a conservative workflow recommendation rather than certified production validation.

## OBJ-only repaired export
- File path: `apps/api/modeldoctor_api/repair_engine.py`
- Temporary behaviour: Repaired meshes are exported as validated OBJ files regardless of original mesh format.
- Reason: The current repair objective is OBJ reliability, and OBJ is easy to reparse for validation.
- Production replacement: Format-preserving exporters for OBJ, STL, GLB and CAD/B-Rep where technically supported.
- Risk if left unchanged: Users uploading STL or GLB receive OBJ repaired output instead of their original format.

## Estimated repair preview
- File path: `apps/api/modeldoctor_api/main.py`
- Temporary behaviour: The repair preview endpoint applies safe repairs to an in-memory copy and returns estimated score and remaining-issue counts before the real repaired artifact is created.
- Reason: Users need a confirmation step before one-click repair, while persistent queued preview jobs are not implemented yet.
- Production replacement: Persist repair plans with versioned geometry snapshots, stage telemetry, cancellation and audited user approval records.
- Risk if left unchanged: Preview estimates are accurate for current deterministic repairs but are not durable records and may diverge from future asynchronous repair engines.

## Approval-required repair catalogue
- File path: `apps/api/modeldoctor_api/repair_engine.py`
- Temporary behaviour: MODOC lists likely repair strategies for disconnected shells, non-manifold topology, suspicious scale, missing UVs and thin-wall candidates, but only executes deterministic safe operations automatically.
- Reason: The MVP should explain how most engineering issues would be handled without pretending design-altering repairs are safe one-click operations.
- Production replacement: Add user-approved repair endpoints with geometry snapshots, tolerance controls, preview diffing and undoable version history.
- Risk if left unchanged: Users see the recommended strategy but cannot yet execute every approval-required repair directly inside the app.

## Bundled sample gallery
- File path: `apps/web/src/app/page.tsx`
- Temporary behaviour: The "Explore Sample Models" cards load programmatically generated backend demo models and present them with marketing names.
- Reason: Users need to understand MODOC without uploading private CAD or mesh files.
- Production replacement: Curated sample assets with thumbnails, persisted analysis records and documented benchmark expectations.
- Risk if left unchanged: Sample names are polished for demonstration, but the source geometry remains simple generated fixtures.

## Simplified dense-model viewer payload
- File path: `apps/api/modeldoctor_api/exporters.py`
- Temporary behaviour: Models above the viewer preview triangle cap are sampled for browser display, while metrics and inspections still run on the parsed mesh.
- Reason: Large STL/OBJ files can now pass the higher analysis limit without sending millions of triangles to the browser canvas.
- Production replacement: Generate proper LOD meshes with spatial decimation, material preservation and progressive loading.
- Risk if left unchanged: Very dense models may show a representative preview rather than every triangle in the viewer.

## Local recent-model history not yet persisted
- File path: `apps/web/src/app/page.tsx`
- Temporary behaviour: The current build persists the last three analysed sessions as browser `localStorage` metadata, including issue summaries and repair result metadata, but not raw model binaries.
- Reason: Judges need to revisit recent result cards and see what was repaired or what was avoided without adding a production database.
- Production replacement: IndexedDB or backend account history storing metadata only, with explicit reselect prompts when binary geometry is unavailable.
- Risk if left unchanged: Recent cards remain local to the browser and full 3D viewer reopening depends on the backend run still existing in the current API session.
