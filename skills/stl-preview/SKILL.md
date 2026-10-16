---
name: stl-preview
description: Preview STL files interactively in BB using the installed STL Preview file opener.
---

# STL Preview

Use a Markdown link to an STL file, or `bb thread open path/to/model.stl` inside its thread. BB opens the interactive viewer in the side panel. Workspace, host and thread-storage sources follow normal BB file routing.

Controls: drag to orbit, right-drag to pan, scroll/pinch to zoom, Reset view, Wireframe, Reload and Open original preview. Reload after editing or regenerating a model; there is no automatic file watch.

Supports ASCII and binary STL up to 64 MiB and one million triangles. WebGL2 required. Dimensions are model units, not necessarily millimeters. For failed loads check the file and host connection, then Retry. There is no plugin CLI command; use core `bb thread open`.
