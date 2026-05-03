import { parseSequenceInput } from "../../core/fasta.js";
import { getCodonsForCode, getGeneticCode, makeCodonMap } from "../../core/genetic-code.js";
import { cleanDnaRnaSequence } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const codonUsageTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "amino_acid", label: "Amino acid", type: "string" },
  { id: "codon", label: "Codon", type: "string" },
  { id: "count", label: "Count", type: "number" },
  { id: "per_1000", label: "Per 1000", type: "number" },
  { id: "fraction", label: "Fraction", type: "number" },
  { id: "amino_acid_total", label: "Amino acid total", type: "number" }
];

function formatNumber(value) {
  return value.toFixed(3);
}

function normalizeSequence(sequence) {
  return String(sequence ?? "").toUpperCase().replaceAll("U", "T");
}

function getOffset(frame) {
  const parsed = Number.parseInt(frame, 10);
  if (parsed === 2) {
    return 1;
  }
  if (parsed === 3) {
    return 2;
  }
  return 0;
}

function makeEmptyUsage(codeOrId = "1") {
  const codons = getCodonsForCode(codeOrId);
  const counts = new Map(codons.map((item) => [item.codon, 0]));
  return { codons, counts };
}

function countCodons(sequence, options = {}) {
  const code = getGeneticCode(options.geneticCode ?? "1");
  const codonMap = makeCodonMap(code);
  const { codons, counts } = makeEmptyUsage(code);
  const offset = getOffset(options.frame);
  const source = normalizeSequence(sequence);
  const completeCodons = [];
  let ambiguousCodons = 0;
  let terminalStopsExcluded = 0;

  for (let index = offset; index + 3 <= source.length; index += 3) {
    const codon = source.slice(index, index + 3);
    if (/^[ACGT]{3}$/.test(codon)) {
      completeCodons.push(codon);
    } else {
      ambiguousCodons += 1;
    }
  }

  if (options.excludeTerminalStop !== false && completeCodons.length > 0) {
    const lastCodon = completeCodons.at(-1);
    if (codonMap.get(lastCodon) === "*") {
      completeCodons.pop();
      terminalStopsExcluded = 1;
    }
  }

  for (const codon of completeCodons) {
    counts.set(codon, (counts.get(codon) ?? 0) + 1);
  }

  const countedCodons = completeCodons.length;
  const stopCodons = completeCodons.filter((codon) => codonMap.get(codon) === "*").length;
  const senseCodons = countedCodons - stopCodons;
  const gc3Count = completeCodons.filter((codon) => codon[2] === "G" || codon[2] === "C").length;

  return {
    code,
    codons,
    counts,
    countedCodons,
    senseCodons,
    stopCodons,
    ambiguousCodons,
    terminalStopsExcluded,
    trailingBases: Math.max(0, (source.length - offset) % 3),
    gc3Percent: countedCodons > 0 ? (gc3Count / countedCodons) * 100 : 0
  };
}

function buildRows(title, usage) {
  const aminoAcidTotals = new Map();

  for (const item of usage.codons) {
    aminoAcidTotals.set(item.aa, (aminoAcidTotals.get(item.aa) ?? 0) + (usage.counts.get(item.codon) ?? 0));
  }

  return usage.codons.map((item) => {
    const count = usage.counts.get(item.codon) ?? 0;
    const aminoAcidTotal = aminoAcidTotals.get(item.aa) ?? 0;
    return {
      record: title,
      amino_acid: item.aa,
      codon: item.codon,
      count,
      per_1000: usage.senseCodons > 0 ? (count / usage.senseCodons) * 1000 : 0,
      fraction: aminoAcidTotal > 0 ? count / aminoAcidTotal : 0,
      amino_acid_total: aminoAcidTotal
    };
  });
}

