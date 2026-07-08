/* global MatterJS -- ambient type-only namespace from Phaser's typings */
import Phaser from 'phaser';

import { KIND_CONFIG, resolveMerge, sentenceScore } from './grammar';
import type { CapsuleSpec } from './grammar';
import { randomWord } from './words';
import { GameEvent, gameEvents } from './events';
import type { SentencePop } from './events';

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 720;

const WALL_THICKNESS = 60;
const JAR_LEFT = 36;
const JAR_RIGHT = GAME_WIDTH - 36;
const FLOOR_Y = GAME_HEIGHT - 16;
const DROP_Y = 72;
const DANGER_Y = 150;
const DANGER_MS = 3000;
/** Grace period after a drop before a capsule can trip the danger line. */
const DROP_GRACE_MS = 700;
const DROP_COOLDOWN_MS = 600;
const QUEUE_SIZE = 3;

type Capsule = {
  id: number;
  spec: CapsuleSpec;
  radius: number;
  body: MatterJS.BodyType;
  container: Phaser.GameObjects.Container;
  droppedAt: number;
  aboveDangerSince: number | null;
};

export class GameScene extends Phaser.Scene {
  private capsules = new Map<number, Capsule>();
  private nextCapsuleId = 0;
  private score = 0;
  private isGameOver = false;
  private canDrop = false;
  private aimX = GAME_WIDTH / 2;
  private queue: CapsuleSpec[] = [];
  private preview: Phaser.GameObjects.Container | null = null;
  private aimLine!: Phaser.GameObjects.Rectangle;
  private dangerLine!: Phaser.GameObjects.Graphics;
  private dangerActive = false;

  constructor() {
    super('game');
  }

