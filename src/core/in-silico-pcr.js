import { formatFastaRecord, parseSequenceInput } from "./fasta.js";
import { cleanDnaRnaSequence, complementDnaRnaSequence } from "./sequence.js";

export const pcrProductTableColumns = [
  { id: "template", label: "Template", type: "string" },
  { id: "forward_primer", label: "Forward primer", type: "string" },
  { id: "reverse_primer", label: "Reverse primer", type: "string" },
  { id: "product", label: "Product", type: "number" },
  { id: "length", label: "Length", type: "number" },
  { id: "topology", label: "Topology", type: "string" },
  { id: "forward_start", label: "Forward start", type: "number" },
  { id: "forward_end", label: "Forward end", type: "number" },
  { id: "reverse_start", label: "Reverse start", type: "number" },
  { id: "reverse_end", label: "Reverse end", type: "number" },
  { id: "forward_mismatches", label: "Forward mismatches", type: "number" },
  { id: "reverse_mismatches", label: "Reverse mismatches", type: "number" },
  { id: "product_sequence", label: "Product sequence", type: "string" }
];

const DNA_SYMBOLS = {
  A: new Set(["A"]),
  C: new Set(["C"]),
  G: new Set(["G"]),
  T: new Set(["T", "U"]),
  U: new Set(["T", "U"]),
  R: new Set(["A", "G"]),
  Y: new Set(["C", "T", "U"]),
  S: new Set(["G", "C"]),
  W: new Set(["A", "T", "U"]),
  K: new Set(["G", "T", "U"]),
  M: new Set(["A", "C"]),
  B: new Set(["C", "G", "T", "U"]),
  D: new Set(["A", "G", "T", "U"]),
  H: new Set(["A", "C", "T", "U"]),
  V: new Set(["A", "C", "G"]),
  N: new Set(["A", "C", "G", "T", "U"])
};

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

function splitInput(input, separator = "---") {
  const pattern = new RegExp(`\\n${separator.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\n`);
  const parts = String(input ?? "").split(pattern);
  return {
    templateText: parts[0] ?? "",
    primerText: parts.slice(1).join(`\n${separator}\n`)
  };
}

function symbolsOverlap(left, right) {
  if (left === right) {
    return true;
  }
  const leftSet = DNA_SYMBOLS[left];
  const rightSet = DNA_SYMBOLS[right];
  if (!leftSet || !rightSet) {
    return false;
  }
  for (const symbol of leftSet) {
    if (rightSet.has(symbol)) {
      return true;
    }
  }
  return false;
}

function comparePrimerAt(template, primer, start, options) {
  let mismatches = 0;
  for (let index = 0; index < primer.length; index += 1) {
    if (!symbolsOverlap(primer[index], template[start + index])) {
      mismatches += 1;
      if (mismatches > options.maxMismatches) {
        return null;
      }
    }
  }
  if (options.exactThreePrimeBases > 0) {
    const exactStart = Math.max(0, primer.length - options.exactThreePrimeBases);
    for (let index = exactStart; index < primer.length; index += 1) {
      if (primer[index] !== template[start + index]) {
        return null;
      }
    }
  }
  return mismatches;
}

function parsePrimers(text, warnings) {
  const fastaRecords = parseSequenceInput(text, "sequence");
  const records = fastaRecords.length > 0
    ? fastaRecords
    : String(text ?? "")
      .split(/\r?\n/)
      .map((line, index) => ({ title: `Primer ${index + 1}`, sequence: line.trim() }))
      .filter((record) => record.sequence);

  return records.map((record, index) => {
    const cleaned = cleanDnaRnaSequence(record.sequence, { preserveCase: false, keepGaps: false });
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title || `Primer ${index + 1}`}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }
    return {
      title: record.title || `Primer ${index + 1}`,
      sequence: cleaned.sequence.replaceAll("U", "T")
    };
  }).filter((primer) => primer.sequence.length > 0);
}

function findPrimerBindingSites(template, primer, options) {
  const sites = [];
  const forwardPrimer = primer.sequence;
  const reversePrimer = reverseComplement(primer.sequence).replaceAll("U", "T");
  const scanTemplate = options.topology === "circular"
    ? template + template.slice(0, Math.max(0, primer.sequence.length - 1))
    : template;
  const limit = template.length;

  for (let start = 0; start < limit; start += 1) {
    if (start + primer.sequence.length > scanTemplate.length) {
      break;
    }
    const forwardMismatches = comparePrimerAt(scanTemplate, forwardPrimer, start, options);
    if (forwardMismatches !== null) {
      sites.push({
        primer: primer.title,
        primer_sequence: primer.sequence,
        strand: "+",
        start: start + 1,
        end: ((start + primer.sequence.length - 1) % template.length) + 1,
        startIndex: start,
        endIndex: start + primer.sequence.length - 1,
        mismatches: forwardMismatches
      });
    }
    const reverseMismatches = comparePrimerAt(scanTemplate, reversePrimer, start, options);
    if (reverseMismatches !== null) {
      sites.push({
        primer: primer.title,
        primer_sequence: primer.sequence,
        strand: "-",
        start: start + 1,
        end: ((start + primer.sequence.length - 1) % template.length) + 1,
        startIndex: start,
        endIndex: start + primer.sequence.length - 1,
        mismatches: reverseMismatches
      });
    }
  }
  return sites;
}

function circularSlice(sequence, startInclusive, endExclusive) {
  if (endExclusive <= sequence.length) {
    return sequence.slice(startInclusive, endExclusive);
  }
  return sequence.slice(startInclusive) + sequence.slice(0, endExclusive - sequence.length);
}

