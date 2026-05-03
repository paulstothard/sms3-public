const TABLE_COLUMNS = [];

export const tableViewerCleanerMetadata = {
  id: "table-viewer-cleaner",
  name: "Table Viewer / Cleaner",
  category: "Analyze Tables",
  tags: ["table", "CSV", "TSV", "cleaning", "workflow"],
  summary: "Parse CSV/TSV-style text, clean headers, filter/sort/select rows, remove duplicates, and export a structured table.",
  inputType: "CSV/TSV table",
  outputType: "Cleaned table, report",
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
  options: [
    {
      type: "group",
      label: "Input",
      help: "Controls how pasted or loaded text is parsed into rows and columns.",
      options: [
        {
          id: "delimiter",
          type: "select",
          label: "Delimiter",
          help: "The character that separates columns. Auto detect checks common delimiters while respecting quoted fields.",
          defaultValue: "auto",
          choices: [
            { value: "auto", label: "Auto detect" },
            { value: "tab", label: "Tab" },
            { value: "comma", label: "Comma" },
            { value: "semicolon", label: "Semicolon" },
            { value: "pipe", label: "Pipe" }
          ]
        },
        { id: "hasHeader", type: "checkbox", label: "First row contains column names", defaultValue: true, help: "When enabled, the first parsed row becomes column names. When disabled, generic column names are assigned." }
      ]
    },
    {
      type: "group",
      label: "Columns",
      help: "Column actions happen before filtering, sorting, duplicate removal, and export.",
      options: [
        {
          id: "columnAction",
          type: "select",
          label: "Column action",
          help: "Use all columns, keep only the columns named below, or remove the columns named below.",
          defaultValue: "all",
          choices: [
            { value: "all", label: "Use all columns" },
            { value: "keep", label: "Keep only listed columns" },
            { value: "remove", label: "Remove listed columns" }
          ]
        },
        {
          id: "columnList",
          type: "text",
          label: "Column list",
          help: "Enter visible column names or normalized ids separated by commas, for example sample, gc_percent.",
          defaultValue: ""
        },
        { id: "removeDuplicates", type: "checkbox", label: "Remove duplicate rows after column action and filtering", defaultValue: false, help: "Duplicate rows are compared after column selection and filtering, so removed columns do not affect duplicate detection." }
      ]
    },
    {
      type: "group",
      label: "Filter rows",
      help: "Filtering is applied after column selection and before sorting.",
      options: [
        {
          id: "filterColumn",
          type: "text",
          label: "Column",
          help: "Column name or normalized id to test. Leave blank with No filter.",
          defaultValue: ""
        },
        {
          id: "filterOperator",
          type: "select",
          label: "Rule",
          help: "Text rules compare strings. Numeric rules convert cell values and the filter value to numbers.",
          defaultValue: "none",
          choices: [
            { value: "none", label: "No filter" },
            { value: "contains", label: "Contains text" },
            { value: "equals", label: "Equals text" },
            { value: "not_empty", label: "Is not empty" },
            { value: "empty", label: "Is empty" },
            { value: "gt", label: "Greater than" },
            { value: "gte", label: "Greater than or equal" },
            { value: "lt", label: "Less than" },
            { value: "lte", label: "Less than or equal" }
          ]
        },
        {
          id: "filterValue",
          type: "text",
          label: "Value",
          help: "Comparison value for the selected filter rule. Empty and not-empty rules ignore this field.",
          defaultValue: ""
        }
      ]
    },
    {
      type: "group",
      label: "Sort rows",
      help: "Sorting is applied after filtering and duplicate removal.",
      options: [
        {
          id: "sortColumn",
          type: "text",
          label: "Column",
          help: "Column name or normalized id to sort by.",
          defaultValue: ""
        },
        {
          id: "sortDirection",
          type: "select",
          label: "Direction",
          help: "Ascending puts smaller numbers or earlier text first; descending reverses that order.",
          defaultValue: "none",
          choices: [
            { value: "none", label: "No sort" },
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" }
          ]
        }
      ]
    },
    {
      type: "group",
      label: "Copy/download format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "tsv",
          choices: [
            { value: "tsv", label: "TSV table" },
            { value: "csv", label: "CSV table" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    },
    {
      id: "columnNote",
      type: "note",
      text: "Column names can be entered as visible labels or normalized ids. Use commas for multiple columns, for example: sample, gc_percent."
    }
  ]
};
