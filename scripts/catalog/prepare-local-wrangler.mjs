import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const configPath = path.resolve("dist/server/wrangler.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const database = config.d1_databases?.find(
  (binding) => binding.binding === "DB" || binding.database_name === "site-creator-d1",
);

if (!database) {
  throw new Error("The generated Wrangler config does not contain the DB binding.");
}

// Wrangler resolves this path from dist/server, where vinext writes its config.
database.migrations_dir = "../../drizzle";

await writeFile(configPath, `${JSON.stringify(config)}\n`, "utf8");
console.log("Prepared dist/server/wrangler.json for local D1 migrations.");
