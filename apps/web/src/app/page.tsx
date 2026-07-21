"use client";

import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Cpu, FileBox, FolderKanban, Gauge, History, Layers3, Settings, Sparkles, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { HealthBadge } from "../components/HealthBadge";
import { IssueDetails } from "../components/IssueDetails";
import { IssueList } from "../components/IssueList";
import { Toolbar } from "../components/Toolbar";
import { UploadPanel } from "../components/UploadPanel";
import type { ProcessingMode } from "../lib/analysis";
import { toAnalysisResult } from "../lib/analysis";
import { getViewer, loadDemo } from "../lib/api";
import { evaluateModelReadiness } from "../lib/readiness";
import { useInspectionStore } from "../store/useInspectionStore";

const Viewer3D = dynamic(() => import("../components/Viewer3D").then((mod) => mod.Viewer3D), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[360px] place-items-center bg-white/60 text-sm text-slate-500">Loading 3D viewer...</div>
});

const uses = [
  ["3d_printing", "3D printing"],
  ["rendering", "Rendering"],
  ["game_asset", "Game asset"],
  ["ar_vr", "AR/VR"],
  ["cnc", "CNC / handoff"],
  ["general", "General"]
];

const modes: { value: ProcessingMode; label: string }[] = [
  { value: "real_time", label: "Real-Time" },
  { value: "visualisation", label: "Visualisation" },
  { value: "manufacturing", label: "Manufacturing" }
];

type ActiveView = "projects" | "models" | "inspections" | "repairs" | "reports" | "settings";