function mergeUsages(usages, codeOrId = "1") {
  const merged = {
    ...makeEmptyUsage(codeOrId),
    countedCodons: 0,
    senseCodons: 0,
    stopCodons: 0,
    ambiguousCodons: 0,
    terminalStopsExcluded: 0,
    trailingBases: 0,
    gc3WeightedCount: 0
  };

  for (const usage of usages) {
    for (const [codon, count] of usage.counts.entries()) {
      merged.counts.set(codon, (merged.counts.get(codon) ?? 0) + count);
    }
    merged.countedCodons += usage.countedCodons;
    merged.senseCodons += usage.senseCodons;
    merged.stopCodons += usage.stopCodons;
    merged.ambiguousCodons += usage.ambiguousCodons;
    merged.terminalStopsExcluded += usage.terminalStopsExcluded;
    merged.trailingBases += usage.trailingBases;
    merged.gc3WeightedCount += (usage.gc3Percent / 100) * usage.countedCodons;
  }

  merged.gc3Percent =
    merged.countedCodons > 0 ? (merged.gc3WeightedCount / merged.countedCodons) * 100 : 0;
  return merged;
}

function makeReport(analyzedRecords) {
  const lines = [];

  for (const record of analyzedRecords) {
    lines.push(`${record.title} codon usage`);
    lines.push(`Codons counted: ${record.usage.countedCodons}`);
    lines.push(`Sense codons: ${record.usage.senseCodons}`);
    lines.push(`Stop codons counted: ${record.usage.stopCodons}`);
    lines.push(`Ambiguous codons skipped: ${record.usage.ambiguousCodons}`);
    lines.push(`Terminal stops excluded: ${record.usage.terminalStopsExcluded}`);
    lines.push(`Trailing bases ignored: ${record.usage.trailingBases}`);
    lines.push(`GC3 percent: ${formatNumber(record.usage.gc3Percent)}`);
    lines.push("aa\tcodon\tcount\tper_1000\tfraction\tamino_acid_total");
    for (const row of record.rows.filter((item) => item.count > 0)) {
      lines.push(
        [
          row.amino_acid,
          row.codon,
          row.count,
          formatNumber(row.per_1000),
          formatNumber(row.fraction),
          row.amino_acid_total
        ].join("\t")
      );
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function makeTsv(rows) {
  const columns = codonUsageTableColumns.map((column) => column.id);
  return [
    columns.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.amino_acid,
        row.codon,
        row.count,
        formatNumber(row.per_1000),
        formatNumber(row.fraction),
        row.amino_acid_total
      ].join("\t")
    )
  ].join("\n");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeSvgPlot(rows, title = "Codon Usage") {
  const plotRows = rows.filter((row) => row.record === title || (title === "Codon Usage" && row.record !== "Total"));
  const activeRows = plotRows.length > 0 ? plotRows : rows;
  const width = 1120;
  const height = 420;
  const margin = { top: 44, right: 24, bottom: 92, left: 56 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxCount = Math.max(1, ...activeRows.map((row) => row.count));
  const barWidth = plotWidth / activeRows.length;
  const axisY = margin.top + plotHeight;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} codon usage plot">`,
    "<style>text{font-family:Inter,Arial,sans-serif;font-size:12px;fill:#172026}.axis{stroke:#5c6b75;stroke-width:1}.grid{stroke:#dfe7ec;stroke-width:1}.bar{fill:#0f766e}.stop{fill:#b7791f}.label{font-size:10px;text-anchor:middle}.tick{stroke:#5c6b75;stroke-width:1}</style>",
    `<rect width="${width}" height="${height}" fill="#ffffff"></rect>`,
    `<text x="${margin.left}" y="26" style="font-size:18px;font-weight:700">${escapeXml(title)} codon usage</text>`
  ];

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = (maxCount / 4) * tick;
    const y = axisY - (value / maxCount) * plotHeight;
    parts.push(`<line class="grid" x1="${margin.left}" y1="${y.toFixed(2)}" x2="${width - margin.right}" y2="${y.toFixed(2)}"></line>`);
    parts.push(`<text x="12" y="${(y + 4).toFixed(2)}">${Math.round(value)}</text>`);
  }

  parts.push(`<line class="axis" x1="${margin.left}" y1="${axisY}" x2="${width - margin.right}" y2="${axisY}"></line>`);
  parts.push(`<line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${axisY}"></line>`);

  activeRows.forEach((row, index) => {
    const bandLeft = margin.left + index * barWidth;
    const barX = bandLeft + 1;
    const barCenter = bandLeft + barWidth / 2;
    const barHeight = (row.count / maxCount) * plotHeight;
    const y = axisY - barHeight;
    const className = row.amino_acid === "*" ? "stop" : "bar";
    parts.push(
      `<rect class="${className}" data-codon="${row.codon}" data-center-x="${barCenter.toFixed(2)}" x="${barX.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(1, barWidth - 2).toFixed(2)}" height="${barHeight.toFixed(2)}"><title>${escapeXml(`${row.codon} (${row.amino_acid}): ${row.count}`)}</title></rect>`
    );
    parts.push(`<line class="tick" x1="${barCenter.toFixed(2)}" y1="${axisY}" x2="${barCenter.toFixed(2)}" y2="${axisY + 5}"></line>`);
    parts.push(
      `<text class="label" data-codon="${row.codon}" data-center-x="${barCenter.toFixed(2)}" x="${barCenter.toFixed(2)}" y="${axisY + 17}"><tspan x="${barCenter.toFixed(2)}">${row.codon[0]}</tspan><tspan x="${barCenter.toFixed(2)}" dy="10">${row.codon[1]}</tspan><tspan x="${barCenter.toFixed(2)}" dy="10">${row.codon[2]}</tspan></text>`
    );
  });

  parts.push(`<text x="${margin.left}" y="${height - 14}">Bar height is observed codon count.</text>`);
  parts.push("</svg>");
  return parts.join("\n");
}

