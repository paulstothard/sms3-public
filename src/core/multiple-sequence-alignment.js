import { formatFastaRecord, parseSequenceInput } from "./fasta.js";
import { alignPairwiseAffine } from "./pairwise-alignment.js";
import { cleanDnaRnaSequence, cleanProteinSequence } from "./sequence.js";

export const multipleAlignmentTableColumns = [
  { id: "alignment_position", label: "Alignment position", type: "number" },
  { id: "consensus", label: "Consensus", type: "string" },
  { id: "gap_count", label: "Gap count", type: "number" },
  { id: "symbols", label: "Symbols", type: "string" }
];

const MAX_MSA_SEQUENCES = 25;
const MAX_MSA_TOTAL_SYMBOLS = 12000;

function cleanForAlphabet(record, alphabet) {
  const cleaner = alphabet === "protein" ? cleanProteinSequence : cleanDnaRnaSequence;
  return cleaner(record.sequence, { preserveCase: false, keepGaps: false });
}

function normalizeOptions(options = {}) {
  return {
    alphabet: options.alphabet === "protein" ? "protein" : "dna-rna",
    gapOpen: Number.parseFloat(options.gapOpen) || 10,
    gapExtend: Number.parseFloat(options.gapExtend) || 1,
    matchScore: Number.parseFloat(options.matchScore) || 5,
    mismatchScore: Number.parseFloat(options.mismatchScore) || -4,
    similarScore: Number.parseFloat(options.similarScore) || 1,
    lineWidth: Math.max(20, Math.min(120, Number.parseInt(options.lineWidth, 10) || 60))
  };
}

