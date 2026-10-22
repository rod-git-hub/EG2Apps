// Tests for each app's app.json against Even Hub's packaging and submission rules
// (hub.evenrealities.com/docs/ship/packaging, /ship/app-submission, read 2026-10-21).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const APPS = [
  { dir: "apps/eg2notes", name: "EG2Notes", id: "net.techdivision.eg2notes" },
  { dir: "apps/eg2presentation", name: "EG2Presentation", id: "net.techdivision.eg2presentation" },
];
const read = (p) => JSON.parse(readFileSync(p, "utf8"));

for (const app of APPS) {
  const m = read(`${app.dir}/app.json`);
  const pkg = read(`${app.dir}/package.json`);

  test(`${app.name}: identity`, () => {
    assert.equal(m.package_id, app.id);
    assert.match(m.package_id, /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/); // reverse-domain, no hyphens or underscores
    assert.equal(m.name, app.name);
    assert.ok(m.name.length <= 20, "name must be 20 characters or fewer");
    assert.doesNotMatch(m.name, /even/i, 'name must not contain "Even"');
    assert.equal(m.edition, "202601");
    assert.match(m.version, /^\d+\.\d+\.\d+$/);
  });

  test(`${app.name}: no permissions at all`, () => {
    assert.deepEqual(m.permissions, []);
  });

  test(`${app.name}: SDK version, entry page, languages`, () => {
    assert.equal(m.min_sdk_version, pkg.dependencies["@evenrealities/even_hub_sdk"]);
    assert.equal(m.entrypoint, "index.html");
    assert.ok(existsSync(`${app.dir}/index.html`));
    assert.deepEqual(m.supported_languages, ["en"]);
  });
}
