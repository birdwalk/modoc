from pathlib import Path

from fastapi.testclient import TestClient

from modeldoctor_api.demo_models import ensure_demo_models
from modeldoctor_api.exporters import viewer_arrays
from modeldoctor_api.models import MeshModel
from modeldoctor_api.main import app
from modeldoctor_api.parsers import parse_model


client = TestClient(app)


def test_valid_ascii_stl_demo_parses():
    demos = ensure_demo_models(Path(__file__).resolve().parents[3])
    mesh, parser, _ = parse_model(demos["clean-cube"])
    assert parser == "native-stl"
    assert len(mesh.faces) == 12


def test_demo_inspection_detects_required_issue_types():
    response = client.post("/api/v1/demo-models/multi-defect-demo/load?intended_use=3d_printing")
    assert response.status_code == 200
    run = response.json()
    rule_ids = {issue["rule_id"] for issue in run["issues"]}
    assert "BOUNDARY_EDGES" in rule_ids
    assert "DUPLICATE_FACES" in rule_ids
    assert "DEGENERATE_TRIANGLES" in rule_ids
    assert "DISCONNECTED_SHELLS" in rule_ids


def test_safe_repair_creates_new_version_and_artifact():
    run = client.post("/api/v1/demo-models/multi-defect-demo/load?intended_use=3d_printing").json()
    response = client.post(f"/api/v1/inspection-runs/{run['id']}/repairs/apply", json={"repair_ids": ["SAFE_ALL"], "tolerance": 0})
    assert response.status_code == 200
    result = response.json()
    assert result["version_id"] != run["version_id"]
    assert result["artifact_id"]
    assert result["before_health_score"] == run["health_scores"]["selected_use_score"]
    assert result["after_health_score"] == result["after_run"]["health_scores"]["selected_use_score"]
    assert "DUPLICATE_FACES" in result["applied_repairs"] or "DEGENERATE_TRIANGLES" in result["applied_repairs"]


def test_safe_repair_preview_reports_estimated_plan_before_apply():
    run = client.post("/api/v1/demo-models/multi-defect-demo/load?intended_use=3d_printing").json()
    response = client.post(f"/api/v1/inspection-runs/{run['id']}/repairs/preview", json={"repair_ids": ["SAFE_ALL"], "tolerance": 0})
    assert response.status_code == 200
    preview = response.json()
    assert preview["operations"]
    assert preview["geometry_will_change"] is True
    assert preview["score_before"] == run["health_scores"]["selected_use_score"]
    assert preview["score_after_estimate"] >= preview["score_before"]
    assert "DUPLICATE_FACES" in preview["applied_repairs"] or "DEGENERATE_TRIANGLES" in preview["applied_repairs"]


def test_report_generation_returns_pdf_json_csv_artifacts():
    run = client.post("/api/v1/demo-models/multi-defect-demo/load?intended_use=3d_printing").json()
    response = client.post(f"/api/v1/inspection-runs/{run['id']}/reports")
    assert response.status_code == 200
    artifacts = response.json()
    assert set(artifacts) == {"pdf", "json", "csv"}


def test_copilot_uses_deterministic_fallback_without_api_key():
    run = client.post("/api/v1/demo-models/multi-defect-demo/load?intended_use=3d_printing").json()
    response = client.post(f"/api/v1/inspection-runs/{run['id']}/copilot", json={"question": "Is this model ready for 3D printing?"})
    assert response.status_code == 200
    assert response.json()["source"] == "deterministic_fallback"


def test_local_frontend_port_3001_is_allowed_by_cors():
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://127.0.0.1:3001",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3001"


def test_obj_safe_repair_changes_geometry_reanalyses_and_exports_valid_obj():
    obj = """o broken
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
v 0 0 0
v 0.01 0.01 0
f 1 2 3
f 1 2 3
f 1 1 4
f 1 3 4
f 6 6 6
"""
    upload = client.post(
        "/api/v1/models/upload?intended_use=game_asset",
        files={"file": ("broken.obj", obj.encode("utf-8"), "text/plain")},
    )
    assert upload.status_code == 200
    run = upload.json()
    before_score = run["health_scores"]["selected_use_score"]
    before_faces = run["metrics"]["face_count"]
    rules = {issue["rule_id"] for issue in run["issues"]}
    assert {"DUPLICATE_VERTICES", "DUPLICATE_FACES", "DEGENERATE_TRIANGLES"}.issubset(rules)

    repair = client.post(f"/api/v1/inspection-runs/{run['id']}/repairs/apply", json={"repair_ids": ["SAFE_ALL"], "tolerance": 0})
    assert repair.status_code == 200
    result = repair.json()
    after = result["after_run"]
    assert result["artifact_id"]
    assert result["applied_repairs"]
    assert after["metrics"]["geometry_hash"] != run["metrics"]["geometry_hash"]
    assert after["health_scores"]["selected_use_score"] >= before_score
    remaining = {issue["rule_id"] for issue in after["issues"]}
    assert "DUPLICATE_FACES" not in remaining
    assert "DEGENERATE_TRIANGLES" not in remaining

    download = client.get(f"/api/v1/artifacts/{result['artifact_id']}/download")
    assert download.status_code == 200
    assert b"v " in download.content
    assert b"f " in download.content


def test_obj_vertex_colors_survive_viewer_payload_and_repaired_export():
    obj = """o colored
v 0 0 0 1 0 0
v 1 0 0 0 1 0
v 0 1 0 0 0 1
v 0 0 0 1 0 0
f 1 2 3
f 4 2 3
"""
    upload = client.post(
        "/api/v1/models/upload?intended_use=rendering",
        files={"file": ("colored.obj", obj.encode("utf-8"), "text/plain")},
    )
    assert upload.status_code == 200
    run = upload.json()

    viewer = client.get(f"/api/v1/inspection-runs/{run['id']}/viewer")
    assert viewer.status_code == 200
    payload = viewer.json()
    assert len(payload["vertex_colors"]) == len(payload["vertices"])
    assert payload["vertex_colors"][:3] == [1.0, 0.0, 0.0]

    repair = client.post(f"/api/v1/inspection-runs/{run['id']}/repairs/apply", json={"repair_ids": ["SAFE_ALL"], "tolerance": 0})
    assert repair.status_code == 200
    result = repair.json()
    download = client.get(f"/api/v1/artifacts/{result['artifact_id']}/download")
    assert download.status_code == 200
    assert b"v 0 0 0 1 0 0" in download.content


def test_viewer_payload_can_be_simplified_without_losing_color_alignment():
    mesh = MeshModel(
        source_format="OBJ",
        vertices=[(float(i), 0.0, 0.0) for i in range(12)],
        faces=[(0, 1, 2), (3, 4, 5), (6, 7, 8), (9, 10, 11)],
        vertex_colors=[(1.0, 0.0, 0.0) for _ in range(12)],
    )
    vertices, indices, colors = viewer_arrays(mesh, max_faces=2)
    assert len(indices) == 6
    assert len(colors) == len(vertices)
