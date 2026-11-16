import type { ReactNode } from "react";

/**
 * Small, safe renderer for the article bodies stored in `posts.body`.
 *
 * It understands only what the writing needs — paragraphs, `##`/`###` headings,
 * `>` quotes, bullet and numbered lists, bold, italic and http(s) links — and it builds React
 * elements rather than injecting HTML, so nothing a future editor writes into the
 * database can become script on a public page.
 */

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_PATTERN).filter((part) => part !== "");
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${String(index)}`;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) return <strong key={key}>{bold[1]}</strong>;
    const italic = /^\*([^*]+)\*$/.exec(part);
    if (italic) return <em key={key}>{italic[1]}</em>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
    if (link) {
      return (
        <a
          key={key}
          href={link[2]}
          rel="noopener noreferrer nofollow"
          target="_blank"
          className="font-semibold text-brand-700 underline"
        >
          {link[1]}
        </a>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function ArticleBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="article-body max-w-none">
      {blocks.map((block, blockIndex) => {
        const key = `block-${String(blockIndex)}`;
        if (block.startsWith("## ")) {
          return <h2 key={key}>{block.slice(3)}</h2>;
        }
        if (block.startsWith("### ")) {
          return <h3 key={key}>{block.slice(4)}</h3>;
        }
        const lines = block.split("\n").map((line) => line.trim());
        if (lines.every((line) => line === ">" || line.startsWith("> "))) {
          const quoted = lines
            .map((line) => (line === ">" ? "" : line.slice(2)))
            .join(" ")
            .trim();
          return (
            <blockquote
              key={key}
              className="my-6 border-l-4 border-brand-700 pl-5 italic text-slate-700"
            >
              {renderInline(quoted, key)}
            </blockquote>
          );
        }
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={key}>
              {lines.map((line, index) => (
                <li key={`${key}-${String(index)}`}>{renderInline(line.slice(2), `${key}-${String(index)}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.every((line) => /^\d+\.\s/.test(line))) {
          return (
            <ol key={key}>
              {lines.map((line, index) => (
                <li key={`${key}-${String(index)}`}>
                  {renderInline(line.replace(/^\d+\.\s/, ""), `${key}-${String(index)}`)}
                </li>
              ))}
            </ol>
          );
        }
        return <p key={key}>{renderInline(block.replace(/\n/g, " "), key)}</p>;
      })}
    </div>
  );
}
