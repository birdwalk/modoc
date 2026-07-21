export const maxModelUploadMb = Number(process.env.NEXT_PUBLIC_MAX_MODEL_UPLOAD_MB ?? 250);
export const maxModelUploadBytes = maxModelUploadMb * 1024 * 1024;
export const supportedModelFormats = [".stl", ".obj", ".glb", ".gltf"];
export const limitedModelFormats = [".step", ".stp", ".iges", ".igs", ".fbx", ".sldprt"];

export function formatUploadLimit() {
  return `${maxModelUploadMb} MB`;
}

export function validateModelFile(name: string, size: number) {
  const extension = extensionFor(name);
  if (!size) return "This file is empty. Choose a valid CAD or mesh file.";
  if (size > maxModelUploadBytes) return `This model exceeds the current ${formatUploadLimit()} processing limit.`;
  if (limitedModelFormats.includes(extension)) return `${extension.toUpperCase()} is listed as limited/planned support. Export to STL, OBJ, GLB or glTF for this MVP.`;
  if (!supportedModelFormats.includes(extension)) return "Unsupported format. Use STL, OBJ, GLB or glTF for the current MVP.";
  return null;
}

function extensionFor(name: string) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}