export default function Home() {
  const [intendedUse, setIntendedUse] = useState("3d_printing");
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("manufacturing");
  const [activeView, setActiveView] = useState<ActiveView>("inspections");
  const run = useInspectionStore((s) => s.run);
  const originalRun = useInspectionStore((s) => s.originalRun);
  const repaired = useInspectionStore((s) => s.repaired);
  const viewer = useQuery({ queryKey: ["viewer", run?.id], queryFn: () => getViewer(run!.id), enabled: Boolean(run) });
  const analysis = useMemo(() => run ? toAnalysisResult(run, processingMode) : null, [run, processingMode]);
  return (
    <main className="h-screen overflow-hidden bg-[linear-gradient(135deg,#fbfdff_0%,#edf7ff_44%,#f8fbff_100%)] text-slate-950">
      <div className="grid h-screen grid-cols-[72px_1fr] overflow-hidden">
        <nav className="border-r border-white/80 bg-white/72 py-3 shadow-[12px_0_40px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="mb-4 grid place-items-center">
            <div className="grid h-11 w-11 place-items-center border border-sky-400 bg-sky-500 text-sm font-bold text-white shadow-lg">MO</div>
          </div>
          <SideIcon title="Projects" active={activeView === "projects"} onClick={() => setActiveView("projects")}><FolderKanban size={19} /></SideIcon>
          <SideIcon title="Models" active={activeView === "models"} onClick={() => setActiveView("models")}><FileBox size={19} /></SideIcon>
          <SideIcon title="Inspections" active={activeView === "inspections"} onClick={() => setActiveView("inspections")}><Gauge size={19} /></SideIcon>
          <SideIcon title="Repairs" active={activeView === "repairs"} onClick={() => setActiveView("repairs")}><Wrench size={19} /></SideIcon>
          <SideIcon title="Reports" active={activeView === "reports"} onClick={() => setActiveView("reports")}><History size={19} /></SideIcon>
          <SideIcon title="Settings" active={activeView === "settings"} onClick={() => setActiveView("settings")}><Settings size={19} /></SideIcon>
        </nav>
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex h-[72px] shrink-0 flex-wrap items-center gap-3 border-b border-white/80 bg-white/78 px-5 py-3 shadow-sm backdrop-blur-xl">
            <div>
              <div className="text-sm font-semibold text-slate-950">MODOC</div>
              <div className="text-xs text-slate-500">Find what is broken before production does.</div>
            </div>
            <select className="h-9 border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm" value={intendedUse} onChange={(event) => setIntendedUse(event.target.value)}>
              {uses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select className="h-9 border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm" value={processingMode} onChange={(event) => setProcessingMode(event.target.value as ProcessingMode)}>
              {modes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            {run ? (
              <>
                <HealthBadge score={run.health_scores.selected_use_score} previousScore={repaired ? originalRun?.health_scores.selected_use_score : undefined} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{run.metrics.filename}</div>
                  <div className="text-xs text-slate-500">{run.status} / {run.analysis_duration_ms} ms / {run.metrics.format}</div>
                </div>
              </>
            ) : null}
          </header>
          {!run ? (
            <LandingPage intendedUse={intendedUse} setIntendedUse={setIntendedUse} processingMode={processingMode} />
          ) : (
            <>
              {activeView === "inspections" ? (
                <>
                  <UploadPanel intendedUse={intendedUse} compact />
                  {analysis ? <ReadinessBanner run={run} analysis={analysis} processingMode={processingMode} repaired={repaired} /> : null}
                </>
              ) : null}
              <ViewHeader activeView={activeView} run={run} analysis={analysis} />
              {activeView !== "inspections" ? (
                <UtilityView activeView={activeView} run={run} analysis={analysis} processingMode={processingMode} setActiveView={setActiveView} />
              ) : run && viewer.isPending ? (
                <section className="grid min-h-0 flex-1 place-items-center overflow-hidden px-6 py-8 text-center">
                  <div className="max-w-xl border border-white/80 bg-white/70 px-6 py-5 shadow-xl backdrop-blur-xl">
                    <Activity className="mx-auto text-sky-300" size={32} />
                    <h2 className="mt-4 text-xl font-semibold">Building 3D viewer payload...</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">The file parsed successfully. MODOC is preparing indexed geometry and issue highlights.</p>
                  </div>
                </section>
              ) : run && viewer.error ? (
                <section className="grid min-h-0 flex-1 place-items-center overflow-hidden px-6 py-8 text-center">
                  <div className="max-w-xl border border-red-200 bg-white/80 px-6 py-5 shadow-xl backdrop-blur-xl">
                    <h2 className="text-xl font-semibold text-red-200">Viewer payload failed</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{viewer.error.message}</p>
                  </div>
                </section>
              ) : run && viewer.data ? (
                <section className={`grid min-h-0 flex-1 overflow-hidden ${run.issues.length ? "grid-cols-[230px_minmax(620px,1fr)_340px]" : "grid-cols-[minmax(720px,1fr)_320px]"}`}>
                  {run.issues.length ? <IssueList issues={run.issues} /> : null}
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                    <Toolbar />
                    <div className="min-h-0 flex-1 overflow-hidden">
                      <Viewer3D payload={viewer.data} />
                    </div>
                    <MetricsStrip run={run} />
                  </div>
                  <IssueDetails run={run} processingMode={processingMode} />
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function LandingPage({ intendedUse, setIntendedUse, processingMode }: { intendedUse: string; setIntendedUse: (value: string) => void; processingMode: ProcessingMode }) {
  return (
    <section className="min-h-0 flex-1 overflow-auto px-6 py-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="rounded-none border border-white/80 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">MODOC / Diagnose. Repair. Ready.</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-tight text-slate-950">Find what is broken before production does.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Upload a CAD or mesh file. MODOC inspects the geometry, identifies structural defects and helps prepare the model for games, visualisation or manufacturing.
          </p>
          <div className="mt-7">
            <h2 className="text-sm font-semibold text-slate-950">What are you preparing this model for?</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <UseCaseCard active={intendedUse === "game_asset"} title="Gaming and Real-Time" text="Optimise for games, web 3D, AR, VR, Unity and Unreal Engine." checks="Polygon density, duplicate geometry, normals, disconnected parts, file size." onClick={() => setIntendedUse("game_asset")} />
              <UseCaseCard active={intendedUse === "3d_printing"} title="3D Printing" text="Check whether the model is watertight, structurally closed and slicer-safe." checks="Open holes, boundary edges, non-manifold geometry, thin walls." onClick={() => setIntendedUse("3d_printing")} />
              <UseCaseCard active={intendedUse === "cnc"} title="Manufacturing" text="Validate geometry integrity for downstream engineering preparation." checks="Closed solids, topology, disconnected components, dimensions." onClick={() => setIntendedUse("cnc")} />
              <UseCaseCard active={intendedUse === "rendering"} title="Visualisation and Rendering" text="Prepare for product rendering, animation and design presentation." checks="Surface smoothness, normals, duplicate faces, Z-fighting." onClick={() => setIntendedUse("rendering")} />
            </div>
          </div>
          <div className="mt-7">
            <UploadPanel intendedUse={intendedUse} />
          </div>
          <SampleGallery setIntendedUse={setIntendedUse} />
        </div>
        <ProductPreview processingMode={processingMode} />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FeatureCard icon={<Gauge size={20} />} title="Geometry Inspection" text="Detect holes, open edges, non-manifold geometry, duplicate faces, flipped normals, intersections and disconnected components." />
        <FeatureCard icon={<Layers3 size={20} />} title="Visual Diagnosis" text="Highlight geometry defects and help users understand where problems occur with MVP markers and object-level evidence." />
        <FeatureCard icon={<Wrench size={20} />} title="Safe Repair" text="Separate deterministic automatic repairs from changes that require user approval or manual engineering review." />
        <FeatureCard icon={<Cpu size={20} />} title="Workflow Optimisation" text="Prepare models for real-time use, rendering, visualisation and manufacturing handoff without hiding limitations." />
      </div>
    </section>
  );
}

function UseCaseCard({ active, title, text, checks, onClick }: { active: boolean; title: string; text: string; checks: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`border p-4 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${active ? "border-sky-400 bg-sky-50" : "border-slate-200 bg-white/70 hover:border-sky-200"}`}>
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-1 text-sm leading-5 text-slate-600">{text}</p>
      <p className="mt-2 text-xs text-slate-500">{checks}</p>
    </button>
  );
}

function ProductPreview({ processingMode }: { processingMode: ProcessingMode }) {
  return (
    <div className="relative overflow-hidden border border-white/80 bg-white/65 p-5 shadow-2xl backdrop-blur-xl">
      <div className="absolute right-6 top-6 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">{modes.find((mode) => mode.value === processingMode)?.label}</div>
      <div className="h-72 border border-slate-100 bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#e8f4ff_55%,#d7e7f8_100%)] shadow-inner">
        <div className="grid h-full place-items-center">
          <div className="relative h-36 w-36 rotate-45 border border-slate-300 bg-white shadow-[0_24px_80px_rgba(14,165,233,0.28)]">
            <span className="absolute -right-12 top-4 border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600">open edge</span>
            <span className="absolute -bottom-10 left-4 border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">thin wall</span>
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <InfoPanel label="Geometry Health Score" value="72 / 100" />
        <InfoPanel label="Critical issues" value="2" />
        <InfoPanel label="Warnings" value="5" />
        <InfoPanel label="Polygon count" value="42,180" />
        <InfoPanel label="File size" value="18.4 MB" />
        <InfoPanel label="Recommended repairs" value="4 safe fixes" />
      </div>
    </div>
  );
}

const samples = [
  {
    id: "clean-cube",
    name: "Print-Ready Figurine",
    useCase: "3D Printing",
    intendedUse: "3d_printing",
    score: "100%",
    issues: "No blocking topology defects",
    body: "Explore a clean model that passes supported print-readiness checks."
  },
  {
    id: "multi-defect-demo",
    name: "Damaged Mechanical Part",
    useCase: "Manufacturing",
    intendedUse: "cnc",
    score: "Repair demo",
    issues: "Open boundaries, duplicates, fragments",
    body: "See how MODOC explains risks, previews repairs and reanalyses the result."
  }
];

function SampleGallery({ setIntendedUse }: { setIntendedUse: (value: string) => void }) {
  const setRun = useInspectionStore((s) => s.setRun);
  const sample = useMutation({
    mutationFn: ({ id, intendedUse }: { id: string; intendedUse: string }) => loadDemo(intendedUse, id),
    onSuccess: setRun
  });
  return (
    <section className="mt-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Explore Sample Models</h2>
          <p className="mt-1 text-sm text-slate-600">Understand MODOC before uploading your own file.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {samples.map((item) => (
          <button
            key={item.id}
            className="group border border-slate-200 bg-white/80 p-4 text-left shadow-sm transition hover:border-sky-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            onClick={() => {
              setIntendedUse(item.intendedUse);
              sample.mutate({ id: item.id, intendedUse: item.intendedUse });
            }}
            disabled={sample.isPending}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                <div className="mt-1 text-xs uppercase text-slate-500">{item.useCase}</div>
              </div>
              <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">{item.score}</div>
            </div>
            <div className="mt-4 h-20 border border-slate-100 bg-[radial-gradient(circle_at_50%_45%,#ffffff_0%,#eaf6ff_62%,#dceeff_100%)] shadow-inner">
              <div className="grid h-full place-items-center text-xs font-semibold text-slate-500">{item.issues}</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            <div className="mt-3 text-sm font-semibold text-sky-700">{sample.isPending ? "Loading analysis..." : "View Analysis"}</div>
          </button>
        ))}
      </div>
      {sample.error ? <p className="mt-2 text-sm text-red-600">{sample.error.message}</p> : null}
    </section>
  );
}

function FeatureCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="border border-white/80 bg-white/65 p-5 shadow-xl backdrop-blur-xl">
      <div className="mb-4 grid h-10 w-10 place-items-center border border-sky-100 bg-sky-50 text-sky-700">{icon}</div>
      <h3 className="font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function SideIcon({ title, active, onClick, children }: { title: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={`mx-auto mb-2 grid h-11 w-11 place-items-center border text-slate-500 hover:border-sky-200 hover:bg-white hover:text-sky-700 ${active ? "border-sky-300 bg-white text-sky-600 shadow-lg" : "border-transparent"}`}
      title={title}
      onClick={onClick}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ViewHeader({ activeView, run, analysis }: { activeView: ActiveView; run: ReturnType<typeof useInspectionStore.getState>["run"]; analysis: ReturnType<typeof toAnalysisResult> | null }) {
  const labels: Record<ActiveView, string> = {
    projects: "Projects",
    models: "Models",
    inspections: "Inspection workspace",
    repairs: "Repairs",
    reports: "Reports",
    settings: "Settings"
  };
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/45 px-5 py-2 text-xs text-slate-500 backdrop-blur-xl">
      <span>{labels[activeView]}</span>
      <span>{run && analysis ? `${run.metrics.filename} / ${analysis.healthSummary.grade} / ${run.issues.length} issue groups` : "No model loaded"}</span>
    </div>
  );
}

function ReadinessBanner({ run, analysis, processingMode, repaired }: { run: NonNullable<ReturnType<typeof useInspectionStore.getState>["run"]>; analysis: NonNullable<ReturnType<typeof toAnalysisResult>>; processingMode: ProcessingMode; repaired: ReturnType<typeof useInspectionStore.getState>["repaired"] }) {
  const readiness = evaluateModelReadiness(analysis, processingMode);
  const hasIssues = run.issues.length > 0;
  const headline = repaired
    ? readiness.status === "READY" ? readyHeadline(processingMode) : "Your model is safer, but not ready yet."
    : hasIssues ? problemHeadline(processingMode) : readyHeadline(processingMode);
  const body = repaired
    ? readiness.status === "READY"
      ? "MODOC repaired the safe geometry defects and rechecked the model. The model now passes the supported readiness checks for the selected workflow."
      : `MODOC improved the geometry score from ${repaired.before_health_score}% to ${repaired.after_health_score}%, but some issues still require review.`
    : hasIssues
      ? topConsequences(run).join(" ")
      : readyBody(processingMode);
  const confidenceMessage = workflowConfidenceMessage(processingMode, Boolean(repaired), readiness.status, hasIssues);
  return (
    <section className="flex shrink-0 items-center gap-4 border-b border-white/80 bg-white/62 px-5 py-2 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold text-slate-950">{headline}</div>
          <span className="rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">{readiness.message}</span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600">{readiness.warnings.length} warnings</span>
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">{readiness.passedChecks.length} checks passed</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-600" title={`${confidenceMessage} ${body}`}>{confidenceMessage} {body}</p>
      </div>
    </section>
  );
}

function readyHeadline(mode: ProcessingMode) {
  if (mode === "real_time") return "This model is ready for real-time use.";
  if (mode === "visualisation") return "This model is ready to render.";
  if (mode === "manufacturing") return "Geometry checks passed.";
  return "Great work - this model is ready for 3D printing.";
}

function problemHeadline(mode: ProcessingMode) {
  if (mode === "real_time") return "Optimise before real-time deployment.";
  if (mode === "visualisation") return "Repair visual artifacts before rendering.";
  if (mode === "manufacturing") return "Review geometry before manufacturing handoff.";
  return "Repair before you print.";
}

function readyBody(mode: ProcessingMode) {
  if (mode === "manufacturing") return "This model passed MODOC's supported topology and integrity checks and is ready for downstream manufacturing review.";
  if (mode === "real_time") return "The asset passed the selected geometry checks and has no detected blocking issues for the current real-time profile.";
  if (mode === "visualisation") return "Surface orientation and supported visual-quality checks passed, reducing the risk of broken shading and visible geometry artifacts.";
  return "MODOC found no blocking geometry defects in the supported checks. The mesh is closed, structurally consistent and ready to proceed to slicing.";
}

function workflowConfidenceMessage(mode: ProcessingMode, repaired: boolean, status: string, hasIssues: boolean) {
  if (mode === "real_time") {
    if (repaired || status === "READY") return "Wow, this will work so well with Unreal Engine.";
    return "A cleaner mesh here means smoother frames in Unreal, Unity and web 3D.";
  }
  if (mode === "manufacturing") {
    if (repaired || status === "READY") return "You're saving the production manager money.";
    return "Catching this now is cheaper than finding it on the shop floor.";
  }
  if (mode === "visualisation") {
    if (repaired || status === "READY") return "Your render artist will thank you for the clean surface.";
    return "Fixing this before rendering helps avoid flicker, dark patches and ugly surface artifacts.";
  }
  if (repaired || status === "READY") return "Your 3D printer will be glad you did this.";
  if (hasIssues) return "Your slicer is asking for a little help before production.";
  return "Your 3D printer will be glad you checked this.";
}

function topConsequences(run: NonNullable<ReturnType<typeof useInspectionStore.getState>["run"]>) {
  const messages = run.issues.slice(0, 3).map((issue) => issue.workflow_impact || issue.plain_language_explanation || issue.summary);
  return messages.length ? messages : ["MODOC found geometry risks that may affect the selected production workflow."];
}

function UtilityView({ activeView, run, analysis, processingMode, setActiveView }: { activeView: ActiveView; run: ReturnType<typeof useInspectionStore.getState>["run"]; analysis: ReturnType<typeof toAnalysisResult> | null; processingMode: ProcessingMode; setActiveView: (view: ActiveView) => void }) {
  if (activeView === "projects") {
    return (
      <UtilityShell title="Project Overview" subtitle="Competition workspace, sample entry points and current inspection state.">
        <PanelGrid>
          <InfoPanel label="Project" value="Local Inspection Project" />
          <InfoPanel label="Storage" value="Local filesystem adapter" />
          <InfoPanel label="Runs" value={run ? "1 active inspection in memory" : "No active inspection"} />
          <InfoPanel label="Current mode" value={modes.find((mode) => mode.value === processingMode)?.label ?? "Manufacturing"} />
        </PanelGrid>
        <section className="mt-6 border border-white/80 bg-white/70 p-5 shadow-xl backdrop-blur-xl">
          <h3 className="text-lg font-semibold text-slate-950">Judge flow</h3>
          <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
            <StepBox title="1. Load" text="Upload a model or open a bundled sample." />
            <StepBox title="2. Inspect" text="View score, risks and highlighted geometry evidence." />
            <StepBox title="3. Repair" text="Preview safe repairs before changing geometry." />
            <StepBox title="4. Export" text="Download repaired OBJ and reports." />
          </div>
        </section>
        <PrimaryAction onClick={() => setActiveView("inspections")} label="Open inspection workspace" />
      </UtilityShell>
    );
  }
  if (activeView === "models") {
    return (
      <UtilityShell title="Models" subtitle="Uploaded and demo models appear here after deterministic analysis.">
        <RecentModels setActiveView={setActiveView} />
        {run ? (
          <PanelGrid>
            <InfoPanel label="Filename" value={run.metrics.filename} />
            <InfoPanel label="Format" value={run.metrics.format} />
            <InfoPanel label="Vertices" value={run.metrics.vertex_count.toLocaleString()} />
            <InfoPanel label="Faces" value={run.metrics.face_count.toLocaleString()} />
            <InfoPanel label="Shells" value={run.metrics.shell_count.toString()} />
            <InfoPanel label="Watertight" value={run.metrics.watertight ? "Yes" : "No"} />
            <InfoPanel label="Bounding box" value={run.metrics.bounding_box.size.x.toFixed(2) + " x " + run.metrics.bounding_box.size.y.toFixed(2) + " x " + run.metrics.bounding_box.size.z.toFixed(2)} />
          </PanelGrid>
        ) : <EmptyPanel setActiveView={setActiveView} />}
      </UtilityShell>
    );
  }
  if (activeView === "repairs") {
    return (
      <UtilityShell title="Repair Plan" subtitle="See what MODOC can repair automatically and what still needs approval.">
        {run ? (
          <>
            <PanelGrid>
              <InfoPanel label="Safe repairs available" value={run.issues.filter((issue) => issue.automatic_repair_available).length.toString()} />
              <InfoPanel label="Manual review items" value={run.issues.filter((issue) => issue.requires_manual_review).length.toString()} />
              <InfoPanel label="Current score" value={`${run.health_scores.selected_use_score}/100`} />
              <InfoPanel label="Repairability" value={analysis?.healthSummary.repairabilityStatus.replaceAll("_", " ") ?? "Unknown"} />
            </PanelGrid>
            <section className="mt-6 grid gap-3 lg:grid-cols-2">
              <RepairSummary title="Automatic safe repairs" issues={run.issues.filter((issue) => issue.automatic_repair_available)} empty="No automatic repair candidates in this result." />
              <RepairSummary title="Approval or manual review" issues={run.issues.filter((issue) => issue.requires_manual_review && !issue.automatic_repair_available)} empty="No approval-required issues detected." />
            </section>
            <PrimaryAction onClick={() => setActiveView("inspections")} label="Go correct safe issues" />
          </>
        ) : <EmptyPanel setActiveView={setActiveView} />}
      </UtilityShell>
    );
  }
  if (activeView === "reports") {
    return (
      <UtilityShell title="Reports and Evidence" subtitle="Export shareable inspection evidence for judges, teammates or manufacturing review.">
        {run ? (
          <>
            <PanelGrid>
              <InfoPanel label="Report title" value="MODOC Geometry Health Report" />
              <InfoPanel label="Audit events" value={run.audit_trail.length.toString()} />
              <InfoPanel label="Checksum" value={run.metrics.geometry_hash.slice(0, 16)} />
            </PanelGrid>
            <section className="mt-6 border border-white/80 bg-white/70 p-5 shadow-xl backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-slate-950">Export package</h3>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
                <StepBox title="PDF" text="Readable inspection summary and readiness explanation." />
                <StepBox title="JSON" text="Typed machine-readable analysis result." />
                <StepBox title="CSV" text="Issue list for spreadsheet review." />
              </div>
            </section>
            <PrimaryAction onClick={() => setActiveView("inspections")} label="Open report controls" />
          </>
        ) : <EmptyPanel setActiveView={setActiveView} />}
      </UtilityShell>
    );
  }
  return (
    <UtilityShell title="Settings" subtitle="Current local limits, supported formats and active workflow controls.">
      <PanelGrid>
        <InfoPanel label="API preference" value="127.0.0.1:8010, with fallback" />
        <InfoPanel label="Supported upload formats" value="STL, OBJ, optional GLB" />
        <InfoPanel label="Upload limit" value="250 MB" />
        <InfoPanel label="Analysis limit" value="2,500,000 triangles" />
        <InfoPanel label="Viewer preview cap" value="120,000 triangles" />
        <InfoPanel label="AI mode" value="Deterministic fallback unless configured" />
        <InfoPanel label="Privacy" value="Local storage, no training use" />
        <InfoPanel label="Visible settings" value={modeSettings(processingMode).join(", ")} />
      </PanelGrid>
    </UtilityShell>
  );
}

function modeSettings(mode: ProcessingMode) {
  if (mode === "real_time") return ["Target polygon reduction", "Preserve sharp edges", "Generate lightweight output", "LOD recommendations"];
  if (mode === "visualisation") return ["Tessellation quality", "Smooth shading", "Detect Z-fighting", "Preserve materials"];
  return ["Watertightness", "Manifold check", "Thin-wall warning", "Tolerance setting"];
}

function RecentModels({ setActiveView }: { setActiveView: (view: ActiveView) => void }) {
  const recent = useInspectionStore((s) => s.recentInspections);
  const openRecent = useInspectionStore((s) => s.openRecentInspection);
  const removeRecent = useInspectionStore((s) => s.removeRecentInspection);
  const clearRecent = useInspectionStore((s) => s.clearRecentInspections);
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">Last 3 Analysed Files</h3>
          <p className="mt-1 text-sm text-slate-600">Saved locally as result metadata so judges can revisit repair status and avoided risks.</p>
        </div>
        {recent.length ? <button className="h-9 border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm" onClick={clearRecent}>Clear history</button> : null}
      </div>
      {recent.length ? (
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {recent.map((item) => (
            <RecentModelCard
              key={item.id}
              item={item}
              onOpen={() => {
                openRecent(item.id);
                setActiveView("inspections");
              }}
              onRemove={() => removeRecent(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 border border-white/80 bg-white/70 p-4 text-sm text-slate-600 shadow-xl backdrop-blur-xl">
          No recent uploaded files yet. Analyse up to three models and they will appear here.
        </div>
      )}
    </section>
  );
}

function RecentModelCard({ item, onOpen, onRemove }: { item: ReturnType<typeof useInspectionStore.getState>["recentInspections"][number]; onOpen: () => void; onRemove: () => void }) {
  const repaired = Boolean(item.repaired);
  const originalScore = item.originalRun.health_scores.selected_use_score;
  const currentScore = item.currentRun.health_scores.selected_use_score;
  const currentIssues = item.currentRun.issues;
  const messages = repaired ? preventedMessages(item) : topConsequences(item.originalRun).slice(0, 3);
  return (
    <article className="border border-white/80 bg-white/75 p-4 shadow-xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">{item.originalRun.metrics.filename}</div>
          <div className="mt-1 text-xs uppercase text-slate-500">{item.originalRun.metrics.format} / {new Date(item.savedAt).toLocaleString()}</div>
        </div>
        <span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-semibold ${repaired ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {repaired ? "Repaired" : "Repair not conducted"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <InfoPanel label="Original" value={`${originalScore}%`} />
        <InfoPanel label="Current" value={`${currentScore}%`} />
        <InfoPanel label="Issues" value={`${currentIssues.length}`} />
      </div>
      <div className="mt-4 border border-slate-200 bg-white/70 p-3 text-xs leading-5 text-slate-700">
        <div className="font-semibold text-slate-950">{repaired ? "What was avoided" : "What still needs attention"}</div>
        <ul className="mt-2 space-y-1">
          {messages.length ? messages.map((message) => <li key={message}>- {message}</li>) : <li>- No blocking issue remains in the supported checks.</li>}
        </ul>
      </div>
      <div className="mt-4 flex gap-2">
        <button className="h-9 flex-1 border border-sky-400 bg-sky-500 px-3 text-xs font-semibold text-white shadow-sm" onClick={onOpen}>View result</button>
        <button className="h-9 border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm" onClick={onRemove}>Remove</button>
      </div>
    </article>
  );
}

function preventedMessages(item: ReturnType<typeof useInspectionStore.getState>["recentInspections"][number]) {
  const repairedRules = new Set(item.repaired?.applied_repairs ?? []);
  const resolved = item.originalRun.issues.filter((issue) => repairedRules.has(issue.rule_id));
  return resolved.map((issue) => {
    if (issue.rule_id === "BOUNDARY_EDGES") return "Missing printed walls or invalid slicer volume from safe open holes.";
    if (issue.rule_id === "DUPLICATE_FACES") return "Rendering flicker and slicer confusion from overlapping duplicate faces.";
    if (issue.rule_id === "DUPLICATE_VERTICES") return "Hidden cracks and unnecessary geometry complexity from stacked vertices.";
    if (issue.rule_id === "DEGENERATE_TRIANGLES") return "Broken normals, export failures and collapsed surface artifacts.";
    if (issue.rule_id === "TINY_COMPONENTS") return "Loose floating fragments, debris prints or unnecessary render cost.";
    if (issue.rule_id === "MISSING_NORMALS") return "Incorrect shading or surface direction guesses during export.";
    return issue.workflow_impact || issue.summary;
  });
}

function StepBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="border border-slate-200 bg-white/70 p-3">
      <div className="font-semibold text-slate-950">{title}</div>
      <p className="mt-1 leading-6">{text}</p>
    </div>
  );
}

function RepairSummary({ title, issues, empty }: { title: string; issues: NonNullable<ReturnType<typeof useInspectionStore.getState>["run"]>["issues"]; empty: string }) {
  return (
    <div className="border border-white/80 bg-white/70 p-5 shadow-xl backdrop-blur-xl">
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {issues.length ? (
        <div className="mt-3 divide-y divide-slate-200 text-sm">
          {issues.slice(0, 6).map((issue) => (
            <div key={issue.id} className="py-3">
              <div className="font-semibold text-slate-950">{issue.rule_name}</div>
              <p className="mt-1 leading-6 text-slate-600">{issue.recommended_action || issue.summary}</p>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 text-sm text-slate-600">{empty}</p>}
    </div>
  );
}

function UtilityShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-h-0 flex-1 overflow-auto bg-white/30 px-6 py-6">
      <div className="mb-5">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function PanelGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function InfoPanel({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/80 bg-white/70 p-4 shadow-xl backdrop-blur-xl">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-2 break-words text-base font-medium text-slate-950">{value}</div>
    </div>
  );
}

function PrimaryAction({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="mt-5 h-10 border border-sky-400 bg-sky-500 px-4 text-sm font-medium text-white shadow-lg" onClick={onClick}>{label}</button>;
}

function EmptyPanel({ setActiveView }: { setActiveView: (view: ActiveView) => void }) {
  return (
    <div className="border border-white/80 bg-white/70 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-base font-medium text-slate-950">No model loaded yet.</div>
      <p className="mt-2 text-sm text-slate-600">Load the defective demo or upload an STL/OBJ model from the inspection workspace.</p>
      <PrimaryAction onClick={() => setActiveView("inspections")} label="Load a model" />
    </div>
  );
}

function MetricsStrip({ run }: { run: NonNullable<ReturnType<typeof useInspectionStore.getState>["run"]> }) {
  const m = run.metrics;
  return (
    <div className="grid grid-cols-5 border-t border-slate-200 bg-white/75 text-xs backdrop-blur-xl">
      <Metric label="Vertices" value={m.vertex_count.toLocaleString()} />
      <Metric label="Edges" value={m.edge_count.toLocaleString()} />
      <Metric label="Faces" value={m.face_count.toLocaleString()} />
      <Metric label="Shells" value={m.shell_count.toString()} />
      <Metric label="Watertight" value={m.watertight ? "Yes" : "No"} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r border-slate-200 px-3 py-2">
      <div className="text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-950">{value}</div>
    </div>
  );
}
