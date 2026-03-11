"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * Parses a subset of Markdown into React elements styled for a documentation layout.
 *
 * Supported blocks:
 *   # H1, ## H2, ### H3, #### H4
 *   - / * unordered lists  (one level of nesting via indentation)
 *   1. ordered lists
 *   > blockquotes
 *   ``` fenced code blocks
 *   --- / *** horizontal rules
 *   blank lines = paragraph breaks
 *
 * Supported inline:
 *   **bold**  *italic*  `code`
 */

// ────────────────────────────────── inline ─────────────────
function renderInline(text: string) {
  // Split on **bold**, *italic*, and `code` markers
  const parts: (string | React.ReactElement)[] = [];
  // regex: **bold** | *italic* | `code`
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // push text before match
    if (match.index > cursor) {
      parts.push(text.slice(cursor, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[2]}
        </strong>,
      );
    } else if (match[4]) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic">
          {match[4]}
        </em>,
      );
    } else if (match[6]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {match[6]}
        </code>,
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

// ────────────────────────────────── types ──────────────────
interface Block {
  type:
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "paragraph"
    | "ul"
    | "ol"
    | "blockquote"
    | "code"
    | "hr";
  content: string;
  items?: string[];
  lang?: string;
  id?: string;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// ────────────────────────────────── parser ─────────────────
function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", content: codeLines.join("\n"), lang });
      continue;
    }

    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr", content: "" });
      i++;
      continue;
    }

    // headings
    if (line.startsWith("#### ")) {
      const text = line.slice(5);
      blocks.push({ type: "h4", content: text, id: slugify(text) });
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      const text = line.slice(4);
      blocks.push({ type: "h3", content: text, id: slugify(text) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      const text = line.slice(3);
      blocks.push({ type: "h2", content: text, id: slugify(text) });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      const text = line.slice(2);
      blocks.push({ type: "h1", content: text, id: slugify(text) });
      i++;
      continue;
    }

    // blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join(" ") });
      continue;
    }

    // unordered list
    if (/^[\s]*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[\s]*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*]\s/, ""));
        i++;
      }
      blocks.push({ type: "ul", content: "", items });
      continue;
    }

    // ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", content: "", items });
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // paragraph: collect consecutive non-empty, non-special lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("```") &&
      !/^[-*]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join(" ") });
    }
  }

  return blocks;
}

// ────────────────────────────────── TOC ────────────────────
export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

export function extractToc(markdown: string): TocEntry[] {
  const blocks = parseBlocks(markdown);
  return blocks
    .filter(
      (b) => (b.type === "h1" || b.type === "h2" || b.type === "h3") && b.id,
    )
    .map((b) => ({
      id: b.id!,
      text: b.content,
      level: b.type === "h1" ? 1 : b.type === "h2" ? 2 : 3,
    }));
}

// ────────────────────────────────── renderer ───────────────
interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={cn("deepdive-prose", className)}>
      {blocks.map((block, i) => {
        const key = `block-${i}`;
        switch (block.type) {
          case "h1":
            return (
              <h1
                key={key}
                id={block.id}
                className="mb-4 mt-2 scroll-mt-20 text-3xl font-bold tracking-tight text-foreground"
              >
                {renderInline(block.content)}
              </h1>
            );
          case "h2":
            return (
              <h2
                key={key}
                id={block.id}
                className="mb-3 mt-10 scroll-mt-20 border-b border-border pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0"
              >
                {renderInline(block.content)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={key}
                id={block.id}
                className="mb-2 mt-8 scroll-mt-20 text-xl font-semibold text-foreground"
              >
                {renderInline(block.content)}
              </h3>
            );
          case "h4":
            return (
              <h4
                key={key}
                id={block.id}
                className="mb-2 mt-6 scroll-mt-20 text-lg font-medium text-foreground"
              >
                {renderInline(block.content)}
              </h4>
            );
          case "paragraph":
            return (
              <p
                key={key}
                className="mb-4 text-base leading-7 text-muted-foreground"
              >
                {renderInline(block.content)}
              </p>
            );
          case "ul":
            return (
              <ul key={key} className="mb-4 ml-6 list-disc space-y-1.5">
                {block.items?.map((item, j) => (
                  <li
                    key={`${key}-li-${j}`}
                    className="text-base leading-7 text-muted-foreground"
                  >
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="mb-4 ml-6 list-decimal space-y-1.5">
                {block.items?.map((item, j) => (
                  <li
                    key={`${key}-li-${j}`}
                    className="text-base leading-7 text-muted-foreground"
                  >
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );
          case "blockquote":
            return (
              <blockquote
                key={key}
                className="mb-4 border-l-4 border-primary/30 py-1 pl-4 italic text-muted-foreground"
              >
                <p className="text-base leading-7">
                  {renderInline(block.content)}
                </p>
              </blockquote>
            );
          case "code":
            return (
              <div
                key={key}
                className="mb-4 overflow-hidden rounded-lg border border-border"
              >
                {block.lang && (
                  <div className="border-b border-border bg-muted/50 px-4 py-1.5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {block.lang}
                    </span>
                  </div>
                )}
                <pre className="overflow-x-auto bg-muted/30 p-4">
                  <code className="font-mono text-sm leading-6 text-foreground">
                    {block.content}
                  </code>
                </pre>
              </div>
            );
          case "hr":
            return <hr key={key} className="my-8 border-border" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
