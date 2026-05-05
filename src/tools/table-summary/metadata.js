import { tableSummaryColumns } from "../../core/table-summary.js";

export const tableSummaryMetadata = {
  id: "table-summary",
  name: "Table Summary / Profiler",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "statistics", "workflow"],
  summary: "Profile a CSV or TSV table with dimensions, inferred column types, missingness, distinct counts, ranges, and numeric summaries.",
  inputType: "CSV/TSV table",
  outputType: "Table profile report or summary table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "summaryTable", kind: "table", schema: "table-summary", columns: tableSummaryColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/table-summary/run.js",
  workerExport: "runTableSummary",
  options: [
    {
      type: "group",
      label: "Input",
      options: [
        {
          id: "delimiter",
          type: "select",
          label: "Delimiter",
          defaultValue: "auto",
          choices: [
            { value: "auto", label: "Auto detect" },
            { value: "tab", label: "Tab" },
            { value: "comma", label: "Comma" },
            { value: "semicolon", label: "Semicolon" },
            { value: "pipe", label: "Pipe" }
          ]
        },
        { id: "hasHeader", type: "checkbox", label: "First row contains column names", defaultValue: true },
        { id: "trimCells", type: "checkbox", label: "Trim cells before profiling", defaultValue: true }
      ]
    },
    {
      id: "missingValues",
      type: "text",
      label: "Additional missing tokens",
      defaultValue: "NA,N/A,na,n/a,null,NULL,-",
      help: "Comma- or line-separated cell values to treat as missing. Empty cells are always missing."
    },
    {
      id: "maxTopValues",
      type: "number",
      label: "Top values per column",
      defaultValue: 5,
      min: 1,
      max: 20,
      step: 1,
      help: "Limits the number of most frequent non-missing values shown for each column."
    },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "summary-tsv",
          choices: [
            { value: "summary-tsv", label: "Summary TSV" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
