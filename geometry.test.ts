import { describe, expect, it, vi } from "vitest";
import { BufferGeometry, Vector3 } from "three";
import { parseGeometry, MAX_BYTES, MAX_TRIANGLES } from "./geometry";

function binaryStl() {
  const data = new ArrayBuffer(134);
  const view = new DataView(data);
  view.setUint32(80, 1, true);
  const vertices = [0, 0, 0, 10, 0, 0, 0, 20, 5];
  vertices.forEach((n, i) => view.setFloat32(96 + i * 4, n, true));
  return data;
}
const ascii = `solid test
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 10 0 0
vertex 0 20 5
endloop
endfacet
endsolid test`;
describe("STL geometry", () => {
  it("parses binary geometry and preserves model dimensions", () => {
    const { geometry, dimensions, triangles } = parseGeometry(binaryStl());
    expect(dimensions).toEqual([10, 20, 5]);
    expect(triangles).toBe(1);
    expect(geometry.boundingBox?.getCenter(new Vector3()).toArray()).toEqual([
      0, 0, 0,
    ]);
    geometry.dispose();
  });
  it("parses ASCII", () => {
    const model = parseGeometry(new TextEncoder().encode(ascii).buffer);
    expect(model.dimensions).toEqual([10, 20, 5]);
    model.geometry.dispose();
  });
  it("rejects empty and malformed inputs", () => {
    for (const text of [
      "",
      "not an STL",
      "solid empty\nendsolid empty",
      ascii.replace("endfacet", ""),
    ]) {
      expect(() =>
        parseGeometry(new TextEncoder().encode(text).buffer),
      ).toThrow();
    }
    expect(() => parseGeometry(binaryStl().slice(0, 130))).toThrow();
  });
  it("rejects nonfinite vertices and disposes partial geometry", () => {
    const data = binaryStl();
    new DataView(data).setFloat32(96, Infinity, true);
    const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    expect(() => parseGeometry(data)).toThrow(/finite/i);
    expect(dispose).toHaveBeenCalled();
    dispose.mockRestore();
  });
  it("bounds byte and declared triangle counts", () => {
    expect(() => parseGeometry(new ArrayBuffer(MAX_BYTES + 1))).toThrow(
      /64 MiB/,
    );
    const data = new ArrayBuffer(84 + (MAX_TRIANGLES + 1) * 50);
    new DataView(data).setUint32(80, MAX_TRIANGLES + 1, true);
    expect(() => parseGeometry(data)).toThrow(/one million/);
  });
  it("accepts exactly one million triangles", () => {
    const data = new ArrayBuffer(84 + MAX_TRIANGLES * 50);
    new Uint8Array(data).set(new Uint8Array(binaryStl()));
    new DataView(data).setUint32(80, MAX_TRIANGLES, true);
    const model = parseGeometry(data);
    expect(model.triangles).toBe(MAX_TRIANGLES);
    expect(model.dimensions).toEqual([10, 20, 5]);
    model.geometry.dispose();
  });
});
