import { parseSequenceInput } from "../../core/fasta.js";
import { cleanDnaRnaSequence } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import { baseCompositionPlotTableColumns } from "./metadata.js";

const TSV_COLUMNS = baseCompositionPlotTableColumns.map((column) => column.id);
const METRIC_LABELS = {
  gc_percent: "GC percent",
  at_percent: "AT percent",
  gc_skew: "GC skew",
  at_skew: "AT skew",
  ambiguous_percent: "Ambiguous percent"
};

function normalizePositiveInteger(value, fallback, max = 1000000) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, parsed)) : fallback;
}

function formatNumber(value, digits = 3) {
  return value === null || value === undefined ? "n/a" : Number(value).toFixed(digits);
}

function countWindow(sequence) {
  const counts = { A: 0, C: 0, G: 0, TU: 0, ambiguous: 0 };
  for (const character of sequence) {
    if (character === "A") {
      counts.A += 1;
    } else if (character === "C") {
      counts.C += 1;
    } else if (character === "G") {
      counts.G += 1;
    } else if (character === "T" || character === "U") {
      counts.TU += 1;
    } else {
      counts.ambiguous += 1;
    }
  }
  return counts;
}

function divideOrNull(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function makeWindowRows(title, sequence, options) {
  if (!sequence) {
    return [];
  }

  const rows = [];
  const effectiveWindow = Math.min(options.windowSize, sequence.length);
  for (let start = 0; start <= sequence.length - effectiveWindow; start += options.stepSize) {
    const end = start + effectiveWindow;
    const windowSequence = sequence.slice(start, end);
    const counts = countWindow(windowSequence);
    const unambiguous = counts.A + counts.C + counts.G + counts.TU;
    const gcPercent = divideOrNull((counts.G + counts.C) * 100, unambiguous);
    const atPercent = divideOrNull((counts.A + counts.TU) * 100, unambiguous);
    const gcSkew = divideOrNull(counts.G - counts.C, counts.G + counts.C);
    const atSkew = divideOrNull(counts.A - counts.TU, counts.A + counts.TU);
    const ambiguousPercent = (counts.ambiguous / windowSequence.length) * 100;
    const values = {
      gc_percent: gcPercent,
      at_percent: atPercent,
      gc_skew: gcSkew,
      at_skew: atSkew,
      ambiguous_percent: ambiguousPercent
    };

    rows.push({
      record: title,
      window_start: start + 1,
      window_end: end,
      position: (start + 1 + end) / 2,
      window_size: windowSequence.length,
      a_count: counts.A,
      c_count: counts.C,
      g_count: counts.G,
      t_u_count: counts.TU,
      ambiguous_count: counts.ambiguous,
      gc_percent: gcPercent,
      at_percent: atPercent,
      gc_skew: gcSkew,
      at_skew: atSkew,
      ambiguous_percent: ambiguousPercent,
      metric_value: values[options.metric]
    });

    if (end === sequence.length) {
      break;
    }
  }

  return rows;
}

async function makeWindowRowsWithContext(title, sequence, options, context = {}) {
  if (!sequence) {
    return [];
  }

  const rows = [];
  const effectiveWindow = Math.min(options.windowSize, sequence.length);
  for (let start = 0; start <= sequence.length - effectiveWindow; start += options.stepSize) {
    if (rows.length > 0 && rows.length % 100 === 0) {
      await context.yieldIfNeeded?.();
    } else {
      context.throwIfCancelled?.();
    }
    const end = start + effectiveWindow;
    const windowSequence = sequence.slice(start, end);
    const counts = countWindow(windowSequence);
    const unambiguous = counts.A + counts.C + counts.G + counts.TU;
    const gcPercent = divideOrNull((counts.G + counts.C) * 100, unambiguous);
    const atPercent = divideOrNull((counts.A + counts.TU) * 100, unambiguous);
    const gcSkew = divideOrNull(counts.G - counts.C, counts.G + counts.C);
    const atSkew = divideOrNull(counts.A - counts.TU, counts.A + counts.TU);
    const ambiguousPercent = (counts.ambiguous / windowSequence.length) * 100;
    const values = {
      gc_percent: gcPercent,
      at_percent: atPercent,
      gc_skew: gcSkew,
      at_skew: atSkew,
      ambiguous_percent: ambiguousPercent
    };

    rows.push({
      record: title,
      window_start: start + 1,
      window_end: end,
      position: (start + 1 + end) / 2,
      window_size: windowSequence.length,
      a_count: counts.A,
      c_count: counts.C,
      g_count: counts.G,
      t_u_count: counts.TU,
      ambiguous_count: counts.ambiguous,
      gc_percent: gcPercent,
      at_percent: atPercent,
      gc_skew: gcSkew,
      at_skew: atSkew,
      ambiguous_percent: ambiguousPercent,
      metric_value: values[options.metric]
    });

    if (end === sequence.length) {
      break;
    }
  }

  return rows;
}

function makeTsv(rows) {
  return [
    TSV_COLUMNS.join("\t"),
    ...rows.map((row) =>
      TSV_COLUMNS.map((column) =>
        typeof row[column] === "number" ? formatNumber(row[column]) : row[column]
      ).join("\t")
    )
  ].join("\n");
}

function summarizeRows(rows) {
  const scoredRows = rows.filter((row) => row.metric_value !== null);
  if (scoredRows.length === 0) {
    return { min: null, max: null };
  }
  return {
    min: scoredRows.reduce((best, row) => (row.metric_value < best.metric_value ? row : best), scoredRows[0]),
    max: scoredRows.reduce((best, row) => (row.metric_value > best.metric_value ? row : best), scoredRows[0])
  };
}

function makeReport(records, metric) {
  const lines = [];
  for (const record of records) {
    const summary = summarizeRows(record.rows);
    lines.push(`${record.title} base composition plot`);
    lines.push(`Length: ${record.cleanedLength}`);
    lines.push(`Windows: ${record.rows.length}`);
    lines.push(`Metric: ${METRIC_LABELS[metric]}`);
    if (summary.min && summary.max) {
      lines.push(`Minimum: ${formatNumber(summary.min.metric_value)} at ${summary.min.window_start}-${summary.min.window_end}`);
      lines.push(`Maximum: ${formatNumber(summary.max.metric_value)} at ${summary.max.window_start}-${summary.max.window_end}`);
    } else {
      lines.push("Minimum: n/a");
      lines.push("Maximum: n/a");
    }
    lines.push("Method: sliding windows over cleaned DNA/RNA IUPAC sequence.");
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeSvgPlot(records, metric) {
  const width = 920;
  const height = 420;
  const margin = { top: 92, right: 30, bottom: 62, left: 62 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const colors = ["#0f766e", "#2563eb", "#a33a3a", "#7c3aed", "#64748b"];
  const plotRecords = records.filter((record) => record.rows.some((row) => row.metric_value !== null));
  const title = `${METRIC_LABELS[metric]} composition plot`;
  const values = plotRecords.flatMap((record) => record.rows.map((row) => row.metric_value).filter((value) => value !== null));
  const maxPosition = Math.max(1, ...plotRecords.flatMap((record) => record.rows.map((row) => row.position)));
  const yMin = metric.endsWith("_skew") ? -1 : 0;
  const yMax = metric.endsWith("_skew") ? 1 : 100;
  const scaleX = (position) => margin.left + ((position - 1) / Math.max(1, maxPosition - 1)) * plotWidth;
  const scaleY = (value) => margin.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const legendRows = Math.ceil(Math.min(plotRecords.length, colors.length) / 2);
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}">`,
    "<style>text{font-family:Inter,Arial,sans-serif;font-size:12px;fill:#172026}.axis{stroke:#5c6b75;stroke-width:1}.grid{stroke:#dfe7ec;stroke-width:1}.zero{stroke:#172026;stroke-width:1.2}.line{fill:none;stroke-width:2.4}.dot{stroke:#fff;stroke-width:1}</style>",
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
      parts.push(`<text x="${legendX + 34}" y="${legendY + 4}">${escapeXml(record.title)}</text>`);
    });
    parts.push(`</g>`);
  }

  for (const tick of metric.endsWith("_skew") ? [-1, -0.5, 0, 0.5, 1] : [0, 25, 50, 75, 100]) {
    const y = scaleY(tick);
    parts.push(`<line class="grid" x1="${margin.left}" y1="${y.toFixed(2)}" x2="${width - margin.right}" y2="${y.toFixed(2)}"></line>`);
    parts.push(`<text x="16" y="${(y + 4).toFixed(2)}">${tick}</text>`);
  }

  parts.push(`<line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>`);
  parts.push(`<line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>`);
  const xTicks = [...new Set([1, Math.round(maxPosition * 0.25), Math.round(maxPosition * 0.5), Math.round(maxPosition * 0.75), Math.round(maxPosition)])]
    .filter((tick) => tick >= 1 && tick <= maxPosition);
  for (const tick of xTicks) {
    const x = scaleX(tick);
    parts.push(`<line class="grid" x1="${x.toFixed(2)}" y1="${margin.top}" x2="${x.toFixed(2)}" y2="${height - margin.bottom}"></line>`);
    parts.push(`<text x="${(x - 8).toFixed(2)}" y="${height - margin.bottom + 18}">${tick}</text>`);
  }
  if (metric.endsWith("_skew")) {
    const zeroY = scaleY(0);
    parts.push(`<line class="zero" x1="${margin.left}" y1="${zeroY.toFixed(2)}" x2="${width - margin.right}" y2="${zeroY.toFixed(2)}"></line>`);
  }

  plotRecords.forEach((record, index) => {
    const color = colors[index % colors.length];
    const points = record.rows
      .filter((row) => row.metric_value !== null)
      .map((row) => `${scaleX(row.position).toFixed(2)},${scaleY(row.metric_value).toFixed(2)}`);
    if (points.length > 1) {
      parts.push(`<polyline class="line" stroke="${color}" points="${points.join(" ")}"></polyline>`);
    }
    for (const row of record.rows.filter((item) => item.metric_value !== null)) {
      parts.push(
        `<circle class="dot" cx="${scaleX(row.position).toFixed(2)}" cy="${scaleY(row.metric_value).toFixed(2)}" r="3" fill="${color}"><title>${escapeXml(`${record.title} ${row.window_start}-${row.window_end}: ${formatNumber(row.metric_value)}`)}</title></circle>`
      );
    }
  });

  if (values.length === 0) {
    parts.push(`<text x="${margin.left}" y="${margin.top + 28}">No plottable windows.</text>`);
  }
  parts.push(`<text x="${margin.left}" y="${height - 18}">Position (window midpoint)</text>`);
  parts.push("</svg>");
  return parts.join("\n");
}

