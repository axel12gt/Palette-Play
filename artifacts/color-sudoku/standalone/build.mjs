import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const workspace = path.resolve(root, '../..');

// Use the existing game, without the app router, backend client, fonts CDN,
// development plugins, payment providers, or ad SDKs.
const result = await build({
  configFile: false,
  root,
  publicDir: false,
  plugins: [{
    name: 'offline-fonts',
    enforce: 'pre',
    transform(code, id) {
      if (id.endsWith('/src/index.css')) {
        return code.replace(/^@import url\([^\n]+\);\s*/m, '');
      }
    },
  }, react(), tailwind()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  build: {
    write: false,
    minify: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: path.join(here, 'main.tsx'),
      output: { format: 'iife', inlineDynamicImports: true },
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(r => r.output);
const js = outputs.filter(o => o.type === 'chunk').map(o => o.code).join('\n');
const css = outputs.filter(o => o.type === 'asset' && o.fileName.endsWith('.css')).map(o => String(o.source)).join('\n');
if (!js || !css) throw new Error('Missing standalone JavaScript or styles');
if (/https:\/\/fonts\.googleapis\.com/.test(css) || /@import\b/.test(css)) {
  throw new Error('Offline stylesheet still has external dependencies');
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Palette Play — Offline</title>
<meta name="description" content="Free offline color logic puzzles. No ads, accounts, payments, or internet required.">
<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>
<body><div id="root"></div><noscript>Enable JavaScript to play Palette Play.</noscript>
<script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
const out = path.join(workspace, 'generated-artifacts');
await mkdir(out, { recursive: true });
await mkdir(path.join(root, 'public'), { recursive: true });
await writeFile(path.join(out, 'Palette-Play.html'), html);
await writeFile(path.join(root, 'public/palette-play-offline.html'), html);
console.log(`Created generated-artifacts/Palette-Play.html (${Buffer.byteLength(html)} bytes)`);
