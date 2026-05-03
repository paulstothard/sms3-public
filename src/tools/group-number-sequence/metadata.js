const groupNumberBaseOptions = [
  { id: "preserveCase", type: "checkbox", label: "Preserve input case", defaultValue: true },
  { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true },
  { id: "showPositionNumbers", type: "checkbox", label: "Show position numbers", defaultValue: true, help: "Adds coordinate labels at the left of each output line for easier visual inspection." },
  {
    id: "groupSize",
    type: "number",
    label: "Characters per group",
    help: "Number of sequence characters in each space-separated block.",
    defaultValue: 10,
    min: 1,
    max: 100
  },
  {
    id: "groupsPerLine",
    type: "number",
    label: "Groups per line",
    help: "Number of blocks shown on each output line.",
    defaultValue: 6,
    min: 1,
    max: 20
  },
  {
    id: "startPosition",
    type: "number",
    label: "Start position",
    help: "Coordinate label to use for the first sequence character in the output.",
    defaultValue: 1,
    min: 0,
    max: 1000000000
  }
];

function makeGroupNumberWorkflow(alphabet) {
  return {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "groupedText", kind: "text", mediaType: "text/plain" },
      { id: "textRecords", kind: "text-records", schema: "group-number-sequence" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet, schema: "group-number-sequence-cleaned" },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

export const groupNumberDnaRnaMetadata = {
  id: "group-number-dna-rna",
  name: "Group / Number DNA/RNA",
  category: "Format Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "format conversion"],
  summary:
    "Group DNA/RNA characters into fixed-width blocks with optional position numbering and complementary strand display.",
  inputType: "DNA/RNA sequence",
  outputType: "Grouped DNA/RNA text",
  workflow: makeGroupNumberWorkflow("dna-rna"),
  options: [
    {
      id: "showComplement",
      type: "checkbox",
      label: "Show complementary strand for DNA/RNA",
      help: "Adds a second grouped line showing the complement below each DNA/RNA sequence line.",
      defaultValue: true
    },
    ...groupNumberBaseOptions,
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is cleaned to DNA/RNA IUPAC symbols before grouping."
    }
  ]
};

export const groupNumberProteinMetadata = {
  id: "group-number-protein",
  name: "Group / Number Protein",
  category: "Format Sequences",
  tags: ["protein", "FASTA", "IUPAC", "format conversion"],
  summary: "Group protein characters into fixed-width blocks with optional position numbering.",
  inputType: "Protein sequence",
  outputType: "Grouped protein text",
  workflow: makeGroupNumberWorkflow("protein"),
  options: [
    ...groupNumberBaseOptions,
    {
      id: "cleaningNote",
      type: "note",
      text: "Input is cleaned to protein IUPAC symbols before grouping."
    }
  ]
};
