import type { CapsuleSpec, PartOfSpeech } from './grammar';

export const WORD_BANK: Record<PartOfSpeech, readonly string[]> = {
  noun: [
    'Goat',
    'Shrek',
    'Gravity',
    'Pants',
    'Toaster',
    'Pigeon',
    'Wizard',
    'Cheese',
    'Blob',
    'Moon',
    'Sock',
    'Walrus',
  ],
  verb: [
    'Exploded',
    'Whispered',
    'Glitched',
    'Yodeled',
    'Melted',
    'Screeched',
    'Wobbled',
    'Vanished',
    'Sneezed',
    'Levitated',
  ],
  adjective: [
    'Screaming',
    'Industrial',
    'Aggressive',
    'Moist',
    'Cursed',
    'Sparkly',
    'Feral',
    'Soggy',
    'Majestic',
    'Haunted',
  ],
  adverb: [
    'Majestically',
    'Violently',
    'Regrettably',
    'Suspiciously',
    'Gracefully',
    'Loudly',
    'Politely',
    'Ominously',
  ],
  article: ['The', 'A'],
};

/**
 * Drop weights per lexical category. Nouns and adjectives are the most
 * common so Noun Phrases stay buildable; articles and adverbs are rarer
 * since each is only needed once per sentence.
 */
const WEIGHTS: readonly { kind: PartOfSpeech; weight: number }[] = [
  { kind: 'noun', weight: 28 },
  { kind: 'adjective', weight: 26 },
  { kind: 'verb', weight: 20 },
  { kind: 'article', weight: 13 },
  { kind: 'adverb', weight: 13 },
];

const TOTAL_WEIGHT = WEIGHTS.reduce((sum, w) => sum + w.weight, 0);

const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error('cannot pick from an empty list');
  return item;
};

export const randomWord = (): CapsuleSpec => {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const { kind, weight } of WEIGHTS) {
    roll -= weight;
    if (roll < 0) {
      return { kind, text: pick(WORD_BANK[kind]) };
    }
  }
  return { kind: 'noun', text: pick(WORD_BANK.noun) };
};
