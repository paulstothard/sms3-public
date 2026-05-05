const TABLE_COLUMNS = [];

export const tableGroupSummaryMetadata = {
  id: "table-group-summary",
  name: "Table Group Summary",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "statistics", "workflow"],
  summary: "Group a CSV or TSV table by selected columns and calculate counts plus numeric summary statistics.",
  inputType: "CSV/TSV table",
  outputType: "Grouped summary table or report",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "summaryTable", kind: "table", schema: "generic-table", columns: TABLE_COLUMNS },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/table-group-summary/run.js",
  workerExport: "runTableGroupSummary",
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
        { id: "trimCells", type: "checkbox", label: "Trim cells before summarizing", defaultValue: true }
      ]
    },
    {
      id: "groupColumns",
      type: "text",
      label: "Group columns",
      defaultValue: "treatment",
      help: "Enter visible column names or normalized ids separated by commas. Leave blank to summarize all rows together."
    },
    {
      id: "valueColumns",
      type: "text",
      label: "Value columns",
      defaultValue: "concentration_ng_ul, od260_280",
      help: "Enter numeric value columns to summarize, separated by commas."
    },
    {
      id: "operations",
      type: "text",
      label: "Operations",
      defaultValue: "count, mean, median, min, max, sd",
      help: "Supported operations are count, sum, mean, median, min, max, sd, and distinct."
    },
    {
      id: "missingValues",
      type: "text",
      label: "Additional missing tokens",
      defaultValue: "NA,N/A,na,n/a,null,NULL,-",
      help: "Comma- or line-separated cell values to treat as missing. Empty cells are always missing."
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
