const TABLE_COLUMNS = [];

export const tableJoinMetadata = {
  id: "table-join",
  name: "Table Join",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "workflow"],
  summary: "Join two CSV or TSV tables by one or more key columns using inner, left, or full joins.",
  inputType: "Two CSV/TSV tables separated by a marker line",
  outputType: "Joined table or report",
  splitInput: {
    separator: "---",
    panels: [
      { id: "left", label: "Left table", dropLabel: "Drop the left CSV/TSV table here", accept: ".csv,.tsv,.tab,.txt" },
      { id: "right", label: "Right table", dropLabel: "Drop the right CSV/TSV table here", accept: ".csv,.tsv,.tab,.txt" }
    ]
  },
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "generic-table", columns: TABLE_COLUMNS },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/table-join/run.js",
  workerExport: "runTableJoin",
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
    { id: "leftKeyColumns", type: "text", label: "Left key columns", defaultValue: "sample_id" },
    { id: "rightKeyColumns", type: "text", label: "Right key columns", defaultValue: "sample_id" },
    {
      id: "joinType",
      type: "radio",
      label: "Join type",
      defaultValue: "inner",
      choices: [
        { value: "inner", label: "Inner" },
        { value: "left", label: "Left" },
        { value: "full", label: "Full" }
      ]
    },
    { id: "caseSensitive", type: "checkbox", label: "Case-sensitive key comparison", defaultValue: false },
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
            { value: "tsv", label: "Joined TSV" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
