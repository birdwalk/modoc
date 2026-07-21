from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import CopilotResponse, InspectionRun, RepairResult


DISCLAIMER = "This report is an automated geometry inspection. It does not replace professional engineering review, manufacturing validation, slicing simulation, structural analysis or machine-specific verification."


def write_pdf_report(path: Path, run: InspectionRun, copilot: CopilotResponse | None = None, repair: RepairResult | None = None) -> None:
    styles = getSampleStyleSheet()
    doc = SimpleDocTemplate(str(path), pagesize=LETTER, title="MODOC Geometry Health Report")
    story = [
        Paragraph("MODOC Geometry Health Report", styles["Title"]),
        Paragraph("Diagnose. Repair. Ready.", styles["Heading2"]),
        Spacer(1, 18),
        Paragraph(DISCLAIMER, styles["BodyText"]),
        Spacer(1, 18),
        Paragraph("Model Identity", styles["Heading2"]),
    ]
    m = run.metrics
    story.append(_table([
        ["Model ID", run.model_id],
        ["Inspection Run", run.id],
        ["Format / Parser", f"{m.format} / {m.parser}"],
        ["Geometry Hash", m.geometry_hash],
        ["Intended Use", run.intended_use],
        ["Health Score", str(run.health_scores.selected_use_score)],
        ["Dimensions", f"{m.bounding_box.size.x:.3f} x {m.bounding_box.size.y:.3f} x {m.bounding_box.size.z:.3f}"],
        ["Vertices / Edges / Faces", f"{m.vertex_count} / {m.edge_count} / {m.face_count}"],
        ["Shell Count", str(m.shell_count)],
        ["Watertight", "yes" if m.watertight else "no"],
        ["Volume", "unknown" if m.volume is None else f"{m.volume:.6g}"],
        ["Surface Area", f"{m.surface_area:.6g}"],
    ]))
    story += [Spacer(1, 12), Paragraph("Issue Summary", styles["Heading2"])]
    severity_rows = [["Severity", "Count"]]
    for severity in ["BLOCKING", "HIGH", "MODERATE", "LOW", "INFO"]:
        severity_rows.append([severity, str(sum(1 for i in run.issues if i.severity.value == severity))])
    story.append(_table(severity_rows))
    story += [Spacer(1, 12), Paragraph("Detailed Issues", styles["Heading2"])]
    rows = [["ID", "Severity", "Rule", "Summary"]]
    for issue in run.issues:
        rows.append([issue.id, issue.severity.value, issue.rule_name, issue.summary])
    story.append(_table(rows, widths=[52, 70, 120, 260]))
    if repair:
        story += [Spacer(1, 12), Paragraph("Repair Actions", styles["Heading2"]), Paragraph(", ".join(repair.applied_repairs) or "No repairs applied.", styles["BodyText"])]
    if copilot:
        story += [Spacer(1, 12), Paragraph("AI Explanation Section", styles["Heading2"]), Paragraph(copilot.summary, styles["BodyText"])]
    story += [Spacer(1, 12), Paragraph("Audit Trail", styles["Heading2"])]
    for event in run.audit_trail:
        story.append(Paragraph(event, styles["BodyText"]))
    story += [Spacer(1, 12), Paragraph("Limitations", styles["Heading2"]), Paragraph("STEP, proprietary CAD validation, slicer simulation, FEA and manufacturing certification are outside this MVP.", styles["BodyText"])]
    doc.build(story)


def _table(rows: list[list[str]], widths: list[int] | None = None) -> Table:
    table = Table(rows, colWidths=widths)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172033")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#9ca3af")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
    ]))
    return table
