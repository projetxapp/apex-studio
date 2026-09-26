import type { DeepPartial } from './index';
import type { Dictionary } from './fr';

/**
 * English — partial on purpose. Missing keys fall back to French.
 * To finish the translation, fill in the remaining keys from `fr.ts`
 * (TypeScript checks the shape).
 */
export const en: DeepPartial<Dictionary> = {
  locale: 'en',
  app: { tagline: 'Your life is the game.' },
  tabs: { today: 'Today', drop: 'Drop', league: 'League', me: 'Me' },
  common: { demo: 'DEMO', simulated: 'Simulated data' },
};
