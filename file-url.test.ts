import { describe, expect, it } from "vitest";
import { fileUrl } from "./file-url";
import type { PluginFileOpenerSource } from "@get-bb/plugin-sdk";

const source: PluginFileOpenerSource = {
  kind: "workspace",
  threadId: "t",
  projectId: "p",
  environmentId: "e",
};
describe("authenticated file routing", () => {
  it("prefers environment and encodes segments", () => {
    expect(fileUrl("folder/a b+#.STL", source)).toBe(
      "/api/v1/environments/e/files/folder/a%20b%2B%23.STL",
    );
  });
  it("uses project and selected host when no environment", () => {
    expect(fileUrl("a.stl", { ...source, environmentId: null })).toBe(
      "/api/v1/projects/p/files/a.stl",
    );
    expect(
      fileUrl("a.stl", {
        ...source,
        environmentId: null,
        experimental_hostId: "h",
      }),
    ).toBe("/api/v1/projects/p/hosts/h/files/a.stl");
  });
  it("supports absolute host and thread storage", () => {
    expect(fileUrl("/Users/ogi/a.stl", { ...source, kind: "host" })).toBe(
      "/api/v1/threads/t/host-files/Users/ogi/a.stl",
    );
    expect(fileUrl("a.stl", { ...source, kind: "thread-storage" })).toBe(
      "/api/v1/threads/t/thread-storage/files/a.stl",
    );
  });
  it("refuses missing context and traversal", () => {
    expect(
      fileUrl("a.stl", { ...source, environmentId: null, projectId: null }),
    ).toBeNull();
    expect(
      fileUrl("a.stl", { ...source, kind: "host", threadId: null }),
    ).toBeNull();
    expect(fileUrl("../secret.stl", source)).toBeNull();
    expect(fileUrl("a/../secret.stl", source)).toBeNull();
  });
});
