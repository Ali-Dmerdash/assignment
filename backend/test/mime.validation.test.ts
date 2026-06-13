import { describe, it, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { detectCvMime } from "../src/middleware/upload.js";

// Fixtures follow a "{realContent}-to-{fakeExtension}" naming convention, e.g.
// image-to-pdf.pdf is a JPEG renamed to .pdf. detectCvMime should key off the
// real content, never the extension.
const FIXTURES_DIR = "test/fixtures";
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Expected detection per real content type (null = rejected).
const EXPECTED: Record<string, string | null> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: DOCX_MIME,
  image: null,
};

describe("CV MIME validation by content (extension is ignored)", () => {
  const files = readdirSync(FIXTURES_DIR);

  it("has fixture files to test", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const realType = file.split("-to-")[0] ?? "";
    if (!(realType in EXPECTED)) continue;
    const expected = EXPECTED[realType]!;
    const label = expected ? `accepts as ${expected}` : "rejects";

    it(`${label}: ${file}`, async () => {
      const buffer = readFileSync(join(FIXTURES_DIR, file));
      expect(await detectCvMime(buffer)).toBe(expected);
    });
  }
});
