import { formatFastaRecord } from "../../core/fasta.js";
import {
  flatfileFeatureColumns,
  flatfileRecordsToFeatureRows,
  flatfileRecordsToSequenceRecords,
  parseFlatfileRecords
} from "../../core/flatfile-records.js";
import { renderSequenceMap } from "../../core/sequence-map-renderer.js";
import { renderTextAnnotationMap } from "../../core/text-annotation-map.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

function escapeTsvValue(value) {
  return String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function tableToTsv(columns, rows) {
  return [
    columns.map((column) => column.id).join("\t"),
    ...rows.map((row) => columns.map((column) => escapeTsvValue(row[column.id])).join("\t"))
  ].join("\n");
}

function recordsToFasta(records, lineWidth = 60) {
  return records.map((record) => formatFastaRecord(record.title, record.sequence, lineWidth)).join("\n");
}

function parseFeatureFilter(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function filterFeatureRows(rows, options = {}) {
  const requested = parseFeatureFilter(options.featureFilter);
  if (requested.size === 0) {
    return rows;
  }
  return rows.filter((row) => requested.has(row.feature));
}

function makeReport(records, featureRows, wholeRecords, cdsRecords, proteinRecords) {
  const formats = [...new Set(records.map((record) => record.format))].join(", ") || "none";
  return [
    "Record parser / extractor",
    `Records parsed: ${records.length}`,
    `Formats: ${formats}`,
    `Features reported: ${featureRows.length}`,
    `Whole DNA/RNA sequences: ${wholeRecords.length}`,
    `CDS DNA/RNA sequences: ${cdsRecords.length}`,
    `Protein sequences: ${proteinRecords.length}`
  ].join("\n") + "\n";
}

function makeFeatureLabel(feature) {
  if (feature.gene) {
    return `${feature.feature} ${feature.gene}`;
  }
  if (feature.locus_tag) {
    return `${feature.feature} ${feature.locus_tag}`;
  }
  return feature.feature;
}

function shortQualifier(value, maxLength = 22) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function informativeQualifier(value, maxLength = 22) {
  const stop = new Set(["DNA", "RNA", "protein", "putative", "hypothetical", "fragment", "partial"]);
  const words = String(value ?? "")
    .replace(/[;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .filter((word) => !stop.has(word));
  return shortQualifier(words.join(" ") || value, maxLength);
}

function getFeatureLabel(feature) {
  const identifier = feature.gene || feature.locus_tag;
  if (feature.product) {
    return identifier
      ? `${feature.feature} ${shortQualifier(identifier, 12)} ${informativeQualifier(feature.product, 22)}`
      : `${feature.feature} ${informativeQualifier(feature.product)}`;
  }
  if (feature.note) {
    return identifier
      ? `${feature.feature} ${shortQualifier(identifier, 12)} ${shortQualifier(feature.note, 22)}`
      : `${feature.feature} ${shortQualifier(feature.note)}`;
  }
  if (feature.bound_moiety) {
    return identifier
      ? `${feature.feature} ${shortQualifier(identifier, 12)} ${shortQualifier(feature.bound_moiety, 22)}`
      : `${feature.feature} ${shortQualifier(feature.bound_moiety)}`;
  }
  if (feature.gene) {
    return `${feature.feature} ${shortQualifier(feature.gene, 18)}`;
  }
  if (feature.locus_tag) {
    return `${feature.feature} ${shortQualifier(feature.locus_tag, 18)}`;
  }
  if (feature.parsedLocation?.start && feature.parsedLocation?.end) {
    return `${feature.feature} ${feature.parsedLocation.start}-${feature.parsedLocation.end}`;
  }
  return feature.feature;
}

function getFeatureClass(featureKey) {
  const key = String(featureKey ?? "").toLowerCase();
  if (key === "cds" || key === "mrna" || key === "exon") {
    return "coding";
  }
  if (key === "gene") {
    return "gene";
  }
  if (key === "source") {
    return "source";
  }
  if (key.includes("regulatory") || key.includes("promoter") || key.includes("terminator") || key === "misc_binding") {
    return "regulatory";
  }
  if (key.includes("repeat")) {
    return "repeat";
  }
  if (key === "variation" || key === "variant") {
    return "variant";
  }
  return "other";
}

function makeFeatureMapSvg(records) {
  const nucleotideRecords = records.filter((record) => record.sequence && record.molecule !== "protein");
  const recordsToDraw = nucleotideRecords.length > 0 ? nucleotideRecords : records.filter((record) => record.sequence);
  return renderSequenceMap({
    title: "Feature map",
    records: recordsToDraw.map((record) => ({
      title: record.accession,
      length: record.sequence.length,
      topology: record.topology,
      molecule: record.molecule,
      features: record.features
        .filter((feature) => feature.parsedLocation.supported && feature.parsedLocation.start && feature.parsedLocation.end)
        .map((feature) => ({
          start: feature.parsedLocation.start,
          end: feature.parsedLocation.end,
          parts: feature.parsedLocation.ranges,
          strand: feature.parsedLocation.strand,
          className: getFeatureClass(feature.feature),
          label: getFeatureLabel(feature),
          type: feature.feature
        }))
    }))
  });
}

function makeFeatureTextMap(records) {
  return records.map((record) =>
    renderTextAnnotationMap([
      {
        title: record.accession,
        sequence: record.sequence,
        annotations: record.features
          .filter((feature) => feature.parsedLocation.supported && feature.parsedLocation.start && feature.parsedLocation.end)
          .map((feature) => ({
            start: feature.parsedLocation.start,
            end: feature.parsedLocation.end,
            strand: feature.parsedLocation.strand,
            label: makeFeatureLabel(feature)
          }))
      }
    ], {
      width: 60,
      showComplement: record.molecule !== "protein"
    })
  ).join("\n\n");
}

function makeDownload(format, text) {
  if (format === "report") {
    return {
      output: text,
      download: { filename: "record-parser-extractor.txt", mimeType: "text/plain;charset=utf-8" }
    };
  }
  if (format.endsWith("fasta")) {
    return {
      output: text,
      download: { filename: `record-parser-extractor.${format}.fasta`, mimeType: "text/x-fasta;charset=utf-8" }
    };
  }
  if (format === "text-map") {
    return {
      output: text,
      download: { filename: "record-parser-extractor.text-map.txt", mimeType: "text/plain;charset=utf-8" }
    };
  }
  if (format === "svg-map") {
    return {
      output: text,
      download: { filename: "record-parser-extractor.feature-map.svg", mimeType: "image/svg+xml;charset=utf-8" }
    };
  }
  return {
    output: text,
    download: { filename: "record-parser-extractor.features.tsv", mimeType: "text/tab-separated-values;charset=utf-8" }
  };
}

export function runRecordParserExtractor(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  const parsed = parseFlatfileRecords(input);
  context.reportProgress?.({ phase: "building-records", progress: 0.25 });
  context.throwIfCancelled?.();
  const warnings = [...parsed.warnings];
  if (parsed.records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: warnings.length > 0 ? warnings : ["No GenBank/DDBJ, EMBL, or UniProt flatfile records were found."],
      recordsProcessed: 0
    });
  }

  const featureRows = filterFeatureRows(flatfileRecordsToFeatureRows(parsed.records), options);
  context.throwIfCancelled?.();
  const wholeRecords = flatfileRecordsToSequenceRecords(parsed.records, "whole");
  context.throwIfCancelled?.();
  const cdsRecords = flatfileRecordsToSequenceRecords(parsed.records, "cds-nucleotide");
  context.throwIfCancelled?.();
  const proteinRecords = flatfileRecordsToSequenceRecords(parsed.records, "protein");
  context.reportProgress?.({ phase: "building-output", progress: 0.55 });
  context.throwIfCancelled?.();
  const lineWidth = Number.parseInt(options.lineWidth, 10) || 60;
  const featuresTsv = tableToTsv(flatfileFeatureColumns, featureRows);
  const wholeFasta = recordsToFasta(wholeRecords, lineWidth);
  const cdsFasta = recordsToFasta(cdsRecords, lineWidth);
  const proteinFasta = recordsToFasta(proteinRecords, lineWidth);
  const report = makeReport(parsed.records, featureRows, wholeRecords, cdsRecords, proteinRecords);
  const format = options.outputFormat === "whole-fasta" ||
    options.outputFormat === "cds-fasta" ||
    options.outputFormat === "protein-fasta" ||
    options.outputFormat === "svg-map" ||
    options.outputFormat === "text-map" ||
    options.outputFormat === "report"
    ? options.outputFormat
    : "features-tsv";
  context.reportProgress?.({ phase: "rendering-selected-output", progress: 0.75 });
  context.throwIfCancelled?.();
  const textMap = format === "text-map" ? makeFeatureTextMap(parsed.records) : "";
  context.throwIfCancelled?.();
  const svgMap = format === "svg-map" ? makeFeatureMapSvg(parsed.records) : "";
  context.throwIfCancelled?.();
  const selectedText = format === "whole-fasta"
    ? wholeFasta
    : format === "cds-fasta"
      ? cdsFasta
    : format === "protein-fasta"
      ? proteinFasta
      : format === "text-map"
        ? textMap
        : format === "svg-map"
          ? svgMap
        : format === "report"
          ? report
          : featuresTsv;
  const selected = makeDownload(format, selectedText);
  context.reportProgress?.({ phase: "finalizing", progress: 0.92 });
  context.throwIfCancelled?.();

  return makeToolResult({
    output: selected.output,
    download: selected.download,
    warnings,
    recordsProcessed: parsed.records.length,
    basesProcessed: parsed.records.reduce((sum, record) => sum + record.sequence.length, 0),
    streams: {
      ...(format === "report" ? { report: makeTextStream(report, "text/plain") } : {}),
      ...(format === "text-map" ? { textMap: makeTextStream(textMap, "text/plain") } : {}),
      ...(format === "svg-map" ? { overview: makeTextStream(svgMap, "image/svg+xml") } : {}),
      ...(format === "features-tsv" ? { featuresTsv: makeTextStream(featuresTsv, "text/tab-separated-values") } : {}),
      table: makeTableStream(flatfileFeatureColumns, featureRows, "flatfile-features"),
      wholeSequenceRecords: {
        kind: "sequence-records",
        alphabet: "dna-rna",
        schema: "flatfile-whole-sequences",
        records: wholeRecords
      },
      cdsSequenceRecords: {
        kind: "sequence-records",
        alphabet: "dna-rna",
        schema: "flatfile-cds-sequences",
        records: cdsRecords
      },
      proteinRecords: {
        kind: "sequence-records",
        alphabet: "protein",
        schema: "flatfile-protein-sequences",
        records: proteinRecords
      },
      ...(format === "whole-fasta" ? { wholeFasta: makeTextStream(wholeFasta, "text/x-fasta") } : {}),
      ...(format === "cds-fasta" ? { cdsFasta: makeTextStream(cdsFasta, "text/x-fasta") } : {}),
      ...(format === "protein-fasta" ? { proteinFasta: makeTextStream(proteinFasta, "text/x-fasta") } : {})
    },
    visual: format === "svg-map" ? { svg: svgMap } : undefined
  });
}

export async function runRecordParserExtractorWorker(input, options = {}, context = {}) {
  await context.yieldIfNeeded?.();
  context.throwIfCancelled?.();
  const result = runRecordParserExtractor(input, options, context);
  await context.yieldIfNeeded?.();
  context.throwIfCancelled?.();
  context.reportProgress?.({ phase: "finished", progress: 1 });
  return result;
}
