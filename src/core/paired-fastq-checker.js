import { exportDelimitedTable } from "./table.js";

export const pairedFastqColumns = [
  { id: "sample", label: "Sample", type: "string" },
  { id: "lane", label: "Lane", type: "string" },
  { id: "read1", label: "Read 1", type: "string" },
  { id: "read2", label: "Read 2", type: "string" },
  { id: "status", label: "Status", type: "string" }
];

function parseFilename(line) {
  const filename = String(line ?? "").trim();
  if (!filename) {
    return null;
  }
  const match = filename.match(/^(.+?)(?:_S\d+)?(?:_(L\d{3}))?_R([12])(?:_\d{3})?\.(?:fastq|fq)(?:\.gz)?$/i);
  if (!match) {
    return { filename, sample: filename.replace(/\.(fastq|fq)(\.gz)?$/i, ""), lane: "", read: "", recognized: false };
  }
  return {
    filename,
    sample: match[1],
    lane: match[2] ?? "",
    read: match[3],
    recognized: true
  };
}

export function checkPairedFastq(input) {
  const warnings = [];
  const groups = new Map();
  const unrecognized = [];
  for (const line of String(input ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const parsed = parseFilename(line);
    if (!parsed) {
      continue;
    }
    if (!parsed.recognized) {
      unrecognized.push(parsed.filename);
      continue;
    }
    const key = `${parsed.sample}\t${parsed.lane}`;
    if (!groups.has(key)) {
      groups.set(key, { sample: parsed.sample, lane: parsed.lane, read1: [], read2: [] });
    }
    groups.get(key)[parsed.read === "1" ? "read1" : "read2"].push(parsed.filename);
  }
  if (unrecognized.length > 0) {
    warnings.push(`${unrecognized.length} filename(s) did not match the expected FASTQ R1/R2 pattern.`);
  }
  const rows = [...groups.values()].map((group) => {
    let status = "paired";
    if (group.read1.length === 0) {
      status = "missing_read1";
    } else if (group.read2.length === 0) {
      status = "missing_read2";
    } else if (group.read1.length > 1 || group.read2.length > 1) {
      status = "duplicate_read_file";
    }
    return {
      sample: group.sample,
      lane: group.lane,
      read1: group.read1.join("; "),
      read2: group.read2.join("; "),
      status
    };
  });
  const report = [
    "Paired FASTQ checker",
    "",
    `FASTQ groups: ${rows.length}`,
    `Complete pairs: ${rows.filter((row) => row.status === "paired").length}`,
    `Problem groups: ${rows.filter((row) => row.status !== "paired").length}`,
    `Unrecognized filenames: ${unrecognized.length}`
  ].join("\n");
  return { rows, report, warnings };
}

export function makePairedFastqTsv(rows) {
  return exportDelimitedTable(pairedFastqColumns, rows, "\t");
}
