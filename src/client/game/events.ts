import Phaser from 'phaser';

/**
 * Shared emitter bridging the Phaser scene and the React HUD.
 * Scene -> React: score, queue, sentence, gameOver.
 * React -> Scene: restart.
 */
export const gameEvents = new Phaser.Events.EventEmitter();

export const GameEvent = {
  score: 'score',
  queue: 'queue',
  sentence: 'sentence',
  gameOver: 'game-over',
  restart: 'restart',
} as const;

export type SentencePop = {
  text: string;
  points: number;
};
