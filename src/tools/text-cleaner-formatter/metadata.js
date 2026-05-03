export const textCleanerFormatterMetadata = {
  id: "text-cleaner-formatter",
  name: "Text Cleaner / Formatter",
  category: "Format Text",
  tags: ["text", "cleaning", "format conversion", "workflow"],
  summary: "Clean pasted text by normalizing line endings, trimming whitespace, removing blank lines, converting tabs/spaces, and wrapping or unwrapping lines.",
  inputType: "Plain text",
  outputType: "Cleaned text, report",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "cleanedText", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      type: "group",
      label: "Whitespace",
      help: "Whitespace includes spaces, tabs, and line breaks. These settings clean spacing without changing the visible words unless wrapping is enabled.",
      options: [
        {
          id: "trimMode",
          type: "select",
          label: "Trim lines",
          help: "Remove spaces and tabs from the start, end, or both sides of each line.",
          defaultValue: "both",
          choices: [
            { value: "none", label: "Do not trim" },
            { value: "left", label: "Trim left side" },
            { value: "right", label: "Trim right side" },
            { value: "both", label: "Trim both sides" }
          ]
        },
        { id: "removeBlankLines", type: "checkbox", label: "Remove blank lines", defaultValue: true, help: "Delete lines that contain only spaces or tabs." },
        { id: "collapseSpaces", type: "checkbox", label: "Collapse repeated spaces", defaultValue: true, help: "Replace each run of two or more ordinary spaces with one space. Tabs are handled separately below." }
      ]
    },
    {
      type: "group",
      label: "Tabs and pasted characters",
      help: "These settings handle indentation and common characters that appear after pasting from web pages, PDFs, Word, or spreadsheets.",
      options: [
        {
          id: "tabMode",
          type: "select",
          label: "Tabs / indentation",
          help: "Convert tab characters to spaces, or convert only indentation spaces at the start of a line to tabs. Spaces inside a line are not converted to tabs.",
          defaultValue: "preserve",
          choices: [
            { value: "preserve", label: "Keep tabs and spaces" },
            { value: "tabs-to-spaces", label: "Convert tabs to spaces" },
            { value: "spaces-to-tabs", label: "Convert indentation spaces to tabs" }
          ]
        },
        {
          id: "tabWidth",
          type: "number",
          label: "Tab size",
          help: "The number of spaces used when converting a tab, or the number of leading spaces that become one tab.",
          defaultValue: 4,
          min: 1,
          max: 16
        },
        {
          id: "normalizeCommonCharacters",
          type: "checkbox",
          label: "Replace smart punctuation and non-breaking spaces",
          defaultValue: true,
          help: "Convert common pasted characters to plain text, such as smart quotes to straight quotes, non-breaking spaces to normal spaces, long dashes to hyphens, and ellipsis to three periods."
        },
        {
          id: "removeNonAscii",
          type: "checkbox",
          label: "Remove other non-ASCII characters",
          defaultValue: false,
          help: "Delete remaining characters outside basic ASCII after the common pasted-character replacements have been applied."
        }
      ]
    },
    {
      type: "group",
      label: "Lines",
      help: "Wrapping and unwrapping operate on paragraphs separated by blank lines.",
      options: [
        {
          id: "wrapMode",
          type: "select",
          label: "Line wrapping",
          help: "Preserve keeps current line breaks. Unwrap joins each paragraph into one line. Wrap folds paragraphs to the selected width and breaks very long words if needed.",
          defaultValue: "preserve",
          choices: [
            { value: "preserve", label: "Preserve line breaks" },
            { value: "unwrap", label: "Unwrap paragraphs" },
            { value: "wrap", label: "Wrap paragraphs" }
          ]
        },
        {
          id: "lineWidth",
          type: "number",
          label: "Line width",
          help: "Target maximum line length when wrapping. Long words are split so the wrapped output does not exceed this width.",
          defaultValue: 80,
          min: 10,
          max: 500
        },
        {
          id: "lineEnding",
          type: "select",
          label: "Output line endings",
          help: "LF is the usual Unix/macOS line ending. CRLF is commonly used by Windows text files.",
          defaultValue: "lf",
          choices: [
            { value: "lf", label: "LF" },
            { value: "crlf", label: "CRLF" }
          ]
        }
      ]
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "cleaned",
      choices: [
        { value: "cleaned", label: "Cleaned text" },
        { value: "report", label: "Summary report" }
      ]
    }
  ]
};
