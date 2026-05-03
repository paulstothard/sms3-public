import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import { getGeneticCode, getStartCodons, getStopCodons, makeCodonMap } from "../../core/genetic-code.js";
import { cleanDnaRnaSequence, complementDnaRnaSequence } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const FORWARD_FRAMES = [
  { label: "+1", strand: "+", offset: 0 },
  { label: "+2", strand: "+", offset: 1 },
  { label: "+3", strand: "+", offset: 2 }
];

const REVERSE_FRAMES = [
  { label: "-1", strand: "-", offset: 0 },
  { label: "-2", strand: "-", offset: 1 },
  { label: "-3", strand: "-", offset: 2 }
];
export const orfTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "orf", label: "ORF", type: "number" },
  { id: "frame", label: "Frame", type: "string" },
  { id: "strand", label: "Strand", type: "string" },
  { id: "start", label: "Start", type: "number" },
  { id: "end", label: "End", type: "number" },
  { id: "nt_length", label: "Nucleotide length", type: "number" },
  { id: "aa_length", label: "Amino acid length", type: "number" },
  { id: "start_codon", label: "Start codon", type: "string" },
  { id: "stop_codon", label: "Stop codon", type: "string" },
  { id: "complete", label: "Complete", type: "boolean" }
];

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

function normalizeSequence(sequence) {
  return String(sequence ?? "").toUpperCase().replaceAll("U", "T");
}

function translateCodon(codon, codonMap) {
  return codonMap.get(codon) ?? "X";
}

function getFrames(strandOption) {
  if (strandOption === "forward") {
    return FORWARD_FRAMES;
  }
  if (strandOption === "reverse") {
    return REVERSE_FRAMES;
  }
  return [...FORWARD_FRAMES, ...REVERSE_FRAMES];
}

function mapCoordinates(sequenceLength, frame, startIndex, endExclusive) {
  if (frame.strand === "+") {
    return {
      start: startIndex + 1,
      end: endExclusive
    };
  }

  return {
    start: sequenceLength - endExclusive + 1,
    end: sequenceLength - startIndex
  };
}

function makeOrf({ sequence, sequenceLength, frame, startIndex, endExclusive, stopCodon, protein }) {
  const coordinates = mapCoordinates(sequenceLength, frame, startIndex, endExclusive);
  return {
    frame: frame.label,
    strand: frame.strand,
    start: coordinates.start,
    end: coordinates.end,
    ntLength: endExclusive - startIndex,
    aaLength: protein.length,
    startCodon: sequence.slice(startIndex, startIndex + 3),
    stopCodon,
    complete: stopCodon !== "",
    nucleotide: sequence.slice(startIndex, endExclusive),
    protein
  };
}

function findStartCodonOrfs(sequence, frame, context) {
  const orfs = [];
  let activeOrfs = [];

  for (let index = frame.offset; index + 3 <= sequence.length; index += 3) {
    const codon = sequence.slice(index, index + 3);

    if (context.stopCodons.has(codon)) {
      for (const active of activeOrfs) {
        orfs.push(
          makeOrf({
            sequence,
            sequenceLength: context.sequenceLength,
            frame,
            startIndex: active.startIndex,
            endExclusive: index + 3,
            stopCodon: codon,
            protein: active.protein
          })
        );
      }
      activeOrfs = [];
      continue;
    }

    for (const active of activeOrfs) {
      if (index !== active.startIndex) {
        active.protein += translateCodon(codon, context.codonMap);
      }
    }

    if (context.startCodons.has(codon) && (context.nestedMode === "all-starts" || activeOrfs.length === 0)) {
      activeOrfs.push({ startIndex: index, protein: "M" });
    }
  }

  if (context.includePartial) {
    for (const active of activeOrfs) {
      orfs.push(
        makeOrf({
          sequence,
          sequenceLength: context.sequenceLength,
          frame,
          startIndex: active.startIndex,
          endExclusive: active.startIndex + active.protein.length * 3,
          stopCodon: "",
          protein: active.protein
        })
      );
    }
  }

  return orfs;
}

