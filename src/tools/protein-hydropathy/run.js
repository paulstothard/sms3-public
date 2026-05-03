import { parseSequenceInput } from "../../core/fasta.js";
import {
  KYTE_DOOLITTLE_HYDROPATHY,
  cleanProteinSequence,
  getProteinGravy,
  getProteinHydropathyProfile
} from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const proteinHydropathyTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "position", label: "Position", type: "number" },
  { id: "window_start", label: "Window start", type: "number" },
  { id: "window_end", label: "Window end", type: "number" },
  { id: "window_size", label: "Window size", type: "number" },
  { id: "standard_residues", label: "Standard residues", type: "number" },
  { id: "excluded_symbols", label: "Excluded symbols", type: "number" },
  { id: "hydropathy", label: "Hydropathy", type: "number" }
];
const TSV_COLUMNS = proteinHydropathyTableColumns.map((column) => column.id);

function formatNumber(value, digits = 3) {
  return value === null ? "n/a" : value.toFixed(digits);
}

function normalizeWindowSize(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return 9;
  }
  return Math.min(1001, Math.max(1, parsed));
}

function normalizeOutputFormat(outputFormat) {
  const outputFormats = new Set(["report", "tsv", "svg-plot"]);
  return outputFormats.has(outputFormat) ? outputFormat : "report";
}

async function getProteinHydropathyProfileWithContext(sequence, options = {}, context = {}) {
  const source = String(sequence ?? "").toUpperCase();
  const scale = options.scale ?? KYTE_DOOLITTLE_HYDROPATHY;
  const requestedWindowSize = Math.max(1, Number.parseInt(options.windowSize, 10) || 9);
  const windowSize = source.length > 0 ? Math.min(requestedWindowSize, source.length) : requestedWindowSize;
  const rows = [];

  if (source.length === 0) {
    return {
      requestedWindowSize,
      windowSize,
      rows
    };
  }

  for (let start = 0; start + windowSize <= source.length; start += 1) {
    if (start > 0 && start % 500 === 0) {
      await context.yieldIfNeeded?.();
    } else {
      context.throwIfCancelled?.();
    }

    const end = start + windowSize;
    const window = source.slice(start, end);
    let total = 0;
    let standardResidues = 0;

    for (const character of window) {
      if (Object.hasOwn(scale, character)) {
        total += scale[character];
        standardResidues += 1;
      }
    }

    rows.push({
      position: (start + 1 + end) / 2,
      windowStart: start + 1,
      windowEnd: end,
      windowSize,
      standardResidues,
      excludedSymbols: window.length - standardResidues,
      hydropathy: standardResidues > 0 ? total / standardResidues : null
    });
  }

  return {
    requestedWindowSize,
    windowSize,
    rows
  };
}

function summarizeProfile(rows) {
  const scoredRows = rows.filter((row) => row.hydropathy !== null);
  if (scoredRows.length === 0) {
    return {
      min: null,
      max: null
    };
  }

  return {
    min: scoredRows.reduce((best, row) => (row.hydropathy < best.hydropathy ? row : best), scoredRows[0]),
    max: scoredRows.reduce((best, row) => (row.hydropathy > best.hydropathy ? row : best), scoredRows[0])
  };
}

function makeTableRows(records) {
  return records.flatMap((record) =>
    record.profile.rows.map((row) => ({
      record: record.title,
      position: row.position,
      window_start: row.windowStart,
      window_end: row.windowEnd,
      window_size: row.windowSize,
      standard_residues: row.standardResidues,
      excluded_symbols: row.excludedSymbols,
      hydropathy: row.hydropathy
    }))
  );
}

