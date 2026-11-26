import assert from "node:assert/strict";
import test from "node:test";
import {
  insertNotebookPageBlock,
  parseNotebookContent,
  serializeNotebookContent,
  splitNotebookTextBlock,
} from "./notebook-content.mjs";

test("parses each Markdown line as a block and retains blank lines", () => {
  assert.deepEqual(parseNotebookContent("# Title\n\nA paragraph"), [
    { type: "text", text: "# Title" },
    { type: "text", text: "" },
    { type: "text", text: "A paragraph" },
  ]);
});

test("round-trips inline page blocks in Markdown content", () => {
  const blocks = [
    { type: "text", text: "Before" },
    { type: "page", pageId: "child/page" },
    { type: "text", text: "After" },
  ];

  assert.deepEqual(parseNotebookContent(serializeNotebookContent(blocks)), blocks);
});

test("treats malformed page markers as text", () => {
  const malformed = "<!-- maxhub-page:%E0%A4%A -->";
  assert.deepEqual(parseNotebookContent(malformed), [{ type: "text", text: malformed }]);
});

test("Enter splits the active line at the selection into two text blocks", () => {
  const blocks = [{ type: "text", text: "read this" }];

  assert.deepEqual(splitNotebookTextBlock(blocks, 0, 4, 4), [
    { type: "text", text: "read" },
    { type: "text", text: " this" },
  ]);
});

test("creating a page replaces a slash-command line with a page block and a new line", () => {
  const blocks = [
    { type: "text", text: "Before" },
    { type: "text", text: "/page" },
    { type: "text", text: "After" },
  ];

  assert.deepEqual(insertNotebookPageBlock(blocks, 1, "child", true), [
    { type: "text", text: "Before" },
    { type: "page", pageId: "child" },
    { type: "text", text: "" },
    { type: "text", text: "After" },
  ]);
});
