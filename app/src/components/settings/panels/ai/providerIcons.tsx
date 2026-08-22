/*
 * Brand marks for provider rows and the add-provider dialog.
 *
 * NOTHING IS DOWNLOADED OR VENDORED. `react-icons` is already a dependency and
 * ships the Simple Icons set (`react-icons/si`), so the marks come from a
 * package the app already installs and tree-shakes. Fetching brand SVGs into
 * the repo instead would add assets whose trademarks belong to other companies,
 * for logos this set already covers.
 *
 * COVERAGE IS PARTIAL ON PURPOSE. Simple Icons carries roughly a third of the
 * ~29 providers here; the rest have no mark in any set we ship. Rather than
 * draw approximations of other companies' logos, an uncovered provider keeps
 * the lettered swatch, which is why `providerIcon` returns `null` instead of a
 * placeholder glyph — the caller already renders a good fallback, and a generic
 * cloud icon on twelve rows carries less information than twelve letters.
 */
import type { IconType } from 'react-icons';
import {
  SiAlibabacloud,
  SiAnthropic,
  SiGooglegemini,
  SiHuggingface,
  SiMistralai,
  SiNvidia,
  SiOllama,
  SiOpenai,
  SiVercel,
  SiX,
} from 'react-icons/si';

/**
 * Provider slug to brand mark. Keys are the slugs in `builtinCloudProviders.ts`
 * and the local-runtime slugs, so a rename there surfaces here as a silently
 * missing icon rather than a wrong one — `providerIconCoverage` in the tests
 * pins the keys against the real provider list.
 */
const PROVIDER_ICONS: Record<string, IconType> = {
  openai: SiOpenai,
  // Codex signs in as an OpenAI credential and is stored under `openai`, so it
  // never reaches this map under its own name.
  anthropic: SiAnthropic,
  'claude-code': SiAnthropic,
  google: SiGooglegemini,
  mistral: SiMistralai,
  huggingface: SiHuggingface,
  nvidia: SiNvidia,
  'vercel-ai-gateway': SiVercel,
  xai: SiX,
  // Z.AI is Zhipu, whose models ship through Alibaba Cloud's model service; the
  // Alibaba Cloud mark is the closest thing the set carries. Dropped rather
  // than guessed if that ever reads as wrong.
  zai: SiAlibabacloud,
  ollama: SiOllama,
};

/** The brand mark for a provider slug, or `null` when we ship none. */
export const providerIcon = (slug: string): IconType | null => PROVIDER_ICONS[slug] ?? null;

/** Slugs with a mark — exported for the coverage test, not for rendering. */
export const PROVIDER_ICON_SLUGS = Object.keys(PROVIDER_ICONS);

export default providerIcon;
