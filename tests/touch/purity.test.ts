/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const SOURCES = import.meta.glob("../../src/**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const LOADERS = import.meta.glob("../../src/touch/*.ts");

const PURE_NAMES = ["geometry", "device", "mode", "controls", "repeat", "pointers", "dispatch", "back", "layout-menus", "layout-gameplay", "layouts", "keymap"];
const PURE = PURE_NAMES.map((n) => `../../src/touch/${n}.ts`);
const ALLOWED = new Set([...PURE, "../../src/config.ts"]);

const FORBIDDEN = /\b(window|document|navigator|matchMedia|globalThis|localStorage|sessionStorage|requestAnimationFrame|HTMLElement|HTMLCanvasElement|PointerEvent|KeyboardEvent|MouseEvent|TouchEvent|CanvasRenderingContext2D)\b|\bhistory\./;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function specifiers(src: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null = re.exec(src);
  while (m !== null) {
    out.push(m[1]);
    m = re.exec(src);
  }
  return out;
}

function resolveSpec(fromKey: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const dir = fromKey.slice(0, fromKey.lastIndexOf("/"));
  const parts = [...dir.split("/"), ...spec.split("/")];
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") {
      const top = stack[stack.length - 1];
      if (top !== undefined && top !== "..") stack.pop();
      else stack.push("..");
    } else {
      stack.push(p);
    }
  }
  const joined = stack.join("/");
  return `${joined}.ts` in SOURCES ? `${joined}.ts` : `${joined}/index.ts`;
}

function closure(entry: string): Set<string> {
  const result = new Set<string>([entry]);
  const visited = new Set<string>();
  const queue: string[] = [entry];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!(key in SOURCES)) continue;
    for (const spec of specifiers(stripComments(SOURCES[key]))) {
      if (!spec.startsWith(".")) {
        result.add(spec);
      } else {
        const resolved = resolveSpec(key, spec);
        result.add(resolved);
        if (resolved in SOURCES && !visited.has(resolved)) {
          queue.push(resolved);
        }
      }
    }
  }
  return result;
}

describe("touch purity", () => {
  it("every pure module exists in SOURCES", () => {
    for (const name of PURE_NAMES) {
      const key = `../../src/touch/${name}.ts`;
      expect(key in SOURCES, `missing source: ${name}`).toBe(true);
    }
  });

  for (const name of PURE_NAMES) {
    it(name, () => {
      const key = `../../src/touch/${name}.ts`;
      const hit = FORBIDDEN.exec(stripComments(SOURCES[key]));
      expect(hit ? hit[0] : null, `forbidden global in ${name}`).toBeNull();
      const offenders = [...closure(key)].filter((k) => !ALLOWED.has(k));
      expect(offenders, `disallowed imports reachable from ${name}`).toEqual([]);
    });
  }

  it("config.ts has no forbidden globals", () => {
    const hit = FORBIDDEN.exec(stripComments(SOURCES["../../src/config.ts"]));
    expect(hit ? hit[0] : null, "forbidden global in config.ts").toBeNull();
  });

  for (const name of PURE_NAMES) {
    it(name, async () => {
      const key = `../../src/touch/${name}.ts`;
      const mod = await LOADERS[key]();
      expect(typeof mod).toBe("object");
    });
  }
});

describe("scanner self-check", () => {
  it("flags browser APIs in a browser-side file", () => {
    expect(stripComments(SOURCES["../../src/touch/dom-input.ts"])).toMatch(FORBIDDEN);
  });

  it("flags imports outside the pure set", () => {
    const reached = [...closure("../../src/app.ts")];
    expect(reached.some((k) => !ALLOWED.has(k))).toBe(true);
  });
});
