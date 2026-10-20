import assert from "node:assert/strict";
import test from "node:test";
import { extractUpload, FileExtractionError, splitExtractedText } from "../lib/file-extractors";

test("extracts a text upload into searchable metadata", async () => {
  const file = new File(["Project decision: start with citations."], "project-note.txt", { type: "text/plain" });
  const result = await extractUpload(file);
  assert.equal(result.length, 1);
  assert.equal(result[0].input.title, "project note");
  assert.equal(result[0].input.content, "Project decision: start with citations.");
  assert.deepEqual(result[0].input.tags, ["upload", "txt"]);
  assert.equal(result[0].input.metadata?.sourceType, "upload");
  assert.equal(result[0].input.metadata?.extractor, "text");
  assert.equal(result[0].input.metadata?.originalName, "project-note.txt");
});

test("chunks long uploads below the existing memory limit", async () => {
  const file = new File([`${"A useful sentence. ".repeat(650)}`], "long.md", { type: "text/markdown" });
  const result = await extractUpload(file);
  assert.ok(result.length > 1);
  assert.ok(result.every((item) => item.input.content.length <= 7800));
  assert.equal(result[0].input.metadata?.chunkCount, result.length);
  assert.equal(result.at(-1)?.input.metadata?.chunkIndex, result.length - 1);
});

test("rejects extension and content mismatches", async () => {
  const file = new File(["not a pdf"], "fake.pdf", { type: "application/pdf" });
  await assert.rejects(() => extractUpload(file), (error: unknown) => error instanceof FileExtractionError && error.code === "INVALID_FILE");
});

test("rejects unsupported formats and empty files", async () => {
  const unsupported = new File(["data"], "archive.zip", { type: "application/zip" });
  await assert.rejects(() => extractUpload(unsupported), (error: unknown) => error instanceof FileExtractionError && error.code === "UNSUPPORTED_FILE_TYPE");
  const empty = new File([], "empty.txt", { type: "text/plain" });
  await assert.rejects(() => extractUpload(empty), (error: unknown) => error instanceof FileExtractionError && error.code === "INVALID_FILE");
});

test("splitExtractedText preserves content without silently truncating", () => {
  const chunks = splitExtractedText("one\n\ntwo\n\nthree", 9);
  assert.deepEqual(chunks, ["one\n\ntwo", "three"]);
});
