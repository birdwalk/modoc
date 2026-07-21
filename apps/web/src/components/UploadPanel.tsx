"use client";

import { Check, FileWarning, Trash2, Upload, Wand2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { checkApiHealth, loadDemo, uploadModel } from "../lib/api";
import { analysisSteps } from "../lib/analysis";
import { formatUploadLimit, validateModelFile } from "../lib/uploadLimits";
import { useInspectionStore } from "../store/useInspectionStore";

export function UploadPanel({ intendedUse, compact = false }: { intendedUse: string; compact?: boolean }) {
  const setRun = useInspectionStore((s) => s.setRun);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const [selectionId, setSelectionId] = useState(0);
  const [step, setStep] = useState(0);
  const demo = useMutation({
    mutationFn: async () => {
      setSelectionId((id) => id + 1);
      setSelectedFile(null);
      setValidationError(null);
      setStep(1);
      return loadDemo(intendedUse);
    },
    onSuccess: (run) => {
      setRun(run);
      setLastLoaded(run.metrics.filename);
      setStep(analysisSteps.length - 1);
    }
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      setStep(0);
      return uploadModel(file, intendedUse);
    },
    onSuccess: (run) => {
      setRun(run);
      setLastLoaded(run.metrics.filename);
      setSelectedFile(null);
      setStep(analysisSteps.length - 1);
      if (inputRef.current) inputRef.current.value = "";
    }
  });
  const health = useMutation({ mutationFn: checkApiHealth });
  const busy = demo.isPending || upload.isPending;
  const error = demo.error ?? upload.error;

  function validate(file: File) {
    return validateModelFile(file.name, file.size);
  }

  function chooseFile(file: File | null) {
    if (!file || busy) return;
    setSelectionId((id) => id + 1);
    setLastLoaded(null);
    const message = validate(file);
    setValidationError(message);
    setSelectedFile(message ? null : file);
  }

  function submitSelected() {
    if (!selectedFile || busy) return;
    const message = validate(selectedFile);
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError(null);
    upload.mutate(selectedFile);
  }

  return (
    <section className={`${compact ? "px-5 py-1.5" : "px-5 py-4"} border-b border-slate-200/80 bg-white/55 backdrop-blur-xl`}>
      <div
        className={`flex flex-col gap-3 border border-sky-100 bg-white/78 backdrop-blur-xl md:flex-row md:items-center md:justify-between ${compact ? "px-3 py-1.5 shadow-sm" : "p-4 shadow-[0_18px_80px_rgba(15,23,42,0.08)]"}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files.item(0);
          chooseFile(file);
        }}
      >
        <div>
          <h1 className={`${compact ? "text-sm" : "text-2xl"} font-semibold tracking-normal text-slate-950`}>{compact ? "Inspect another model" : "Find what is broken before production does."}</h1>
          {!compact ? (
            <>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                MODOC analyses 3D models, detects geometry problems, repairs safe defects and confirms whether the model is ready for gaming, visualisation, 3D printing or manufacturing workflows.
              </p>
              <p className="mt-2 text-xs text-slate-500">Uploaded models stay local to this API storage adapter and are not used for training. Current limit: {formatUploadLimit()}.</p>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`${compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm"} inline-flex items-center gap-2 border border-slate-200 bg-white font-medium text-slate-700 shadow-sm disabled:opacity-50`} onClick={() => health.mutate()} disabled={health.isPending}>
            API status
          </button>
          <label className={`${compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm"} inline-flex cursor-pointer items-center gap-2 border border-slate-900 bg-slate-950 font-medium text-white shadow-sm`}>
            <Upload size={16} />
            Upload a model
            <input
              ref={inputRef}
              type="file"
              accept=".stl,.obj,.glb,.gltf"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                chooseFile(file ?? null);
              }}
            />
          </label>
          <button className={`${compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm"} inline-flex items-center gap-2 border border-emerald-500 bg-emerald-500 font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50`} onClick={submitSelected} disabled={!selectedFile || busy}>
            Analyse
          </button>
          <button className={`${compact ? "h-8 px-2 text-xs" : "h-10 px-3 text-sm"} inline-flex items-center gap-2 border border-sky-500 bg-sky-50 font-medium text-sky-700 shadow-sm disabled:opacity-50`} onClick={() => demo.mutate()} disabled={busy}>
            <Wand2 size={16} />
            Load Demo Model
          </button>
        </div>
      </div>
      <div className={`${compact ? "mt-1" : "mt-3"} grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start`}>
        <div>
          {selectedFile ? (
            <div key={selectionId} className="flex items-center justify-between border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm">
              <div>
                <div className="font-medium text-slate-950">{selectedFile.name}</div>
                <div className="text-xs text-slate-500">{formatBytes(selectedFile.size)} / {extensionFor(selectedFile.name).toUpperCase()}</div>
              </div>
              <button className="grid h-8 w-8 place-items-center text-slate-500 hover:text-red-600" onClick={() => { setSelectionId((id) => id + 1); setSelectedFile(null); setValidationError(null); }} aria-label="Remove selected file">
                <Trash2 size={16} />
              </button>
            </div>
          ) : null}
          {!compact ? <p className="mt-2 text-xs text-slate-500">Supported now: STL, OBJ, GLB, glTF. Limited/planned: STEP, STP, IGES, FBX, SLDPRT. Current processing limit: {formatUploadLimit()}.</p> : null}
        </div>
        {busy || (!compact && step > 0) ? <ProgressStepper activeIndex={busy ? Math.min(step + 2, analysisSteps.length - 2) : step} failed={Boolean(error)} compact={compact} /> : null}
      </div>
      {busy ? <p className="mt-2 text-sm text-sky-700">Processing actual geometry stages...</p> : null}
      {health.data ? <p className="mt-2 text-sm text-emerald-700">API connected: {health.data.service}</p> : null}
      {lastLoaded && !busy ? <p className="mt-2 text-sm text-emerald-700">Loaded {lastLoaded}. The viewer is rendering the analyzed geometry below.</p> : null}
      {validationError ? <p className="mt-2 flex items-center gap-2 text-sm text-red-600"><FileWarning size={15} /> {validationError}</p> : null}
      {health.error ? <p className="mt-2 text-sm text-red-300">{health.error.message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-300">{error.message}</p> : null}
    </section>
  );
}

function ProgressStepper({ activeIndex, failed, compact = false }: { activeIndex: number; failed: boolean; compact?: boolean }) {
  if (compact) {
    return <div className="text-xs font-medium text-sky-700" aria-live="polite">{failed ? "Analysis failed" : analysisSteps[Math.min(activeIndex, analysisSteps.length - 1)]}</div>;
  }
  return (
    <ol className="grid min-w-[280px] gap-1 text-[11px]" aria-live="polite">
      {analysisSteps.map((item, index) => (
        <li key={item} className={`flex items-center gap-2 ${failed && index === activeIndex ? "text-red-600" : index <= activeIndex ? "text-sky-700" : "text-slate-400"}`}>
          <span className={`grid h-4 w-4 place-items-center rounded-full border ${index <= activeIndex ? "border-sky-500 bg-sky-50" : "border-slate-300 bg-white"}`}>
            {index < activeIndex ? <Check size={10} /> : null}
          </span>
          {failed && index === activeIndex ? "Failed" : item}
        </li>
      ))}
    </ol>
  );
}

function extensionFor(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
