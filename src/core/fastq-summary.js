import { exportDelimitedTable } from "./table.js";

export const fastqSummaryColumns = [
  { id: "metric", label: "Metric", type: "string" },
  { id: "value", label: "Value", type: "number" }
];

function parseFastq(input) {
  const lines = String(input ?? "").replace(/\r\n?/g, "\n").split("\n").filter((line) => line.length > 0);
  const records = [];
  const warnings = [];
  if (lines.length % 4 !== 0) {
    warnings.push(`FASTQ input has ${lines.length} non-empty line(s), which is not divisible by 4.`);
  }
  for (let index = 0; index + 3 < lines.length; index += 4) {
    const title = lines[index];
    const sequence = lines[index + 1];
    const plus = lines[index + 2];
    const quality = lines[index + 3];
    const recordNumber = records.length + 1;
    if (!title.startsWith("@")) {
      warnings.push(`Record ${recordNumber} title line does not start with @.`);
    }
    if (!plus.startsWith("+")) {
      warnings.push(`Record ${recordNumber} separator line does not start with +.`);
    }
    if (sequence.length !== quality.length) {
      warnings.push(`Record ${recordNumber} sequence length (${sequence.length}) differs from quality length (${quality.length}).`);
    }
    records.push({ title: title.replace(/^@/, ""), sequence, quality });
  }
  return { records, warnings };
}

function roundNumber(value, digits = 6) {
  if (!Number.isFinite(value)) {
    return "";
  }
  return Number(value.toFixed(digits));
}

function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) {
    return "";
  }
  if (sortedValues.length === 1) {
    return sortedValues[0];
  }
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) {
    return sortedValues[lower];
  }
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function summarizeFastq(input) {
  const parsed = parseFastq(input);
  const readCount = parsed.records.length;
  const lengths = parsed.records.map((record) => record.sequence.length).sort((left, right) => left - right);
  const totalBases = lengths.reduce((sum, value) => sum + value, 0);
  let gc = 0;
  let n = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  for (const record of parsed.records) {
    for (const base of record.sequence.toUpperCase()) {
      if (base === "G" || base === "C") {
        gc += 1;
      }
      if (base === "N") {
        n += 1;
      }
    }
    for (const character of record.quality) {
      qualitySum += character.charCodeAt(0) - 33;
      qualityCount += 1;
    }
  }
  const rows = [
    { metric: "read_count", value: readCount },
    { metric: "total_bases", value: totalBases },
    { metric: "min_read_length", value: lengths[0] ?? 0 },
    { metric: "mean_read_length", value: readCount > 0 ? roundNumber(totalBases / readCount) : 0 },
    { metric: "median_read_length", value: roundNumber(quantile(lengths, 0.5)) },
    { metric: "max_read_length", value: lengths[lengths.length - 1] ?? 0 },
    { metric: "gc_percent", value: totalBases > 0 ? roundNumber((gc / totalBases) * 100, 2) : 0 },
    { metric: "n_count", value: n },
    { metric: "mean_phred_quality", value: qualityCount > 0 ? roundNumber(qualitySum / qualityCount) : 0 }
  ];
  const report = [
    "FASTQ summary",
    "",
    ...rows.map((row) => `${row.metric}: ${row.value}`)
  ].join("\n");
  return {
    records: parsed.records,
    rows,
    report,
    warnings: parsed.warnings
  };
}

export function makeFastqSummaryTsv(rows) {
  return exportDelimitedTable(fastqSummaryColumns, rows, "\t");
}
