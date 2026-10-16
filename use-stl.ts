import { useEffect, useState } from "react";
import { MAX_BYTES } from "./geometry";

type LoadState =
  | { status: "loading"; url: string | null; revision: number }
  | { status: "ready"; url: string; revision: number; data: ArrayBuffer }
  | { status: "error"; url: string | null; revision: number; message: string };

export function useStl(url: string | null, revision: number): LoadState {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    url,
    revision,
  });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading", url, revision });
    if (!url) {
      setState({
        status: "error",
        url,
        revision,
        message:
          "BB cannot resolve this file source. Open the original preview instead.",
      });
      return () => controller.abort();
    }
    fetchStl(url, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted)
          setState({ status: "ready", url, revision, data });
      },
      (error) => {
        if (controller.signal.aborted) return;
        console.error("stl-preview.load.failed", { url, error });
        setState({
          status: "error",
          url,
          revision,
          message:
            error instanceof Error ? error.message : "STL could not be loaded.",
        });
      },
    );
    return () => controller.abort();
  }, [url, revision]);
  if (state.url !== url || state.revision !== revision)
    return { status: "loading", url, revision };
  return state;
}

export async function fetchStl(
  url: string,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: "same-origin", signal });
  if (!response.ok)
    throw new Error(
      `BB could not load this STL (HTTP ${response.status}). Check the file and host connection, then retry.`,
    );
  const length = Number(response.headers.get("content-length"));
  if (length > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("STL exceeds the 64 MiB preview limit.");
  }
  if (!response.body) throw new Error("BB returned an empty file response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES)
        throw new Error("STL exceeds the 64 MiB preview limit.");
      chunks.push(value);
    }
    signal.throwIfAborted();
    const data = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return data.buffer;
  } finally {
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}
