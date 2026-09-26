import { en } from './en';
import { fr, type Dictionary } from './fr';

export type { Dictionary } from './fr';
export type Locale = 'fr' | 'en';

export type DeepPartial<T> = T extends (infer U)[]
  ? U[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) {
    return (override as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (value === undefined) continue;
    out[key] = deepMerge((base as Record<string, unknown>)[key], value as never);
  }
  return out as T;
}

const dictionaries: Record<Locale, Dictionary> = {
  fr,
  en: deepMerge(fr, en),
};

/** French is the only complete locale in phase one. */
let current: Locale = 'fr';

export function setLocale(locale: Locale) {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** The dictionary for the active (or given) locale. */
export function strings(locale: Locale = current): Dictionary {
  return dictionaries[locale];
}

/** Replaces `{name}` placeholders. Unknown placeholders are left untouched. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match,
  );
}
