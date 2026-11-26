export type NotebookContentBlock =
  | { type: "text"; text: string }
  | { type: "page"; pageId: string };

export function parseNotebookContent(body: string): NotebookContentBlock[];
export function serializeNotebookContent(blocks: NotebookContentBlock[]): string;
export function splitNotebookTextBlock(
  blocks: NotebookContentBlock[],
  index: number,
  selectionStart: number,
  selectionEnd: number,
): NotebookContentBlock[];
export function insertNotebookPageBlock(
  blocks: NotebookContentBlock[],
  index: number,
  pageId: string,
  replaceCurrent?: boolean,
): NotebookContentBlock[];
