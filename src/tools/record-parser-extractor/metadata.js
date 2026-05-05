import { flatfileFeatureColumns } from "../../core/flatfile-records.js";

export const recordParserExtractorMetadata = {
  id: "record-parser-extractor",
  name: "Annotated Record Extractor",
  category: "Format Conversion",
  tags: ["DNA", "RNA", "protein", "FASTA", "GenBank", "EMBL", "DDBJ", "UniProt", "annotation", "format conversion", "workflow"],
  summary: "Extract feature tables, maps, whole sequences, CDS DNA/RNA, and protein translations from GenBank/DDBJ, EMBL, or UniProt flatfile records.",
  inputType: "GenBank/DDBJ, EMBL, or UniProt flatfile records",
  outputType: "Feature table, feature map, extracted FASTA, report",
  runInWorker: true,
  workerModule: "../tools/record-parser-extractor/run.js",
  workerExport: "runRecordParserExtractorWorker",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "textMap", kind: "text", mediaType: "text/plain" },
      { id: "overview", kind: "text", mediaType: "image/svg+xml", label: "Feature map" },
      { id: "featuresTsv", kind: "text", mediaType: "text/tab-separated-values" },
      { id: "table", kind: "table", schema: "flatfile-features", columns: flatfileFeatureColumns },
      { id: "wholeSequenceRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "flatfile-whole-sequences" },
      { id: "cdsSequenceRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "flatfile-cds-sequences" },
      { id: "proteinRecords", kind: "sequence-records", alphabet: "protein", schema: "flatfile-protein-sequences" },
      { id: "wholeFasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "cdsFasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "proteinFasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "featureFilter",
      type: "text",
      label: "Feature types",
      help: "Optional comma-separated feature keys for the table, for example CDS,gene,tRNA. Leave blank to include all parsed features.",
      defaultValue: ""
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
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "features-tsv",
      choices: [
        { value: "features-tsv", label: "Feature table" },
        { value: "svg-map", label: "Feature map" },
        { value: "whole-fasta", label: "Whole sequence FASTA" },
        { value: "cds-fasta", label: "CDS DNA/RNA FASTA" },
        { value: "protein-fasta", label: "Protein FASTA" },
        { value: "text-map", label: "Feature text map" },
        { value: "report", label: "Summary report" }
      ]
    }
  ]
};
