import { extractSubsequencesTableColumns } from "./run.js";

const baseOptions = [
  {
    id: "coordinates",
    type: "text",
    label: "Coordinates",
    defaultValue: "2-8, 12-18"
  },
  { id: "preserveCase", type: "checkbox", label: "Preserve input case", defaultValue: true },
  { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true },
  {
    id: "outputFormat",
    type: "radio",
    label: "Copy/download format",
    defaultValue: "fasta",
    choices: [
      { value: "fasta", label: "FASTA records" },
      { value: "tsv", label: "TSV table" }
    ]
  },
  {
    id: "lineWidth",
    type: "number",
    label: "FASTA characters per line",
    defaultValue: 60,
    min: 10,
    max: 200
  }
];

function makeWorkflow(alphabet) {
  return {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "table", kind: "table", schema: "extract-subsequences", columns: extractSubsequencesTableColumns },
      { id: "sequenceRecords", kind: "sequence-records", alphabet, schema: "extract-subsequences" },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

export const extractSubsequencesDnaRnaMetadata = {
  id: "extract-subsequences-dna-rna",
  name: "Extract Subsequences DNA/RNA",
  category: "Edit DNA/RNA",
  tags: ["DNA", "RNA", "FASTA", "coordinates", "workflow"],
  summary:
    "Extract 1-based inclusive DNA/RNA subsequences from raw or FASTA input.",
  inputType: "DNA/RNA sequence",
  outputType: "Extracted DNA/RNA sequences, table",
  workflow: makeWorkflow("dna-rna"),
  options: [
    ...baseOptions,
    {
      id: "reverseComplement",
      type: "checkbox",
      label: "Reverse complement extracted regions",
      defaultValue: false
    },
    {
      id: "coordinateNote",
      type: "note",
      text: "Coordinates are 1-based and inclusive. Use ranges like 2-8, 2..8, or 2:8; separate ranges with commas, semicolons, or new lines."
    }
  ]
};

export const extractSubsequencesProteinMetadata = {
  id: "extract-subsequences-protein",
  name: "Extract Subsequences Protein",
  category: "Edit Protein",
  tags: ["protein", "FASTA", "coordinates", "workflow"],
  summary:
    "Extract 1-based inclusive protein subsequences from raw or FASTA input.",
  inputType: "Protein sequence",
  outputType: "Extracted protein sequences, table",
  workflow: makeWorkflow("protein"),
  options: [
    ...baseOptions,
    {
      id: "coordinateNote",
      type: "note",
      text: "Coordinates are 1-based and inclusive. Use ranges like 2-8, 2..8, or 2:8; separate ranges with commas, semicolons, or new lines."
    }
  ]
};