function findAnyCodonOrfs(sequence, frame, context) {
  const orfs = [];
  let activeStart = frame.offset;
  let protein = "";

  for (let index = frame.offset; index + 3 <= sequence.length; index += 3) {
    const codon = sequence.slice(index, index + 3);

    if (context.stopCodons.has(codon)) {
      orfs.push(
        makeOrf({
          sequence,
          sequenceLength: context.sequenceLength,
          frame,
          startIndex: activeStart,
          endExclusive: index + 3,
          stopCodon: codon,
          protein
        })
      );
      activeStart = index + 3;
      protein = "";
      continue;
    }

    protein += translateCodon(codon, context.codonMap);
  }

  if (protein.length > 0 && context.includePartial) {
    orfs.push(
      makeOrf({
        sequence,
        sequenceLength: context.sequenceLength,
        frame,
        startIndex: activeStart,
        endExclusive: activeStart + protein.length * 3,
        stopCodon: "",
        protein
      })
    );
  }

  return orfs;
}

async function findStartCodonOrfsWithContext(sequence, frame, context, workerContext = {}) {
  const orfs = [];
  let activeOrfs = [];

  for (let index = frame.offset; index + 3 <= sequence.length; index += 3) {
    if (index > frame.offset && index % 30000 === frame.offset) {
      await workerContext.yieldIfNeeded?.();
    } else {
      workerContext.throwIfCancelled?.();
    }

    const codon = sequence.slice(index, index + 3);

    if (context.stopCodons.has(codon)) {
      for (const active of activeOrfs) {
        orfs.push(
          makeOrf({
            sequence,
            sequenceLength: context.sequenceLength,
            frame,
            startIndex: active.startIndex,
            endExclusive: index + 3,
            stopCodon: codon,
            protein: active.protein
          })
        );
      }
      activeOrfs = [];
      continue;
    }

    for (const active of activeOrfs) {
      if (index !== active.startIndex) {
        active.protein += translateCodon(codon, context.codonMap);
      }
    }

    if (context.startCodons.has(codon) && (context.nestedMode === "all-starts" || activeOrfs.length === 0)) {
      activeOrfs.push({ startIndex: index, protein: "M" });
    }
  }

  if (context.includePartial) {
    for (const active of activeOrfs) {
      orfs.push(
        makeOrf({
          sequence,
          sequenceLength: context.sequenceLength,
          frame,
          startIndex: active.startIndex,
          endExclusive: active.startIndex + active.protein.length * 3,
          stopCodon: "",
          protein: active.protein
        })
      );
    }
  }

  return orfs;
}

async function findAnyCodonOrfsWithContext(sequence, frame, context, workerContext = {}) {
  const orfs = [];
  let activeStart = frame.offset;
  let protein = "";

  for (let index = frame.offset; index + 3 <= sequence.length; index += 3) {
    if (index > frame.offset && index % 30000 === frame.offset) {
      await workerContext.yieldIfNeeded?.();
    } else {
      workerContext.throwIfCancelled?.();
    }

    const codon = sequence.slice(index, index + 3);

    if (context.stopCodons.has(codon)) {
      orfs.push(
        makeOrf({
          sequence,
          sequenceLength: context.sequenceLength,
          frame,
          startIndex: activeStart,
          endExclusive: index + 3,
          stopCodon: codon,
          protein
        })
      );
      activeStart = index + 3;
      protein = "";
      continue;
    }

    protein += translateCodon(codon, context.codonMap);
  }

  if (protein.length > 0 && context.includePartial) {
    orfs.push(
      makeOrf({
        sequence,
        sequenceLength: context.sequenceLength,
        frame,
        startIndex: activeStart,
        endExclusive: activeStart + protein.length * 3,
        stopCodon: "",
        protein
      })
    );
  }

  return orfs;
}

function sortOrfs(orfs, sortBy = "start") {
  const byStart = (left, right) =>
    left.start - right.start || left.end - right.end || left.frame.localeCompare(right.frame);
  const byFrame = (left, right) =>
    left.strand.localeCompare(right.strand) ||
    left.frame.localeCompare(right.frame) ||
    left.start - right.start ||
    left.end - right.end;

  return [...orfs].sort((left, right) => {
    if (sortBy === "length-desc") {
      return right.aaLength - left.aaLength || byStart(left, right);
    }
    if (sortBy === "frame") {
      return byFrame(left, right);
    }
    if (sortBy === "complete") {
      return Number(right.complete) - Number(left.complete) || byStart(left, right);
    }
    return byStart(left, right);
  });
}

