const TABLE_COLUMNS = [];

export const tableColumnCalculatorMetadata = {
  id: "table-column-calculator",
  name: "Table Column Calculator",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "statistics", "workflow"],
  summary: "Add a calculated numeric column using safe operations such as ratios, percentages, logs, and z-scores.",
  inputType: "CSV/TSV table",
  outputType: "Table with calculated column or report",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "generic-table", columns: TABLE_COLUMNS },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/table-column-calculator/run.js",
  workerExport: "runTableColumnCalculator",
  options: [
    {
      type: "group",
      label: "Input table",
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
        { id: "hasHeader", type: "checkbox", label: "First row contains column names", defaultValue: true }
      ]
    },
    {
      type: "group",
      label: "Calculation",
      options: [
        { id: "leftColumn", type: "text", label: "Column", defaultValue: "mapped_reads" },
    {
      id: "operation",
      type: "select",
      label: "Operation",
      defaultValue: "percent",
      choices: [
        { value: "add", label: "Add" },
        { value: "subtract", label: "Subtract" },
        { value: "multiply", label: "Multiply" },
        { value: "divide", label: "Divide" },
        { value: "percent", label: "Percent" },
        { value: "log2", label: "Log2" },
        { value: "log10", label: "Log10" },
        { value: "zscore", label: "Z-score" }
      ]
    },
        { id: "rightColumn", type: "text", label: "Other column", defaultValue: "total_reads", help: "Used by add, subtract, multiply, divide, and percent." },
        { id: "constant", type: "text", label: "Or constant", defaultValue: "", help: "Optional number used when Other column is blank." },
        { id: "resultColumn", type: "text", label: "New column name", defaultValue: "percent_mapped" }
      ]
    },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "tsv",
          choices: [
            { value: "tsv", label: "Calculated TSV" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
