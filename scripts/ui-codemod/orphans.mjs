#!/usr/bin/env node
/**
 * Report primitives that exist but nothing uses.
 *
 * The Radix/shadcn migration repeatedly produced components that were written,
 * tested, exported from the barrel — and then imported by nothing, while the
 * hand-rolled markup they were meant to replace stayed in place. `ui/Sidebar.tsx`
 * (625 lines, a byte-identical copy of the app shell's own width constants) sat
 * unused that way; so did all ten `ai-elements/` components.
 *
 * A primitive with no consumers is not neutral: it reads as "already migrated"
 * in every audit while the real UI is untouched. This script makes that state
 * visible instead of silent.
 *
 * The dev gallery (`pages/dev/**`) is deliberately NOT counted as a consumer —
 * it renders every primitive by design, so counting it would mask every orphan.
 *
 *   node scripts/ui-codemod/orphans.mjs
 *   node scripts/ui-codemod/orphans.mjs --json
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const APP_SRC = path.resolve(process.cwd(), 'app/src');
const DIRS = ['components/ui', 'components/ai-elements'];
const SKIP = /\.(test|stories)\.tsx$|^index\.ts$|^types\.ts$|^icons\.tsx$/;

/**
 * A consumer is a file that IMPORTS the primitive, not merely one that contains
 * its name. That distinction matters: `layout/shell/SidebarNav.tsx` mentions
 * "Sidebar" in every other identifier while importing nothing from
 * `ui/Sidebar`, so a bare word match reported the app shell as a consumer of a
 * primitive it had never wired up — exactly the orphan this script exists to
 * catch. Matches both the barrel (`from '../ui'`) and the direct path
 * (`from '../ui/Button'`), across single- and multi-line import statements.
 */
function consumersOf(name) {
  let out = '';
  const pattern =
    `(?s)import[^;]*?\\b${name}\\b[^;]*?from\\s*['\"][^'\"]*(components/)?(ui|ai-elements)(/${name})?['\"]` +
    `|import\\s+${name}\\s+from\\s*['\"][^'\"]*(ui|ai-elements)/${name}['\"]`;
  try {
    out = execFileSync(
      'rg',
      ['-l', '--multiline', '-g', '*.ts', '-g', '*.tsx', pattern, '.'],
      { cwd: APP_SRC, encoding: 'utf8' },
    );
  } catch {
    return [];
  }
  return out
    .split('\n')
    .map((s) => s.replace(/^\.\//, '').trim())
    .filter(Boolean)
    .filter((f) => !DIRS.some((d) => f.startsWith(d)))
    .filter((f) => !f.startsWith('pages/dev/'))
    .filter((f) => !/\.test\.tsx?$/.test(f));
}

const rows = [];
for (const dir of DIRS) {
  let entries = [];
  try {
    entries = readdirSync(path.join(APP_SRC, dir));
  } catch {
    continue;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.tsx') || SKIP.test(entry)) continue;
    const name = entry.replace(/\.tsx$/, '');
    const consumers = consumersOf(name);
    rows.push({ primitive: name, dir, consumers: consumers.length, files: consumers });
  }
}

rows.sort((a, b) => a.consumers - b.consumers || a.primitive.localeCompare(b.primitive));

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ rows }, null, 2));
  process.exit(0);
}

const orphans = rows.filter((r) => r.consumers === 0);
console.log(`${rows.length} primitives, ${orphans.length} with ZERO consumers\n`);
console.log('consumers  primitive');
for (const r of rows) {
  const mark = r.consumers === 0 ? '  <- ORPHAN' : '';
  console.log(String(r.consumers).padStart(9), ' ', r.primitive + mark);
}
