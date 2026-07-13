import { spawnSync } from "node:child_process";

const tagIndex = process.argv.indexOf("--tag");
const tag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined;
const execute = process.argv.includes("--execute");

if (!tag || !/^(v\d+\.\d+\.\d+|sha-[a-f0-9]{7,40})$/.test(tag)) {
  console.error("--tag v1.2.3 または --tag sha-abcdef1 を指定してください");
  process.exit(2);
}

const image = `ghcr.io/simosimo1333-png/games-5p-gpt-server:${tag}`;
console.log(JSON.stringify({ event: "rollback.planned", image, execute }));
if (!execute) {
  console.log("確認のみです。実行する場合は --execute を追加してください。");
  process.exit(0);
}
if (!process.env.ALLOWED_ORIGINS) {
  console.error("ALLOWED_ORIGINSを設定してください");
  process.exit(2);
}

const environment = { ...process.env, SERVER_IMAGE: image };
for (const args of [
  ["compose", "-f", "compose.production.yml", "pull", "game-server"],
  ["compose", "-f", "compose.production.yml", "up", "-d", "--no-build", "game-server"],
]) {
  const result = spawnSync("docker", args, { env: environment, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(JSON.stringify({ event: "rollback.completed", image }));
