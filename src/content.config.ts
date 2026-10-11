import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { STOP_TYPES, isValidStatute } from "./lib/content-rules";

const statute = z.string().refine(isValidStatute, {
  message: "statute must match § 25-19-ddd(x)(y)…",
});

const stop = z
  .object({
    type: z.enum(STOP_TYPES),
    title: z.string(),
    source: z.string().url().or(z.string().min(1)),
    locator: z.string().optional(),
    archived: z.string().url().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.type === "passage" && !s.locator?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["locator"],
        message: "passage stops require a locator",
      });
    }
  });

const md = (dir: string) => glob({ pattern: "**/*.md", base: `./src/content/${dir}` });

const manual = defineCollection({
  loader: md("manual"),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    reviewed: z.coerce.date(),
    sources: z.array(z.string().min(1)),
    statutes: z.array(statute),
    printable: z.boolean(),
    order: z.number(),
  }),
});

const trails = defineCollection({
  loader: md("trails"),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    dateline: z.string(),
    author: z.string(),
    summary: z.string(),
    stops: z.array(stop).min(1),
  }),
});

const sources = defineCollection({
  loader: md("sources"),
  schema: z.object({
    name: z.string(),
    holder: z.string(),
    whatItHolds: z.string(),
    cost: z.string(),
    limits: z.string(),
    url: z.string().url(),
    checked: z.coerce.date(),
  }),
});

const essays = defineCollection({
  loader: md("essays"),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    dateline: z.string(),
    summary: z.string(),
    reviewed: z.coerce.date(),
  }),
});

const corrections = defineCollection({
  loader: md("corrections"),
  schema: z.object({
    page: z.string(),
    date: z.coerce.date(),
    was: z.string(),
    now: z.string(),
  }),
});

export const collections = { manual, trails, sources, essays, corrections };
