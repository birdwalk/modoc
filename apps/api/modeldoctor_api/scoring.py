from .models import GeometryIssue, HealthScores, Severity


PENALTIES = {
    Severity.INFO: 0,
    Severity.LOW: 3,
    Severity.MODERATE: 8,
    Severity.HIGH: 18,
    Severity.BLOCKING: 35,
}

USE_WEIGHTS = {
    "3d_printing": {"BOUNDARY_EDGES": 1.5, "NON_MANIFOLD_EDGES": 1.5, "THIN_WALL_CANDIDATE": 1.3},
    "rendering": {"MISSING_UV": 1.6, "DUPLICATE_FACES": 1.2, "DEGENERATE_TRIANGLES": 1.2},
    "game_asset": {"MISSING_UV": 1.5, "DUPLICATE_VERTICES": 1.2, "DISCONNECTED_SHELLS": 1.1},
    "cnc": {"BOUNDARY_EDGES": 1.4, "NON_MANIFOLD_EDGES": 1.4, "SUSPICIOUS_SCALE": 1.2},
    "general": {},
}


def calculate_scores(issues: list[GeometryIssue], intended_use: str) -> HealthScores:
    general = _score(issues, {})
    print_score = _score(issues, USE_WEIGHTS["3d_printing"])
    render_score = _score(issues, USE_WEIGHTS["rendering"])
    cad_score = _score(issues, USE_WEIGHTS["cnc"])
    selected = _score(issues, USE_WEIGHTS.get(intended_use, {}))
    return HealthScores(
        general_geometry_health=general,
        print_readiness=print_score,
        rendering_game_readiness=render_score,
        cad_handoff_readiness=cad_score,
        selected_use_score=selected,
        methodology="Start at 100 and subtract capped severity penalties. Intended-use scores increase penalty weight for issues known to affect that workflow.",
    )


def _score(issues: list[GeometryIssue], weights: dict[str, float]) -> int:
    penalty = 0.0
    for issue in issues:
        base = PENALTIES[issue.severity]
        penalty += base * weights.get(issue.rule_id, 1.0)
    return max(0, min(100, round(100 - penalty)))