function selectPlotRows(analyzedRecords, allRows) {
  if (analyzedRecords.length > 1) {
    return {
      title: "Total",
      rows: allRows.filter((row) => row.record === "Total")
    };
  }

  return {
    title: analyzedRecords[0]?.title ?? "Codon Usage",
    rows: analyzedRecords[0]?.rows ?? allRows
  };
}

export function calculateCodonUsage(sequence, options = {}) {
  return countCodons(sequence, options);
}

export function runCodonUsage(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  const analyzedRecords = [];
  const allRows = [];
  const code = getGeneticCode(options.geneticCode ?? "1");
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: false
    });
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(
        `${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`
      );
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }

    const usage = calculateCodonUsage(cleaned.sequence, {
      ...options,
      geneticCode: code.id
    });

    if (usage.ambiguousCodons > 0) {
      warnings.push(`${record.title}: skipped ${usage.ambiguousCodons} ambiguous codon(s).`);
    }

    if (usage.terminalStopsExcluded > 0) {
      warnings.push(`${record.title}: excluded terminal stop codon from usage counts.`);
    }

    if (usage.trailingBases > 0) {
      warnings.push(`${record.title}: ignored ${usage.trailingBases} trailing base(s).`);
    }

    const rows = buildRows(record.title, usage);
    analyzedRecords.push({ title: record.title, usage, rows });
    allRows.push(...rows);
  }

  if (analyzedRecords.length > 1) {
    const totalUsage = mergeUsages(
      analyzedRecords.map((record) => record.usage),
      code
    );
    const totalRows = buildRows("Total", totalUsage);
    analyzedRecords.push({ title: "Total", usage: totalUsage, rows: totalRows });
    allRows.push(...totalRows);
  }

  const outputFormats = new Set(["report", "tsv", "svg-plot"]);
  const outputFormat = outputFormats.has(options.outputFormat) ? options.outputFormat : "report";
  const plot = selectPlotRows(analyzedRecords, allRows);
  const svgPlot = makeSvgPlot(plot.rows, plot.title);
  const output =
    outputFormat === "tsv"
      ? makeTsv(allRows)
      : outputFormat === "svg-plot"
        ? svgPlot
        : makeReport(analyzedRecords);
  return makeToolResult({
    output,
    download: {
      filename: `codon-usage.${outputFormat === "tsv" ? "tsv" : outputFormat === "svg-plot" ? "svg" : "txt"}`,
      mimeType:
        outputFormat === "tsv"
          ? "text/tab-separated-values"
          : outputFormat === "svg-plot"
            ? "image/svg+xml;charset=utf-8"
            : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(makeReport(analyzedRecords), "text/plain"),
      table: makeTableStream(codonUsageTableColumns, allRows, "codon-usage"),
      plot: makeTextStream(svgPlot, "image/svg+xml")
    },
    visual: outputFormat === "svg-plot" ? { svg: svgPlot } : undefined
  });
}
