import { formatFastaRecord, parseSequenceInput } from "./fasta.js";
import { exportDelimitedTable, findColumn, parseDelimitedTable } from "./table.js";

export const fastaTableColumns = [
  { id: "id", label: "ID", type: "string" },
  { id: "title", label: "Title", type: "string" },
  { id: "sequence", label: "Sequence", type: "string" },
  { id: "length", label: "Length", type: "number" }
];

function recordId(record) {
  return String(record.title ?? "").trim().split(/\s+/)[0] ?? "";
}

export function convertFastaTable(input, options = {}) {
  const mode = options.mode === "table-to-fasta" ? "table-to-fasta" : "fasta-to-table";
  const warnings = [];
  let tableRows = [];
  let fasta = "";
  let sequenceRecords = [];

  if (mode === "fasta-to-table") {
    sequenceRecords = parseSequenceInput(input, "sequence");
    tableRows = sequenceRecords.map((record) => ({
      id: recordId(record),
      title: record.title,
      sequence: record.sequence,
      length: record.sequence.length
    }));
    fasta = sequenceRecords.map((record) => formatFastaRecord(record.title, record.sequence, options.lineWidth ?? 60)).join("");
  } else {
    const parsed = parseDelimitedTable(String(input ?? ""), {
      delimiter: options.delimiter ?? "auto",
      hasHeader: options.hasHeader !== false
    });
    warnings.push(...parsed.warnings);
    const titleColumn = findColumn(parsed.columns, options.titleColumn ?? "title") ?? findColumn(parsed.columns, options.idColumn ?? "id");
    const sequenceColumn = findColumn(parsed.columns, options.sequenceColumn ?? "sequence");
    if (!titleColumn) {
      warnings.push(`Title column "${options.titleColumn ?? "title"}" was not found.`);
    }
    if (!sequenceColumn) {
      warnings.push(`Sequence column "${options.sequenceColumn ?? "sequence"}" was not found.`);
    }
    sequenceRecords = titleColumn && sequenceColumn
      ? parsed.rows.map((row, index) => ({
        title: String(row[titleColumn.id] ?? "").trim() || `record_${index + 1}`,
        sequence: String(row[sequenceColumn.id] ?? "").replace(/\s+/g, "")
      }))
      : [];
    fasta = sequenceRecords.map((record) => formatFastaRecord(record.title, record.sequence, options.lineWidth ?? 60)).join("");
    tableRows = sequenceRecords.map((record) => ({
      id: recordId(record),
      title: record.title,
      sequence: record.sequence,
      length: record.sequence.length
    }));
  }

  const report = [
    "FASTA table converter",
    "",
    `Mode: ${mode}`,
    `Records: ${sequenceRecords.length}`,
    `Total bases/residues: ${sequenceRecords.reduce((sum, record) => sum + record.sequence.length, 0)}`
  ].join("\n");
  return { mode, tableRows, fasta, sequenceRecords, report, warnings };
}

export function makeFastaTableTsv(rows) {
  return exportDelimitedTable(fastaTableColumns, rows, "\t");
}
