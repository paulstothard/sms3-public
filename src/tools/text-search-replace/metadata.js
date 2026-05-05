import { textSearchMatchColumns } from "../../core/text-search-replace.js";

export const textSearchReplaceMetadata = {
  id: "text-search-replace",
  name: "Text Search / Replace",
  category: "Edit Text",
  tags: ["table", "text", "regex", "search", "workflow"],
  summary: "Search plain text or regular expressions, replace matches, extract matches, or remove matching lines.",
  inputType: "Plain text",
  outputType: "Transformed text, match table, report",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "text", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "text-search-replace", columns: textSearchMatchColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      type: "group",
      label: "Search",
      help: "Controls how SMS3 finds matching text.",
      options: [
        {
          id: "pattern",
          type: "text",
          label: "Find",
          help: "Text or regular expression to search for.",
          defaultValue: "sample_\\d+"
        },
        {
          id: "searchMode",
          type: "radio",
          label: "Search mode",
          help: "Plain text searches literal characters. JavaScript regex treats Find as a regular expression.",
          defaultValue: "regex",
          choices: [
            { value: "plain", label: "Plain text" },
            { value: "regex", label: "JavaScript regex" }
          ]
        },
        { id: "caseSensitive", type: "checkbox", label: "Case-sensitive search", defaultValue: false, help: "When off, uppercase and lowercase letters are treated as equivalent." },
        { id: "multiline", type: "checkbox", label: "Regex multiline anchors", defaultValue: true, help: "In regex mode, makes ^ and $ match the start and end of each line." }
      ]
    },
    {
      type: "group",
      label: "Action",
      help: "Controls what happens after matches are found.",
      options: [
        {
          id: "operation",
          type: "select",
          label: "Operation",
          defaultValue: "replace",
          choices: [
            { value: "replace", label: "Replace all matches" },
            { value: "extract", label: "Extract matches only" },
            { value: "remove-lines", label: "Remove matching lines" }
          ]
        },
        {
          id: "replacement",
          type: "text",
          label: "Replace with",
          help: "Replacement text. In regex mode, JavaScript replacement tokens such as $1 can refer to capture groups.",
          defaultValue: "ID",
          visibleWhen: { option: "operation", value: "replace" }
        },
        {
          id: "joinMode",
          type: "select",
          label: "Extracted match output",
          help: "Only used when Operation is Extract matches only. Choose whether extracted matches are returned one per line, comma-separated, or tab-separated.",
          defaultValue: "lines",
          visibleWhen: { option: "operation", value: "extract" },
          choices: [
            { value: "lines", label: "Lines" },
            { value: "comma", label: "Comma + space" },
            { value: "tab", label: "Tabs" }
          ]
        }
      ]
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "text",
      choices: [
        { value: "text", label: "Result text" },
        { value: "tsv", label: "Match table" },
        { value: "report", label: "Summary report" }
      ]
    }
  ]
};