function normalizeBaseCompositionOptions(options = {}) {
  const metric = Object.hasOwn(METRIC_LABELS, options.metric) ? options.metric : "gc_percent";
  return {
    metric,
    windowSize: normalizePositiveInteger(options.windowSize, 100),
    stepSize: normalizePositiveInteger(options.stepSize, 25),
    keepGaps: options.keepGaps === true,
    outputFormat: new Set(["report", "tsv", "svg-plot"]).has(options.outputFormat)
      ? options.outputFormat
      : "svg-plot"
  };
}

function makeBaseCompositionResult({
  analyzedRecords,
  warnings,
  recordsProcessed,
  basesProcessed,
  charactersRemoved,
  metric,
  outputFormat
}) {
  const tableRows = analyzedRecords.flatMap((record) => record.rows);
  const reportOutput = makeReport(analyzedRecords, metric);
  const svgPlot = makeSvgPlot(analyzedRecords, metric);
  const output = outputFormat === "report" ? reportOutput : outputFormat === "tsv" ? makeTsv(tableRows) : svgPlot;

  return makeToolResult({
    output,
    download: {
      filename: `base-composition-plot.${outputFormat === "tsv" ? "tsv" : outputFormat === "svg-plot" ? "svg" : "txt"}`,
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
      table: makeTableStream(baseCompositionPlotTableColumns, tableRows, "base-composition-plot"),
      plot: makeTextStream(svgPlot, "image/svg+xml")
    },
    visual: outputFormat === "svg-plot" ? { svg: svgPlot } : undefined
  });
}

