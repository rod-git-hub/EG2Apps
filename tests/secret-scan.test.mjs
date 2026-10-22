// Tests for scripts/secret-scan.mjs. Fake secrets are assembled at runtime so
// this file itself never contains anything that looks like a real secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "../scripts/secret-scan.mjs";

const fake = {
  anthropic: "sk-" + "ant-" + "api03-" + "a".repeat(40),
  github: "ghp" + "_" + "b".repeat(36),
  githubFineGrained: "github" + "_pat_" + "c".repeat(60),
  aws: "AKIA" + "D".repeat(16),
  privateKey: "-----BEGIN OPENSSH " + "PRIVATE KEY-----",
};

test("detects each secret type", () => {
  for (const [kind, value] of Object.entries(fake)) {
    const findings = scanText("src/config.ts", `const x = "${value}";`);
    assert.ok(findings.length > 0, `should detect ${kind}`);
  }
});

test("detects hard-coded secret assignments", () => {
  const findings = scanText("src/app.ts", `const apiKey = "${"z".repeat(24)}";`);
  assert.equal(findings[0]?.rule, "Hard-coded secret assignment");
});

test("flags committed .env files but not .env.example", () => {
  assert.equal(scanText(".env", "").length, 1);
  assert.equal(scanText("config/.env.local", "").length, 1);
  assert.equal(scanText("config/.env.example", "EXAMPLE_SETTING=").length, 0);
});

test("ignores normal text and allow-listed lines", () => {
  assert.equal(scanText("docs/plan.md", "The API key lives only on the server.").length, 0);
  assert.equal(scanText("x.ts", `token = "${"q".repeat(20)}" // secret-scan: allow`).length, 0);
});

test("reports the line number", () => {
  const findings = scanText("a.ts", `line one\nconst t = "${fake.github}";`);
  assert.equal(findings[0].line, 2);
});
