"use client";

import { ContactShadows, Grid, Line, OrbitControls, PerspectiveCamera, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Issue, ViewerPayload } from "../lib/types";
import { useInspectionStore } from "../store/useInspectionStore";

export function Viewer3D({ payload }: { payload: ViewerPayload }) {
  const selectedId = useInspectionStore((s) => s.selectedIssueId);
  const viewMode = useInspectionStore((s) => s.viewMode);
  const cameraMode = useInspectionStore((s) => s.cameraMode);
  const showGrid = useInspectionStore((s) => s.showGrid);
  const autoRotate = useInspectionStore((s) => s.autoRotate);
  const setAutoRotate = useInspectionStore((s) => s.setAutoRotate);
  const resetToken = useInspectionStore((s) => s.resetToken);
  const issue = payload.issues.find((item) => item.id === selectedId) ?? payload.issues[0];
  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#eaf4ff_42%,#dce8f4_100%)]">
      <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
        {cameraMode === "perspective" ? <PerspectiveCamera makeDefault position={[3.4, 2.4, 3.6]} fov={38} /> : <OrthographicCamera makeDefault position={[3.4, 2.4, 3.6]} zoom={95} />}
        <color attach="background" args={["#eef6ff"]} />
        <ambientLight intensity={1.25} />
        <hemisphereLight args={["#ffffff", "#b8c4d6", 1.6]} />
        <directionalLight position={[4, 7, 5]} intensity={2.2} castShadow />
        <ModelMesh payload={payload} issue={issue} viewMode={viewMode} />
        <ContactShadows position={[0, -1.38, 0]} opacity={0.22} scale={6} blur={2.5} far={3} />
        {showGrid ? <Grid args={[7, 7]} cellColor="#d7e0eb" sectionColor="#9db2c8" fadeDistance={8} position={[0, -1.35, 0]} /> : null}
        <Axes />
        <OrbitControls key={resetToken} makeDefault enableDamping target={[0, 0, 0]} autoRotate={autoRotate} autoRotateSpeed={0.65} rotateSpeed={0.65} zoomSpeed={0.8} panSpeed={0.8} onStart={() => setAutoRotate(false)} />
      </Canvas>
      {issue ? (
        <div className="pointer-events-none absolute left-3 top-3 max-w-[320px] border border-white/70 bg-white/75 px-3 py-2 text-xs text-slate-700 shadow-2xl backdrop-blur-xl">
          <div className="font-semibold text-slate-950">{issue.rule_name}</div>
          <div className="mt-1 text-slate-600">{issue.summary}</div>
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-3 left-3 border border-white/70 bg-white/75 px-3 py-2 text-xs text-slate-700 shadow-xl backdrop-blur-xl">
        {payload.metrics.bounding_box.size.x.toFixed(2)} x {payload.metrics.bounding_box.size.y.toFixed(2)} x {payload.metrics.bounding_box.size.z.toFixed(2)} units
      </div>
    </div>
  );
}

function ModelMesh({ payload, issue, viewMode }: { payload: ViewerPayload; issue?: Issue; viewMode: "solid" | "wireframe" | "transparent" }) {
  const showBoundingBox = useInspectionStore((s) => s.showBoundingBox);
  const showVertexColors = useInspectionStore((s) => s.showVertexColors);
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(payload.vertices, 3));
    if (payload.vertex_colors.length === payload.vertices.length) {
      geom.setAttribute("color", new THREE.Float32BufferAttribute(payload.vertex_colors, 3));
    }
    geom.setIndex(payload.indices);
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    return geom;
  }, [payload]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const fit = useMemo(() => fitTransform(payload), [payload]);
  const highlightEdges = useMemo(() => edgeSegments(payload, issue), [payload, issue]);
  const highlightPoints = useMemo(() => vertexPoints(payload, issue), [payload, issue]);
  const color = issue?.severity === "BLOCKING" || issue?.severity === "HIGH" ? "#ef4444" : issue?.severity === "MODERATE" ? "#f59e0b" : "#38bdf8";
  const hasVertexColors = showVertexColors && payload.vertex_colors.length === payload.vertices.length;
  return (
    <group scale={fit.scale} position={fit.position}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={hasVertexColors ? "#ffffff" : "#f8fafc"} vertexColors={hasVertexColors} metalness={0.18} roughness={0.38} emissive="#ffffff" emissiveIntensity={0.08} transparent={viewMode === "transparent"} opacity={viewMode === "transparent" ? 0.42 : 1} wireframe={viewMode === "wireframe"} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry, 20]} />
        <lineBasicMaterial color="#64748b" transparent opacity={viewMode === "solid" ? 0.28 : 0.78} />
      </lineSegments>
      {highlightEdges.map((points, index) => (
        <Line key={index} points={points} color={color} lineWidth={3} />
      ))}
      {highlightPoints.map((position, index) => (
        <mesh key={index} position={position}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
      {issue ? <IssueCallout payload={payload} issue={issue} color={color} /> : null}
      {showBoundingBox && geometry.boundingBox ? <box3Helper args={[geometry.boundingBox, "#38bdf8"]} /> : null}
    </group>
  );
}

function IssueCallout({ payload, issue, color }: { payload: ViewerPayload; issue: Issue; color: string }) {
  const position = useMemo(() => issuePosition(payload, issue), [payload, issue]);
  if (!position) return null;
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.055, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function edgeSegments(payload: ViewerPayload, issue?: Issue): [number, number, number][][] {
  if (!issue) return [];
  const vertices = payload.vertices;
  const edges = issue.affected.edge_indices.slice(0, 200);
  const faceEdges = issue.affected.face_indices.slice(0, 120).flatMap((faceIndex) => {
    const a = payload.indices[faceIndex * 3];
    const b = payload.indices[faceIndex * 3 + 1];
    const c = payload.indices[faceIndex * 3 + 2];
    return [[a, b], [b, c], [c, a]] as [number, number][];
  });
  return [...edges, ...faceEdges].map(([a, b]) => [vec(vertices, a), vec(vertices, b)]);
}

function vertexPoints(payload: ViewerPayload, issue?: Issue): [number, number, number][] {
  if (!issue) return [];
  return issue.affected.vertex_indices.slice(0, 120).map((idx) => vec(payload.vertices, idx));
}

function issuePosition(payload: ViewerPayload, issue: Issue): [number, number, number] | null {
  const candidates: [number, number, number][] = [];
  for (const idx of issue.affected.vertex_indices.slice(0, 40)) candidates.push(vec(payload.vertices, idx));
  for (const [a, b] of issue.affected.edge_indices.slice(0, 20)) {
    const av = vec(payload.vertices, a);
    const bv = vec(payload.vertices, b);
    candidates.push([(av[0] + bv[0]) / 2, (av[1] + bv[1]) / 2, (av[2] + bv[2]) / 2]);
  }
  for (const faceIndex of issue.affected.face_indices.slice(0, 20)) {
    const a = vec(payload.vertices, payload.indices[faceIndex * 3]);
    const b = vec(payload.vertices, payload.indices[faceIndex * 3 + 1]);
    const c = vec(payload.vertices, payload.indices[faceIndex * 3 + 2]);
    candidates.push([(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3]);
  }
  if (!candidates.length) return null;
  return [
    candidates.reduce((sum, point) => sum + point[0], 0) / candidates.length,
    candidates.reduce((sum, point) => sum + point[1], 0) / candidates.length,
    candidates.reduce((sum, point) => sum + point[2], 0) / candidates.length
  ];
}

function vec(vertices: number[], idx: number): [number, number, number] {
  return [vertices[idx * 3] ?? 0, vertices[idx * 3 + 1] ?? 0, vertices[idx * 3 + 2] ?? 0];
}

function fitTransform(payload: ViewerPayload): { scale: number; position: [number, number, number] } {
  const box = payload.metrics.bounding_box;
  const center: [number, number, number] = [
    (box.min.x + box.max.x) / 2,
    (box.min.y + box.max.y) / 2,
    (box.min.z + box.max.z) / 2
  ];
  const maxDim = Math.max(box.size.x, box.size.y, box.size.z, 0.001);
  const scale = 2.35 / maxDim;
  return { scale, position: [-center[0] * scale, -center[1] * scale, -center[2] * scale] };
}

function Axes() {
  return (
    <group position={[-1.6, -1.18, -1.6]}>
      <Line points={[[0, 0, 0], [0.55, 0, 0]]} color="#ef4444" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0.55, 0]]} color="#22c55e" lineWidth={2} />
      <Line points={[[0, 0, 0], [0, 0, 0.55]]} color="#38bdf8" lineWidth={2} />
    </group>
  );
}
