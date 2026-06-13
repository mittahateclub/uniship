// Presentation-only class sweep: Linear typography weights + label tracking.
// Touches class strings only — no logic, no structure.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = [
  'c:/Users/ASUS/github/uniship/app/(protected)',
  'c:/Users/ASUS/github/uniship/components/Navbar.tsx',
];

// Ordered: font-bold first so font-extrabold (no substring overlap) follows safely.
const replacements = [
  [/\bfont-bold\b/g, 'font-semibold'],
  [/\bfont-extrabold\b/g, 'font-bold'],
  [/\btracking-widest\b/g, 'tracking-[0.07em]'],
  [/\btext-\[10px\]\b/g, 'text-[10.5px]'],
];

function walk(p, out = []) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) walk(join(p, e), out);
  } else if (/\.tsx?$/.test(p)) {
    out.push(p);
  }
  return out;
}

let totalFiles = 0;
let totalRepl = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const before = readFileSync(file, 'utf8');
    let after = before;
    let count = 0;
    for (const [re, to] of replacements) {
      after = after.replace(re, (m) => {
        count++;
        return typeof to === 'string' ? to : to(m);
      });
    }
    if (count > 0) {
      writeFileSync(file, after);
      totalFiles++;
      totalRepl += count;
      console.log(`${count}\t${file.split('uniship/')[1] ?? file}`);
    }
  }
}
console.log(`\nswept ${totalRepl} replacements in ${totalFiles} files`);
