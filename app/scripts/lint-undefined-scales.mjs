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
import resolveConfigModule from 'tailwindcss/resolveConfig.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');

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

function shadeResolver() {
  // Resolve the FULL theme, not just `theme.extend.colors`. Two things this
  // gets right that a name allow-list cannot:
  //
  //  - `extend` KEEPS Tailwind's defaults, so `sky-500`/`rose-500` are valid
  //    even though `sky`/`rose` appear in the config only as single `accent.*`
  //    colours. A hand-maintained default list tracks that only until Tailwind
  //    changes — and gets it exactly backwards if the config ever switches from
  //    `extend` to a replacing `theme.colors`, where it would keep allowing
  //    scales that no longer resolve.
  //  - SCALE vs SINGLE COLOUR. `accent`, `surface` and `content` ARE palette
  //    keys, but hold named entries (`accent.lavender`, `surface.canvas`), not
  //    numeric shades. So `accent-lavender` is real while `accent-500` emits
  //    nothing. Checking the resolved SHADE catches that; checking the scale
  //    NAME does not — `bg-accent-500`, `bg-surface-500` and `text-content-500`
  //    all passed the previous version of this lint while emitting no CSS.
  const resolveConfig = resolveConfigModule.default ?? resolveConfigModule;
  const colors = resolveConfig(loadTailwindConfig())?.theme?.colors;
  if (!colors || Object.keys(colors).length === 0) {
    throw new Error(
      'lint:ui-tokens: resolved theme.colors is empty — refusing to run, since ' +
        'an empty palette would flag every colour utility in the app.'
    );
  }
  // Fail loudly if the resolved shape ever changes, rather than silently
  // passing everything.
  if (typeof colors.primary !== 'object' || !colors.primary['500']) {
    throw new Error(
      'lint:ui-tokens: resolved palette has no primary-500 — the config shape ' +
        'changed and this lint can no longer be trusted.'
    );
  }
  const shadeExists = (scale, shade) => {
    const entry = colors[scale];
    return typeof entry === 'object' && entry !== null && Boolean(entry[shade]);
  };

  // Shade-LESS colour utilities (`bg-ocean`, `text-ocean/90`, `bg-surface`).
  // These have no shade to look up, so the shade check above cannot see them —
  // which is how `bg-ocean` on an action button survived the sweep AND the
  // first version of this lint, rendering `text-content-inverted` on a
  // transparent background. Valid iff the name resolves to a colour STRING, or
  // to an object carrying a DEFAULT. `bg-surface` is valid (DEFAULT);
  // `bg-primary` is not (a scale with no DEFAULT); `bg-ocean` is not (absent).
  // Names may be nested (`accent-lavender` -> colors.accent.lavender), so walk
  // every split point rather than assuming one segment.
  const bareExists = name => {
    const parts = name.split('-');
    for (let i = 1; i <= parts.length; i += 1) {
      let node = colors;
      for (const seg of [parts.slice(0, i).join('-'), ...parts.slice(i)]) {
        if (node === null || typeof node !== 'object') { node = undefined; break; }
        node = node[seg];
      }
      if (typeof node === 'string') return true;
      if (node && typeof node === 'object' && node.DEFAULT) return true;
    }
    return false;
  };

  return { shadeExists, bareExists };
}


const PATTERN = new RegExp(
  `\\b(${UTILITY_PREFIXES.join('|')})-([a-z][a-z0-9]+)-(\\d{2,3})\\b`,
  'g'
);

/**
 * Shade-less colour utilities: `bg-ocean`, `text-ocean/90`, `bg-surface`.
 *
 * Narrower prefix set than PATTERN on purpose. `text-`/`border-`/`ring-` also
 * carry NON-colour values (`text-xs`, `border-2`, `ring-offset-2`), so a bare
 * match there needs the exclusion set below or it flags half the codebase.
 */
const BARE_PATTERN = new RegExp(
  `\\b(${UTILITY_PREFIXES.join('|')})-([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)(?:\\/\\d{1,3})?\\b(?!-?\\d)`,
  'g'
);

/**
 * Values that follow a colour-utility prefix but are not colours. Derived from
 * the resolved theme where possible (font sizes, so a new `text-micro` needs no
 * edit here) plus the static Tailwind keywords that share these prefixes.
 */
function nonColourValues(resolved) {
  return new Set([
    ...Object.keys(resolved?.theme?.fontSize ?? {}),
    ...Object.keys(resolved?.theme?.borderWidth ?? {}),
    ...Object.keys(resolved?.theme?.ringWidth ?? {}),
    // Static keywords sharing bg-/text-/border-/ring-/divide-/from-/to-/via-.
    'left', 'center', 'right', 'justify', 'start', 'end',
    'wrap', 'nowrap', 'balance', 'pretty', 'clip', 'ellipsis',
    'transparent', 'current', 'inherit', 'none', 'auto',
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'collapse', 'separate',
    'fixed', 'local', 'scroll', 'cover', 'contain', 'repeat', 'no', 'origin',
    'opacity', 'offset', 'blend', 'clip-text', 'gradient',
  ]);
}

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

const { shadeExists, bareExists } = shadeResolver();
const violations = [];

for (const file of walk(path.join(appRoot, 'src'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip comment-only lines — prose is allowed to name a retired scale.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.matchAll(PATTERN)) {
      const [match, , scale, shade] = m;
      if (!SHADES.has(shade)) continue;
      if (shadeExists(scale, shade)) continue;
      violations.push(`${path.relative(appRoot, file)}:${i + 1}: ${match}`);
    }
    for (const m of line.matchAll(BARE_PATTERN)) {
      const [match, , name] = m;
      if (nonColour.has(name)) continue;
      if (bareExists(name)) continue;
      violations.push(`${path.relative(appRoot, file)}:${i + 1}: ${match} (no such colour)`);
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
