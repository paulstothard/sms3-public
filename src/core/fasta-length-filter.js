import { formatFastaRecord, parseSequenceInput } from "./fasta.js";

export const fastaLengthFilterTableColumns = [
  { id: "title", label: "Title", type: "string" },
  { id: "length", label: "Length", type: "number" },
  { id: "gc_percent", label: "GC %", type: "number" },
  { id: "ambiguous_count", label: "Ambiguous count", type: "number" },
  { id: "status", label: "Status", type: "string" },
  { id: "reason", label: "Reason", type: "string" }
];

function normalizeOptions(options = {}) {
  const minLength = Math.max(0, Number.parseInt(options.minLength, 10) || 0);
  const rawMax = Number.parseInt(options.maxLength, 10);
  const maxLength = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : Number.POSITIVE_INFINITY;
  const minGc = parseOptionalNumber(options.minGcPercent);
  const maxGc = parseOptionalNumber(options.maxGcPercent);
  const maxAmbiguous = parseOptionalInteger(options.maxAmbiguousCount);
  return {
    minLength,
    maxLength,
    titleContains: String(options.titleContains ?? "").trim(),
    sequenceContains: String(options.sequenceContains ?? "").replace(/\s+/g, "").toUpperCase(),
    minGcPercent: minGc === null ? null : Math.max(0, Math.min(100, minGc)),
    maxGcPercent: maxGc === null ? null : Math.max(0, Math.min(100, maxGc)),
    maxAmbiguousCount: maxAmbiguous === null ? null : Math.max(0, maxAmbiguous),
    keepMode: options.keepMode === "outside" ? "outside" : "inside",
    lineWidth: Math.max(10, Math.min(200, Number.parseInt(options.lineWidth, 10) || 60))
  };
}

function parseOptionalNumber(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function sequenceStats(sequence) {
  const upper = String(sequence ?? "").toUpperCase();
  const gc = (upper.match(/[GC]/g) ?? []).length;
  const atgc = (upper.match(/[ACGTU]/g) ?? []).length;
  const ambiguous = (upper.match(/[^ACGTU]/g) ?? []).length;
  return {
    gcPercent: atgc > 0 ? Number(((gc / atgc) * 100).toFixed(2)) : null,
    ambiguousCount: ambiguous
  };
}

function recordReasons(record, normalized, stats) {
  const reasons = [];
  const length = record.sequence.length;
  if (length < normalized.minLength) {
    reasons.push(`length ${length} is shorter than minimum ${normalized.minLength}`);
  }
  if (length > normalized.maxLength) {
    reasons.push(`length ${length} is longer than maximum ${normalized.maxLength}`);
  }
  if (normalized.titleContains && !record.title.toLowerCase().includes(normalized.titleContains.toLowerCase())) {
    reasons.push(`title does not contain "${normalized.titleContains}"`);
  }
  if (normalized.sequenceContains && !record.sequence.toUpperCase().includes(normalized.sequenceContains)) {
    reasons.push(`sequence does not contain "${normalized.sequenceContains}"`);
  }
  if (normalized.minGcPercent !== null && (stats.gcPercent === null || stats.gcPercent < normalized.minGcPercent)) {
    reasons.push(`GC percent is below ${normalized.minGcPercent}`);
  }
  if (normalized.maxGcPercent !== null && (stats.gcPercent === null || stats.gcPercent > normalized.maxGcPercent)) {
    reasons.push(`GC percent is above ${normalized.maxGcPercent}`);
  }
  if (normalized.maxAmbiguousCount !== null && stats.ambiguousCount > normalized.maxAmbiguousCount) {
    reasons.push(`ambiguous character count ${stats.ambiguousCount} is above ${normalized.maxAmbiguousCount}`);
  }
  return reasons;
}

export function filterFastaByLength(input, options = {}) {
  const normalized = normalizeOptions(options);
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];

  if (records.length === 0) {
    return {
      records: [],
      keptRecords: [],
      removedRecords: [],
      tableRows: [],
      report: "",
      keptFasta: "",
      removedFasta: "",
      warnings: ["No sequence input was provided."],
      basesProcessed: 0,
      options: normalized
    };
  }

  if (!String(input ?? "").trim().startsWith(">")) {
    warnings.push("Input did not start with a FASTA header; treated it as one raw sequence record.");
  }
  if (normalized.maxLength < normalized.minLength) {
    warnings.push("Maximum length is shorter than minimum length; no records can be within the selected range.");
  }
  if (normalized.minGcPercent !== null || normalized.maxGcPercent !== null) {
    warnings.push("GC percent filters count A/C/G/T/U characters only; other symbols are ignored for the percentage denominator.");
  }

  const keptRecords = [];
  const removedRecords = [];
  const tableRows = [];
  let basesProcessed = 0;

  for (const record of records) {
    const length = record.sequence.length;
    basesProcessed += length;
    const stats = sequenceStats(record.sequence);
    const reasons = recordReasons(record, normalized, stats);
    const matches = reasons.length === 0;
    const keep = normalized.keepMode === "inside" ? matches : !matches;
    const destination = keep ? keptRecords : removedRecords;
    destination.push(record);
    tableRows.push({
      title: record.title,
      length,
      gc_percent: stats.gcPercent,
      ambiguous_count: stats.ambiguousCount,
      status: keep ? "kept" : "removed",
      reason: reasons.length > 0 ? reasons.join("; ") : "matched all selected criteria"
    });
  }

  const maxLabel = Number.isFinite(normalized.maxLength) ? normalized.maxLength : "no maximum";
  const report = [
    "FASTA filter / select",
    "",
    `Records processed: ${records.length}`,
    `Bases processed: ${basesProcessed}`,
    `Length range: ${normalized.minLength} to ${maxLabel}`,
    `Title contains: ${normalized.titleContains || "not used"}`,
    `Sequence contains: ${normalized.sequenceContains || "not used"}`,
    `GC percent range: ${normalized.minGcPercent ?? "no minimum"} to ${normalized.maxGcPercent ?? "no maximum"}`,
    `Maximum ambiguous characters: ${normalized.maxAmbiguousCount ?? "not used"}`,
    `Mode: ${normalized.keepMode === "inside" ? "Keep matching records" : "Remove matching records"}`,
    `Records kept: ${keptRecords.length}`,
    `Records removed: ${removedRecords.length}`
  ].join("\n");
  const keptFasta = keptRecords.map((record) => formatFastaRecord(record.title, record.sequence, normalized.lineWidth)).join("");
  const removedFasta = removedRecords.map((record) => formatFastaRecord(record.title, record.sequence, normalized.lineWidth)).join("");

  return {
    records,
    keptRecords,
    removedRecords,
    tableRows,
    report,
    keptFasta,
    removedFasta,
    warnings,
    basesProcessed,
    options: normalized
  };
}
