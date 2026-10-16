import { Vector3 } from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export const MAX_BYTES = 64 * 1024 * 1024;
export const MAX_TRIANGLES = 1_000_000;

export function parseGeometry(data: ArrayBuffer) {
  if (data.byteLength > MAX_BYTES)
    throw new Error("STL exceeds the 64 MiB preview limit.");
  if (data.byteLength < 15)
    throw new Error("This file contains no STL geometry.");
  const view = new DataView(data);
  const binaryCount = data.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const binary = data.byteLength === 84 + binaryCount * 50;
  if (!binary) {
    const text = new TextDecoder().decode(data);
    if (!/^\s*solid\b/i.test(text) || !/endsolid\b/i.test(text)) {
      throw new Error("Invalid or truncated STL file.");
    }
    const facets = text.match(/\bfacet\s+normal\b/gi)?.length ?? 0;
    const ends = text.match(/\bendfacet\b/gi)?.length ?? 0;
    const vertices = text.match(/\bvertex\s/g)?.length ?? 0;
    if (!facets || facets !== ends || vertices !== facets * 3)
      throw new Error("Invalid STL facets.");
    if (facets > MAX_TRIANGLES)
      throw new Error("STL exceeds the one million triangle preview limit.");
  } else if (binaryCount > MAX_TRIANGLES) {
    throw new Error("STL exceeds the one million triangle preview limit.");
  }
  const geometry = new STLLoader().parse(data);
  try {
    const positions = geometry.getAttribute("position");
    if (!positions || !positions.count || positions.count % 3 !== 0)
      throw new Error("STL contains no complete triangles.");
    if (positions.count / 3 > MAX_TRIANGLES)
      throw new Error("STL exceeds the one million triangle preview limit.");
    for (let i = 0; i < positions.array.length; i++) {
      if (!Number.isFinite(positions.array[i]))
        throw new Error("STL contains nonfinite coordinates.");
    }
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const dimensions = box.getSize(new Vector3()).toArray();
    if (!dimensions.every(Number.isFinite) || Math.max(...dimensions) <= 0)
      throw new Error("STL has no measurable extent.");
    geometry.center();
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return { geometry, dimensions, triangles: positions.count / 3 };
  } catch (error) {
    geometry.dispose();
    throw error;
  }
}
