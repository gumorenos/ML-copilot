import { readFile } from "node:fs/promises";

const configPath = process.argv[2];
if (!configPath) throw new Error("Usage: npm run staging:validate -- wrangler.staging.local.jsonc");

const source = await readFile(configPath, "utf8");
const normalized = source.toLowerCase();
const forbidden = [
  "00000000-0000-0000-0000-000000000000",
  "replace-with-",
  "replace_with_",
  "<staging-hostname>",
  ".example/phase0/",
];
const found = forbidden.filter((marker) => normalized.includes(marker));
if (found.length > 0) throw new Error(`Staging config contains placeholder values: ${found.join(", ")}`);

const databaseId = source.match(/"database_id"\s*:\s*"([^"]+)"/)?.[1];
if (!databaseId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(databaseId)) {
  throw new Error("Staging config must contain a real UUID D1 database_id");
}
const redirect = source.match(/"ML_REDIRECT_URI"\s*:\s*"([^"]+)"/)?.[1];
if (!redirect || !redirect.startsWith("https://") || !redirect.endsWith("/phase0/oauth/callback")) {
  throw new Error("Staging ML_REDIRECT_URI must be an HTTPS callback ending in /phase0/oauth/callback");
}
for (const key of ["ML_CLIENT_ID", "ML_API_BASE_URL", "ML_REDIRECT_URI"]) {
  const value = source.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`))?.[1];
  if (!value) throw new Error(`Staging config is missing vars.${key}`);
}
console.log(`Staging config ${configPath} passed placeholder, D1 UUID, and callback validation.`);
