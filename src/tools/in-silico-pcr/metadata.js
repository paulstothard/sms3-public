import { pcrProductTableColumns } from "../../core/in-silico-pcr.js";

export const inSilicoPcrMetadata = {
  id: "in-silico-pcr",
  name: "In Silico PCR",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "primer", "coordinates", "workflow"],
  summary: "Find potential PCR products from one or more template sequences and multiple primer sequences.",
  inputType: "Template DNA and primer DNA",
  outputType: "PCR product report, table, or FASTA",
  splitInput: {
    separator: "---",
    panels: [
      { id: "template", label: "Template sequence", dropLabel: "Drop template FASTA here", accept: ".fa,.fasta,.fna,.txt,.seq" },
      { id: "primers", label: "Primer sequences", dropLabel: "Drop primer FASTA or list here", accept: ".fa,.fasta,.txt,.seq" }
    ]
  },
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "in-silico-pcr-products", columns: pcrProductTableColumns },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/in-silico-pcr/run.js",
  workerExport: "runInSilicoPcr",
  options: [
    {
      id: "topology",
      type: "radio",
      label: "Template topology",
      defaultValue: "linear",
      choices: [
        { value: "linear", label: "Linear" },
        { value: "circular", label: "Circular" }
      ]
    },
    { id: "maxMismatches", type: "number", label: "Maximum mismatches per primer", defaultValue: 0, min: 0, max: 6, step: 1 },
    { id: "exactThreePrimeBases", type: "number", label: "Exact 3' bases", defaultValue: 3, min: 0, max: 12, step: 1, help: "Rejects a binding site unless this many bases at the primer 3' end match exactly." },
    { id: "minProductLength", type: "number", label: "Minimum product length", defaultValue: 20, min: 1, step: 1 },
    { id: "maxProductLength", type: "number", label: "Maximum product length", defaultValue: 5000, min: 1, step: 1 },
    {
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV product table" },
        { value: "fasta", label: "Product FASTA" }
      ]
    },
    {
      id: "methodNote",
      type: "note",
      text: "Primer binding is modeled by direct sequence matching on both template strands with optional mismatches and an exact 3' end requirement. Coordinates are 1-based on the submitted template."
    }
  ]
};
