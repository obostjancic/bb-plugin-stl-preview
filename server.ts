import type { BbPluginApi } from "@get-bb/plugin-sdk";

// BB requires a default-exported backend factory, even for frontend-only viewers.
export default function plugin(_bb: BbPluginApi) {}
