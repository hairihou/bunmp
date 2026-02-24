#!/usr/bin/env bun
import type { ServerWebSocket } from 'bun';
import { watch } from 'fs';
import { basename, resolve } from 'path';

const file = process.argv.slice(2).find((arg) => !arg.startsWith('-')) ?? 'README.md';
if (!(await Bun.file(file).exists())) {
  console.error(`Error: File not found: ${file}`);
  process.exit(1);
}
const resolvedPath = resolve(process.cwd(), file);

const htmlEscapes: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};
const escapeHtml = (str: string): string => str.replace(/[&<>"]/g, (ch) => htmlEscapes[ch]);

const renderContent = async (): Promise<string> => {
  const md = await Bun.file(resolvedPath).text();
  return Bun.markdown.html(md, {
    headings: true,
    latexMath: true,
    wikiLinks: true,
  });
};

const clients = new Set<ServerWebSocket<undefined>>();
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
const watcher = watch(resolvedPath, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    try {
      const content = await renderContent();
      for (const ws of clients) {
        ws.send(content);
      }
    } catch (error) {
      console.error('Render error:', error);
    }
  }, 50);
});
watcher.on('error', (error) => {
  console.error('Watch error:', error);
});

const renderHTML = async (): Promise<string> => {
  const content = await renderContent();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(basename(file))}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css">
  <style>
    body { box-sizing: border-box; max-width: 960px; margin: 0 auto; padding: 48px; background-color: var(--color-canvas-default); }
    @media (max-width: 768px) { body { padding: 16px; } }
  </style>
</head>
<body class="markdown-body">
  <div id="content">${content}</div>
  <script>
    const ws = new WebSocket(\`ws://\${location.host}\`);
    ws.onmessage = (e) => { document.getElementById('content').innerHTML = e.data; };
    ws.onclose = () => setTimeout(() => location.reload(), 1000);
  </script>
</body>
</html>`;
};

const port = 1412;
const server = Bun.serve({
  port,
  async fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response(await renderHTML(), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
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

const openCmd =
  process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
Bun.spawn([openCmd, `http://localhost:${port}`]);

const shutdown = (): void => {
  watcher.close();
  server.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