export function findOrfs(sequence, options = {}) {
  const normalized = normalizeSequence(sequence);
  const code = getGeneticCode(options.geneticCode ?? "1");
  const context = {
    codonMap: makeCodonMap(code),
    startCodons: getStartCodons(code),
    stopCodons: getStopCodons(code),
    includePartial: options.includePartial !== false,
    nestedMode: options.nestedMode === "all-starts" ? "all-starts" : "first-start",
    sequenceLength: normalized.length
  };
  const frames = getFrames(options.strand);
  const minimumAminoAcids = Math.max(1, Number.parseInt(options.minimumAminoAcids, 10) || 1);
  const startMode = options.startMode === "any-codon" ? "any-codon" : "start-codon";
  const orfs = [];

  for (const frame of frames) {
    const frameSequence = frame.strand === "-" ? reverseComplement(normalized) : normalized;
    const frameOrfs =
      startMode === "any-codon"
        ? findAnyCodonOrfs(frameSequence, frame, context)
        : findStartCodonOrfs(frameSequence, frame, context);

    orfs.push(...frameOrfs.filter((orf) => orf.aaLength >= minimumAminoAcids));
  }

  return sortOrfs(orfs, options.sortBy);
}

async function findOrfsWithContext(sequence, options = {}, workerContext = {}) {
  const normalized = normalizeSequence(sequence);
  const code = getGeneticCode(options.geneticCode ?? "1");
  const context = {
    codonMap: makeCodonMap(code),
    startCodons: getStartCodons(code),
    stopCodons: getStopCodons(code),
    includePartial: options.includePartial !== false,
    nestedMode: options.nestedMode === "all-starts" ? "all-starts" : "first-start",
    sequenceLength: normalized.length
  };
  const frames = getFrames(options.strand);
  const minimumAminoAcids = Math.max(1, Number.parseInt(options.minimumAminoAcids, 10) || 1);
  const startMode = options.startMode === "any-codon" ? "any-codon" : "start-codon";
  const orfs = [];

  for (const [index, frame] of frames.entries()) {
    await workerContext.yieldIfNeeded?.();
    const frameSequence = frame.strand === "-" ? reverseComplement(normalized) : normalized;
    const frameOrfs =
      startMode === "any-codon"
        ? await findAnyCodonOrfsWithContext(frameSequence, frame, context, workerContext)
        : await findStartCodonOrfsWithContext(frameSequence, frame, context, workerContext);

    orfs.push(...frameOrfs.filter((orf) => orf.aaLength >= minimumAminoAcids));
    workerContext.reportProgress?.({
      phase: "scanning-frames",
      progress: (index + 1) / frames.length,
      framesProcessed: index + 1,
      totalFrames: frames.length
    });
  }

  return sortOrfs(orfs, options.sortBy);
}

function formatOrfRow(recordTitle, index, orf) {
  return [
    recordTitle,
    index,
    orf.frame,
    orf.strand,
    orf.start,
    orf.end,
    orf.ntLength,
    orf.aaLength,
    orf.startCodon,
    orf.stopCodon || ".",
    orf.complete ? "yes" : "no"
  ];
}

function makeTsv(records) {
  const rows = [
    [
      "record",
      "orf",
      "frame",
      "strand",
      "start",
      "end",
      "nt_length",
      "aa_length",
      "start_codon",
      "stop_codon",
      "complete"
    ].join("\t")
  ];

  for (const record of records) {
    record.orfs.forEach((orf, index) => {
      rows.push(formatOrfRow(record.title, index + 1, orf).join("\t"));
    });
  }

  return rows.join("\n");
}