  create(): void {
    this.capsules = new Map();
    this.nextCapsuleId = 0;
    this.score = 0;
    this.isGameOver = false;
    this.canDrop = false;
    this.aimX = GAME_WIDTH / 2;
    this.queue = Array.from({ length: QUEUE_SIZE }, () => randomWord());

    this.createJar();
    this.createDangerLine();

    this.aimLine = this.add
      .rectangle(this.aimX, (DROP_Y + FLOOR_Y) / 2, 2, FLOOR_Y - DROP_Y, 0xffffff, 0.08)
      .setDepth(1);

    this.matter.world.on(
      Phaser.Physics.Matter.Events.COLLISION_START,
      this.onCollisionStart,
      this
    );

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) =>
      this.updateAim(p.worldX)
    );
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) =>
      this.updateAim(p.worldX)
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
      this.updateAim(p.worldX);
      this.dropCurrent();
    });

    const onRestart = (): void => {
      this.scene.restart();
    };
    gameEvents.on(GameEvent.restart, onRestart);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      gameEvents.off(GameEvent.restart, onRestart);
      this.matter.world.off(
        Phaser.Physics.Matter.Events.COLLISION_START,
        this.onCollisionStart,
        this
      );
    });

    gameEvents.emit(GameEvent.score, this.score);
    gameEvents.emit(GameEvent.queue, [...this.queue]);
    this.showPreview();
  }

  override update(time: number): void {
    for (const capsule of this.capsules.values()) {
      capsule.container.setPosition(capsule.body.position.x, capsule.body.position.y);
      capsule.container.setRotation(capsule.body.angle);
    }
    if (!this.isGameOver) {
      this.checkDangerLine(time);
    }
  }

  private createJar(): void {
    const half = WALL_THICKNESS / 2;
    this.matter.add.rectangle(
      JAR_LEFT - half,
      GAME_HEIGHT / 2,
      WALL_THICKNESS,
      GAME_HEIGHT * 2,
      { isStatic: true }
    );
    this.matter.add.rectangle(
      JAR_RIGHT + half,
      GAME_HEIGHT / 2,
      WALL_THICKNESS,
      GAME_HEIGHT * 2,
      { isStatic: true }
    );
    this.matter.add.rectangle(GAME_WIDTH / 2, FLOOR_Y + half, GAME_WIDTH * 2, WALL_THICKNESS, {
      isStatic: true,
    });

    const g = this.add.graphics().setDepth(2);
    g.lineStyle(3, 0x94a3b8, 0.9);
    g.beginPath();
    g.moveTo(JAR_LEFT - 2, DANGER_Y - 30);
    g.lineTo(JAR_LEFT - 2, FLOOR_Y + 2);
    g.lineTo(JAR_RIGHT + 2, FLOOR_Y + 2);
    g.lineTo(JAR_RIGHT + 2, DANGER_Y - 30);
    g.strokePath();
  }

  private createDangerLine(): void {
    this.dangerLine = this.add.graphics().setDepth(2);
    this.drawDangerLine(0.5);
  }

  private drawDangerLine(alpha: number): void {
    this.dangerLine.clear();
    this.dangerLine.lineStyle(2, 0xef4444, alpha);
    const dash = 10;
    const gap = 8;
    for (let x = JAR_LEFT; x < JAR_RIGHT; x += dash + gap) {
      this.dangerLine.beginPath();
      this.dangerLine.moveTo(x, DANGER_Y);
      this.dangerLine.lineTo(Math.min(x + dash, JAR_RIGHT), DANGER_Y);
      this.dangerLine.strokePath();
    }
  }

  private updateAim(worldX: number): void {
    if (this.isGameOver) return;
    const spec = this.queue[0];
    const radius = spec ? KIND_CONFIG[spec.kind].radius : 30;
    this.aimX = Phaser.Math.Clamp(worldX, JAR_LEFT + radius, JAR_RIGHT - radius);
    this.aimLine.setX(this.aimX);
    if (this.preview) {
      this.preview.setX(this.aimX);
    }
  }

  private createCapsuleContainer(spec: CapsuleSpec): Phaser.GameObjects.Container {
    const config = KIND_CONFIG[spec.kind];
    const circle = this.add
      .circle(0, 0, config.radius, config.color, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.5);
    const text = this.add
      .text(0, 0, spec.text, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: `${config.fontSize}px`,
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: config.radius * 1.6 },
      })
      .setOrigin(0.5)
      .setStroke('#1e293b', 3);
    return this.add.container(0, 0, [circle, text]).setDepth(3);
  }

  private showPreview(): void {
    if (this.isGameOver) return;
    const spec = this.queue[0];
    if (!spec) return;
    const radius = KIND_CONFIG[spec.kind].radius;
    this.aimX = Phaser.Math.Clamp(this.aimX, JAR_LEFT + radius, JAR_RIGHT - radius);
    this.preview = this.createCapsuleContainer(spec)
      .setPosition(this.aimX, DROP_Y)
      .setAlpha(0.85);
    this.aimLine.setX(this.aimX);
    this.canDrop = true;
  }

  private dropCurrent(): void {
    if (!this.canDrop || this.isGameOver) return;
    const spec = this.queue.shift();
    if (!spec) return;
    this.canDrop = false;
    this.preview?.destroy();
    this.preview = null;

    this.spawnCapsule(spec, this.aimX, DROP_Y);

    this.queue.push(randomWord());
    gameEvents.emit(GameEvent.queue, [...this.queue]);
    this.time.delayedCall(DROP_COOLDOWN_MS, () => this.showPreview());
  }

  private spawnCapsule(spec: CapsuleSpec, x: number, y: number): Capsule {
    const config = KIND_CONFIG[spec.kind];
    const body = this.matter.add.circle(x, y, config.radius, {
      restitution: 0.25,
      friction: 0.35,
      frictionAir: 0.012,
    });
    const container = this.createCapsuleContainer(spec).setPosition(x, y);
    const capsule: Capsule = {
      id: this.nextCapsuleId++,
      spec,
      radius: config.radius,
      body,
      container,
      droppedAt: this.time.now,
      aboveDangerSince: null,
    };
    this.capsules.set(body.id, capsule);
    return capsule;
  }

  private destroyCapsule(capsule: Capsule): void {
    this.capsules.delete(capsule.body.id);
    this.matter.world.remove(capsule.body);
    capsule.container.destroy();
  }

  private onCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.isGameOver) return;
    for (const pair of event.pairs) {
      const capA = this.capsules.get(pair.bodyA.id);
      const capB = this.capsules.get(pair.bodyB.id);
      if (!capA || !capB) continue;

      const merged = resolveMerge(capA.spec, capB.spec);
      if (!merged) continue;

      const mx = (capA.body.position.x + capB.body.position.x) / 2;
      const my = (capA.body.position.y + capB.body.position.y) / 2;
      this.destroyCapsule(capA);
      this.destroyCapsule(capB);

      if (merged.kind === 'sentence') {
        this.popSentence(merged, mx, my);
      } else {
        this.addScore(KIND_CONFIG[merged.kind].score);
        const capsule = this.spawnCapsule(merged, mx, my);
        capsule.container.setScale(0.6);
        this.tweens.add({
          targets: capsule.container,
          scale: 1,
          duration: 180,
          ease: 'Back.Out',
        });
      }
    }
  }

  private popSentence(spec: CapsuleSpec, x: number, y: number): void {
    const points = sentenceScore(spec.text);
    this.addScore(points);
    const pop: SentencePop = { text: spec.text, points };
    gameEvents.emit(GameEvent.sentence, pop);

    this.cameras.main.shake(180, 0.005);

    const burst = this.add
      .circle(x, y, KIND_CONFIG.sentence.radius, KIND_CONFIG.sentence.color, 0.55)
      .setDepth(4);
    const label = this.add
      .text(x, y, `${spec.text}\n+${points}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 220 },
      })
      .setOrigin(0.5)
      .setStroke('#0f172a', 4)
      .setDepth(5);

    this.tweens.add({
      targets: burst,
      scale: 2.2,
      alpha: 0,
      duration: 450,
      ease: 'Cubic.Out',
      onComplete: () => burst.destroy(),
    });
    this.tweens.add({
      targets: label,
      y: y - 70,
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    });
  }

  private addScore(points: number): void {
    if (points <= 0) return;
    this.score += points;
    gameEvents.emit(GameEvent.score, this.score);
  }

  private checkDangerLine(time: number): void {
    let anyAbove = false;
    for (const capsule of this.capsules.values()) {
      const top = capsule.body.position.y - capsule.radius;
      const isAbove = top < DANGER_Y && time - capsule.droppedAt > DROP_GRACE_MS;
      if (!isAbove) {
        capsule.aboveDangerSince = null;
        continue;
      }
      anyAbove = true;
      if (capsule.aboveDangerSince === null) {
        capsule.aboveDangerSince = time;
      } else if (time - capsule.aboveDangerSince > DANGER_MS) {
        this.triggerGameOver();
        return;
      }
    }

    if (anyAbove !== this.dangerActive) {
      this.dangerActive = anyAbove;
    }
    if (this.dangerActive) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(time / 150));
      this.drawDangerLine(pulse);
    } else {
      this.drawDangerLine(0.5);
    }
  }

  private triggerGameOver(): void {
    this.isGameOver = true;
    this.canDrop = false;
    this.preview?.destroy();
    this.preview = null;
    this.matter.pause();
    this.drawDangerLine(1);
    gameEvents.emit(GameEvent.gameOver, this.score);
  }
}
