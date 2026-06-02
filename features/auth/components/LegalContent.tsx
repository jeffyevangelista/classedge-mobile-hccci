import { AppText } from "@/components/AppText";
import { useMemo } from "react";
import { Text, View } from "react-native";

/**
 * Lightweight markdown renderer for legal-doc content.
 *
 * Supports:
 *  - Paragraphs separated by blank lines
 *  - `\d+. Title` as a section heading (rest of paragraph becomes body)
 *  - `- ` or `* ` bullet lists (mixed within a paragraph)
 *  - Inline `**bold**` spans
 *  - Multi-line paragraphs preserve their line breaks
 */
type InlineSpan = { text: string; bold?: boolean };
type ContentBlock =
  | { kind: "heading"; spans: InlineSpan[] }
  | { kind: "paragraph"; spans: InlineSpan[] }
  | { kind: "list"; items: InlineSpan[][] };

const HEADING_RE = /^(\d+)\.\s+(.+)$/;
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

    const headingMatch = lines[0].match(HEADING_RE);
    if (headingMatch) {
      blocks.push({ kind: "heading", spans: parseInline(headingMatch[2]) });
      if (lines.length > 1) pushMixedLines(blocks, lines.slice(1));
      continue;
    }

    pushMixedLines(blocks, lines);
  }
  return blocks;
}

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
              className={`text-base text-foreground mb-2 ${i === 0 ? "" : "mt-5"}`}
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
          <AppText
            key={i}
            className="text-sm text-foreground leading-6 mb-3"
          >
            {renderSpans(block.spans)}
          </AppText>
        );
      })}
    </>
  );
};
