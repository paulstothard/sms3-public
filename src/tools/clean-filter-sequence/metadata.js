const cleanFilterBaseOptions = [
  { id: "preserveCase", type: "checkbox", label: "Preserve input case", defaultValue: true },
  { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: false },
  { id: "formatFasta", type: "checkbox", label: "Return FASTA records", defaultValue: true },
  {
    id: "lineWidth",
    type: "number",
    label: "Characters per output line",
    defaultValue: 60,
    min: 10,
    max: 200
  }
];

function makeCleanFilterWorkflow(alphabet) {
  return {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet, schema: "clean-filter-sequence" },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

export const cleanFilterDnaRnaMetadata = {
  id: "clean-filter-dna-rna",
  name: "Clean / Filter DNA/RNA",
  category: "Prepare Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "validation"],
  summary:
    "Remove characters that are not valid DNA/RNA IUPAC symbols and report what was skipped.",
  inputType: "DNA/RNA sequence",
  outputType: "Cleaned DNA/RNA sequence",
  workflow: makeCleanFilterWorkflow("dna-rna"),
  options: [
    ...cleanFilterBaseOptions,
    {
      id: "cleaningNote",
      type: "note",
      text: "Filtering preserves DNA/RNA ambiguity symbols such as R, Y, S, W, K, M, B, D, H, V, N, and X."
    }
  ]
};

export const cleanFilterProteinMetadata = {
  id: "clean-filter-protein",
  name: "Clean / Filter Protein",
  category: "Prepare Sequences",
  tags: ["protein", "FASTA", "IUPAC", "validation"],
  summary: "Remove characters that are not valid protein IUPAC symbols and report what was skipped.",
  inputType: "Protein sequence",
  outputType: "Cleaned protein sequence",
  workflow: makeCleanFilterWorkflow("protein"),
  options: [
    ...cleanFilterBaseOptions,
    {
      id: "cleaningNote",
      type: "note",
      text: "Filtering preserves protein ambiguity and uncommon residue symbols such as B, J, O, U, X, and Z."
    }
  ]
};
