export function formatChangedFields(fields: string[]) {
  if (fields.length === 0) return "no fields";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

export function normalizeDisplayText(value: string) {
  const text = value
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.includes("\n") || text.length < 520) return text;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const paragraphs: string[] = [];
  let current = "";
  sentences.forEach((sentence) => {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > 520 && current) {
      paragraphs.push(current);
      current = sentence;
    } else {
      current = next;
    }
  });
  if (current) paragraphs.push(current);
  return paragraphs.join("\n\n");
}
