import './index.css';

import Phaser from 'phaser';
import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

import { createGameConfig } from './game/config';
import { GameEvent, gameEvents } from './game/events';
import type { SentencePop } from './game/events';
import { KIND_CONFIG } from './game/grammar';
import type { CapsuleSpec } from './game/grammar';

export const App = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [score, setScore] = useState(0);
  const [queue, setQueue] = useState<CapsuleSpec[]>([]);
  const [sentence, setSentence] = useState<SentencePop | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const game = new Phaser.Game(createGameConfig(mountRef.current));

    const onScore = (value: number) => setScore(value);
    const onQueue = (words: CapsuleSpec[]) => setQueue(words);
    const onSentence = (pop: SentencePop) => setSentence(pop);
    const onGameOver = (value: number) => setFinalScore(value);

    gameEvents.on(GameEvent.score, onScore);
    gameEvents.on(GameEvent.queue, onQueue);
    gameEvents.on(GameEvent.sentence, onSentence);
    gameEvents.on(GameEvent.gameOver, onGameOver);

    return () => {
      gameEvents.off(GameEvent.score, onScore);
      gameEvents.off(GameEvent.queue, onQueue);
      gameEvents.off(GameEvent.sentence, onSentence);
      gameEvents.off(GameEvent.gameOver, onGameOver);
      game.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (!sentence) return;
    const timer = setTimeout(() => setSentence(null), 3500);
    return () => clearTimeout(timer);
  }, [sentence]);

  const restart = () => {
    setFinalScore(null);
    setScore(0);
    setSentence(null);
    gameEvents.emit(GameEvent.restart);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      <div ref={mountRef} className="h-full w-full" />

      {/* Score */}
      <div className="absolute top-3 left-3 rounded-lg bg-slate-800/80 px-3 py-1.5 text-white">
        <span className="text-xs uppercase tracking-wide text-slate-400">Score</span>
        <div className="text-xl font-bold leading-tight">{score}</div>
      </div>

      {/* Next-up queue */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
        <span className="text-xs uppercase tracking-wide text-slate-400">Next</span>
        {queue.slice(1).map((word, i) => (
          <div
            key={`${word.text}-${i}`}
            className="flex items-center gap-2 rounded-full bg-slate-800/80 px-3 py-1 text-sm font-semibold text-white"
            style={{ opacity: 1 - i * 0.3 }}
          >
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: KIND_CONFIG[word.kind].cssColor }}
            />
            {word.text}
          </div>
        ))}
      </div>

      {/* Completed-sentence toast */}
      {sentence && (
        <div className="pointer-events-none absolute bottom-8 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-xl bg-cyan-300/95 px-4 py-2 text-center shadow-lg">
          <div className="text-sm font-bold text-slate-900">“{sentence.text}”</div>
          <div className="text-xs font-semibold text-slate-700">
            Complete Sentence! +{sentence.points}
          </div>
        </div>
      )}

      {/* Game over */}
      {finalScore !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/80">
          <h1 className="text-3xl font-extrabold text-white">Game Over</h1>
          <p className="text-slate-300">
            Final score: <span className="text-xl font-bold text-white">{finalScore}</span>
          </p>
          <button
            className="cursor-pointer rounded-full bg-[#d93900] px-6 py-2.5 font-semibold text-white transition-colors hover:bg-[#c23300]"
            onClick={restart}
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