export function runBaseCompositionPlot(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const normalizedOptions = normalizeBaseCompositionOptions(options);

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
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: normalizedOptions.keepGaps
    });
    charactersRemoved += cleaned.removedCount;
    basesProcessed += cleaned.sequence.length;
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }
    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }
    if (cleaned.sequence.length > 0 && cleaned.sequence.length < normalizedOptions.windowSize) {
      warnings.push(`${record.title}: sequence shorter than requested window; used a ${cleaned.sequence.length}-base window.`);
    }
    const rows = makeWindowRows(record.title, cleaned.sequence, normalizedOptions);
    analyzedRecords.push({
      title: record.title,
      cleanedLength: cleaned.sequence.length,
      rows
    });
  }

  return makeBaseCompositionResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    metric: normalizedOptions.metric,
    outputFormat: normalizedOptions.outputFormat
  });
}

export async function runBaseCompositionPlotWorker(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const normalizedOptions = normalizeBaseCompositionOptions(options);

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
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const [index, record] of records.entries()) {
    await context.yieldIfNeeded?.();
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: normalizedOptions.keepGaps
    });
    charactersRemoved += cleaned.removedCount;
    basesProcessed += cleaned.sequence.length;
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }
    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }
    if (cleaned.sequence.length > 0 && cleaned.sequence.length < normalizedOptions.windowSize) {
      warnings.push(`${record.title}: sequence shorter than requested window; used a ${cleaned.sequence.length}-base window.`);
    }
    const rows = await makeWindowRowsWithContext(record.title, cleaned.sequence, normalizedOptions, context);
    analyzedRecords.push({
      title: record.title,
      cleanedLength: cleaned.sequence.length,
      rows
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
  return makeBaseCompositionResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    metric: normalizedOptions.metric,
    outputFormat: normalizedOptions.outputFormat
  });
}
