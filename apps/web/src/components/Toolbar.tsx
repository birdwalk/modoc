"use client";

import { Box, Camera, Cuboid, Download, Grid3X3, Layers3, LocateFixed, Palette, RotateCw, SquareDashedBottom } from "lucide-react";
import { useInspectionStore } from "../store/useInspectionStore";

export function Toolbar() {
  const viewMode = useInspectionStore((s) => s.viewMode);
  const cameraMode = useInspectionStore((s) => s.cameraMode);
  const beforeAfter = useInspectionStore((s) => s.beforeAfter);
  const showGrid = useInspectionStore((s) => s.showGrid);
  const showBoundingBox = useInspectionStore((s) => s.showBoundingBox);
  const showVertexColors = useInspectionStore((s) => s.showVertexColors);
  const autoRotate = useInspectionStore((s) => s.autoRotate);
  const setViewMode = useInspectionStore((s) => s.setViewMode);
  const setCameraMode = useInspectionStore((s) => s.setCameraMode);
  const setBeforeAfter = useInspectionStore((s) => s.setBeforeAfter);
  const toggleGrid = useInspectionStore((s) => s.toggleGrid);
  const toggleBoundingBox = useInspectionStore((s) => s.toggleBoundingBox);
  const toggleVertexColors = useInspectionStore((s) => s.toggleVertexColors);
  const toggleAutoRotate = useInspectionStore((s) => s.toggleAutoRotate);
  const resetCamera = useInspectionStore((s) => s.resetCamera);
  return (
    <div className="flex h-14 shrink-0 flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/72 px-3 py-2 backdrop-blur-xl">
      <ToolGroup label="View">
        <Tool active={viewMode === "solid"} onClick={() => setViewMode("solid")} title="Solid view"><Cuboid size={16} /></Tool>
        <Tool active={viewMode === "wireframe"} onClick={() => setViewMode("wireframe")} title="Toggle wireframe"><SquareDashedBottom size={16} /></Tool>
        <Tool active={viewMode === "transparent"} onClick={() => setViewMode("transparent")} title="Transparent view"><Layers3 size={16} /></Tool>
      </ToolGroup>
      <ToolGroup label="Camera">
        <Tool active={cameraMode === "perspective"} onClick={() => setCameraMode("perspective")} title="Perspective camera"><Camera size={16} /></Tool>
        <Tool active={cameraMode === "orthographic"} onClick={() => setCameraMode("orthographic")} title="Orthographic camera"><Box size={16} /></Tool>
        <Tool active={false} onClick={resetCamera} title="Fit model to view"><LocateFixed size={16} /></Tool>
      </ToolGroup>
      <ToolGroup label="Display">
        <Tool active={showGrid} onClick={toggleGrid} title="Show grid"><Grid3X3 size={16} /></Tool>
        <Tool active={showBoundingBox} onClick={toggleBoundingBox} title="Show bounding box"><Box size={16} /></Tool>
        <Tool active={showVertexColors} onClick={toggleVertexColors} title="Show original model colors"><Palette size={16} /></Tool>
        <Tool active={autoRotate} onClick={toggleAutoRotate} title="Start showcase rotation"><RotateCw size={16} /></Tool>
      </ToolGroup>
      <div className="ml-auto flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <button className={`h-8 px-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${beforeAfter === "before" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setBeforeAfter("before")}>Before</button>
        <button className={`h-8 px-3 text-xs transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${beforeAfter === "after" ? "bg-sky-50 text-sky-700" : "text-slate-600 hover:bg-slate-50"}`} onClick={() => setBeforeAfter("after")}>After</button>
      </div>
      <button className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500" onClick={() => window.print()} title="Capture screenshot or print current workspace" aria-label="Capture screenshot or print current workspace">
        <Download size={14} />
        Screenshot
      </button>
    </div>
  );
}

function ToolGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white/80 p-1 shadow-sm" aria-label={label}>
      {children}
    </div>
  );
}

function Tool({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      className={`grid h-8 w-8 place-items-center rounded border text-slate-600 transition focus:outline-none focus:ring-2 focus:ring-sky-500 ${active ? "border-sky-300 bg-sky-50 text-sky-700" : "border-transparent bg-transparent hover:bg-slate-50 hover:text-sky-700"}`}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
