import { parseSequenceInput } from "../../core/fasta.js";
import {
  findRestrictionSites,
  makeRestrictionFragments,
  makeRestrictionMapSvg,
  restrictionFragmentTableColumns,
  restrictionHitTableColumns,
  restrictionMapTableColumns,
  selectRestrictionEnzymes
} from "../../core/restriction-analysis.js";
import { cleanDnaRnaSequence } from "../../core/sequence.js";
import { renderTextAnnotationMap } from "../../core/text-annotation-map.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import { restrictionEnzymeRecords } from "../../reference-data/restriction-enzymes/records.js";

const TSV_COLUMNS = restrictionHitTableColumns.map((column) => column.id);
const LARGE_TEXT_STREAM_HIT_THRESHOLD = 2000;
const SVG_OVERVIEW_HIT_THRESHOLD = 2000;
const SVG_OVERVIEW_BASE_THRESHOLD = 250000;

function normalizeOptions(options = {}) {
  return {
    enzymeIds: options.enzymeIds ?? "common",
    topology: options.topology === "circular" ? "circular" : "linear",
    minimumSites: Math.max(0, Number.parseInt(options.minimumSites ?? 1, 10) || 0),
    maximumSites: Math.max(1, Number.parseInt(options.maximumSites ?? 999, 10) || 999),
    keepGaps: options.keepGaps === true,
    outputFormat: new Set(["report", "tsv", "svg-overview", "text-map"]).has(options.outputFormat)
      ? options.outputFormat
      : "svg-overview"
  };
}

function filterHitsByEnzymeSiteCount(hits, options) {
  const counts = new Map();
  for (const hit of hits) {
    counts.set(hit.enzyme_id, (counts.get(hit.enzyme_id) ?? 0) + 1);
  }
  return hits.filter((hit) => {
    const count = counts.get(hit.enzyme_id) ?? 0;
    return count >= options.minimumSites && count <= options.maximumSites;
  });
}

function makeSiteRows(records) {
  return records.flatMap((record) =>
    record.hits.map((hit) => ({
      record: record.title,
      enzyme: hit.enzyme,
      recognition: hit.recognition,
      strand: hit.strand,
      site_start: hit.site_start,
      site_end: hit.site_end,
      cut_after: hit.cut_after,
      overhang: hit.overhang,
      left_context: hit.left_context,
      matched_text: hit.matched_text,
      right_context: hit.right_context,
      context_sequence: hit.context_sequence
    }))
  );
}

function makeFragmentRows(records) {
  return records.flatMap((record) =>
    record.fragments.map((fragment) => ({
      record: record.title,
      fragment: fragment.fragment,
      start: fragment.start,
      end: fragment.end,
      length: fragment.length,
      topology: fragment.topology
    }))
  );
}

function makeMapRows(records) {
  return records.flatMap((record) =>
    record.hits.map((hit) => ({
      record: record.title,
      enzyme: hit.enzyme,
      recognition: hit.recognition,
      strand: hit.strand,
      site_start: hit.site_start,
      site_end: hit.site_end,
      cut_after: hit.cut_after,
      overhang: hit.overhang,
      matched_text: hit.matched_text,
      left_context: hit.left_context,
      right_context: hit.right_context,
      context_sequence: hit.context_sequence,
      record_length: record.length
    }))
  );
}

function makeTsv(rows) {
  return [
    TSV_COLUMNS.join("\t"),
    ...rows.map((row) => TSV_COLUMNS.map((column) => row[column] ?? "").join("\t"))
  ].join("\n");
}