function productSequence(template, forwardSite, reverseSite, topology) {
  const start = forwardSite.startIndex;
  const end = reverseSite.endIndex + 1;
  if (topology === "linear") {
    return template.slice(start, end);
  }
  return circularSlice(template, start, end);
}

function makeProductRows(templateRecord, sites, options) {
  const rows = [];
  const forwardSites = sites.filter((site) => site.strand === "+");
  const reverseSites = sites.filter((site) => site.strand === "-");
  for (const forwardSite of forwardSites) {
    for (const reverseSite of reverseSites) {
      let length = reverseSite.endIndex - forwardSite.startIndex + 1;
      if (options.topology === "circular" && length <= 0) {
        length += templateRecord.sequence.length;
      }
      if (length < options.minProductLength || length > options.maxProductLength) {
        continue;
      }
      if (options.topology === "linear" && forwardSite.startIndex > reverseSite.startIndex) {
        continue;
      }
      rows.push({
        template: templateRecord.title,
        forward_primer: forwardSite.primer,
        reverse_primer: reverseSite.primer,
        product: rows.length + 1,
        length,
        topology: options.topology,
        forward_start: forwardSite.start,
        forward_end: forwardSite.end,
        reverse_start: reverseSite.start,
        reverse_end: reverseSite.end,
        forward_mismatches: forwardSite.mismatches,
        reverse_mismatches: reverseSite.mismatches,
        product_sequence: productSequence(templateRecord.sequence, forwardSite, reverseSite, options.topology)
      });
    }
  }
  return rows.sort((left, right) => left.length - right.length || left.forward_start - right.forward_start);
}

export function normalizePcrOptions(options = {}) {
  return {
    topology: options.topology === "circular" ? "circular" : "linear",
    maxMismatches: Math.max(0, Math.min(6, Number.parseInt(options.maxMismatches, 10) || 0)),
    exactThreePrimeBases: Math.max(0, Math.min(12, Number.parseInt(options.exactThreePrimeBases, 10) || 3)),
    minProductLength: Math.max(1, Number.parseInt(options.minProductLength, 10) || 20),
    maxProductLength: Math.max(1, Number.parseInt(options.maxProductLength, 10) || 5000)
  };
}

export function findInSilicoPcrProducts(input, options = {}) {
  const normalized = normalizePcrOptions(options);
  const warnings = [];
  const { templateText, primerText } = splitInput(input);
  const templateRecords = parseSequenceInput(templateText, "sequence");
  const primers = parsePrimers(primerText, warnings);
  if (templateRecords.length === 0) {
    return { records: [], primers, rows: [], warnings: ["No template sequence was provided."], charactersRemoved: 0 };
  }
  if (primers.length === 0) {
    return { records: [], primers, rows: [], warnings: ["No primer sequences were provided."], charactersRemoved: 0 };
  }

  let charactersRemoved = 0;
  const records = templateRecords.map((record, index) => {
    const cleaned = cleanDnaRnaSequence(record.sequence, { preserveCase: false, keepGaps: false });
    charactersRemoved += cleaned.removedCount;
    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title || `Template ${index + 1}`}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }
    return {
      title: record.title || `Template ${index + 1}`,
      sequence: cleaned.sequence.replaceAll("U", "T")
    };
  }).filter((record) => record.sequence.length > 0);

  const rows = [];
  for (const record of records) {
    const sites = primers.flatMap((primer) => findPrimerBindingSites(record.sequence, primer, normalized));
    const recordRows = makeProductRows(record, sites, normalized);
    rows.push(...recordRows.map((row) => ({ ...row, product: rows.length + row.product })));
  }
  return { records, primers, rows, warnings, charactersRemoved, options: normalized };
}

export function makePcrReport(result) {
  const lines = [];
  lines.push("In silico PCR");
  lines.push(`Templates: ${result.records.length}`);
  lines.push(`Primers: ${result.primers.length}`);
  lines.push(`Topology: ${result.options.topology}`);
  lines.push(`Allowed mismatches per primer: ${result.options.maxMismatches}`);
  lines.push(`Required exact 3' bases: ${result.options.exactThreePrimeBases}`);
  lines.push(`Product length range: ${result.options.minProductLength}-${result.options.maxProductLength} bp`);
  lines.push(`Products found: ${result.rows.length}`);
  lines.push("");
  if (result.rows.length === 0) {
    lines.push("No products matched the current primer and product-length settings.");
    return lines.join("\n");
  }
  lines.push("template\tproduct\tlength\tforward_primer\tforward_start\tforward_end\treverse_primer\treverse_start\treverse_end\tmismatches");
  for (const row of result.rows) {
    lines.push([
      row.template,
      row.product,
      row.length,
      row.forward_primer,
      row.forward_start,
      row.forward_end,
      row.reverse_primer,
      row.reverse_start,
      row.reverse_end,
      `${row.forward_mismatches}+${row.reverse_mismatches}`
    ].join("\t"));
  }
  return lines.join("\n");
}

export function makePcrProductsTsv(rows) {
  const headers = pcrProductTableColumns.map((column) => column.id);
  return [
    headers.join("\t"),
    ...rows.map((row) => headers.map((header) => String(row[header] ?? "").replace(/\t/g, " ")).join("\t"))
  ].join("\n");
}

export function makePcrProductsFasta(rows, lineWidth = 60) {
  return rows.map((row) =>
    formatFastaRecord(
      `${row.template}_pcr_product_${row.product} ${row.forward_primer}/${row.reverse_primer} ${row.length} bp`,
      row.product_sequence,
      lineWidth
    )
  ).join("\n");
}
