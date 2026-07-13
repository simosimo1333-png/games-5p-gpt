import { GameServer } from "./game-server";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const server = new GameServer({ port });
console.info(JSON.stringify({ event: "server.started", port: server.address() }));

const shutdown = (): void => {
  void server.close().then(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
