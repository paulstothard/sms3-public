import { listSetCompareColumns } from "../../core/list-set-compare.js";

export const listSetCompareMetadata = {
  id: "list-set-compare",
  name: "List Set Compare",
  category: "Clean Text",
  tags: ["table", "text", "search", "workflow"],
  summary: "Compare two pasted lists and report shared items, A-only items, B-only items, union rows, and duplicate-aware counts.",
  inputType: "Two or more text lists",
  outputType: "Comparison report, item list, TSV table, or SVG Venn diagram",
  splitInput: {
    separator: "---",
    allowAdd: true,
    addLabel: "Add list",
    panels: [
      { id: "a", label: "List A", dropLabel: "Drop the first text list here", accept: ".txt,.csv,.tsv,.tab" },
      { id: "b", label: "List B", dropLabel: "Drop the second text list here", accept: ".txt,.csv,.tsv,.tab" }
    ]
  },
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "venn", kind: "text", mediaType: "image/svg+xml", label: "Venn diagram" },
      { id: "table", kind: "table", schema: "list-set-compare", columns: listSetCompareColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/list-set-compare/run.js",
  workerExport: "runListSetCompare",
  options: [
    { id: "trimItems", type: "checkbox", label: "Trim item whitespace", defaultValue: true },
    { id: "caseSensitive", type: "checkbox", label: "Case-sensitive comparison", defaultValue: false },
    { id: "ignoreCommentLines", type: "checkbox", label: "Ignore comment lines starting with #", defaultValue: true },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "table-tsv",
          choices: [
            { value: "table-tsv", label: "Comparison TSV" },
            { value: "shared", label: "Shared item list" },
            { value: "a-only", label: "A-only item list" },
            { value: "b-only", label: "B-only item list" },
            { value: "venn-svg", label: "SVG Venn diagram" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
