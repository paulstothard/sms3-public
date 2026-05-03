import { vectorContaminationTableColumns } from "../../core/vector-contamination-scanner.js";
import vectorSummary from "../../reference-data/vector-contamination/summary.js";

export const vectorContaminationScannerMetadata = {
  id: "vector-contamination-scanner",
  name: "Vector Contamination Scanner",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "vector", "adapter", "contamination", "reference data"],
  summary: "Screen DNA/RNA sequences for vector-like contamination using bundled indexed references.",
  inputType: "DNA/RNA sequence",
  outputType: "Report, TSV table",
  runInWorker: true,
  workerModule: "../tools/vector-contamination-scanner/run.js",
  workerExport: "runVectorContaminationScanner",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "report", kind: "text", mediaType: "text/plain" },
      {
        id: "table",
        kind: "table",
        schema: "vector-contamination-scanner",
        columns: vectorContaminationTableColumns
      },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "sensitivity",
      type: "select",
      label: "Sensitivity",
      defaultValue: "balanced",
      choices: [
        { value: "high-confidence", label: "High confidence" },
        { value: "balanced", label: "Balanced" },
        { value: "sensitive", label: "Sensitive" }
      ]
    },
    {
      id: "strand",
      type: "radio",
      label: "Strand",
      defaultValue: "both",
      choices: [
        { value: "both", label: "Both strands" },
        { value: "forward", label: "Forward only" }
      ]
    },
    {
      id: "minimumAlignedLength",
      type: "number",
      label: "Minimum aligned length",
      defaultValue: 30,
      min: 8,
      max: 500
    },
    {
      id: "minimumPercentIdentity",
      type: "number",
      label: "Minimum percent identity",
      defaultValue: 90,
      min: 70,
      max: 100
    },
    {
      id: "maxHitsPerRecord",
      type: "number",
      label: "Maximum hits per record",
      defaultValue: 50,
      min: 1,
      max: 1000
    },
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
      id: "databaseNote",
      type: "note",
      text: `${vectorSummary.sourceName} ${vectorSummary.sourceVersion}; ${vectorSummary.recordCount} records and ${vectorSummary.totalBases.toLocaleString()} bases. SMS3 uses a browser-local ungapped scanner, not NCBI VecScreen BLAST.`
    }
  ]
};
