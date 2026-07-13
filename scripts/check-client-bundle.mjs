import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve(process.argv[2] ?? "apps/client/dist");
const files = [];
const visit = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) visit(path);
    else files.push(path);
  }
};
visit(root);

const measured = files.map((path) => ({
  path: relative(root, path).replaceAll("\\", "/"),
  gzipBytes: gzipSync(readFileSync(path)).byteLength,
}));
const totalGzipBytes = measured.reduce((total, file) => total + file.gzipBytes, 0);
const appJavaScriptBytes = measured
  .filter((file) => file.path.endsWith(".js") && !file.path.includes("phaser"))
  .reduce((total, file) => total + file.gzipBytes, 0);

const budgets = {
  totalGzipBytes: 430 * 1024,
  appJavaScriptBytes: 80 * 1024,
};

console.log(
  JSON.stringify({
    event: "client.bundle.measured",
    totalGzipBytes,
    appJavaScriptBytes,
    budgets,
  }),
);

if (totalGzipBytes > budgets.totalGzipBytes)
  throw new Error(`client bundle exceeds total gzip budget: ${totalGzipBytes}`);
if (appJavaScriptBytes > budgets.appJavaScriptBytes)
  throw new Error(`application JavaScript exceeds gzip budget: ${appJavaScriptBytes}`);
