export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'article';

export type CapsuleKind =
  | PartOfSpeech
  | 'nounPhrase'
  | 'determinedNounPhrase'
  | 'predicate'
  | 'sentence';

export type CapsuleSpec = {
  kind: CapsuleKind;
  text: string;
};

export type KindConfig = {
  label: string;
  radius: number;
  /** Phaser fill color (0xRRGGBB) */
  color: number;
  /** Same color as a CSS string, for the React HUD */
  cssColor: string;
  fontSize: number;
  /** Points awarded when a capsule of this kind is created via merge */
  score: number;
};

export const KIND_CONFIG: Record<CapsuleKind, KindConfig> = {
  noun: {
    label: 'Noun',
    radius: 32,
    color: 0xef4444,
    cssColor: '#ef4444',
    fontSize: 13,
    score: 0,
  },
  verb: {
    label: 'Verb',
    radius: 32,
    color: 0x3b82f6,
    cssColor: '#3b82f6',
    fontSize: 13,
    score: 0,
  },
  adjective: {
    label: 'Adjective',
    radius: 30,
    color: 0xeab308,
    cssColor: '#eab308',
    fontSize: 12,
    score: 0,
  },
  adverb: {
    label: 'Adverb',
    radius: 28,
    color: 0x22c55e,
    cssColor: '#22c55e',
    fontSize: 11,
    score: 0,
  },
  article: {
    label: 'Article',
    radius: 24,
    color: 0xa855f7,
    cssColor: '#a855f7',
    fontSize: 13,
    score: 0,
  },
  nounPhrase: {
    label: 'Noun Phrase',
    radius: 46,
    color: 0xf97316,
    cssColor: '#f97316',
    fontSize: 13,
    score: 10,
  },
  determinedNounPhrase: {
    label: 'Determined NP',
    radius: 56,
    color: 0xfbbf24,
    cssColor: '#fbbf24',
    fontSize: 13,
    score: 20,
  },
  predicate: {
    label: 'Predicate',
    radius: 70,
    color: 0x10b981,
    cssColor: '#10b981',
    fontSize: 14,
    score: 50,
  },
  sentence: {
    label: 'Complete Sentence',
    radius: 84,
    color: 0x67e8f9,
    cssColor: '#67e8f9',
    fontSize: 15,
    score: 0, // computed per-sentence from word count
  },
};

/** Points for a popped Complete Sentence, scaled by how many words it contains. */
export const sentenceScore = (text: string): number =>
  50 * text.split(/\s+/).filter(Boolean).length;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The deterministic merge matrix. Returns the merged capsule if the two
 * specs are syntactically compatible (in either collision order), else null.
 */
export const resolveMerge = (a: CapsuleSpec, b: CapsuleSpec): CapsuleSpec | null => {
  const ordered = (
    first: CapsuleKind,
    second: CapsuleKind
  ): [CapsuleSpec, CapsuleSpec] | null => {
    if (a.kind === first && b.kind === second) return [a, b];
    if (b.kind === first && a.kind === second) return [b, a];
    return null;
  };

  const adjNoun = ordered('adjective', 'noun');
  if (adjNoun) {
    return { kind: 'nounPhrase', text: `${adjNoun[0].text} ${adjNoun[1].text}` };
  }

  const artPhrase = ordered('article', 'nounPhrase');
  if (artPhrase) {
    return {
      kind: 'determinedNounPhrase',
      text: `${artPhrase[0].text} ${artPhrase[1].text}`,
    };
  }

  const phraseVerb =
    ordered('nounPhrase', 'verb') ?? ordered('determinedNounPhrase', 'verb');
  if (phraseVerb) {
    return { kind: 'predicate', text: `${phraseVerb[0].text} ${phraseVerb[1].text}` };
  }

  const predAdverb = ordered('predicate', 'adverb');
  if (predAdverb) {
    return {
      kind: 'sentence',
      text: `${capitalize(`${predAdverb[0].text} ${predAdverb[1].text}`)}.`,
    };
  }

  return null;
};
