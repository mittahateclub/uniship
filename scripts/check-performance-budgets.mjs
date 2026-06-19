import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const routeBudgets = [
  ['landing', '.next/server/app/index.html', 230],
  ['dashboard', '.next/server/app/user/dashboard.html', 450],
  ['proctoring', '.next/server/app/uniadmin/proctoring.html', 450],
];
const maxChunkGzipKb = 275;
let failed = false;

function gzipKb(file) {
  return zlib.gzipSync(fs.readFileSync(file)).length / 1024;
}

for (const [name, htmlPath, budget] of routeBudgets) {
  if (!fs.existsSync(htmlPath)) {
    console.error(`Missing build output for ${name}: ${htmlPath}`);
    failed = true;
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');
  const assets = [...new Set(
    [...html.matchAll(/(?:src|href)="\/_next\/([^"]+\.(?:js|css))/g)].map((match) => match[1]),
  )];
  const total = assets.reduce((sum, asset) => sum + gzipKb(path.join('.next', asset)), 0);
  console.log(`${name}: ${total.toFixed(1)} KB gzip (budget ${budget} KB)`);
  if (total > budget) failed = true;
}

const chunkDir = '.next/static/chunks';
for (const entry of fs.readdirSync(chunkDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
  const size = gzipKb(path.join(chunkDir, entry.name));
  if (size > maxChunkGzipKb) {
    console.error(`${entry.name}: ${size.toFixed(1)} KB gzip exceeds ${maxChunkGzipKb} KB`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log('Performance budgets passed.');