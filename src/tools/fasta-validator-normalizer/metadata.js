import { fastaValidationTableColumns } from "../../core/fasta-validator.js";

export const fastaValidatorNormalizerMetadata = {
  id: "fasta-validator-normalizer",
  name: "FASTA Summarizer",
  category: "Prepare Sequences",
  tags: ["DNA", "RNA", "protein", "FASTA", "format conversion", "statistics", "workflow"],
  summary: "Summarize FASTA records, unique titles, unique sequences, duplicate titles, duplicate sequences, and formatting issues.",
  inputType: "FASTA records",
  outputType: "Summary report, normalized FASTA, table",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      {
        id: "table",
        kind: "table",
        schema: "fasta-validation",
        columns: fastaValidationTableColumns
      },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "lineWidth",
      type: "number",
      label: "Characters per output line",
      defaultValue: 60,
      min: 10,
      max: 200
    },
    {
      id: "checkReverseComplement",
      type: "checkbox",
      label: "Check reverse-complement duplicates",
      defaultValue: false,
      help: "Also flags records whose sequence is the reverse complement of another FASTA record. Useful for DNA/RNA record QC."
    },
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "report",
          choices: [
            { value: "report", label: "Summary report" },
            { value: "fasta", label: "Normalized FASTA" },
            { value: "tsv", label: "Record table" }
          ]
        }
      ]
    },
    {
      id: "scopeNote",
      type: "note",
      text: "This tool summarizes FASTA structure and duplicates. Use DNA/RNA or protein cleaning tools when you need alphabet-specific symbol filtering."
    }
  ]
};
