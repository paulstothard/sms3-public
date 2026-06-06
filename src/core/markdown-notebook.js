export const markdownNotebookTemplates = [
  {
    id: "protocol-notes",
    label: "Protocol notes",
    defaultTitle: "Protocol notes",
    fileStem: "protocol-notes",
    description: "Procedure notes with materials, steps, checkpoints, and changes.",
    body: ({ title, date }) => `# ${title}\n\nDate: ${date}\n\n## Purpose\n\n\n## Materials\n\n${formatMarkdownTableRows(["Item", "Amount", "Notes"], [["", "", ""]])}\n\n## Procedure\n\n1. \n\n## Checkpoints\n\n- \n\n## Changes\n\n- \n`
  },
  {
    id: "analysis-report",
    label: "Analysis notes",
    defaultTitle: "Analysis notes",
    fileStem: "analysis-notes",
    description: "A compact report structure for SMS3 outputs and interpretation.",
    body: ({ title, date }) => `# ${title}\n\nDate: ${date}\n\n## Question\n\n\n## Input Data\n\n\n## Methods\n\n\n## Results\n\n\n## Interpretation\n\n\n## Files and Links\n\n`
  },
  {
    id: "meeting-notes",
    label: "Meeting notes",
    defaultTitle: "Meeting notes",
    fileStem: "meeting-notes",
    description: "Agenda, decisions, and action items.",
    body: ({ title, date }) => `# ${title}\n\nDate: ${date}\n\n## Attendees\n\n\n## Agenda\n\n- \n\n## Decisions\n\n- \n\n## Action Items\n\n${formatMarkdownTableRows(["Task", "Owner", "Due"], [["", "", ""]])}\n`
  },
  {
    id: "blank",
    label: "Blank",
    defaultTitle: "Untitled notes",
    fileStem: "untitled-notes",
    description: "A simple dated Markdown page.",
    body: ({ title, date }) => `# ${title}\n\nDate: ${date}\n\n## Notes\n\n`
  }
];

function isoDate(value) {
  const text = String(value ?? "").trim();
  if (text) return text;
  return new Date().toISOString().slice(0, 10);
}

function normalizeMarkdownTableCell(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isMarkdownTableDividerCell(value) {
  return /^:?-{3,}:?$/.test(normalizeMarkdownTableCell(value));
}

function splitMarkdownTableRow(line) {
  const trimmed = String(line ?? "").trim();
  if (!trimmed.includes("|")) return [];
  const withoutEdges = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return withoutEdges.split("|").map(normalizeMarkdownTableCell);
}

function renderMarkdownTableRow(cells, widths, indent = "") {
  return `${indent}| ${cells.map((cell, index) => normalizeMarkdownTableCell(cell).padEnd(widths[index] ?? 3)).join(" | ")} |`;
}

export function formatMarkdownTableRows(headerCells, bodyRows = [], indent = "") {
  const header = Array.isArray(headerCells) ? headerCells.map(normalizeMarkdownTableCell) : [];
  const rows = Array.isArray(bodyRows) ? bodyRows : [];
  const columnCount = Math.max(1, header.length, ...rows.map((row) => Array.isArray(row) ? row.length : 0));
  const normalizeRow = (row) => Array.from({ length: columnCount }, (_, index) => normalizeMarkdownTableCell(row?.[index]));
  const normalizedHeader = normalizeRow(header);
  const normalizedRows = rows.map(normalizeRow);
  const widths = Array.from({ length: columnCount }, (_, index) => Math.max(
    3,
    normalizedHeader[index].length,
    ...normalizedRows.map((row) => row[index].length)
  ));
  const divider = widths.map((width) => "-".repeat(width));
  return [
    renderMarkdownTableRow(normalizedHeader, widths, indent),
    renderMarkdownTableRow(divider, widths, indent),
    ...normalizedRows.map((row) => renderMarkdownTableRow(row, widths, indent))
  ].join("\n");
}

export function formatMarkdownTableBlock(block) {
  const lines = String(block ?? "").split(/\r?\n/);
  const tableLines = lines.filter((line) => line.trim());
  if (tableLines.length < 2 || !tableLines.every((line) => line.includes("|"))) {
    return String(block ?? "");
  }
  const indent = tableLines[0].match(/^\s*/)?.[0] ?? "";
  const parsedRows = tableLines.map(splitMarkdownTableRow).filter((row) => row.length > 0);
  if (parsedRows.length < 2) {
    return String(block ?? "");
  }
  const header = parsedRows[0];
  const bodyRows = parsedRows.slice(1).filter((row) => !row.every(isMarkdownTableDividerCell));
  return formatMarkdownTableRows(header, bodyRows, indent);
}

function slugify(value) {
  return String(value ?? "sms3-notebook")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sms3-notebook";
}

function frontMatter(options) {
  if (options.includeFrontMatter !== true) return "";
  return [
    "---",
    `title: "${String(options.title ?? "SMS3 Notebook").replaceAll('"', '\\"')}"`,
    `date: "${isoDate(options.date)}"`,
    `template: "${options.templateId ?? "blank"}"`,
    "---",
    ""
  ].join("\n");
}

export function buildMarkdownNotebook(input, options = {}) {
  const templateId = options.templateId ?? "protocol-notes";
  const template = markdownNotebookTemplates.find((item) => item.id === templateId)
    ?? markdownNotebookTemplates.find((item) => item.id === "protocol-notes")
    ?? markdownNotebookTemplates[0];
  const title = String(options.title ?? "").trim() || template.defaultTitle || "SMS3 Notebook";
  const date = isoDate(options.date);
  const source = String(input ?? "").trimEnd();
  const body = source
    ? source + "\n"
    : template.body({ title, date });
  const markdown = frontMatter({ ...options, templateId, title, date }) + body;
  const filename = `${slugify(options.fileName || template.fileStem || title)}.md`;
  const report = [
    "Markdown notebook",
    `Template: ${template.label}`,
    `Filename: ${filename}`,
    source ? "Started from the Markdown already present in the input area." : "Started from the selected notebook template."
  ].join("\n") + "\n";
  return {
    markdown,
    filename,
    report,
    template,
    warnings: []
  };
}