function makeReport(records) {
  const lines = [];

  for (const record of records) {
    lines.push(`${record.title} ORFs`);
    if (record.orfs.length === 0) {
      lines.push("No ORFs matched the selected options.");
      lines.push("");
      continue;
    }

    lines.push("orf\tframe\tstrand\tstart\tend\tnt_length\taa_length\tstart_codon\tstop_codon\tcomplete");
    record.orfs.forEach((orf, index) => {
      lines.push(formatOrfRow("", index + 1, orf).slice(1).join("\t"));
    });
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function makeFastaHeader(recordTitle, index, orf) {
  return `record=${recordTitle} orf=${index} strand=${orf.strand} frame=${orf.frame} start=${orf.start} end=${orf.end} aa_length=${orf.aaLength} complete=${orf.complete ? "yes" : "no"}`;
}

function makeNucleotideFasta(records) {
  const outputParts = [];

  for (const record of records) {
    record.orfs.forEach((orf, index) => {
      outputParts.push(formatFastaRecord(makeFastaHeader(record.title, index + 1, orf), orf.nucleotide, 60));
    });
  }

  return outputParts.join("\n");
}

function makeProteinFasta(records, includeStopInProtein = false) {
  const outputParts = [];

  for (const record of records) {
    record.orfs.forEach((orf, index) => {
      const protein = includeStopInProtein && orf.complete ? `${orf.protein}*` : orf.protein;
      outputParts.push(formatFastaRecord(makeFastaHeader(record.title, index + 1, orf), protein, 60));
    });
  }

  return outputParts.join("\n");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function makeSvgOverview(records) {
  const width = 980;
  const left = 90;
  const right = 24;
  const laneHeight = 26;
  const recordGap = 36;
  const titleHeight = 28;
  const plotWidth = width - left - right;
  const frames = ["+1", "+2", "+3", "-1", "-2", "-3"];
  let y = 24;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 1" role="img" aria-label="ORF overview">`,
    "<style>text{font-family:Inter,Arial,sans-serif;font-size:12px;fill:#172026}.axis{stroke:#cfd8df}.complete{fill:#0f766e}.partial{fill:#b7791f}.lane{stroke:#eef2f5;stroke-width:8;stroke-linecap:round}</style>"
  ];

  for (const record of records) {
    const maxEnd = Math.max(1, ...record.orfs.map((orf) => orf.end));
    parts.push(`<text x="16" y="${y}">${escapeXml(record.title)} (${record.orfs.length} ORFs)</text>`);
    y += titleHeight;

    for (const frame of frames) {
      const laneY = y + laneHeight / 2;
      parts.push(`<text x="24" y="${laneY + 4}">${frame}</text>`);
      parts.push(`<line class="lane" x1="${left}" y1="${laneY}" x2="${width - right}" y2="${laneY}"></line>`);

      for (const orf of record.orfs.filter((item) => item.frame === frame)) {
        const x = left + ((orf.start - 1) / maxEnd) * plotWidth;
        const rectWidth = Math.max(2, ((orf.end - orf.start + 1) / maxEnd) * plotWidth);
        const className = orf.complete ? "complete" : "partial";
        parts.push(
          `<rect class="${className}" x="${x.toFixed(2)}" y="${laneY - 6}" width="${rectWidth.toFixed(2)}" height="12" rx="2"><title>${escapeXml(`${record.title} ${orf.frame} ${orf.start}-${orf.end} ${orf.aaLength} aa ${orf.complete ? "complete" : "partial"}`)}</title></rect>`
        );
      }

      y += laneHeight;
    }

    parts.push(`<line class="axis" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line>`);
    parts.push(`<text x="${left}" y="${y + 16}">1</text>`);
    parts.push(`<text x="${width - right - 36}" y="${y + 16}">${maxEnd}</text>`);
    y += recordGap;
  }

  parts[0] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${Math.max(120, y)}" role="img" aria-label="ORF overview">`;
  parts.push("</svg>");
  return parts.join("\n");
}

function makeOutput(records, options) {
  if (options.outputFormat === "tsv") {
    return makeTsv(records);
  }
  if (options.outputFormat === "nucleotide-fasta") {
    return makeNucleotideFasta(records);
  }
  if (options.outputFormat === "protein-fasta") {
    return makeProteinFasta(records, options.includeStopInProtein === true);
  }
  if (options.outputFormat === "svg-overview") {
    return makeSvgOverview(records);
  }
  return makeReport(records);
}

function makeOrfRows(records) {
  return records.flatMap((record) =>
    record.orfs.map((orf, index) => ({
      record: record.title,
      orf: index + 1,
      frame: orf.frame,
      strand: orf.strand,
      start: orf.start,
      end: orf.end,
      nt_length: orf.ntLength,
      aa_length: orf.aaLength,
      start_codon: orf.startCodon,
      stop_codon: orf.stopCodon,
      complete: orf.complete
    }))
  );
}

function makeOrfRecords(records) {
  return records.flatMap((record) =>
    record.orfs.map((orf, index) => ({
      record: record.title,
      orf: index + 1,
      header: makeFastaHeader(record.title, index + 1, orf),
      ...orf
    }))
  );
}

function getDownloadExtension(outputFormat) {
  if (outputFormat === "tsv") {
    return "tsv";
  }
  if (outputFormat === "nucleotide-fasta" || outputFormat === "protein-fasta") {
    return "fasta";
  }
  if (outputFormat === "svg-overview") {
    return "svg";
  }
  return "txt";
}

function getMimeType(outputFormat) {
  if (outputFormat === "svg-overview") {
    return "image/svg+xml;charset=utf-8";
  }
  if (outputFormat === "tsv") {
    return "text/tab-separated-values;charset=utf-8";
  }
  if (outputFormat === "nucleotide-fasta" || outputFormat === "protein-fasta") {
    return "text/x-fasta;charset=utf-8";
  }
  return "text/plain;charset=utf-8";
}

function normalizeOutputFormat(outputFormat) {
  const outputFormats = new Set(["report", "tsv", "nucleotide-fasta", "protein-fasta", "svg-overview"]);
  return outputFormats.has(outputFormat) ? outputFormat : "report";
}

function makeOrfFinderResult({ analyzedRecords, warnings, recordsProcessed, basesProcessed, charactersRemoved, options }) {
  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const output = makeOutput(analyzedRecords, { ...options, outputFormat });
  const reportOutput = makeReport(analyzedRecords);
  const tsvOutput = makeTsv(analyzedRecords);
  const nucleotideFastaOutput = makeNucleotideFasta(analyzedRecords);
  const proteinFastaOutput = makeProteinFasta(analyzedRecords, options.includeStopInProtein === true);
  const svgOverviewOutput = makeSvgOverview(analyzedRecords);

  return makeToolResult({
    output,
    visual: outputFormat === "svg-overview" ? { svg: output } : undefined,
    download: {
      filename: `orf-finder.${getDownloadExtension(outputFormat)}`,
      mimeType: getMimeType(outputFormat)
    },
    warnings,
    recordsProcessed,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(reportOutput, "text/plain"),
      tsv: makeTextStream(tsvOutput, "text/tab-separated-values"),
      table: makeTableStream(orfTableColumns, makeOrfRows(analyzedRecords), "orf-finder"),
      nucleotideFasta: makeTextStream(nucleotideFastaOutput, "text/x-fasta"),
      proteinFasta: makeTextStream(proteinFastaOutput, "text/x-fasta"),
      overview: makeTextStream(svgOverviewOutput, "image/svg+xml"),
      orfRecords: {
        kind: "orf-records",
        schema: "orf-finder",
        records: makeOrfRecords(analyzedRecords)
      }
    }
  });
}

export function runOrfFinder(input, options = {}) {
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

    analyzedRecords.push({
      title: record.title,
      orfs: findOrfs(cleaned.sequence, options)
    });
  }

  return makeOrfFinderResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    options
  });
}

export async function runOrfFinderWorker(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.03 });
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
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const [index, record] of records.entries()) {
    await context.yieldIfNeeded?.();
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

    const orfs = await findOrfsWithContext(cleaned.sequence, options, context);
    analyzedRecords.push({
      title: record.title,
      orfs
    });
    context.reportProgress?.({
      phase: "scanning-records",
      progress: 0.03 + ((index + 1) / records.length) * 0.87,
      recordsProcessed: index + 1,
      totalRecords: records.length
    });
  }

  context.reportProgress?.({ phase: "building-output", progress: 0.95 });
  context.throwIfCancelled?.();
  return makeOrfFinderResult({
    analyzedRecords,
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    options
  });
}
