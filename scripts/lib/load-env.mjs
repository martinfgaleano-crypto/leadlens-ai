// Shared env loader for readiness/seed scripts. Parses .env.local and .env
// into a plain object WITHOUT printing any values. process.env wins.
import { readFileSync, existsSync } from "node:fs";

export function loadEnv(root = process.cwd()) {
  const env = {};
  for (const file of [".env", ".env.local"]) {
    const path = `${root}/${file}`;
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return { ...env, ...process.env };
}

/** Presence only — never the value. */
export function has(env, key) {
  return typeof env[key] === "string" && env[key].trim().length > 0;
}
