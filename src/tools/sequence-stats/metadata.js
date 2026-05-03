import { sequenceStatsTableColumns } from "./table-columns.js";

export const sequenceStatsDnaRnaMetadata = {
  id: "sequence-stats-dna-rna",
  name: "Sequence Stats DNA/RNA",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "IUPAC", "GC", "statistics"],
  summary:
    "Summarize DNA/RNA sequence length, base counts, ambiguity symbols, gaps, and GC content.",
  inputType: "DNA/RNA sequence",
  outputType: "Sequence statistics report, table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "sequence-stats-dna-rna", columns: sequenceStatsTableColumns },
      { id: "statsRecords", kind: "stats-records", schema: "sequence-stats-dna-rna" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" }
      ]
    },
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is cleaned to DNA/RNA IUPAC symbols before statistics are calculated. GC% uses G+C divided by A+C+G+T+U."
    }
  ]
};
