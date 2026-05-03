export function parseSequenceInput(input, fallbackTitle = "sequence") {
  const text = String(input ?? "").trim();
  if (!text) {
    return [];
  }

  if (!text.startsWith(">")) {
    return [
      {
        title: fallbackTitle,
        sequence: text.replace(/\s+/g, ""),
        hadHeader: false
      }
    ];
  }

  const records = [];
  const entries = text.split(/\n(?=>)/);

  for (const entry of entries) {
    const lines = entry.split(/\r?\n/);
    const header = lines.shift() ?? "";
    const title = header.replace(/^>\s*/, "").trim() || fallbackTitle;
    const sequence = lines.join("").replace(/\s+/g, "");
    records.push({ title, sequence, hadHeader: true });
  }

  return records;
}

export function formatFastaRecord(title, sequence, lineWidth = 60) {
  const width = Math.max(1, Number.parseInt(lineWidth, 10) || 60);
  const lines = [`>${title}`];

  for (let index = 0; index < sequence.length; index += width) {
    lines.push(sequence.slice(index, index + width));
  }

  return `${lines.join("\n")}\n`;
}