function makeReport(records) {
  const lines = [];

  for (const record of records) {
    const summary = summarizeProfile(record.profile.rows);
    lines.push(`${record.title} protein hydropathy`);
    lines.push(`Length: ${record.cleanedLength}`);
    lines.push(`Standard residues used for GRAVY: ${record.gravy.residueCount}`);
    lines.push(`GRAVY: ${formatNumber(record.gravy.value)}`);
    lines.push(`Requested window size: ${record.profile.requestedWindowSize}`);
    lines.push(`Profile window size used: ${record.profile.windowSize}`);
    lines.push(`Profile windows: ${record.profile.rows.length}`);
    if (summary.max) {
      lines.push(
        `Most hydrophobic window: ${formatNumber(summary.max.hydropathy)} at ${summary.max.windowStart}-${summary.max.windowEnd}`
      );
      lines.push(
        `Most hydrophilic window: ${formatNumber(summary.min.hydropathy)} at ${summary.min.windowStart}-${summary.min.windowEnd}`
      );
    } else {
      lines.push("Most hydrophobic window: n/a");
      lines.push("Most hydrophilic window: n/a");
    }
    lines.push("Method: Kyte-Doolittle hydropathy scale; windows average standard residues only.");
    lines.push("Reference: Kyte J, Doolittle RF. J Mol Biol. 1982;157:105-132; ExPASy ProtScale.");
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function makeTsv(rows) {
  return [
    TSV_COLUMNS.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        formatNumber(row.position, 1),
        row.window_start,
        row.window_end,
        row.window_size,
        row.standard_residues,
        row.excluded_symbols,
        formatNumber(row.hydropathy)
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

function makeSvgPlot(records) {
  const width = 920;
  const height = 420;
  const margin = { top: 92, right: 28, bottom: 62, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const axisY = margin.top + plotHeight / 2;
  const colors = ["#0f766e", "#b7791f", "#2563eb", "#a33a3a", "#64748b"];
  const plotRecords = records.filter((record) => record.profile.rows.some((row) => row.hydropathy !== null));
  const title = plotRecords.length === 1 ? `${plotRecords[0].title} hydropathy` : "Protein hydropathy";
  const maxPosition = Math.max(1, ...plotRecords.flatMap((record) => record.profile.rows.map((row) => row.position)));
  const yMin = -4.5;
  const yMax = 4.5;
  const scaleX = (position) => margin.left + ((position - 1) / Math.max(1, maxPosition - 1)) * plotWidth;
  const scaleY = (value) => margin.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const legendRows = Math.ceil(Math.min(plotRecords.length, colors.length) / 2);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)} plot">`,
    "<style>text{font-family:Inter,Arial,sans-serif;font-size:12px;fill:#172026}.axis{stroke:#5c6b75;stroke-width:1}.grid{stroke:#dfe7ec;stroke-width:1}.zero{stroke:#172026;stroke-width:1.2}.line{fill:none;stroke-width:2.4}.dot{stroke:#fff;stroke-width:1}.label{font-size:11px}</style>",
    `<rect width="${width}" height="${height}" fill="#ffffff"></rect>`,
    `<text x="${margin.left}" y="28" style="font-size:18px;font-weight:700">${escapeXml(title)}</text>`
  ];

  if (plotRecords.length > 0) {
    parts.push(`<g aria-label="Legend">`);
    parts.push(`<rect x="${margin.left}" y="38" width="${width - margin.left - margin.right}" height="${Math.max(26, legendRows * 20 + 8)}" rx="4" fill="#f8fafc" stroke="#dfe7ec"></rect>`);
    plotRecords.slice(0, colors.length).forEach((record, index) => {
      const legendX = margin.left + 14 + (index % 2) * 330;
      const legendY = 55 + Math.floor(index / 2) * 20;
      const color = colors[index % colors.length];
      parts.push(`<line stroke="${color}" stroke-width="3" x1="${legendX}" y1="${legendY}" x2="${legendX + 26}" y2="${legendY}"></line>`);
      parts.push(`<text class="label" x="${legendX + 34}" y="${legendY + 4}">${escapeXml(record.title)}</text>`);
    });
    parts.push(`</g>`);
  }

  for (let tick = -4; tick <= 4; tick += 2) {
    const y = scaleY(tick);
    parts.push(`<line class="grid" x1="${margin.left}" y1="${y.toFixed(2)}" x2="${width - margin.right}" y2="${y.toFixed(2)}"></line>`);
    parts.push(`<text x="18" y="${(y + 4).toFixed(2)}">${tick}</text>`);
  }

  parts.push(`<line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>`);
  parts.push(`<line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>`);
  parts.push(`<line class="zero" x1="${margin.left}" y1="${axisY.toFixed(2)}" x2="${width - margin.right}" y2="${axisY.toFixed(2)}"></line>`);
  const xTicks = [...new Set([1, Math.round(maxPosition * 0.25), Math.round(maxPosition * 0.5), Math.round(maxPosition * 0.75), Math.round(maxPosition)])]
    .filter((tick) => tick >= 1 && tick <= maxPosition);
  for (const tick of xTicks) {
    const x = scaleX(tick);
    parts.push(`<line class="grid" x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${height - margin.bottom}"></line>`);
    parts.push(`<text x="${(x - 8).toFixed(2)}" y="${height - margin.bottom + 18}">${tick}</text>`);
  }

  plotRecords.forEach((record, index) => {
    const color = colors[index % colors.length];
    const points = record.profile.rows
      .filter((row) => row.hydropathy !== null)
      .map((row) => `${scaleX(row.position).toFixed(2)},${scaleY(row.hydropathy).toFixed(2)}`);
    if (points.length > 1) {
      parts.push(`<polyline class="line" stroke="${color}" points="${points.join(" ")}"></polyline>`);
    }
    for (const row of record.profile.rows.filter((item) => item.hydropathy !== null)) {
      parts.push(
        `<circle class="dot" cx="${scaleX(row.position).toFixed(2)}" cy="${scaleY(row.hydropathy).toFixed(2)}" r="3" fill="${color}"><title>${escapeXml(`${record.title} ${row.windowStart}-${row.windowEnd}: ${formatNumber(row.hydropathy)}`)}</title></circle>`
      );
    }
  });

  parts.push(`<text x="${margin.left}" y="${height - 18}">Position is the window midpoint; positive Kyte-Doolittle values are more hydrophobic.</text>`);
  parts.push("</svg>");
  return parts.join("\n");
}

function makeHydropathyResult({ analyzedRecords, warnings, recordsProcessed, basesProcessed, charactersRemoved, outputFormat }) {
  const tableRows = makeTableRows(analyzedRecords);
  const reportOutput = makeReport(analyzedRecords);
  const svgPlot = makeSvgPlot(analyzedRecords);
  const output =
    outputFormat === "tsv" ? makeTsv(tableRows) : outputFormat === "svg-plot" ? svgPlot : reportOutput;

  return makeToolResult({
    output,
    download: {
      filename: `protein-hydropathy.${outputFormat === "tsv" ? "tsv" : outputFormat === "svg-plot" ? "svg" : "txt"}`,
      mimeType:
        outputFormat === "tsv"
          ? "text/tab-separated-values"
          : outputFormat === "svg-plot"
            ? "image/svg+xml;charset=utf-8"
            : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(reportOutput, "text/plain"),
      table: makeTableStream(proteinHydropathyTableColumns, tableRows, "protein-hydropathy"),
      plot: makeTextStream(svgPlot, "image/svg+xml")
    },
    visual: outputFormat === "svg-plot" ? { svg: svgPlot } : undefined
  });
}

export function runProteinHydropathy(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const windowSize = normalizeWindowSize(options.windowSize ?? 9);
  const outputFormat = normalizeOutputFormat(options.outputFormat);

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
  let charactersRemoved = 0;
  let basesProcessed = 0;

  for (const record of records) {
    const cleaned = cleanProteinSequence(record.sequence, {
      preserveCase: false,
      keepGaps: options.keepGaps !== false
    });
    charactersRemoved += cleaned.removedCount;
    basesProcessed += cleaned.sequence.length;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-protein character(s).`);
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no protein sequence characters were found.`);
    }

    const excludedSymbols = Array.from(cleaned.sequence).filter(
      (character) => !Object.hasOwn(KYTE_DOOLITTLE_HYDROPATHY, character)
    ).length;
    if (excludedSymbols > 0) {
      warnings.push(`${record.title}: excluded ${excludedSymbols} ambiguous, uncommon, stop, or gap symbol(s) from hydropathy values.`);
    }
    if (cleaned.sequence.length > 0 && cleaned.sequence.length < windowSize) {
      warnings.push(`${record.title}: sequence shorter than requested window; used a ${cleaned.sequence.length}-residue window.`);
    }

    analyzedRecords.push({
      title: record.title,
      cleanedLength: cleaned.sequence.length,
      gravy: getProteinGravy(cleaned.sequence),
      profile: getProteinHydropathyProfile(cleaned.sequence, { windowSize })
    });
  }

  return makeHydropathyResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    outputFormat
  });
}

