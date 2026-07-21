import { create } from "zustand";
import type { InspectionRun, Issue, RepairResult } from "../lib/types";

export type RecentInspection = {
  id: string;
  savedAt: string;
  originalRun: InspectionRun;
  currentRun: InspectionRun;
  repaired: RepairResult | null;
};

type State = {
  run: InspectionRun | null;
  originalRun: InspectionRun | null;
  selectedIssueId: string | null;
  repaired: RepairResult | null;
  recentInspections: RecentInspection[];
  viewMode: "solid" | "wireframe" | "transparent";
  cameraMode: "perspective" | "orthographic";
  beforeAfter: "before" | "after";
  showGrid: boolean;
  showBoundingBox: boolean;
  showVertexColors: boolean;
  autoRotate: boolean;
  resetToken: number;
  setRun: (run: InspectionRun) => void;
  openRecentInspection: (id: string) => void;
  removeRecentInspection: (id: string) => void;
  clearRecentInspections: () => void;
  selectIssue: (id: string | null) => void;
  setRepaired: (result: RepairResult) => void;
  setViewMode: (mode: State["viewMode"]) => void;
  setCameraMode: (mode: State["cameraMode"]) => void;
  setBeforeAfter: (mode: State["beforeAfter"]) => void;
  resetRepairs: () => void;
  toggleGrid: () => void;
  toggleBoundingBox: () => void;
  toggleVertexColors: () => void;
  toggleAutoRotate: () => void;
  setAutoRotate: (enabled: boolean) => void;
  resetCamera: () => void;
};

export const useInspectionStore = create<State>((set) => ({
  run: null,
  originalRun: null,
  selectedIssueId: null,
  repaired: null,
  recentInspections: loadRecentInspections(),
  viewMode: "solid",
  cameraMode: "perspective",
  beforeAfter: "before",
  showGrid: true,
  showBoundingBox: true,
  showVertexColors: true,
  autoRotate: true,
  resetToken: 0,
  setRun: (run) => set((state) => {
    const recentInspections = saveRecentInspection(state.recentInspections, {
      id: run.id,
      savedAt: new Date().toISOString(),
      originalRun: run,
      currentRun: run,
      repaired: null
    });
    return { run, originalRun: run, repaired: null, beforeAfter: "before", selectedIssueId: run.issues[0]?.id ?? null, recentInspections };
  }),
  openRecentInspection: (id) => set((state) => {
    const item = state.recentInspections.find((recent) => recent.id === id);
    if (!item) return {};
    const run = item.repaired?.after_run ?? item.currentRun;
    return { run, originalRun: item.originalRun, repaired: item.repaired, beforeAfter: item.repaired ? "after" : "before", selectedIssueId: run.issues[0]?.id ?? null, autoRotate: true };
  }),
  removeRecentInspection: (id) => set((state) => {
    const recentInspections = state.recentInspections.filter((recent) => recent.id !== id);
    persistRecentInspections(recentInspections);
    return { recentInspections };
  }),
  clearRecentInspections: () => set(() => {
    persistRecentInspections([]);
    return { recentInspections: [] };
  }),
  selectIssue: (id) => set({ selectedIssueId: id }),
  setRepaired: (result) => set((state) => {
    const originalRun = state.originalRun ?? result.after_run;
    const recentInspections = saveRecentInspection(state.recentInspections, {
      id: result.source_run_id,
      savedAt: new Date().toISOString(),
      originalRun,
      currentRun: result.after_run,
      repaired: result
    });
    return { repaired: result, beforeAfter: "after", run: result.after_run, selectedIssueId: result.after_run.issues[0]?.id ?? null, autoRotate: true, recentInspections };
  }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setBeforeAfter: (mode) => set((state) => {
    const nextRun = mode === "before" ? state.originalRun : state.repaired?.after_run ?? state.run;
    return { beforeAfter: mode, run: nextRun, selectedIssueId: nextRun?.issues[0]?.id ?? null };
  }),
  resetRepairs: () => set((state) => ({ run: state.originalRun, repaired: null, beforeAfter: "before", selectedIssueId: state.originalRun?.issues[0]?.id ?? null })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleBoundingBox: () => set((state) => ({ showBoundingBox: !state.showBoundingBox })),
  toggleVertexColors: () => set((state) => ({ showVertexColors: !state.showVertexColors })),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setAutoRotate: (enabled) => set({ autoRotate: enabled }),
  resetCamera: () => set((state) => ({ resetToken: state.resetToken + 1 }))
}));

const RECENT_KEY = "modoc.recent-inspections.v1";
const MAX_RECENT = 3;

function loadRecentInspections(): RecentInspection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentInspection[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecentInspection(existing: RecentInspection[], next: RecentInspection) {
  const recent = [next, ...existing.filter((item) => item.id !== next.id)].slice(0, MAX_RECENT);
  persistRecentInspections(recent);
  return recent;
}

function persistRecentInspections(recent: RecentInspection[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}
