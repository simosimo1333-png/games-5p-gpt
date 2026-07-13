import type { PlayerSnapshot } from "../../../../packages/protocol/src";

export interface TimedSnapshot {
  players: PlayerSnapshot[];
  serverTime: number;
}

export class SnapshotInterpolator {
  private readonly snapshots: TimedSnapshot[] = [];

  push(snapshot: TimedSnapshot): void {
    if (this.snapshots.some((item) => item.serverTime === snapshot.serverTime)) return;
    this.snapshots.push(snapshot);
    this.snapshots.sort((left, right) => left.serverTime - right.serverTime);
    if (this.snapshots.length > 30) this.snapshots.splice(0, this.snapshots.length - 30);
  }

  sample(playerId: string, renderTime: number): PlayerSnapshot | undefined {
    let before: TimedSnapshot | undefined;
    let after: TimedSnapshot | undefined;
    for (const snapshot of this.snapshots) {
      if (snapshot.serverTime <= renderTime) before = snapshot;
      if (snapshot.serverTime >= renderTime) {
        after = snapshot;
        break;
      }
    }
    before ??= this.snapshots[0];
    after ??= this.snapshots.at(-1);
    const from = before?.players.find((player) => player.id === playerId);
    const to = after?.players.find((player) => player.id === playerId);
    if (!from) return to;
    if (!to || !before || !after || after.serverTime === before.serverTime) return from;
    const ratio = Math.max(
      0,
      Math.min(1, (renderTime - before.serverTime) / (after.serverTime - before.serverTime)),
    );
    return {
      ...to,
      x: from.x + (to.x - from.x) * ratio,
      y: from.y + (to.y - from.y) * ratio,
      velocityX: from.velocityX + (to.velocityX - from.velocityX) * ratio,
      velocityY: from.velocityY + (to.velocityY - from.velocityY) * ratio,
    };
  }
}
