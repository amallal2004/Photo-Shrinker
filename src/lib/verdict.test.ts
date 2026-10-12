import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluate, softnessNote } from "./verdict";
import type { VerdictInput } from "./verdict";

function input(overrides: Partial<VerdictInput> = {}): VerdictInput {
  return {
    bytes: 900_000,
    width: 1000,
    height: 750,
    targetBytes: 1_000_000,
    minWidth: 0,
    minHeight: 0,
    exactWidth: null,
    exactHeight: null,
    ...overrides,
  };
}

test("passes when under the limit with no size constraints", () => {
  const result = evaluate(input());
  assert.equal(result.level, "pass");
  assert.deepEqual(result.failures, []);
});

test("fails when over the byte limit", () => {
  const result = evaluate(input({ bytes: 2_500_000, targetBytes: 1_000_000 }));
  assert.equal(result.level, "fail");
  assert.match(result.failures[0], /Over the limit by 1\.5 MB/);
});

test("treats the byte ceiling as inclusive", () => {
  const result = evaluate(input({ bytes: 1_000_000, targetBytes: 1_000_000 }));
  assert.equal(result.level, "pass");
});

test("fails when the image is under the portal's minimum width", () => {
  const result = evaluate(input({ minWidth: 1200 }));
  assert.equal(result.level, "fail");
  assert.match(result.failures[0], /Too small: 1000px wide/);
});

test("fails when the image is under the portal's minimum height", () => {
  const result = evaluate(input({ minHeight: 800 }));
  assert.equal(result.level, "fail");
  assert.match(result.failures[0], /Too small: 750px tall/);
});

test("reports every failure at once rather than only the first", () => {
  const result = evaluate(
    input({ bytes: 3_000_000, minWidth: 1200, minHeight: 800 }),
  );
  assert.equal(result.failures.length, 3);
});

test("exact dimensions override the minimum-size check", () => {
  const ok = evaluate(input({ exactWidth: 1000, exactHeight: 750 }));
  assert.equal(ok.level, "pass");

  const wrong = evaluate(input({ exactWidth: 600, exactHeight: 600 }));
  assert.equal(wrong.level, "fail");
  assert.match(wrong.failures[0], /Expected exactly 600×600px/);
});

test("softness note appears only for heavy downscaling", () => {
  // Unchanged and mildly reduced stay under the threshold...
  assert.equal(softnessNote(4000, 3000, 4000, 3000), null);
  assert.equal(softnessNote(4000, 3000, 3000, 2250), null);

  // ...while halving each edge leaves only 25% of the pixels.
  const note = softnessNote(4000, 3000, 600, 450);
  assert.ok(note);
  assert.match(note, /2%/);
});