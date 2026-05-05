import { fastaExtractByIdColumns } from "../../core/fasta-extract-by-id.js";

export const fastaExtractByIdMetadata = {
  id: "fasta-extract-by-id",
  name: "FASTA Extract By ID List",
  category: "Edit Sequences",
  tags: ["DNA", "FASTA", "search", "workflow"],
  summary: "Keep, remove, or reorder FASTA records using a pasted list of record IDs or title matches.",
  inputType: "FASTA records and ID list",
  outputType: "Extracted FASTA, match table, or report",
  splitInput: {
    separator: "---",
    panels: [
      { id: "fasta", label: "FASTA records", dropLabel: "Drop the FASTA file here", accept: ".fa,.fasta,.fna,.faa,.txt" },
      { id: "ids", label: "ID list", dropLabel: "Drop the ID list here", accept: ".txt,.csv,.tsv,.tab" }
    ]
  },
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "fasta-extract-by-id", columns: fastaExtractByIdColumns },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "fasta-extract-by-id" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/fasta-extract-by-id/run.js",
  workerExport: "runFastaExtractById",
  options: [
    {
      id: "action",
      type: "radio",
      label: "Action",
      defaultValue: "keep",
      choices: [
        { value: "keep", label: "Keep matching records" },
        { value: "remove", label: "Remove matching records" },
        { value: "order", label: "Output in ID-list order" }
      ]
    },
    {
      id: "matchMode",
      type: "radio",
      label: "Match mode",
      defaultValue: "id-exact",
      choices: [
        { value: "id-exact", label: "Exact first-word ID" },
        { value: "title-exact", label: "Exact full title" },
        { value: "title-contains", label: "Title contains query" }
      ]
    },
    { id: "caseSensitive", type: "checkbox", label: "Case-sensitive matching", defaultValue: true },
    { id: "lineWidth", type: "number", label: "FASTA line width", defaultValue: 60, min: 1, max: 200, step: 1 },
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
            { value: "fasta", label: "FASTA" },
            { value: "table-tsv", label: "Match TSV" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
