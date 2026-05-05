import { fastaLengthFilterTableColumns } from "../../core/fasta-length-filter.js";

export const fastaLengthFilterMetadata = {
  id: "fasta-length-filter",
  name: "FASTA Filter / Select",
  category: "Prepare Sequences",
  tags: ["DNA", "RNA", "protein", "FASTA", "workflow"],
  summary: "Keep or remove FASTA records by length, title text, sequence text, GC percent, or ambiguous-character count.",
  inputType: "FASTA records",
  outputType: "Filtered FASTA, removed FASTA, report, table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "filteredFasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "removedFasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "fasta-length-filter", columns: fastaLengthFilterTableColumns },
      { id: "sequenceRecords", kind: "sequence-records" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/fasta-length-filter/run.js",
  workerExport: "runFastaLengthFilter",
  options: [
    {
      id: "minLength",
      type: "number",
      label: "Minimum length",
      defaultValue: 10,
      min: 0,
      step: 1
    },
    {
      id: "maxLength",
      type: "number",
      label: "Maximum length",
      defaultValue: 1000,
      min: 0,
      step: 1,
      help: "Use 0 to apply no maximum length."
    },
    {
      id: "titleContains",
      type: "text",
      label: "Title contains",
      defaultValue: "",
      help: "Optional case-insensitive text that must appear in the FASTA title."
    },
    {
      id: "sequenceContains",
      type: "text",
      label: "Sequence contains",
      defaultValue: "",
      help: "Optional ungapped sequence text that must appear in the record sequence."
    },
    {
      id: "minGcPercent",
      type: "text",
      label: "Minimum GC %",
      defaultValue: "",
      help: "Optional DNA/RNA criterion. Leave blank to ignore."
    },
    {
      id: "maxGcPercent",
      type: "text",
      label: "Maximum GC %",
      defaultValue: "",
      help: "Optional DNA/RNA criterion. Leave blank to ignore."
    },
    {
      id: "maxAmbiguousCount",
      type: "text",
      label: "Maximum ambiguous characters",
      defaultValue: "",
      help: "Optional criterion counting characters outside A/C/G/T/U."
    },
    {
      id: "keepMode",
      type: "radio",
      label: "Filter mode",
      defaultValue: "inside",
      choices: [
        { value: "inside", label: "Keep matching records" },
        { value: "outside", label: "Remove matching records" }
      ]
    },
    {
      id: "lineWidth",
      type: "number",
      label: "Characters per FASTA line",
      defaultValue: 60,
      min: 10,
      max: 200
    },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "filtered-fasta",
          choices: [
            { value: "filtered-fasta", label: "Filtered FASTA" },
            { value: "removed-fasta", label: "Removed FASTA" },
            { value: "report", label: "Summary report" },
            { value: "tsv", label: "Decision table" }
          ]
        }
      ]
    }
  ]
};
