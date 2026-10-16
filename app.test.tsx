// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { loadPluginApp } from "@get-bb/plugin-sdk/testing/app";
import { useStl, fetchStl } from "./use-stl";
import { MAX_BYTES } from "./geometry";
import { BufferGeometry } from "three";

const graphics = vi.hoisted(() => ({
  dispose: vi.fn(),
  reset: vi.fn(),
  setWireframe: vi.fn(),
}));
vi.mock("./viewer", () => ({ createViewer: vi.fn(() => graphics) }));
import { createViewer } from "./viewer";

function stlResponse() {
  const data = new ArrayBuffer(134);
  const view = new DataView(data);
  view.setUint32(80, 1, true);
  view.setFloat32(108, 10, true);
  view.setFloat32(124, 20, true);
  return new Response(data);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => stlResponse()),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("BB STL opener", () => {
  it("registers an STL opener", async () => {
    const app = await loadPluginApp(() => import("./app"));
    expect(app.fileOpeners[0].extensions).toEqual(["stl"]);
  });
  it("renders controls, switches wireframe and disposes on reload and close", async () => {
    const { StlPreview } = await import("./app");
    const geometryDispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const ui = render(
      <StlPreview
        path="a.stl"
        source={{
          kind: "workspace",
          environmentId: "e",
          projectId: "p",
          threadId: "t",
        }}
        Original={() => <div>Original file</div>}
      />,
    );
    expect(
      screen
        .getByRole("button", { name: "Wireframe" })
        .hasAttribute("disabled"),
    ).toBe(true);
    await screen.findByText(/model units/);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/environments/e/files/a.stl",
      expect.objectContaining({ credentials: "same-origin" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Wireframe" }));
    expect(graphics.setWireframe).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset view" }));
    expect(graphics.reset).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(graphics.dispose).toHaveBeenCalledOnce();
    await waitFor(() => expect(createViewer).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createViewer).mock.invocationCallOrder[1]).toBeGreaterThan(
      graphics.dispose.mock.invocationCallOrder[0],
    );
    ui.unmount();
    expect(graphics.dispose).toHaveBeenCalledTimes(2);
  });
  it("shows a recoverable load error, retries and can delegate to BB", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Host offline"));
    const { StlPreview } = await import("./app");
    render(
      <StlPreview
        path="a.stl"
        source={{
          kind: "host",
          environmentId: null,
          projectId: null,
          threadId: "t",
        }}
        Original={() => <div>Original file</div>}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Host offline",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/model units/);
    fireEvent.click(
      screen.getByRole("button", { name: "Open original preview" }),
    );
    expect(screen.getByText("Original file")).toBeTruthy();
    expect(graphics.dispose).toHaveBeenCalledOnce();
  });
  it("releases parsed geometry when WebGL construction fails", async () => {
    vi.mocked(createViewer).mockImplementationOnce(() => {
      throw new Error("WebGL unavailable");
    });
    const dispose = vi.spyOn(BufferGeometry.prototype, "dispose");
    const { StlPreview } = await import("./app");
    render(
      <StlPreview
        path="a.stl"
        source={{
          kind: "workspace",
          environmentId: "e",
          projectId: null,
          threadId: "t",
        }}
        Original={() => null}
      />,
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "WebGL unavailable",
    );
    expect(dispose).toHaveBeenCalledOnce();
  });
});

describe("load lifetime and transfer limits", () => {
  it("aborts on source change/unmount and ignores a late old response", async () => {
    let resolveOld: ((value: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const hook = renderHook(({ url }) => useStl(url, 0), {
      initialProps: { url: "/old" },
    });
    const oldSignal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    hook.rerender({ url: "/new" });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      resolveOld?.(stlResponse());
    });
    expect(hook.result.current.url).toBe("/new");
    hook.unmount();
    expect(vi.mocked(fetch).mock.calls[1][1]?.signal?.aborted).toBe(true);
  });
  it("accepts a transfer at exactly the byte limit", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array(MAX_BYTES)),
    );
    const data = await fetchStl("/at-limit", new AbortController().signal);
    expect(data.byteLength).toBe(MAX_BYTES);
  });
  it("rejects declared and streamed oversized files", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("", {
        headers: { "content-length": String(MAX_BYTES + 1) },
      }),
    );
    await expect(
      fetchStl("/large", new AbortController().signal),
    ).rejects.toThrow(/64 MiB/);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(MAX_BYTES));
            controller.enqueue(new Uint8Array(1));
            controller.close();
          },
        }),
      ),
    );
    await expect(
      fetchStl("/large", new AbortController().signal),
    ).rejects.toThrow(/64 MiB/);
  });
});
