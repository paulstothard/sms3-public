import { formatFastaRecord, parseSequenceInput } from "./fasta.js";
import { exportDelimitedTable } from "./table.js";

export const fastaExtractByIdColumns = [
  { id: "query", label: "Query", type: "string" },
  { id: "record", label: "Record", type: "string" },
  { id: "matched", label: "Matched", type: "boolean" },
  { id: "length", label: "Length", type: "number" }
];

function splitInput(input, separator) {
  const lines = String(input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const splitIndex = lines.findIndex((line) => line.trim() === separator);
  if (splitIndex === -1) {
    return {
      fastaText: String(input ?? ""),
      queryText: "",
      warnings: [`Separator line "${separator}" was not found; no ID list was provided.`]
    };
  }
  return {
    fastaText: lines.slice(0, splitIndex).join("\n"),
    queryText: lines.slice(splitIndex + 1).join("\n"),
    warnings: []
  };
}

function recordId(record) {
  return String(record.title ?? "").trim().split(/\s+/)[0] ?? "";
}

function matchesRecord(record, query, mode, caseSensitive) {
  const normalize = (value) => caseSensitive ? String(value) : String(value).toLowerCase();
  const normalizedQuery = normalize(query);
  if (mode === "title-contains") {
    return normalize(record.title).includes(normalizedQuery);
  }
  if (mode === "title-exact") {
    return normalize(record.title) === normalizedQuery;
  }
  return normalize(recordId(record)) === normalizedQuery;
}

export function extractFastaById(input, options = {}) {
  const separator = String(options.separator ?? "---").trim() || "---";
  const split = splitInput(input, separator);
  const records = parseSequenceInput(split.fastaText, "sequence");
  const queries = split.queryText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const mode = ["id-exact", "title-exact", "title-contains"].includes(options.matchMode) ? options.matchMode : "id-exact";
  const action = ["keep", "remove", "order"].includes(options.action) ? options.action : "keep";
  const caseSensitive = options.caseSensitive !== false;
  const matched = new Set();
  const rows = [];
  const orderedRecords = [];

  for (const query of queries) {
    const matches = records.filter((record) => matchesRecord(record, query, mode, caseSensitive));
    if (matches.length === 0) {
      rows.push({ query, record: "", matched: false, length: 0 });
    }
    for (const record of matches) {
      matched.add(record);
      orderedRecords.push(record);
      rows.push({ query, record: record.title, matched: true, length: record.sequence.length });
    }
  }

  let outputRecords;
  if (action === "remove") {
    outputRecords = records.filter((record) => !matched.has(record));
  } else if (action === "order") {
    outputRecords = orderedRecords;
  } else {
    outputRecords = records.filter((record) => matched.has(record));
  }
  const lineWidth = Number(options.lineWidth ?? 60) || 60;
  const fasta = outputRecords.map((record) => formatFastaRecord(record.title, record.sequence, lineWidth)).join("");
  const report = [
    "FASTA extract by ID list",
    "",
    `Input records: ${records.length}`,
    `Queries: ${queries.length}`,
    `Matched records: ${matched.size}`,
    `Output records: ${outputRecords.length}`,
    `Action: ${action}`,
    `Match mode: ${mode}`
  ].join("\n");
  return {
    records,
    outputRecords,
    rows,
    fasta,
    report,
    warnings: split.warnings
  };
}

export function makeFastaExtractByIdTsv(rows) {
  return exportDelimitedTable(fastaExtractByIdColumns, rows, "\t");
}
