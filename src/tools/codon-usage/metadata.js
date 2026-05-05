import { geneticCodes } from "../../core/genetic-code.js";
import { codonUsageTableColumns } from "./run.js";

export const codonUsageMetadata = {
  id: "codon-usage",
  name: "Codon Usage",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "codon", "statistics", "translation"],
  summary:
    "Calculate observed codon usage for coding DNA/RNA input in a selected reading frame.",
  inputType: "DNA/RNA coding sequence",
  outputType: "Codon usage report, table, plot",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" },
      { id: "orfRecords", kind: "orf-records", schema: "orf-finder" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "codon-usage", columns: codonUsageTableColumns },
      { id: "plot", kind: "text", mediaType: "image/svg+xml" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "frame",
      type: "radio",
      label: "Frame",
      help: "Frame 1 starts counting codons at the first base, frame 2 at the second, and frame 3 at the third.",
      defaultValue: "1",
      choices: [
        { value: "1", label: "Frame 1" },
        { value: "2", label: "Frame 2" },
        { value: "3", label: "Frame 3" }
      ]
    },
    {
      id: "geneticCode",
      type: "radio",
      label: "Genetic code",
      help: "Selects the codon table used to assign codons to amino acids and identify stop codons.",
      defaultValue: "1",
      choices: geneticCodes.map((code) => ({ value: code.id, label: `${code.id}. ${code.name}` }))
    },
    {
      id: "excludeTerminalStop",
      type: "checkbox",
      label: "Exclude terminal stop codon",
      help: "Common for coding sequences where the final stop codon is not counted as amino-acid usage.",
      defaultValue: true
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "svg-plot",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" },
        { value: "svg-plot", label: "SVG codon plot" }
      ]
    },
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is treated as coding sequence. Ambiguous codons are skipped, and trailing bases outside complete codons are ignored."
    }
  ]
};
