import { lineListCountColumns } from "../../core/line-list.js";

export const lineListCleanerMetadata = {
  id: "line-list-cleaner",
  name: "Line / List Cleaner",
  category: "Format Text",
  tags: ["table", "text", "cleaning", "statistics", "workflow"],
  summary: "Clean, split, sort, deduplicate, count, and rejoin simple text lists.",
  inputType: "Text list",
  outputType: "Cleaned list, count table, report",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "listText", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "line-list-counts", columns: lineListCountColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      type: "group",
      label: "Parse and cleanup",
      help: "Controls how pasted text is split into items before sorting, deduplication, or counting.",
      options: [
        {
          id: "splitMode",
          type: "select",
          label: "Split input by",
          help: "Choose how the input should be separated into list items.",
          defaultValue: "lines",
          choices: [
            { value: "lines", label: "Lines" },
            { value: "comma", label: "Commas" },
            { value: "semicolon", label: "Semicolons" },
            { value: "tab", label: "Tabs" },
            { value: "whitespace", label: "Any whitespace" }
          ]
        },
        { id: "trimItems", type: "checkbox", label: "Trim each item", defaultValue: true, help: "Remove spaces and tabs from the start and end of each item." },
        { id: "removeBlankItems", type: "checkbox", label: "Remove blank items", defaultValue: true, help: "Drop empty items after splitting and trimming." },
        { id: "collapseInternalSpaces", type: "checkbox", label: "Collapse repeated spaces inside items", defaultValue: false, help: "Replace each run of two or more ordinary spaces inside an item with one space." },
        { id: "caseSensitive", type: "checkbox", label: "Case-sensitive comparisons", defaultValue: false, help: "When off, Apple and apple are treated as the same item for sorting, unique, and counts." }
      ]
    },
    {
      type: "group",
      label: "Operation",
      help: "Choose the list operation to apply after cleanup.",
      options: [
        {
          id: "operation",
          type: "select",
          label: "Operation",
          defaultValue: "sort-unique",
          choices: [
            { value: "clean", label: "Clean only" },
            { value: "sort", label: "Sort" },
            { value: "unique", label: "Remove duplicates" },
            { value: "sort-unique", label: "Sort and remove duplicates" },
            { value: "count", label: "Count occurrences" }
          ]
        },
        {
          id: "sortMode",
          type: "select",
          label: "Sort mode",
          help: "Natural sorting treats embedded numbers numerically, so sample2 sorts before sample10.",
          defaultValue: "natural",
          choices: [
            { value: "natural", label: "Natural text" },
            { value: "text", label: "Plain text" },
            { value: "numeric", label: "Numeric first" }
          ]
        },
        {
          id: "sortDirection",
          type: "select",
          label: "Sort direction",
          defaultValue: "asc",
          choices: [
            { value: "asc", label: "Ascending" },
            { value: "desc", label: "Descending" }
          ]
        }
      ]
    },
    {
      type: "group",
      label: "Output",
      help: "Controls how cleaned list output is joined. Count table output summarizes cleaned input items regardless of the selected list operation.",
      options: [
        {
          id: "joinMode",
          type: "select",
          label: "Join list with",
          defaultValue: "lines",
          choices: [
            { value: "lines", label: "Lines" },
            { value: "comma", label: "Comma + space" },
            { value: "semicolon", label: "Semicolon + space" },
            { value: "tab", label: "Tabs" }
          ]
        },
        {
          id: "outputFormat",
          type: "radio",
          label: "Copy/download format",
          defaultValue: "list",
          choices: [
            { value: "list", label: "List text" },
            { value: "report", label: "Summary report" },
            { value: "tsv", label: "Count table" }
          ]
        }
      ]
    }
  ]
};
