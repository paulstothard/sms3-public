export const reverseComplementMetadata = {
  id: "reverse-complement",
  name: "Reverse Complement",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "IUPAC", "format conversion"],
  summary:
    "Reverse, complement, or reverse-complement DNA/RNA sequences while preserving ambiguous IUPAC symbols.",
  inputType: "DNA/RNA sequence",
  outputType: "DNA/RNA sequence",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "reverse-complement-dna-rna" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "operation",
      type: "radio",
      label: "Operation",
      help: "Reverse complement changes both order and bases. Reverse changes only order. Complement changes bases without reversing order.",
      defaultValue: "reverse-complement",
      choices: [
        { value: "reverse-complement", label: "Reverse complement" },
        { value: "reverse", label: "Reverse" },
        { value: "complement", label: "Complement" }
      ]
    },
    { id: "preserveCase", type: "checkbox", label: "Preserve input case", defaultValue: true },
    { id: "formatFasta", type: "checkbox", label: "Return FASTA records", defaultValue: true, help: "Adds FASTA headers and wraps output sequences for copy/download." },
    {
      id: "lineWidth",
      type: "number",
      label: "Bases per output line",
      help: "Controls line wrapping in FASTA-style text output. It does not change the sequence.",
      defaultValue: 60,
      min: 10,
      max: 200
    },
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is cleaned to IUPAC DNA/RNA characters before output is generated."
    }
  ]
};
