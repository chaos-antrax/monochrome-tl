import { normalizeDisplayText } from "./text";

type ReaderProps = { text: string; fontSize: number; lineHeight: number };

export function Reader({ text, fontSize, lineHeight }: ReaderProps) {
  return (
    <article
      className="whitespace-pre-wrap font-serif text-neutral-900"
      style={{ fontSize, lineHeight }}
    >
      {normalizeDisplayText(text)}
    </article>
  );
}
