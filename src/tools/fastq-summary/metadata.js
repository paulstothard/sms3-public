import { fastqSummaryColumns } from "../../core/fastq-summary.js";

export const fastqSummaryMetadata = {
  id: "fastq-summary",
  name: "FASTQ Summary",
  category: "Analyze Sequences",
  tags: ["DNA", "statistics", "workflow"],
  summary: "Summarize pasted FASTQ reads with read counts, base counts, read length statistics, GC percent, N count, and mean Phred quality.",
  inputType: "FASTQ text",
  outputType: "FASTQ summary report or TSV table",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "fastq-summary", columns: fastqSummaryColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/fastq-summary/run.js",
  workerExport: "runFastqSummary",
  options: [
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "report",
          choices: [
            { value: "report", label: "Summary report" },
            { value: "tsv", label: "Summary TSV" }
          ]
        }
      ]
    }
  ]
};
