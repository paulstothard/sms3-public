import { exportDelimitedTable } from "./table.js";

export const vcfGenotypeTableColumns = [
  { id: "chrom", label: "Chrom", type: "string" },
  { id: "pos", label: "Pos", type: "number" },
  { id: "id", label: "ID", type: "string" },
  { id: "ref", label: "Ref", type: "string" },
  { id: "alt", label: "Alt", type: "string" },
  { id: "sample", label: "Sample", type: "string" },
  { id: "gt", label: "GT", type: "string" },
  { id: "gq", label: "GQ", type: "string" },
  { id: "dp", label: "DP", type: "string" }
];

export const vcfMetadataColumns = [
  { id: "key", label: "Key", type: "string" },
  { id: "id", label: "ID", type: "string" },
  { id: "value", label: "Value", type: "string" },
  { id: "line", label: "Line", type: "string" }
];

export const vcfSampleColumns = [
  { id: "sample", label: "Sample", type: "string" },
  { id: "index", label: "Index", type: "number" }
];

export const vcfVariantColumns = [
  { id: "chrom", label: "Chrom", type: "string" },
  { id: "pos", label: "Pos", type: "number" },
  { id: "id", label: "ID", type: "string" },
  { id: "ref", label: "Ref", type: "string" },
  { id: "alt", label: "Alt", type: "string" },
  { id: "qual", label: "Qual", type: "string" },
  { id: "filter", label: "Filter", type: "string" },
  { id: "info", label: "Info", type: "string" }
];

function parseMetadataLine(line) {
  const body = line.slice(2);
  const equals = body.indexOf("=");
  if (equals < 0) {
    return { key: body, id: "", value: "", line };
  }
  const key = body.slice(0, equals);
  const value = body.slice(equals + 1);
  const idMatch = value.match(/^<ID=([^,>]+)/);
  return {
    key,
    id: idMatch ? idMatch[1] : "",
    value,
    line
  };
}

export function extractVcfData(input, options = {}) {
  const dataType = ["metadata", "samples", "variants", "genotypes"].includes(options.dataType) ? options.dataType : "metadata";
  const rows = [];
  const warnings = [];
  const metadataRows = [];
  const variantRows = [];
  let samples = [];
  for (const line of String(input ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    if (!line) {
      continue;
    }
    if (line.startsWith("##")) {
      metadataRows.push(parseMetadataLine(line));
      continue;
    }
    if (line.startsWith("#CHROM")) {
      samples = line.split("\t").slice(9);
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }
    const fields = line.split("\t");
    if (fields.length < 8) {
      warnings.push("Skipped a VCF data line with fewer than 8 fixed fields.");
      continue;
    }
    variantRows.push({
      chrom: fields[0],
      pos: Number(fields[1]),
      id: fields[2],
      ref: fields[3],
      alt: fields[4],
      qual: fields[5],
      filter: fields[6],
      info: fields[7]
    });
    if (fields.length < 9) {
      warnings.push("Skipped a VCF data line without FORMAT/sample columns.");
      continue;
    }
    const formatKeys = fields[8].split(":");
    fields.slice(9).forEach((sampleField, sampleIndex) => {
      const values = sampleField.split(":");
      const valueByKey = Object.fromEntries(formatKeys.map((key, index) => [key, values[index] ?? ""]));
      rows.push({
        chrom: fields[0],
        pos: Number(fields[1]),
        id: fields[2],
        ref: fields[3],
        alt: fields[4],
        sample: samples[sampleIndex] ?? `sample_${sampleIndex + 1}`,
        gt: valueByKey.GT ?? "",
        gq: valueByKey.GQ ?? "",
        dp: valueByKey.DP ?? ""
      });
    });
  }
  const sampleRows = samples.map((sample, index) => ({ sample, index: index + 1 }));
  const selectedRows = dataType === "metadata"
    ? metadataRows
    : dataType === "samples"
      ? sampleRows
      : dataType === "variants"
        ? variantRows
        : rows;
  const columns = dataType === "metadata"
    ? vcfMetadataColumns
    : dataType === "samples"
      ? vcfSampleColumns
      : dataType === "variants"
        ? vcfVariantColumns
        : vcfGenotypeTableColumns;
  const report = [
    "VCF extractor",
    "",
    `Metadata lines: ${metadataRows.length}`,
    `Samples: ${samples.length}`,
    `Variant sites: ${variantRows.length}`,
    `Genotype rows: ${rows.length}`,
    `Selected data: ${dataType}`,
    `Selected rows: ${selectedRows.length}`
  ].join("\n");
  return { rows: selectedRows, allGenotypeRows: rows, report, warnings, columns, dataType };
}

export function extractVcfGenotypeTable(input) {
  return extractVcfData(input, { dataType: "genotypes" });
}

export function makeVcfGenotypeTableTsv(rows, columns = vcfGenotypeTableColumns) {
  return exportDelimitedTable(columns, rows, "\t");
}
