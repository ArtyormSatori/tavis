#!/usr/bin/env node
/**
 * lint:ui-tokens companion — fail on Tailwind colour utilities that name a
 * scale the palette never defines.
 *
 * Motivation: `ocean-*` shipped across ~26 component files and emitted ZERO
 * CSS, because `ocean` is not a colour in `tailwind.config.js` (it is only a
 * *theme preset id* in `src/lib/theme/presets.ts`). Those elements rendered
 * with no background, no text colour and no border. The old rg-based
 * `lint:ui-tokens` regex only banned scales that DO exist but are off-palette
 * (`neutral|stone|slate|canvas|white|black`), so an undefined scale — the more
 * damaging case, since it is silently invisible — slipped straight through.
 *
 * This script inverts the check: instead of a hand-maintained deny-list it
 * derives the ALLOWED scale names from the Tailwind config itself
 * (`theme.extend.colors`) plus Tailwind's own default palette, and fails on
 * any `<utility>-<name>-<shade>` whose `<name>` is in neither.
 *
 * Deliberately NOT flagged:
 *  - bare words (`ocean` as a preset id, a CSS custom property `--ocean`, a
 *    comment) — only utility-shaped matches count;
 *  - arbitrary values (`bg-[#D97757]`), which need no scale;
 *  - non-shade numeric suffixes (`border-l-2`, `w-12`), filtered by requiring
 *    a real Tailwind shade step.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

/** Tailwind's built-in colour scales (v3), all of which resolve to real CSS. */
const TAILWIND_DEFAULT_SCALES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

const SHADES = new Set([
  '50', '100', '150', '200', '300', '400', '500', '600', '700', '800', '900', '950',
]);

/** Colour-bearing utility prefixes, including directional border/divide forms. */
const UTILITY_PREFIXES = [
  'bg', 'text', 'border', 'border-x', 'border-y',
  'border-t', 'border-r', 'border-b', 'border-l',
  'ring', 'ring-offset', 'divide', 'divide-x', 'divide-y',
  'outline', 'shadow', 'fill', 'stroke', 'accent', 'caret',
  'decoration', 'placeholder', 'from', 'to', 'via',
];

/**
 * `tailwind.config.js` is CommonJS (`module.exports`) but this package is
 * `"type": "module"`, so `require()` / `import` both refuse it. It is pure
 * data with no `require` calls, so evaluate it in a throwaway vm context with
 * a stub `module`/`exports` — the same trick Tailwind's own loader performs.
 */
function loadTailwindConfig() {
  const source = readFileSync(path.join(appRoot, 'tailwind.config.js'), 'utf8');
  const sandbox = { module: { exports: {} }, require: () => ({}) };
  sandbox.exports = sandbox.module.exports;
  vm.createContext(sandbox);
  new vm.Script(source, { filename: 'tailwind.config.js' }).runInContext(sandbox);
  return sandbox.module.exports;
}

function allowedScales() {
  const config = loadTailwindConfig();
  const extended = Object.keys(config?.theme?.extend?.colors ?? {});
  if (extended.length === 0) {
    throw new Error(
      'lint:ui-tokens: could not read theme.extend.colors from tailwind.config.js — ' +
        'refusing to run with an empty allow-list (it would flag everything).'
    );
  }
  return new Set([...extended, ...TAILWIND_DEFAULT_SCALES]);
}

const PATTERN = new RegExp(
  `\\b(${UTILITY_PREFIXES.join('|')})-([a-z][a-z0-9]+)-(\\d{2,3})\\b`,
  'g'
);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry)) {
      yield full;
    }
  }
}

const allowed = allowedScales();
const violations = [];

for (const file of walk(path.join(appRoot, 'src'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip comment-only lines — prose is allowed to name a retired scale.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(PATTERN)) {
      const [match, , scale, shade] = m;
      if (!SHADES.has(shade)) continue;
      if (allowed.has(scale)) continue;
      violations.push(`${path.relative(appRoot, file)}:${i + 1}: ${match}`);
    }
  });
}

if (violations.length > 0) {
  console.error(
    `lint:ui-tokens: ${violations.length} Tailwind utility/utilities name a colour scale that ` +
      `tailwind.config.js does not define. These emit NO CSS and render uncoloured:\n`
  );
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    `\nAllowed scales: ${[...allowed].sort().join(', ')}\n` +
      `Fix by choosing a defined semantic token — do NOT add the missing scale to tailwind.config.js.`
  );
  process.exit(1);
}

console.log(`lint:ui-tokens: no undefined colour scales (${allowed.size} scales allowed).`);
