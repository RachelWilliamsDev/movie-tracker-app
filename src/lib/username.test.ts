import assert from "node:assert/strict";
import test from "node:test";
import {
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  normalizeUsernameForDb,
  parseUsername
} from "@/lib/username";

test("parseUsername accepts valid usernames and lowercases", () => {
  assert.deepEqual(parseUsername("Ada_Lovelace42"), {
    ok: true,
    username: "ada_lovelace42"
  });
  assert.deepEqual(parseUsername("  abc  "), { ok: true, username: "abc" });
  assert.deepEqual(parseUsername("A"), {
    ok: false,
    error: {
      code: "USERNAME_TOO_SHORT",
      message: `Username must be at least ${USERNAME_MIN_LENGTH} characters.`
    }
  });
});

test("parseUsername rejects empty and whitespace-only", () => {
  assert.equal(parseUsername("").ok, false);
  assert.equal(parseUsername("   ").ok, false);
  assert.equal(parseUsername(null).ok, false);
  assert.equal(parseUsername(undefined).ok, false);
  const empty = parseUsername("");
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.error.code, "USERNAME_EMPTY");
});

test("parseUsername rejects too short boundary", () => {
  const s = "a".repeat(USERNAME_MIN_LENGTH - 1);
  const r = parseUsername(s);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "USERNAME_TOO_SHORT");
});

test("parseUsername accepts min length boundary", () => {
  const s = "a".repeat(USERNAME_MIN_LENGTH);
  assert.deepEqual(parseUsername(s), { ok: true, username: s });
});

test("parseUsername rejects too long boundary", () => {
  const s = "a".repeat(USERNAME_MAX_LENGTH + 1);
  const r = parseUsername(s);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "USERNAME_TOO_LONG");
});

test("parseUsername accepts max length boundary", () => {
  const s = "a".repeat(USERNAME_MAX_LENGTH);
  assert.deepEqual(parseUsername(s), { ok: true, username: s });
});

test("parseUsername rejects invalid characters", () => {
  const cases = ["bad-hyphen", "dot.name", "space here", "unicodeé", "at@sign"];
  for (const c of cases) {
    const r = parseUsername(c);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "USERNAME_INVALID_CHARS");
  }
});

test("parseUsername rejects inner invalid chars after trim", () => {
  const r = parseUsername("  x@y  ");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error.code, "USERNAME_INVALID_CHARS");
});

test("normalizeUsernameForDb trims lowercases and maps empty to null", () => {
  assert.equal(normalizeUsernameForDb("  Ada "), "ada");
  assert.equal(normalizeUsernameForDb(""), null);
  assert.equal(normalizeUsernameForDb("   "), null);
  assert.equal(normalizeUsernameForDb(null), null);
  assert.equal(normalizeUsernameForDb(undefined), null);
});
