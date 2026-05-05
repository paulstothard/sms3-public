import { fastaTableColumns } from "../../core/fasta-table-converter.js";

export const fastaTableConverterMetadata = {
  id: "fasta-table-converter",
  name: "FASTA Table Converter",
  category: "Format Conversion",
  tags: ["DNA", "table", "FASTA", "CSV", "TSV", "format conversion", "workflow"],
  summary: "Convert FASTA records to a table with IDs, titles, sequences, and lengths, or rebuild FASTA records from table columns.",
  inputType: "FASTA or CSV/TSV table",
  outputType: "FASTA, TSV table, or report",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "fasta-table-converter", columns: fastaTableColumns },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "fasta-table-converter" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/fasta-table-converter/run.js",
  workerExport: "runFastaTableConverter",
  options: [
    {
      id: "mode",
      type: "radio",
      label: "Conversion",
      defaultValue: "fasta-to-table",
      choices: [
        { value: "fasta-to-table", label: "FASTA to table" },
        { value: "table-to-fasta", label: "Table to FASTA" }
      ]
    },
    {
      id: "delimiter",
      type: "select",
      label: "Table delimiter",
      defaultValue: "auto",
      choices: [
        { value: "auto", label: "Auto detect" },
        { value: "tab", label: "Tab" },
        { value: "comma", label: "Comma" },
        { value: "semicolon", label: "Semicolon" },
        { value: "pipe", label: "Pipe" }
      ]
    },
    { id: "hasHeader", type: "checkbox", label: "First table row contains column names", defaultValue: true },
    { id: "titleColumn", type: "text", label: "Title column", defaultValue: "title" },
    { id: "sequenceColumn", type: "text", label: "Sequence column", defaultValue: "sequence" },
    { id: "lineWidth", type: "number", label: "FASTA line width", defaultValue: 60, min: 1, max: 200, step: 1 },
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
            { value: "table-tsv", label: "TSV table" },
            { value: "fasta", label: "FASTA" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
