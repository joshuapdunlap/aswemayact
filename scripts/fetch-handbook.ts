// Downloads the Attorney General's FOIA handbook and writes its text to
// .content-rules/handbook-22.txt, which `npm run check` uses to verify every
// "What the law says" quotation and page note in the field manual. The text file is the
// AG's publication, so it stays local (gitignored), like the excluded-names list.
// Needs `pdftotext` (poppler; it ships with Git for Windows) on the PATH.
// Usage: npm run handbook
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = "https://media.ark.org/ag/APA-045-2026-FOIA-Handbook-22nd-Edition.pdf";
const OUT = ".content-rules/handbook-22.txt";

async function main() {
  const res = await fetch(URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);
  const dir = mkdtempSync(join(tmpdir(), "handbook-"));
  try {
    const pdf = join(dir, "handbook.pdf");
    writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
    mkdirSync(".content-rules", { recursive: true });
    try {
      execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", pdf, OUT], { stdio: "inherit" });
    } catch {
      throw new Error("pdftotext failed or is not installed; install poppler and run again");
    }
    console.log(`fetch-handbook: wrote ${OUT}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(`fetch-handbook: ${(e as Error).message}`);
  process.exit(1);
});