function summarizeCounts(records) {
  const counts = new Map();
  for (const record of records) {
    for (const hit of record.hits) {
      counts.set(hit.enzyme, (counts.get(hit.enzyme) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([enzyme, count]) => `${enzyme}: ${count}`)
    .join("; ") || "none";
}

function makeReport(records, enzymes, options) {
  const lines = [];
  lines.push("Restriction analysis");
  lines.push(`Topology: ${options.topology}`);
  lines.push(`Enzymes searched: ${enzymes.map((enzyme) => enzyme.name).join(", ")}`);
  lines.push(`Site-count filter: ${options.minimumSites} to ${options.maximumSites} per enzyme`);
  lines.push("");

  for (const record of records) {
    lines.push(`${record.title} restriction sites`);
    lines.push(`Length: ${record.length}`);
    lines.push(`Sites shown: ${record.hits.length}`);
    lines.push(`Digest fragments: ${record.fragments.length}`);
    lines.push(`Enzyme counts: ${summarizeCounts([record])}`);
    if (record.hits.length > 0) {
      lines.push("enzyme\trecognition\tstrand\tsite_start\tsite_end\tcut_after\toverhang\tmatched_text\tcontext_sequence");
      for (const hit of record.hits) {
        lines.push([
          hit.enzyme,
          hit.recognition,
          hit.strand,
          hit.site_start,
          hit.site_end,
          hit.cut_after,
          hit.overhang,
          hit.matched_text,
          hit.context_sequence
        ].join("\t"));
      }
    } else {
      lines.push("No restriction sites passed the current filters.");
    }
    lines.push("");
  }

  lines.push(`Total sites shown: ${records.reduce((sum, record) => sum + record.hits.length, 0)}`);
  lines.push(`Total enzyme counts: ${summarizeCounts(records)}`);
  return lines.join("\n").trimEnd();
}

function makeSummaryReport(records, enzymes, options) {
  const lines = [];
  lines.push("Restriction analysis");
  lines.push(`Topology: ${options.topology}`);
  lines.push(`Enzymes searched: ${enzymes.map((enzyme) => enzyme.name).join(", ")}`);
  lines.push(`Site-count filter: ${options.minimumSites} to ${options.maximumSites} per enzyme`);
  lines.push("");
  for (const record of records) {
    lines.push(`${record.title} restriction sites`);
    lines.push(`Length: ${record.length}`);
    lines.push(`Sites shown: ${record.hits.length}`);
    lines.push(`Digest fragments: ${record.fragments.length}`);
    lines.push(`Enzyme counts: ${summarizeCounts([record])}`);
    lines.push("");
  }
  lines.push(`Total sites shown: ${records.reduce((sum, record) => sum + record.hits.length, 0)}`);
  lines.push(`Total enzyme counts: ${summarizeCounts(records)}`);
  return lines.join("\n").trimEnd();
}

function makeTextMap(records) {
  return renderTextAnnotationMap(records.map((record) => ({
    title: record.title,
    sequence: record.sequence,
    annotations: record.hits.map((hit) => ({
      start: hit.site_start,
      end: hit.site_end,
      strand: hit.strand,
      label: hit.enzyme
    }))
  })), {
    width: 60,
    showComplement: true
  });
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makePlaceholderSvg(title, lines) {
  const safeLines = lines.map((line) => escapeXml(line));
  const height = 120 + safeLines.length * 20;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 ${height}" role="img" aria-label="${escapeXml(title)}">`,
    "<style>",
    ".title{font:700 18px system-ui,sans-serif;fill:#263238}",
    ".note{font:12px system-ui,sans-serif;fill:#5c6b75}",
    "</style>",
    `<rect x="0" y="0" width="760" height="${height}" fill="white"/>`,
    `<text class="title" x="24" y="34">${escapeXml(title)}</text>`,
    ...safeLines.map((line, index) => `<text class="note" x="24" y="${66 + index * 20}">${line}</text>`),
    "</svg>"
  ].join("");
}

function shouldRenderSvgOverview({ outputFormat, totalHits, basesProcessed }) {
  return outputFormat === "svg-overview" &&
    totalHits <= SVG_OVERVIEW_HIT_THRESHOLD &&
    basesProcessed <= SVG_OVERVIEW_BASE_THRESHOLD;
}

export function runRestrictionAnalysis(input, options = {}) {
  const normalized = normalizeOptions(options);
  const sequenceRecords = parseSequenceInput(input, "sequence");
  const selectedEnzymes = selectRestrictionEnzymes(restrictionEnzymeRecords, normalized.enzymeIds);
  const warnings = [];

  if (sequenceRecords.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  const analyzedRecords = [];
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of sequenceRecords) {
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: normalized.keepGaps
    });
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }
    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }

    const allHits = findRestrictionSites(cleaned.sequence, selectedEnzymes);
    const hits = filterHitsByEnzymeSiteCount(allHits, normalized);
    analyzedRecords.push({
      title: record.title,
      length: cleaned.sequence.length,
      sequence: cleaned.sequence,
      hits,
      fragments: makeRestrictionFragments(cleaned.sequence.length, hits, normalized.topology)
    });
  }

  const siteRows = makeSiteRows(analyzedRecords);
  const fragmentRows = makeFragmentRows(analyzedRecords);
  const mapRows = makeMapRows(analyzedRecords);
  const report = normalized.outputFormat === "report" || siteRows.length <= LARGE_TEXT_STREAM_HIT_THRESHOLD
    ? makeReport(analyzedRecords, selectedEnzymes, normalized)
    : makeSummaryReport(analyzedRecords, selectedEnzymes, normalized);
  const tsv = normalized.outputFormat === "tsv" ? makeTsv(siteRows) : "";
  const renderSvgOverview = shouldRenderSvgOverview({
    outputFormat: normalized.outputFormat,
    totalHits: siteRows.length,
    basesProcessed
  });
  let svgMap = "";
  if (renderSvgOverview) {
    svgMap = makeRestrictionMapSvg(analyzedRecords, normalized);
  } else if (normalized.outputFormat === "svg-overview") {
    warnings.push(
      `SVG restriction map was not drawn because this run has ${siteRows.length} sites across ${basesProcessed} bases. Use site filters, table output, or report output for dense analyses.`
    );
    svgMap = makePlaceholderSvg("Restriction map not drawn", [
      `${siteRows.length} restriction sites across ${basesProcessed} bases.`,
      "The graphical map is suppressed for dense outputs to keep the browser responsive.",
      "Use the site table or tighten the enzyme/site-count filters for a drawable map."
    ]);
  }
  const textMap = normalized.outputFormat === "text-map" ? makeTextMap(analyzedRecords) : "";
  const output = normalized.outputFormat === "tsv"
    ? tsv
    : normalized.outputFormat === "svg-overview"
      ? svgMap
      : normalized.outputFormat === "text-map"
        ? textMap
      : report;

  return makeToolResult({
    output,
    download: {
      filename: `restriction-analysis.${normalized.outputFormat === "tsv" ? "tsv" : normalized.outputFormat === "svg-overview" ? "svg" : "txt"}`,
      mimeType:
        normalized.outputFormat === "tsv"
          ? "text/tab-separated-values"
          : normalized.outputFormat === "svg-overview"
            ? "image/svg+xml;charset=utf-8"
            : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: sequenceRecords.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      ...(normalized.outputFormat === "report" ? { report: makeTextStream(report, "text/plain") } : {}),
      ...(normalized.outputFormat === "text-map" ? { textMap: makeTextStream(textMap, "text/plain") } : {}),
      table: makeTableStream(restrictionHitTableColumns, siteRows, "restriction-sites"),
      fragments: makeTableStream(restrictionFragmentTableColumns, fragmentRows, "restriction-fragments"),
      mapTable: makeTableStream(restrictionMapTableColumns, mapRows, "restriction-map"),
      ...(normalized.outputFormat === "svg-overview" ? { overview: makeTextStream(svgMap, "image/svg+xml") } : {})
    },
    visual: normalized.outputFormat === "svg-overview" ? { svg: svgMap } : undefined
  });
}
