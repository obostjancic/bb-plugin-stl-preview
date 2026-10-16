import type { PluginFileOpenerSource } from "@get-bb/plugin-sdk";

export function fileUrl(
  path: string,
  source: PluginFileOpenerSource,
): string | null {
  if (!path || path.includes("\\") || path.includes("\0")) return null;
  const parts = path.replace(/^\/+/, "").split("/");
  if (parts.some((part) => part === ".." || part === ".")) return null;
  const encoded = parts.map(encodeURIComponent).join("/");
  const id = encodeURIComponent;
  if (source.kind === "workspace") {
    if (source.environmentId)
      return `/api/v1/environments/${id(source.environmentId)}/files/${encoded}`;
    if (!source.projectId) return null;
    const project = `/api/v1/projects/${id(source.projectId)}`;
    return source.experimental_hostId
      ? `${project}/hosts/${id(source.experimental_hostId)}/files/${encoded}`
      : `${project}/files/${encoded}`;
  }
  if (!source.threadId) return null;
  const route = source.kind === "host" ? "host-files" : "thread-storage/files";
  return `/api/v1/threads/${id(source.threadId)}/${route}/${encoded}`;
}
