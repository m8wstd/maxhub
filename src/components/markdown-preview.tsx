import type { ReactNode } from "react";

function inlineMarkdown(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]" key={index}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export function MarkdownPreview({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/).filter(Boolean);
  if (!blocks.length) return <p className="text-sm text-muted-foreground">Nada para visualizar ainda.</p>;

  return (
    <div className="markdown-preview space-y-3">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const heading = /^(#{1,3})\s+(.+)$/.exec(lines[0]);
        if (heading) {
          const level = heading[1].length;
          const className = level === 1 ? "text-xl font-semibold" : level === 2 ? "text-lg font-semibold" : "font-semibold";
          return <div className={className} key={index}>{inlineMarkdown(heading[2])}</div>;
        }
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul className="list-disc space-y-1 pl-5 text-sm" key={index}>
              {lines.map((line, lineIndex) => <li key={lineIndex}>{inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>)}
            </ul>
          );
        }
        return <p className="whitespace-pre-wrap text-sm leading-6" key={index}>{inlineMarkdown(block)}</p>;
      })}
    </div>
  );
}
