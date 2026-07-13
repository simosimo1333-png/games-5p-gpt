const baseUrl = (process.env.PRODUCTION_SERVER_URL ?? process.argv[2] ?? "").replace(/\/$/, "");

if (!baseUrl) {
  console.error("PRODUCTION_SERVER_URLを設定してください");
  process.exit(2);
}
if (!baseUrl.startsWith("https://") && process.env.ALLOW_INSECURE_MONITORING !== "true") {
  console.error("本番監視URLはhttps://で指定してください");
  process.exit(2);
}

async function readJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "user-agent": "houkago-dash-monitor/1" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

try {
  const [health, metrics] = await Promise.all([readJson("/health"), readJson("/metrics")]);
  if (health.ok !== true) throw new Error("health response is not ok");

  const messages = Number(metrics.messagesTotal ?? 0);
  const errors = Number(metrics.errorsTotal ?? 0);
  const disconnects = Number(metrics.disconnectsTotal ?? 0);
  const connections = Number(metrics.connectionsTotal ?? 0);
  const started = Number(metrics.gamesStartedTotal ?? 0);
  const completed = Number(metrics.gamesCompletedTotal ?? 0);
  const errorRate = messages > 0 ? errors / messages : 0;
  const disconnectRate = connections > 0 ? disconnects / connections : 0;
  const completionRate = started > 0 ? completed / started : 1;

  const report = {
    event: "production.monitor.ok",
    activeConnections: metrics.activeConnections,
    activeRooms: metrics.activeRooms,
    completionRate,
    disconnectRate,
    errorRate,
    tickDurationMaxMs: metrics.tickDurationMaxMs,
  };
  console.log(JSON.stringify(report));

  const failures = [];
  if (messages >= 100 && errorRate > 0.05) failures.push("エラー率が5%を超えました");
  if (connections >= 20 && disconnectRate > 0.1) failures.push("切断率が10%を超えました");
  if (started >= 5 && Number(metrics.activeConnections) === 0 && completionRate < 0.5)
    failures.push("完走率が50%未満です");
  if (Number(metrics.tickDurationMaxMs) > 25) failures.push("処理遅延が25msを超えました");
  if (failures.length > 0) throw new Error(failures.join(" / "));
} catch (error) {
  console.error(
    JSON.stringify({
      event: "production.monitor.failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
}
