#!/usr/bin/env bun
import type { ServerWebSocket } from "bun";
import { watch } from "fs";
import { basename, resolve } from "path";

const escapeHtml = (str: string): string =>
  str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const githubMarkdownCssUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css";
const layout = {
  maxWidth: 960,
  mobileBreakpoint: 768,
  mobilePadding: 16,
  padding: 48,
} as const;
const reconnectDelayMs = 1000;

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("-")) ?? "README.md";
const portArg = args.find((arg) => arg.startsWith("--port="))?.split("=")[1];
const port = portArg !== undefined ? parseInt(portArg, 10) : 1412;
if (Number.isNaN(port)) {
  console.error("Error: Invalid port number");
  process.exit(1);
}
const noOpen = args.includes("--no-open");

const clients = new Set<ServerWebSocket<undefined>>();

if (!(await Bun.file(file).exists())) {
  console.error(`Error: File not found: ${file}`);
  process.exit(1);
}

const resolvedPath = resolve(process.cwd(), file);

const watcher = watch(resolvedPath, () => {
  for (const ws of clients) {
    ws.send("reload");
  }
});
watcher.on("error", (error) => {
  console.error("Watch error:", error);
});

const styleHtml = `<style>
  body {
    box-sizing: border-box;
    max-width: ${layout.maxWidth}px;
    margin: 0 auto;
    padding: ${layout.padding}px;
    background-color: var(--color-canvas-default);
  }
  @media (max-width: ${layout.mobileBreakpoint}px) {
    body { padding: ${layout.mobilePadding}px; }
  }
</style>`;

const scriptHtml = `<script>
  const ws = new WebSocket(\`ws://\${location.host}\`);
  ws.onmessage = () => location.reload();
  ws.onclose = () => setTimeout(() => location.reload(), ${reconnectDelayMs});
</script>`;

async function renderHTML(): Promise<string> {
  const md = await Bun.file(resolvedPath).text();
  // @ts-expect-error headingIds is a valid option in Bun 1.3.8+
  const content = Bun.markdown.html(md, { headingIds: true });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(basename(file))}</title>
  <link rel="stylesheet" href="${githubMarkdownCssUrl}">
  ${styleHtml}
</head>
<body class="markdown-body">
  ${content}
  ${scriptHtml}
</body>
</html>`;
}

const server = Bun.serve({
  port,
  async fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    const html = await renderHTML();
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
  websocket: {
    open(ws) {
      clients.add(ws);
    },
    close(ws) {
      clients.delete(ws);
    },
    message() {},
  },
});

console.log(`Previewing ${file} at http://localhost:${port}`);

if (!noOpen) {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  Bun.spawn([cmd, `http://localhost:${port}`]);
}

process.on("SIGINT", () => {
  watcher.close();
  server.stop();
  process.exit(0);
});
