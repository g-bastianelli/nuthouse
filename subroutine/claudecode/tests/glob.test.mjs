import { expect, test } from "bun:test";
import { matchGlob } from "../hooks/lib/glob.mjs";

test("**/*.ts matches absolute, nested, and bare .ts paths", () => {
  expect(matchGlob("**/*.ts", "/Users/x/proj/src/foo.ts")).toBe(true);
  expect(matchGlob("**/*.ts", "foo.ts")).toBe(true);
  expect(matchGlob("**/*.ts", "/a/b/c/d.ts")).toBe(true);
});

test("**/*.ts does NOT match .tsx (extension is exact)", () => {
  expect(matchGlob("**/*.ts", "/Users/x/Button.tsx")).toBe(false);
});

test("**/*.tsx matches .tsx but not .ts", () => {
  expect(matchGlob("**/*.tsx", "/Users/x/Button.tsx")).toBe(true);
  expect(matchGlob("**/*.tsx", "/Users/x/util.ts")).toBe(false);
});

test("**/use*.ts matches use-prefixed hooks anywhere", () => {
  expect(matchGlob("**/use*.ts", "/app/src/useAuth.ts")).toBe(true);
  expect(matchGlob("**/use*.ts", "/app/useAuth.ts")).toBe(true);
  expect(matchGlob("**/use*.ts", "/app/src/auth.ts")).toBe(false);
});

test("**/hooks/**/*.ts matches files under a hooks dir at any depth", () => {
  expect(matchGlob("**/hooks/**/*.ts", "/a/hooks/useThing.ts")).toBe(true);
  expect(matchGlob("**/hooks/**/*.ts", "/a/b/hooks/sub/useThing.ts")).toBe(true);
  expect(matchGlob("**/hooks/**/*.ts", "/a/components/Button.ts")).toBe(false);
});

test("brace alternation expands", () => {
  expect(matchGlob("**/*.{ts,tsx}", "/a/foo.ts")).toBe(true);
  expect(matchGlob("**/*.{ts,tsx}", "/a/foo.tsx")).toBe(true);
  expect(matchGlob("**/*.{ts,tsx}", "/a/foo.js")).toBe(false);
});

test("dots are literal, not regex wildcards", () => {
  expect(matchGlob("**/*.ts", "/a/footsx")).toBe(false);
  expect(matchGlob("**/*.ts", "/a/fooXts")).toBe(false);
});

test("backslash paths are normalised", () => {
  expect(matchGlob("**/*.ts", "C:\\proj\\src\\foo.ts")).toBe(true);
});

test("empty / nullish path never matches", () => {
  expect(matchGlob("**/*.ts", "")).toBe(false);
  expect(matchGlob("**/*.ts", null)).toBe(false);
});
