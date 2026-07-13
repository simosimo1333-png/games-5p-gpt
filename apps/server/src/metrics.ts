export interface MetricsSnapshot {
  activeConnections: number;
  activeRooms: number;
  connectionsTotal: number;
  disconnectsTotal: number;
  errorsTotal: number;
  reconnectsTotal: number;
  tickDurationMaxMs: number;
}

export class Metrics {
  activeConnections = 0;
  connectionsTotal = 0;
  disconnectsTotal = 0;
  errorsTotal = 0;
  reconnectsTotal = 0;
  tickDurationMaxMs = 0;

  snapshot(activeRooms: number): MetricsSnapshot {
    return {
      activeConnections: this.activeConnections,
      activeRooms,
      connectionsTotal: this.connectionsTotal,
      disconnectsTotal: this.disconnectsTotal,
      errorsTotal: this.errorsTotal,
      reconnectsTotal: this.reconnectsTotal,
      tickDurationMaxMs: this.tickDurationMaxMs,
    };
  }
}
