import { fastaHeaderRenameTableColumns } from "../../core/fasta-header-rename.js";

export const fastaHeaderRenameMetadata = {
  id: "fasta-header-rename",
  name: "FASTA Header Rename",
  category: "Prepare Sequences",
  tags: ["DNA", "RNA", "protein", "FASTA", "cleaning", "workflow"],
  summary: "Rename FASTA headers with prefix/suffix rules, find-and-replace, safe-ID cleanup, and optional numbering.",
  inputType: "FASTA records",
  outputType: "Renamed FASTA, report, table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "fasta-header-rename", columns: fastaHeaderRenameTableColumns },
      { id: "sequenceRecords", kind: "sequence-records" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/fasta-header-rename/run.js",
  workerExport: "runFastaHeaderRename",
  options: [
    { id: "findText", type: "text", label: "Find text or regex", defaultValue: "" },
    { id: "replaceText", type: "text", label: "Replace with", defaultValue: "" },
    { id: "useRegex", type: "checkbox", label: "Use regular expression", defaultValue: false },
    { id: "prefix", type: "text", label: "Add prefix", defaultValue: "" },
    { id: "suffix", type: "text", label: "Add suffix", defaultValue: "" },
    { id: "safeIds", type: "checkbox", label: "Make safe IDs", defaultValue: true, help: "Replaces spaces and unusual punctuation with underscores so headers are easier to use in scripts." },
    {
      id: "numberMode",
      type: "radio",
      label: "Numbering",
      defaultValue: "none",
      choices: [
        { value: "none", label: "No numbering" },
        { value: "prefix", label: "Number prefix" },
        { value: "suffix", label: "Number suffix" }
      ]
    },
    { id: "numberStart", type: "number", label: "First number", defaultValue: 1, min: 0, step: 1 },
    { id: "numberWidth", type: "number", label: "Number width", defaultValue: 3, min: 1, max: 12, step: 1 },
    { id: "lineWidth", type: "number", label: "Characters per FASTA line", defaultValue: 60, min: 10, max: 200 },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "fasta",
          choices: [
            { value: "fasta", label: "Renamed FASTA" },
            { value: "report", label: "Summary report" },
            { value: "tsv", label: "Rename table" }
          ]
        }
      ]
    }
  ]
};
