#!/usr/bin/env bun
import type { ServerWebSocket } from 'bun';
import { watch } from 'fs';
import { basename, resolve } from 'path';

const args = process.argv.slice(2);
const mode = args.includes('--_server')
  ? 'server'
  : args.includes('--_webview')
    ? 'webview'
    : 'launcher';
const isCompiled = !Bun.main.endsWith('.ts');
const selfCmd = isCompiled ? process.execPath : Bun.main;
const port = 1412;

if (mode === 'webview') {
  const { Webview } = await import('webview-bun');
  const url = args.find((arg) => !arg.startsWith('-'));
  const titleArg = args.find((arg) => arg.startsWith('--title='))?.split('=')[1];
  if (url === undefined) {
    process.exit(1);
  }
  const webview = new Webview();
  webview.title = titleArg ?? 'bunmp';
  webview.navigate(url);
  webview.run();
  process.exit(0);
}

const file = args.find((arg) => !arg.startsWith('-')) ?? 'README.md';
if (!(await Bun.file(file).exists())) {
  console.error(`Error: File not found: ${file}`);
  process.exit(1);
}
const resolvedPath = resolve(process.cwd(), file);

if (mode === 'launcher') {
  const serverArgs = isCompiled
    ? [selfCmd, file, '--_server']
    : ['bun', selfCmd, file, '--_server'];
  Bun.spawn(serverArgs, {
    cwd: process.cwd(),
    stdout: 'ignore',
    stderr: 'ignore',
  });
  process.exit(0);
}

const clients = new Set<ServerWebSocket<undefined>>();
const watcher = watch(resolvedPath, () => {
  for (const ws of clients) {
    ws.send('reload');
  }
});
watcher.on('error', (error) => {
  console.error('Watch error:', error);
});

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const renderHTML = async (): Promise<string> => {
  const md = await Bun.file(resolvedPath).text();
  const content = Bun.markdown.html(md, {
    headings: true,
    latexMath: true,
    wikiLinks: true,
  });
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
  ${content}
  <script>
    const ws = new WebSocket(\`ws://\${location.host}\`);
    ws.onmessage = () => location.reload();
    ws.onclose = () => setTimeout(() => location.reload(), 1000);
  </script>
</body>
</html>`;
};

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

const shutdown = (): void => {
  watcher.close();
  server.stop();
  process.exit(0);
};

const url = `http://localhost:${port}`;
const webviewArgs = isCompiled
  ? [selfCmd, url, `--title=${basename(file)}`, '--_webview']
  : ['bun', selfCmd, url, `--title=${basename(file)}`, '--_webview'];
Bun.spawn(webviewArgs).exited.then(shutdown);

process.on('SIGINT', shutdown);
