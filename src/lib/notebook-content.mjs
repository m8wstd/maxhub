const PAGE_BLOCK_PATTERN = /^<!-- maxhub-page:(.+) -->$/;

export function parseNotebookContent(body) {
  return body.split("\n").map((line) => {
    const match = PAGE_BLOCK_PATTERN.exec(line);
    if (match) {
      try {
        return { type: "page", pageId: decodeURIComponent(match[1]) };
      } catch {
        return { type: "text", text: line };
      }
    }
    return { type: "text", text: line };
  });
}

export function serializeNotebookContent(blocks) {
  return blocks.map((block) =>
    block.type === "page"
      ? `<!-- maxhub-page:${encodeURIComponent(block.pageId)} -->`
      : block.text
  ).join("\n");
}

export function splitNotebookTextBlock(blocks, index, selectionStart, selectionEnd) {
  const block = blocks[index];
  if (!block || block.type !== "text") return blocks;
  return [
    ...blocks.slice(0, index),
    { type: "text", text: block.text.slice(0, selectionStart) },
    { type: "text", text: block.text.slice(selectionEnd) },
    ...blocks.slice(index + 1),
  ];
}

export function insertNotebookPageBlock(blocks, index, pageId, replaceCurrent = false) {
  const next = [...blocks];
  const insertionIndex = replaceCurrent ? index : index + 1;
  next.splice(
    insertionIndex,
    replaceCurrent ? 1 : 0,
    { type: "page", pageId },
    { type: "text", text: "" }
  );
  return next;
}
