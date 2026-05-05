import { proteinHydropathyTableColumns } from "./run.js";

export const proteinHydropathyMetadata = {
  id: "protein-hydropathy",
  name: "Protein Hydropathy",
  category: "Analyze Protein",
  tags: ["protein", "hydropathy", "GRAVY", "Kyte-Doolittle", "plot"],
  summary:
    "Calculate Kyte-Doolittle GRAVY and sliding-window hydropathy profiles for protein sequences.",
  inputType: "Protein sequence",
  outputType: "Hydropathy report, table, plot",
  runInWorker: true,
  workerModule: "../tools/protein-hydropathy/run.js",
  workerExport: "runProteinHydropathyWorker",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "protein" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "protein-hydropathy", columns: proteinHydropathyTableColumns },
      { id: "plot", kind: "text", mediaType: "image/svg+xml" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true },
    {
      id: "windowSize",
      type: "number",
      label: "Window size",
      defaultValue: 9,
      min: 1,
      max: 1001,
      step: 1
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "svg-plot",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" },
        { value: "svg-plot", label: "SVG hydropathy plot" }
      ]
    },
    {
      id: "methodNote",
      type: "note",
      text: "GRAVY and profile values use the Kyte-Doolittle hydropathy scale. Windows are averaged over standard residues only."
    },
    {
      id: "citationNote",
      type: "note",
      text: "Reference: Kyte J, Doolittle RF. J Mol Biol. 1982;157:105-132. Values from ExPASy ProtScale."
    }
  ]
};
