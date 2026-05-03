import { geneticCodes } from "../../core/genetic-code.js";
import { translationTableColumns } from "./run.js";

export const translateMetadata = {
  id: "translate",
  name: "Translate DNA/RNA",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "protein", "genetic code", "translation"],
  summary:
    "Translate DNA/RNA sequences using selectable NCBI genetic codes and forward or reverse reading frames.",
  inputType: "DNA/RNA sequence",
  outputType: "Protein sequence",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "translations", kind: "table", schema: "translate-dna-rna", columns: translationTableColumns },
      { id: "proteinRecords", kind: "sequence-records", alphabet: "protein", schema: "translated-protein-records" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "frame",
      type: "radio",
      label: "Frame",
      help: "Frame 1 starts at the first base, frame 2 at the second, and frame 3 at the third. Reverse frames translate the reverse complement.",
      defaultValue: "1",
      choices: [
        { value: "1", label: "Forward frame 1" },
        { value: "2", label: "Forward frame 2" },
        { value: "3", label: "Forward frame 3" },
        { value: "all-forward", label: "All forward frames" },
        { value: "all-reverse", label: "All reverse-complement frames" },
        { value: "all-six", label: "All six frames" }
      ]
    },
    {
      id: "geneticCode",
      type: "radio",
      label: "Genetic code",
      help: "Selects the codon table used to translate codons and identify stop codons.",
      defaultValue: "1",
      choices: geneticCodes.map((code) => ({ value: code.id, label: `${code.id}. ${code.name}` }))
    },
    { id: "formatFasta", type: "checkbox", label: "Return FASTA records", defaultValue: true, help: "Adds FASTA headers and wraps translated protein sequences for copy/download." },
    {
      id: "lineWidth",
      type: "number",
      label: "Amino acids per output line",
      help: "Controls line wrapping in FASTA-style text output. It does not change the protein sequence.",
      defaultValue: 60,
      min: 10,
      max: 200
    },
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is cleaned to DNA/RNA IUPAC symbols before translation. Ambiguous codons translate as X."
    }
  ]
};
