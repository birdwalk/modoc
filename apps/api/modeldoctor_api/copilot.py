from .models import CopilotRequest, CopilotResponse, InspectionRun, Severity
from .reports import DISCLAIMER


def explain(run: InspectionRun, request: CopilotRequest | None = None) -> CopilotResponse:
    blocking = [i for i in run.issues if i.severity == Severity.BLOCKING]
    high = [i for i in run.issues if i.severity == Severity.HIGH]
    priority = blocking + high + [i for i in run.issues if i.severity == Severity.MODERATE]
    status = "likely_ready"
    if blocking:
        status = "not_ready"
    elif high or any(i.requires_manual_review for i in run.issues):
        status = "review_required"
    top = priority[:5]
    summary = f"Deterministic analysis found {len(run.issues)} issue groups. The selected-use score is {run.health_scores.selected_use_score}/100."
    if request and request.question:
        summary += f" For your question, '{request.question}', the answer is based only on these detected issues."
    return CopilotResponse(
        summary=summary,
        priority_issues=[
            {
                "issue_id": issue.id,
                "why_it_matters": issue.technical_explanation,
                "recommended_action": "Apply the available safe repair." if issue.automatic_repair_available else "Review manually in a modeling or CAD tool.",
            }
            for issue in top
        ],
        readiness_assessment={
            "status": status,
            "reasoning": [issue.summary for issue in top] or ["No blocking deterministic issue was detected by the MVP rule set."],
        },
        limitations=[
            "This MVP does not run slicer simulation, finite-element analysis or manufacturing process validation.",
            "Approximate candidate checks are labelled for manual review.",
        ],
        recommended_next_steps=[
            "Fix blocking topology issues first.",
            "Re-run inspection after each repair.",
            "Use a slicer or CAD validation tool for production-specific checks.",
        ],
        disclaimer=DISCLAIMER,
        source="deterministic_fallback",
    )
