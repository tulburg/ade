// Usage: npm run validate -- <file.ade.json>
import { readFileSync } from "node:fs";
import { validate } from "../src/format/validate.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: ade-validate <file.ade.json>");
  process.exit(2);
}
let doc: unknown;
try {
  doc = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  console.error(`${file}: not valid JSON: ${(e as Error).message}`);
  process.exit(1);
}
const issues = validate(doc);
for (const i of issues) console.log(`${file}: ${i.path} ${i.message}`);
console.log(issues.length ? `${issues.length} issue(s)` : `${file}: valid`);
process.exit(issues.length ? 1 : 0);
