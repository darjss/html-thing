import { expect, test } from "vite-plus/test";
import { generateSlug, SLUG_LENGTH } from "../src/index.ts";

test("generateSlug returns the requested length", () => {
  expect(generateSlug()).toHaveLength(SLUG_LENGTH);
  expect(generateSlug(10)).toHaveLength(10);
});

test("generateSlug uses only base62 characters", () => {
  const slug = generateSlug(100);
  expect(slug).toMatch(/^[A-Za-z0-9]+$/);
});

test("generateSlug is random across calls", () => {
  const a = generateSlug(12);
  const b = generateSlug(12);
  expect(a).not.toBe(b);
});
