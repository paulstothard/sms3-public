import { proteinPatternFinderTableColumns } from "./run.js";

export const proteinPatternFinderMetadata = {
  id: "protein-pattern-finder",
  name: "Protein Pattern Finder",
  category: "Analyze Protein",
  tags: ["protein", "motif", "pattern", "regex", "search"],
  summary:
    "Find plain-text, IUPAC, or regular-expression protein motifs and report match coordinates.",
  inputType: "Protein sequence",
  outputType: "Match report, table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "protein" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "protein-pattern-finder", columns: proteinPatternFinderTableColumns },
      { id: "matchedRegions", kind: "sequence-records", alphabet: "protein", schema: "protein-pattern-finder" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "pattern",
      type: "text",
      label: "Pattern",
      help: "Enter the protein pattern to find. In IUPAC mode, ambiguity symbols such as B, Z, J, and X are interpreted as residue sets.",
      defaultValue: "KDD"
    },
    {
      id: "patternMode",
      type: "radio",
      label: "Pattern mode",
      help: "Plain text searches for exact characters. IUPAC motif expands protein ambiguity symbols. JavaScript regex treats the pattern as a regular expression.",
      defaultValue: "plain",
      choices: [
        { value: "plain", label: "Plain text" },
        { value: "iupac", label: "IUPAC motif" },
        { value: "regex", label: "JavaScript regex" }
      ]
    },
    { id: "caseInsensitive", type: "checkbox", label: "Case-insensitive search", defaultValue: true, help: "Treat uppercase and lowercase letters as equivalent during matching." },
    { id: "allowOverlaps", type: "checkbox", label: "Allow overlapping matches", defaultValue: true, help: "Allows matches that share one or more residue positions." },
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true, help: "Keeps alignment gaps in the searched sequence. Gap characters can affect reported positions and regex behavior." },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" }
      ]
    },
    {
      id: "patternNote",
      type: "note",
      text: "IUPAC motif mode treats B, J, Z, and X as ambiguity symbols. Regex mode uses JavaScript regular expressions. Coordinates are 1-based and inclusive."
    }
  ]
};
