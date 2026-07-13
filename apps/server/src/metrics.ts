export interface MetricsSnapshot {
  activeConnections: number;
  activeRooms: number;
  connectionsTotal: number;
  disconnectsTotal: number;
  errorsTotal: number;
  gamesCompletedTotal: number;
  gamesStartedTotal: number;
  messagesTotal: number;
  reconnectsTotal: number;
  tickDurationMaxMs: number;
}

export class Metrics {
  activeConnections = 0;
  connectionsTotal = 0;
  disconnectsTotal = 0;
  errorsTotal = 0;
  gamesCompletedTotal = 0;
  gamesStartedTotal = 0;
  messagesTotal = 0;
  reconnectsTotal = 0;
  tickDurationMaxMs = 0;

  snapshot(activeRooms: number, resetTickPeak = false): MetricsSnapshot {
    const snapshot = {
      activeConnections: this.activeConnections,
      activeRooms,
      connectionsTotal: this.connectionsTotal,
      disconnectsTotal: this.disconnectsTotal,
      errorsTotal: this.errorsTotal,
      gamesCompletedTotal: this.gamesCompletedTotal,
      gamesStartedTotal: this.gamesStartedTotal,
      messagesTotal: this.messagesTotal,
      reconnectsTotal: this.reconnectsTotal,
      tickDurationMaxMs: this.tickDurationMaxMs,
    };
    if (resetTickPeak) this.tickDurationMaxMs = 0;
    return snapshot;
  }
}