export async function runProteinHydropathyWorker(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const windowSize = normalizeWindowSize(options.windowSize ?? 9);
  const outputFormat = normalizeOutputFormat(options.outputFormat);

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
  let charactersRemoved = 0;
  let basesProcessed = 0;

  for (const [index, record] of records.entries()) {
    await context.yieldIfNeeded?.();
    const cleaned = cleanProteinSequence(record.sequence, {
      preserveCase: false,
      keepGaps: options.keepGaps !== false
    });
    charactersRemoved += cleaned.removedCount;
    basesProcessed += cleaned.sequence.length;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-protein character(s).`);
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no protein sequence characters were found.`);
    }

    const excludedSymbols = Array.from(cleaned.sequence).filter(
      (character) => !Object.hasOwn(KYTE_DOOLITTLE_HYDROPATHY, character)
    ).length;
    if (excludedSymbols > 0) {
      warnings.push(`${record.title}: excluded ${excludedSymbols} ambiguous, uncommon, stop, or gap symbol(s) from hydropathy values.`);
    }
    if (cleaned.sequence.length > 0 && cleaned.sequence.length < windowSize) {
      warnings.push(`${record.title}: sequence shorter than requested window; used a ${cleaned.sequence.length}-residue window.`);
    }

    analyzedRecords.push({
      title: record.title,
      cleanedLength: cleaned.sequence.length,
      gravy: getProteinGravy(cleaned.sequence),
      profile: await getProteinHydropathyProfileWithContext(cleaned.sequence, { windowSize }, context)
    });
    context.reportProgress?.({
      phase: "building-windows",
      progress: 0.05 + ((index + 1) / records.length) * 0.85,
      recordsProcessed: index + 1,
      totalRecords: records.length
    });
  }

  context.reportProgress?.({ phase: "building-output", progress: 0.95 });
  context.throwIfCancelled?.();
  return makeHydropathyResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    outputFormat
  });
}
