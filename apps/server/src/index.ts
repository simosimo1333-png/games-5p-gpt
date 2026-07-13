import { GameServer } from "./game-server";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = new GameServer({ port, allowedOrigins });
console.info(JSON.stringify({ event: "server.started", port: server.address() }));

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
