// Tests for scripts/hygiene-check.mjs. Private-looking values are assembled at runtime so
// this file itself passes the check.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeny, scanText } from "../scripts/hygiene-check.mjs";

const rules = (text, deny) => scanText("docs/x.md", text, deny).map((f) => f.rule);

test("flags private IPv4 addresses, not public or loopback ones", () => {
  assert.deepEqual(rules("server at " + "192.168" + ".1.20"), ["private IP address"]);
  assert.deepEqual(rules("vpn " + "10.0" + ".0.7"), ["private IP address"]);
  assert.deepEqual(rules("lab " + "172.20" + ".3.4"), ["private IP address"]);
  assert.deepEqual(rules("dev server http://127.0.0.1:5173"), []);
  assert.deepEqual(rules("version 1.2.3"), []);
});

test("flags email addresses except example and GitHub noreply domains", () => {
  assert.deepEqual(rules("mail " + "someone" + "@" + "realmail.net"), ["email address"]);
  assert.deepEqual(rules("user@example.com"), []);
  assert.deepEqual(rules("123+someone@users.noreply.github.com"), []);
});

test("flags home-folder paths", () => {
  assert.deepEqual(rules("see /" + "home/" + "someone/notes"), ["home-folder path"]);
  assert.deepEqual(rules("see ~/Documents/x"), []);
});

test("allows the domain only inside the two package ids", () => {
  const word = "tech" + "division";
  assert.deepEqual(rules(`"package_id": "net.${word}.eg2notes"`), []);
  assert.deepEqual(rules(`net.${word}.eg2presentation`), []);
  assert.deepEqual(rules(`https://app.${word}.net`), ["domain name outside the package ids"]);
  assert.deepEqual(rules(`net.${word}.other`), ["domain name outside the package ids"]);
});

test("local deny list matches case-insensitively and skips comments", () => {
  const deny = parseDeny("# private strings\n\nSecretHost\n");
  assert.deepEqual(deny, ["secrethost"]);
  assert.deepEqual(rules("connect to secretHOST now", deny), ["local deny list"]);
});

test("allow marker skips a line; line numbers are reported", () => {
  assert.deepEqual(rules("lab " + "10.1" + ".2.3 // hygiene-check: allow"), []);
  assert.equal(scanText("a.md", "ok\nlab " + "10.1" + ".2.3")[0].line, 2);
});