function prepareRecords(input, alphabet) {
  const warnings = [];
  const parsed = parseSequenceInput(input, "sequence");
  let charactersRemoved = 0;
  const records = parsed.map((record, index) => {
    const cleaned = cleanForAlphabet(record, alphabet);
    charactersRemoved += cleaned.removedCount;
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title || `Sequence ${index + 1}`}: removed ${cleaned.removedCount} character(s) outside the selected alphabet.`);
    }
    return {
      title: record.title || `Sequence ${index + 1}`,
      sequence: cleaned.sequence
    };
  }).filter((record) => record.sequence.length > 0);

  if (records.length < 2) {
    warnings.push("Provide at least two FASTA records for multiple sequence alignment.");
  }
  if (records.length > MAX_MSA_SEQUENCES) {
    warnings.push(`Only the first ${MAX_MSA_SEQUENCES} records were aligned.`);
  }
  const limitedRecords = records.slice(0, MAX_MSA_SEQUENCES);
  const totalSymbols = limitedRecords.reduce((sum, record) => sum + record.sequence.length, 0);
  if (totalSymbols > MAX_MSA_TOTAL_SYMBOLS) {
    throw new Error(`Multiple alignment input has ${totalSymbols.toLocaleString()} symbols. Reduce the number or length of sequences for this progressive browser-local aligner.`);
  }
  return { records: limitedRecords, warnings, charactersRemoved, totalSymbols };
}

function pairwiseOptions(options) {
  return {
    mode: "global",
    alphabet: options.alphabet,
    scoringMatrix: options.alphabet === "protein" ? "blosum62" : "identity",
    matchScore: options.matchScore,
    mismatchScore: options.mismatchScore,
    similarScore: options.similarScore,
    gapOpen: options.gapOpen,
    gapExtend: options.gapExtend
  };
}

async function chooseCenterRecord(records, options, context = {}) {
  const scores = new Array(records.length).fill(0);
  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      context.throwIfCancelled?.();
      const alignment = await alignPairwiseAffine(records[i].sequence, records[j].sequence, pairwiseOptions(options), context);
      const score = alignment.identityPercent - alignment.gapOpenings * 2;
      scores[i] += score;
      scores[j] += score;
    }
  }
  let bestIndex = 0;
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index] > scores[bestIndex]) {
      bestIndex = index;
    }
  }
  return { centerIndex: bestIndex, centerScores: scores };
}

function mergePairIntoProfile(profile, centerAligned, incomingAligned, incomingTitle) {
  if (!profile) {
    return {
      titles: ["__center__", incomingTitle],
      aligned: [centerAligned, incomingAligned]
    };
  }

  const merged = profile.aligned.map(() => []);
  const incoming = [];
  const masterCenter = profile.aligned[0];
  let i = 0;
  let j = 0;
  while (i < masterCenter.length || j < centerAligned.length) {
    const masterChar = masterCenter[i];
    const pairCenterChar = centerAligned[j];
    if (i >= masterCenter.length) {
      for (const row of merged) {
        row.push("-");
      }
      incoming.push(incomingAligned[j] ?? "-");
      j += 1;
    } else if (j >= centerAligned.length) {
      profile.aligned.forEach((sequence, rowIndex) => merged[rowIndex].push(sequence[i]));
      incoming.push("-");
      i += 1;
    } else if (masterChar === "-" && pairCenterChar !== "-") {
      profile.aligned.forEach((sequence, rowIndex) => merged[rowIndex].push(sequence[i]));
      incoming.push("-");
      i += 1;
    } else if (masterChar !== "-" && pairCenterChar === "-") {
      for (const row of merged) {
        row.push("-");
      }
      incoming.push(incomingAligned[j] ?? "-");
      j += 1;
    } else {
      profile.aligned.forEach((sequence, rowIndex) => merged[rowIndex].push(sequence[i]));
      incoming.push(incomingAligned[j] ?? "-");
      i += 1;
      j += 1;
    }
  }

  return {
    titles: [...profile.titles, incomingTitle],
    aligned: [...merged.map((row) => row.join("")), incoming.join("")]
  };
}

function consensusForColumn(symbols) {
  const residues = symbols.filter((symbol) => symbol !== "-");
  if (residues.length === 0) {
    return " ";
  }
  if (residues.every((symbol) => symbol === residues[0]) && residues.length === symbols.length) {
    return "*";
  }
  const counts = new Map();
  for (const symbol of residues) {
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }
  const best = Math.max(...counts.values());
  return best >= Math.max(2, Math.ceil(residues.length * 0.6)) ? ":" : " ";
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function summarizeMsa(records, titles, aligned, centerIndex, centerScores, options) {
  const alignmentLength = aligned[0]?.length ?? 0;
  const consensus = [];
  const rows = [];
  let fullyConserved = 0;
  let majorityColumns = 0;
  let gapColumns = 0;

  for (let index = 0; index < alignmentLength; index += 1) {
    const symbols = aligned.map((sequence) => sequence[index] ?? "-");
    const consensusSymbol = consensusForColumn(symbols);
    const gapCount = symbols.filter((symbol) => symbol === "-").length;
    if (consensusSymbol === "*") {
      fullyConserved += 1;
    } else if (consensusSymbol === ":") {
      majorityColumns += 1;
    }
    if (gapCount > 0) {
      gapColumns += 1;
    }
    consensus.push(consensusSymbol);
    rows.push({
      alignment_position: index + 1,
      consensus: consensusSymbol,
      gap_count: gapCount,
      symbols: symbols.join("")
    });
  }

  return {
    records,
    titles,
    aligned,
    consensus: consensus.join(""),
    rows,
    centerIndex,
    centerTitle: records[centerIndex].title,
    centerScores,
    alphabet: options.alphabet,
    alignmentLength,
    fullyConserved,
    majorityColumns,
    gapColumns
  };
}

export async function alignMultipleSequences(input, rawOptions = {}, context = {}) {
  const options = normalizeOptions(rawOptions);
  const prepared = prepareRecords(input, options.alphabet);
  if (prepared.records.length < 2) {
    return { ...prepared, alignment: null, options };
  }

  context.reportProgress?.({ phase: "choosing-center", progress: 0.1 });
  const { centerIndex, centerScores } = await chooseCenterRecord(prepared.records, options, context);
  const center = prepared.records[centerIndex];
  let profile = null;
  const others = prepared.records.map((record, index) => ({ record, index })).filter((item) => item.index !== centerIndex);
  for (let index = 0; index < others.length; index += 1) {
    context.throwIfCancelled?.();
    await context.yieldIfNeeded?.();
    const item = others[index];
    const pair = await alignPairwiseAffine(center.sequence, item.record.sequence, pairwiseOptions(options), context);
    profile = mergePairIntoProfile(profile, pair.alignmentA, pair.alignmentB, item.record.title);
    context.reportProgress?.({ phase: "progressive-alignment", progress: 0.35 + 0.55 * ((index + 1) / others.length) });
  }

  const titleToRecord = new Map(prepared.records.map((record) => [record.title, record]));
  const finalTitles = profile.titles.map((title, index) => index === 0 ? center.title : title);
  const ordered = finalTitles.map((title, index) => ({
    title,
    aligned: profile.aligned[index],
    record: titleToRecord.get(title) ?? center
  }));
  const alignment = summarizeMsa(
    ordered.map((item) => item.record),
    ordered.map((item) => item.title),
    ordered.map((item) => item.aligned),
    0,
    centerScores,
    options
  );
  return { ...prepared, alignment, options };
}

export function makeMultipleAlignmentReport(result) {
  if (!result.alignment) {
    return "";
  }
  const { alignment, options } = result;
  return [
    "Multiple sequence alignment",
    "",
    `Sequences aligned: ${alignment.titles.length}`,
    `Alphabet: ${options.alphabet === "protein" ? "protein" : "DNA/RNA"}`,
    `Method: progressive star alignment using a center sequence selected from pairwise global alignments`,
    `Center sequence: ${alignment.centerTitle}`,
    `Scoring: ${options.alphabet === "protein" ? "BLOSUM62" : `match ${options.matchScore}, similar ${options.similarScore}, mismatch ${options.mismatchScore}`}, gap open ${options.gapOpen}, gap extend ${options.gapExtend}`,
    `Aligned length: ${alignment.alignmentLength}`,
    `Fully conserved columns: ${alignment.fullyConserved}`,
    `Majority columns: ${alignment.majorityColumns}`,
    `Columns with gaps: ${alignment.gapColumns}`,
    "",
    "References: Needleman and Wunsch 1970; Gotoh 1982; Feng and Doolittle 1987; Henikoff and Henikoff 1992 for BLOSUM62 protein scoring."
  ].join("\n");
}

export function makeMultipleAlignmentFasta(alignment, lineWidth = 60) {
  return alignment.titles.map((title, index) =>
    formatFastaRecord(`${title} aligned`, alignment.aligned[index], lineWidth)
  ).join("\n");
}

export function makeMultipleAlignmentClustal(alignment, lineWidth = 60) {
  const width = Math.max(20, Math.min(120, Number.parseInt(lineWidth, 10) || 60));
  const names = alignment.titles.map((title) => title.replace(/\s+/g, "_").slice(0, 24) || "sequence");
  const labelWidth = Math.max(12, ...names.map((name) => name.length));
  const lines = ["CLUSTAL W multiple sequence alignment", ""];
  for (let index = 0; index < alignment.alignmentLength; index += width) {
    names.forEach((name, rowIndex) => {
      lines.push(`${name.padEnd(labelWidth)} ${alignment.aligned[rowIndex].slice(index, index + width)}`);
    });
    lines.push(`${"".padEnd(labelWidth)} ${alignment.consensus.slice(index, index + width)}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

export function makeMultipleAlignmentTsv(alignment) {
  const headers = multipleAlignmentTableColumns.map((column) => column.id);
  return [
    headers.join("\t"),
    ...alignment.rows.map((row) => headers.map((header) => row[header]).join("\t"))
  ].join("\n");
}

function columnFill(consensusSymbol, hasGap) {
  if (hasGap) {
    return "#e5e7eb";
  }
  if (consensusSymbol === "*") {
    return "#bbf7d0";
  }
  if (consensusSymbol === ":") {
    return "#dbeafe";
  }
  return "#fecaca";
}

export function makeMultipleAlignmentSvg(alignment, options = {}) {
  const blockWidth = Math.max(20, Math.min(120, Number.parseInt(options.lineWidth, 10) || 60));
  const cell = 15;
  const rowHeight = 17;
  const labelX = 24;
  const labelPixelWidth = 132;
  const maxSequenceLength = Math.max(...alignment.aligned.map((sequence) => sequence.replace(/-/g, "").length), 1);
  const coordinatePixelWidth = Math.max(6, String(maxSequenceLength).length) * 7;
  const left = labelX + labelPixelWidth + 12 + coordinatePixelWidth + 12;
  const startCoordinateX = left - 8;
  const endCoordinatePadding = 4;
  const blocks = Math.ceil(alignment.alignmentLength / blockWidth);
  const renderedBlockColumns = Math.min(blockWidth, alignment.alignmentLength);
  const top = 58;
  const blockGap = 58;
  const blockHeight = alignment.titles.length * rowHeight + 20;
  const width = left + renderedBlockColumns * cell + endCoordinatePadding + coordinatePixelWidth + 24;
  const height = top + blocks * (blockHeight + blockGap) + 58;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Colored multiple sequence alignment">`,
    "<style>",
    ".title{font:600 18px system-ui,sans-serif;fill:#111827}",
    ".note{font:12px system-ui,sans-serif;fill:#475569}",
    ".label{font:12px system-ui,sans-serif;fill:#334155}",
    ".coord{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#475569}",
    ".coord-start{text-anchor:end}",
    ".coord-end{text-anchor:start}",
    ".cell{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;text-anchor:middle;dominant-baseline:central;fill:#111827}",
    ".consensus{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#334155;text-anchor:middle;dominant-baseline:central}",
    ".legend{font:12px system-ui,sans-serif;fill:#475569}",
    "</style>",
    '<rect width="100%" height="100%" fill="white"/>',
    '<text class="title" x="24" y="30">Colored multiple sequence alignment</text>',
    `<text class="note" x="24" y="49">Coordinates count bases or amino acids and ignore gaps.</text>`
  ];

  const positions = alignment.aligned.map(() => 1);
  for (let block = 0; block < blocks; block += 1) {
    const start = block * blockWidth;
    const chunkLength = Math.min(blockWidth, alignment.alignmentLength - start);
    const blockTop = top + block * (blockHeight + blockGap);
    const consensusY = blockTop + alignment.titles.length * rowHeight + 9;

    alignment.titles.forEach((title, rowIndex) => {
      const y = blockTop + rowIndex * rowHeight;
      const chunk = alignment.aligned[rowIndex].slice(start, start + chunkLength);
      const count = chunk.replace(/-/g, "").length;
      const startCoord = positions[rowIndex];
      const endCoord = count > 0 ? positions[rowIndex] + count - 1 : positions[rowIndex] - 1;
      parts.push(`<text class="label" x="${labelX}" y="${y + 11}">${escapeXml(title.slice(0, 20))}</text>`);
      parts.push(`<text class="coord coord-start" x="${startCoordinateX}" y="${y + 11}">${count > 0 ? startCoord : ""}</text>`);
      parts.push(`<text class="coord coord-end" x="${left + chunkLength * cell + endCoordinatePadding}" y="${y + 11}">${count > 0 ? endCoord : ""}</text>`);
      for (let offset = 0; offset < chunkLength; offset += 1) {
        const columnIndex = start + offset;
        const symbol = alignment.aligned[rowIndex][columnIndex] ?? "-";
        const hasGap = alignment.rows[columnIndex].gap_count > 0;
        const fill = columnFill(alignment.consensus[columnIndex], hasGap);
        const x = left + offset * cell;
        parts.push(`<rect x="${x}" y="${y}" width="${cell - 1}" height="${cell}" fill="${fill}"></rect>`);
        parts.push(`<text class="cell" x="${x + cell / 2}" y="${y + cell / 2}">${escapeXml(symbol)}</text>`);
      }
      positions[rowIndex] += count;
    });

    parts.push(`<text class="label" x="${labelX}" y="${consensusY + 4}">Consensus</text>`);
    for (let offset = 0; offset < chunkLength; offset += 1) {
      const columnIndex = start + offset;
      const x = left + offset * cell;
      const symbol = alignment.consensus[columnIndex] === " " ? "." : alignment.consensus[columnIndex];
      parts.push(`<text class="consensus" x="${x + cell / 2}" y="${consensusY}">${escapeXml(symbol)}</text>`);
    }
  }

  parts.push(`<text class="legend" x="24" y="${height - 32}">Green fully conserved; blue majority conserved; red variable; gray gap column.</text>`);
  parts.push(`<text class="legend" x="24" y="${height - 14}">Consensus: * fully conserved, : majority conserved, . variable.</text>`);
  parts.push("</svg>");
  return parts.join("\n");
}
