import { useMemo } from "react";
import { Text, View } from "react-native";
import { AppText } from "@/components/AppText";

/**
 * Lightweight markdown renderer for legal-doc content.
 *
 * Supports:
 *  - Paragraphs separated by blank lines
 *  - ATX headings (`#`, `##`, `###`) with size scaled per level
 *  - `- ` or `* ` bullet lists (mixed within a paragraph)
 *  - Inline `**bold**` spans
 *  - Multi-line paragraphs preserve their line breaks
 */
type HeadingLevel = 1 | 2 | 3;
type InlineSpan = { text: string; bold?: boolean };
type ContentBlock =
  | { kind: "heading"; level: HeadingLevel; spans: InlineSpan[] }
  | { kind: "paragraph"; spans: InlineSpan[] }
  | { kind: "list"; items: InlineSpan[][] };

const ATX_HEADING_RE = /^(#{1,6})\s+(.+)$/;
const BULLET_RE = /^[-*]\s+(.+)$/;
const BOLD_RE = /\*\*(.+?)\*\*/g;

function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  BOLD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BOLD_RE.exec(text)) !== null) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) });
    spans.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  if (spans.length === 0) spans.push({ text });
  return spans;
}

function pushMixedLines(blocks: ContentBlock[], lines: string[]) {
  let textBuffer: string[] = [];
  let listBuffer: InlineSpan[][] = [];

  const flushText = () => {
    if (textBuffer.length === 0) return;
    blocks.push({
      kind: "paragraph",
      spans: parseInline(textBuffer.join("\n")),
    });
    textBuffer = [];
  };
  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push({ kind: "list", items: listBuffer });
    listBuffer = [];
  };

  for (const line of lines) {
    const bullet = line.match(BULLET_RE);
    if (bullet) {
      flushText();
      listBuffer.push(parseInline(bullet[1]));
    } else {
      flushList();
      textBuffer.push(line);
    }
  }
  flushText();
  flushList();
}

function parseContent(raw: string): ContentBlock[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n");

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const blocks: ContentBlock[] = [];
  for (const para of paragraphs) {
    const lines = para
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const headingMatch = lines[0].match(ATX_HEADING_RE);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 3) as HeadingLevel;
      blocks.push({
        kind: "heading",
        level,
        spans: parseInline(headingMatch[2]),
      });
      if (lines.length > 1) pushMixedLines(blocks, lines.slice(1));
      continue;
    }

    pushMixedLines(blocks, lines);
  }

  if (blocks[0]?.kind === "heading" && blocks[0].level === 1) {
    blocks.shift();
  }
  return blocks;
}

const HEADING_STYLES: Record<HeadingLevel, { size: string; top: string }> = {
  1: { size: "text-xl", top: "mt-6" },
  2: { size: "text-base", top: "mt-5" },
  3: { size: "text-sm", top: "mt-4" },
};

const headingClassName = (level: HeadingLevel, isFirst: boolean) => {
  const { size, top } = HEADING_STYLES[level];
  return `${size} text-foreground mb-2 ${isFirst ? "" : top}`;
};

const renderSpans = (spans: InlineSpan[]) =>
  spans.map((s, i) =>
    s.bold ? (
      <Text key={i} style={{ fontFamily: "Poppins-SemiBold" }}>
        {s.text}
      </Text>
    ) : (
      s.text
    ),
  );

export const LegalContent = ({ content }: { content: string }) => {
  const blocks = useMemo(() => parseContent(content), [content]);

  return (
    <>
      {blocks.map((block, i) => {
        if (block.kind === "heading") {
          return (
            <AppText
              key={i}
              weight="bold"
              className={headingClassName(block.level, i === 0)}
            >
              {renderSpans(block.spans)}
            </AppText>
          );
        }
        if (block.kind === "list") {
          return (
            <View key={i} className="mb-3 gap-1.5">
              {block.items.map((item, j) => (
                <View key={j} className="flex-row">
                  <AppText className="text-sm text-foreground leading-6">
                    {"\u2022 "}
                  </AppText>
                  <AppText className="text-sm text-foreground leading-6 flex-1">
                    {renderSpans(item)}
                  </AppText>
                </View>
              ))}
            </View>
          );
        }
        return (
          <AppText key={i} className="text-sm text-foreground leading-6 mb-3">
            {renderSpans(block.spans)}
          </AppText>
        );
      })}
    </>
  );
};
