import { useEffect, useRef, useState } from "react";
import {
  definePluginApp,
  type PluginFileOpenerProps,
} from "@get-bb/plugin-sdk/app";
import { fileUrl } from "./file-url";
import { parseGeometry } from "./geometry";
import { useStl } from "./use-stl";
import { createViewer, type StlViewer } from "./viewer";
import "./app.css";

type ModelInfo = { dimensions: number[]; triangles: number };

export default definePluginApp((app) => {
  app.slots.fileOpener({
    id: "stl",
    title: "STL preview",
    extensions: ["stl"],
    component: StlPreview,
  });
});

export function StlPreview({ path, source, Original }: PluginFileOpenerProps) {
  const [original, setOriginal] = useState(false);
  const [revision, setRevision] = useState(0);
  if (original) return <Original />;
  return (
    <Preview
      key={path + JSON.stringify(source) + revision}
      path={path}
      source={source}
      reload={() => setRevision((value) => value + 1)}
      fallback={() => setOriginal(true)}
    />
  );
}

function Preview({
  path,
  source,
  reload,
  fallback,
}: Pick<PluginFileOpenerProps, "path" | "source"> & {
  reload(): void;
  fallback(): void;
}) {
  const loaded = useStl(fileUrl(path, source), 0);
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<StlViewer | null>(null);
  const [info, setInfo] = useState<ModelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  useEffect(() => {
    if (loaded.status !== "ready" || !container.current) return;
    const host = container.current;
    let model: ReturnType<typeof parseGeometry> | undefined;
    let instance: StlViewer | undefined;
    try {
      model = parseGeometry(loaded.data);
      instance = createViewer(host, model.geometry, setError);
      viewer.current = instance;
      setInfo({ dimensions: model.dimensions, triangles: model.triangles });
    } catch (cause) {
      model?.geometry.dispose();
      console.error("stl-preview.render.failed", { path, cause });
      setError(
        cause instanceof Error
          ? cause.message
          : "3D preview is unavailable. Check WebGL support or open the original preview.",
      );
    }
    return () => {
      instance?.dispose();
      viewer.current = null;
    };
  }, [loaded, path]);
  const message = loaded.status === "error" ? loaded.message : error;
  const ready = info !== null && !message;
  return (
    <section className="stl-preview" aria-label="STL preview">
      <div className="stl-toolbar">
        <span className="stl-filename" title={path}>
          {path.split("/").pop()}
        </span>
        <button disabled={!ready} onClick={() => viewer.current?.reset()}>
          Reset view
        </button>
        <button
          disabled={!ready}
          aria-pressed={wireframe}
          onClick={() => {
            viewer.current?.setWireframe(!wireframe);
            setWireframe(!wireframe);
          }}
        >
          Wireframe
        </button>
        <button onClick={reload}>{message ? "Retry" : "Reload"}</button>
        <button onClick={fallback}>Open original preview</button>
      </div>
      <div className="stl-stage">
        <div className="stl-canvas" ref={container} />
        {message ? (
          <div className="stl-message" role="alert">
            {message}
          </div>
        ) : !ready ? (
          <div className="stl-message" role="status">
            Loading STL…
          </div>
        ) : null}
      </div>
      <footer className="stl-footer" aria-live="polite">
        {info ? (
          <span>
            X {format(info.dimensions[0])} × Y {format(info.dimensions[1])} × Z{" "}
            {format(info.dimensions[2])} model units ·{" "}
            {info.triangles.toLocaleString()} triangles
          </span>
        ) : null}
        <span>Drag to orbit · Right-drag to pan · Scroll or pinch to zoom</span>
      </footer>
    </section>
  );
}

function format(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
