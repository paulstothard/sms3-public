const TABLE_COLUMNS = [];

export const tableReshapeMetadata = {
  id: "table-reshape",
  name: "Table Reshape",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "workflow"],
  summary: "Reshape CSV or TSV data between long and wide table layouts for sample, feature, and measurement tables.",
  inputType: "CSV/TSV table",
  outputType: "Reshaped table or report",
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
  workerModule: "../tools/table-reshape/run.js",
  workerExport: "runTableReshape",
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
        { id: "hasHeader", type: "checkbox", label: "First row contains column names", defaultValue: true }
      ]
    },
    {
      id: "mode",
      type: "radio",
      label: "Reshape mode",
      defaultValue: "long-to-wide",
      choices: [
        { value: "long-to-wide", label: "Long to wide" },
        { value: "wide-to-long", label: "Wide to long" }
      ]
    },
    { id: "idColumns", type: "text", label: "ID columns", defaultValue: "sample_id, treatment", help: "Columns that identify each sample or row group." },
    { id: "namesFrom", type: "text", label: "Column names from", defaultValue: "gene_id", help: "Long-to-wide only: this column supplies new output column names.", visibleWhen: { option: "mode", value: "long-to-wide" } },
    { id: "valuesFrom", type: "text", label: "Values from", defaultValue: "tpm", help: "Long-to-wide only: this column supplies output values.", visibleWhen: { option: "mode", value: "long-to-wide" } },
    { id: "valueColumns", type: "text", label: "Columns to gather", defaultValue: "TP53, BRCA1, MYC", help: "Wide-to-long only: these columns become rows.", visibleWhen: { option: "mode", value: "wide-to-long" } },
    {
      id: "duplicateMode",
      type: "select",
      label: "Duplicate long values",
      defaultValue: "first",
      visibleWhen: { option: "mode", value: "long-to-wide" },
      choices: [
        { value: "first", label: "Use first value" },
        { value: "last", label: "Use last value" },
        { value: "sum", label: "Sum numeric values" },
        { value: "mean", label: "Mean of numeric values" }
      ]
    },
    { id: "namesTo", type: "text", label: "Name column", defaultValue: "gene_id", visibleWhen: { option: "mode", value: "wide-to-long" } },
    { id: "valuesTo", type: "text", label: "Value column", defaultValue: "tpm", visibleWhen: { option: "mode", value: "wide-to-long" } },
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
            { value: "tsv", label: "TSV table" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
