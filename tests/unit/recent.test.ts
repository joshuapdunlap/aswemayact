// tests/unit/recent.test.ts
import { canRebuildFromHistory, parseGitLog, contentPath, recentEntries, LAUNCH_ENTRIES } from "../../src/lib/recent";

const LOG = [
  "\0" + "2026-10-12T01:30:00-05:00",
  "",
  "src/content/trails/the-camera.md",
  "src/content/essays/why-as-we-may-act.md",
  "\0" + "2026-10-11T09:00:00-05:00",
  "",
  "src/content/trails/the-camera.md",
  "src/content/manual/the-clock.md",
  "src/content/sources/deflock.md",
  "",
].join("\n");

test("parseGitLog reads commits newest first with UTC dates", () => {
  expect(parseGitLog(LOG)).toEqual([
    { date: "2026-10-12", files: ["src/content/trails/the-camera.md", "src/content/essays/why-as-we-may-act.md"] },
    { date: "2026-10-11", files: ["src/content/trails/the-camera.md", "src/content/manual/the-clock.md", "src/content/sources/deflock.md"] },
  ]);
});

test("contentPath maps each collection to its page", () => {
  expect(contentPath("src/content/manual/the-clock.md")).toBe("/manual/the-clock/");
  expect(contentPath("src/content/trails/the-lectern.md")).toBe("/trails/the-lectern/");
  expect(contentPath("src/content/essays/why-as-we-may-act.md")).toBe("/about/");
  expect(contentPath("src/content/corrections/2026-10-11-launch.md")).toBe("/corrections/");
  expect(contentPath("src/content/sources/deflock.md")).toBe("/manual/sources/");
  expect(contentPath("src/content/unknown/x.md")).toBeNull();
});

test("recentEntries keeps each page once, at its latest change, and pads to five", () => {
  const titles: Record<string, string> = {
    "src/content/trails/the-camera.md": "The camera",
    "src/content/essays/why-as-we-may-act.md": "Why “As We May Act”",
    "src/content/manual/the-clock.md": "The clock",
    "src/content/sources/deflock.md": "DeFlock",
  };
  const entries = recentEntries(parseGitLog(LOG), (f) => titles[f] ?? null, 5);
  expect(entries.slice(0, 4)).toEqual([
    { path: "/trails/the-camera/", title: "The camera", date: "2026-10-12" },
    { path: "/about/", title: "Why “As We May Act”", date: "2026-10-12" },
    { path: "/manual/the-clock/", title: "The clock", date: "2026-10-11" },
    { path: "/manual/sources/", title: "Source cards", date: "2026-10-11" },
  ]);
  expect(entries).toHaveLength(5);
  // Padding comes from the launch set and never repeats a page already listed.
  expect(LAUNCH_ENTRIES.map((e) => e.path)).toContain(entries[4].path);
  expect(new Set(entries.map((e) => e.path)).size).toBe(5);
});

test("recentEntries with no history is the launch set", () => {
  expect(recentEntries([], () => null, 5)).toEqual(LAUNCH_ENTRIES.slice(0, 5));
});

test("canRebuildFromHistory refuses shallow clones and missing git", () => {
  expect(canRebuildFromHistory("false\n")).toBe(true);
  expect(canRebuildFromHistory("true\n")).toBe(false);
  expect(canRebuildFromHistory(null)).toBe(false);
});
