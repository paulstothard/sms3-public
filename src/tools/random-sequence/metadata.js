import { geneticCodes, getStartCodons } from "../../core/genetic-code.js";
import {
  randomMutationTableColumns,
  randomRegionTableColumns
} from "./run.js";

const randomSeedOption = {
  id: "seed",
  type: "text",
  label: "Random seed",
  help: "Optional. Leave blank for a fresh random seed, or enter a seed to reproduce the same result.",
  defaultValue: ""
};

const lineWidthOption = {
  id: "lineWidth",
  type: "number",
  label: "Characters per output line",
  defaultValue: 60,
  min: 10,
  max: 200
};

const nucleotideAlphabetOption = {
  id: "nucleotideAlphabet",
  type: "radio",
  label: "Generated sequence type",
  defaultValue: "dna",
  choices: [
    { value: "dna", label: "DNA (uses T)" },
    { value: "rna", label: "RNA (uses U)" }
  ]
};

const replacementNucleotideAlphabetOption = {
  ...nucleotideAlphabetOption,
  label: "Replacement bases"
};

const fastaReportOutputOptions = [
  {
    id: "outputFormat",
    type: "radio",
    label: "Output format",
    defaultValue: "fasta",
    choices: [
      { value: "fasta", label: "FASTA" },
      { value: "report", label: "Summary report" }
    ]
  }
];

const fastaReportTableOutputOptions = [
  {
    id: "outputFormat",
    type: "radio",
    label: "Output format",
    defaultValue: "fasta",
    choices: [
      { value: "fasta", label: "FASTA" },
      { value: "report", label: "Summary report" },
      { value: "tsv", label: "TSV table" }
    ]
  }
];

function sequenceWorkflow(alphabet, schema, includeTable = false, tableSchema = "", columns = []) {
  return {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet, schema },
      ...(includeTable ? [{ id: "tsv", kind: "text", mediaType: "text/tab-separated-values" }] : []),
      ...(includeTable ? [{ id: "table", kind: "table", schema: tableSchema, columns }] : []),
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

function generatorWorkflow(alphabet, schema) {
  return {
    inputs: [],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet, schema },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

function makeStartCodonChoices() {
  const choices = [
    { value: "random", label: "Random valid start codon", always: true },
    { value: "none", label: "No fixed start codon", always: true },
    { value: "custom", label: "Custom codon", always: true }
  ];
  for (const code of geneticCodes) {
    for (const codon of getStartCodons(code.id)) {
      choices.push({
        value: `codon:${codon}`,
        label: codon,
        dependsOnValue: code.id
      });
    }
  }
  return choices;
}

const mutateOptions = (preserveLabel) => [
  {
    id: "mutationCount",
    type: "number",
    label: "Mutations per record",
    defaultValue: 5,
    min: 0,
    max: 1000000
  },
  { id: "preserveEnds", type: "checkbox", label: preserveLabel, defaultValue: true },
  randomSeedOption,
  lineWidthOption,
  ...fastaReportTableOutputOptions
];

const mutateDnaRnaOptions = (preserveLabel) => [
  {
    id: "mutationCount",
    type: "number",
    label: "Mutations per record",
    defaultValue: 5,
    min: 0,
    max: 1000000
  },
  { id: "preserveEnds", type: "checkbox", label: preserveLabel, defaultValue: true },
  replacementNucleotideAlphabetOption,
  randomSeedOption,
  lineWidthOption,
  ...fastaReportTableOutputOptions
];

const randomDnaRnaSequenceOptions = [
  nucleotideAlphabetOption,
  { id: "sequenceLength", type: "number", label: "Sequence length", defaultValue: 120, min: 1, max: 10000000 },
  { id: "sequenceCount", type: "number", label: "Number of sequences", defaultValue: 3, min: 1, max: 100000 },
  randomSeedOption,
  lineWidthOption,
  ...fastaReportOutputOptions
];

const randomProteinSequenceOptions = [
  { id: "sequenceLength", type: "number", label: "Sequence length", defaultValue: 120, min: 1, max: 10000000 },
  { id: "sequenceCount", type: "number", label: "Number of sequences", defaultValue: 3, min: 1, max: 100000 },
  randomSeedOption,
  lineWidthOption,
  ...fastaReportOutputOptions
];

const sampleOptions = [
  { id: "sampleLength", type: "number", label: "Sample length", defaultValue: 120, min: 1, max: 10000000 },
  { id: "samplesPerRecord", type: "number", label: "Samples per input record", defaultValue: 2, min: 1, max: 100000 },
  randomSeedOption,
  lineWidthOption,
  ...fastaReportOutputOptions
];

const regionOptions = [
  { id: "regionCount", type: "number", label: "Random regions per record", defaultValue: 3, min: 0, max: 1000000 },
  { id: "regionLength", type: "number", label: "Region length", defaultValue: 8, min: 1, max: 10000000 },
  randomSeedOption,
  lineWidthOption,
  ...fastaReportTableOutputOptions
];

const dnaRnaRegionOptions = [
  { id: "regionCount", type: "number", label: "Random regions per record", defaultValue: 3, min: 0, max: 1000000 },
  { id: "regionLength", type: "number", label: "Region length", defaultValue: 8, min: 1, max: 10000000 },
  replacementNucleotideAlphabetOption,
  randomSeedOption,
  lineWidthOption,
  ...fastaReportTableOutputOptions
];

const shuffleOptions = [randomSeedOption, lineWidthOption, ...fastaReportOutputOptions];

export const mutateDnaRnaMetadata = {
  id: "mutate-dna-rna",
  name: "Mutate DNA/RNA",
  category: "Generate Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "workflow"],
  summary: "Introduce random base substitutions into DNA/RNA sequences with an optional reproducible seed.",
  inputType: "DNA/RNA sequence",
  outputType: "Mutated DNA/RNA FASTA, mutation table",
  workflow: sequenceWorkflow("dna-rna", "mutate-dna-rna", true, "random-mutations", randomMutationTableColumns),
  options: mutateDnaRnaOptions("Preserve first and last 3 bases")
};

export const mutateProteinMetadata = {
  id: "mutate-protein",
  name: "Mutate Protein",
  category: "Generate Sequences",
  tags: ["protein", "FASTA", "IUPAC", "workflow"],
  summary: "Introduce random residue substitutions into protein sequences with an optional reproducible seed.",
  inputType: "Protein sequence",
  outputType: "Mutated protein FASTA, mutation table",
  workflow: sequenceWorkflow("protein", "mutate-protein", true, "random-mutations", randomMutationTableColumns),
  options: mutateOptions("Preserve first residue")
};

export const randomDnaRnaMetadata = {
  id: "random-dna-rna",
  name: "Random DNA/RNA Sequence",
  category: "Generate Sequences",
  tags: ["DNA", "RNA", "FASTA", "workflow"],
  summary: "Generate random DNA or RNA sequences of a requested length with an optional reproducible seed.",
  inputType: "No input required",
  inputRequired: false,
  outputType: "Random DNA/RNA FASTA",
  workflow: generatorWorkflow("dna-rna", "random-dna-rna"),
  options: randomDnaRnaSequenceOptions
};

export const randomProteinMetadata = {
  id: "random-protein",
  name: "Random Protein Sequence",
  category: "Generate Sequences",
  tags: ["protein", "FASTA", "workflow"],
  summary: "Generate random protein sequences of a requested length with an optional reproducible seed.",
  inputType: "No input required",
  inputRequired: false,
  outputType: "Random protein FASTA",
  workflow: generatorWorkflow("protein", "random-protein"),
  options: randomProteinSequenceOptions
};

export const randomCodingDnaMetadata = {
  id: "random-coding-dna",
  name: "Random Coding DNA",
  category: "Generate Sequences",
  tags: ["DNA", "FASTA", "genetic code", "codon", "workflow"],
  summary: "Generate random coding DNA with a start codon, internal sense codons, and a stop codon.",
  inputType: "No input required",
  inputRequired: false,
  outputType: "Random coding DNA FASTA",
  workflow: generatorWorkflow("dna-rna", "random-coding-dna"),
  options: [
    { id: "codonCount", type: "number", label: "Codons including start and stop", defaultValue: 30, min: 2, max: 1000000 },
    {
      id: "geneticCode",
      type: "select",
      label: "Genetic code",
      defaultValue: "1",
      choices: geneticCodes.map((code) => ({ value: code.id, label: `${code.id}. ${code.name}` }))
    },
    {
      id: "startCodonChoice",
      type: "select",
      label: "Start codon",
      defaultValue: "random",
      dependsOn: "geneticCode",
      choices: makeStartCodonChoices()
    },
    {
      id: "customStartCodon",
      type: "text",
      label: "Custom start codon",
      help: "Used only when Start codon is set to Custom codon. Enter one DNA sense codon, for example ATG, GTG, or TTG.",
      defaultValue: "ATG",
      visibleWhen: { option: "startCodonChoice", value: "custom" }
    },
    { id: "sequenceCount", type: "number", label: "Number of sequences", defaultValue: 3, min: 1, max: 100000 },
    randomSeedOption,
    lineWidthOption,
    ...fastaReportOutputOptions
  ]
};

export const randomDnaRnaRegionsMetadata = {
  id: "random-dna-rna-regions",
  name: "Random DNA/RNA Regions",
  category: "Generate Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "workflow"],
  summary: "Replace randomly selected DNA/RNA regions with random bases using an optional reproducible seed.",
  inputType: "DNA/RNA sequence",
  outputType: "Randomized DNA/RNA FASTA, region table",
  workflow: sequenceWorkflow("dna-rna", "random-dna-rna-regions", true, "random-regions", randomRegionTableColumns),
  options: dnaRnaRegionOptions
};

export const randomProteinRegionsMetadata = {
  id: "random-protein-regions",
  name: "Random Protein Regions",
  category: "Generate Sequences",
  tags: ["protein", "FASTA", "IUPAC", "workflow"],
  summary: "Replace randomly selected protein regions with random residues using an optional reproducible seed.",
  inputType: "Protein sequence",
  outputType: "Randomized protein FASTA, region table",
  workflow: sequenceWorkflow("protein", "random-protein-regions", true, "random-regions", randomRegionTableColumns),
  options: regionOptions
};

export const sampleDnaRnaMetadata = {
  id: "sample-dna-rna",
  name: "Sample DNA/RNA",
  category: "Generate Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "workflow"],
  summary: "Sample bases with replacement from each DNA/RNA input record to build new sequences.",
  inputType: "DNA/RNA sequence",
  outputType: "Sampled DNA/RNA FASTA",
  workflow: sequenceWorkflow("dna-rna", "sampled-dna-rna"),
  options: sampleOptions
};

export const sampleProteinMetadata = {
  id: "sample-protein",
  name: "Sample Protein",
  category: "Generate Sequences",
  tags: ["protein", "FASTA", "IUPAC", "workflow"],
  summary: "Sample residues with replacement from each protein input record to build new sequences.",
  inputType: "Protein sequence",
  outputType: "Sampled protein FASTA",
  workflow: sequenceWorkflow("protein", "sampled-protein"),
  options: sampleOptions
};

export const shuffleDnaRnaMetadata = {
  id: "shuffle-dna-rna",
  name: "Shuffle DNA/RNA",
  category: "Generate Sequences",
  tags: ["DNA", "RNA", "FASTA", "IUPAC", "workflow"],
  summary: "Randomly shuffle each DNA/RNA input sequence while preserving composition.",
  inputType: "DNA/RNA sequence",
  outputType: "Shuffled DNA/RNA FASTA",
  workflow: sequenceWorkflow("dna-rna", "shuffled-dna-rna"),
  options: shuffleOptions
};

export const shuffleProteinMetadata = {
  id: "shuffle-protein",
  name: "Shuffle Protein",
  category: "Generate Sequences",
  tags: ["protein", "FASTA", "IUPAC", "workflow"],
  summary: "Randomly shuffle each protein input sequence while preserving composition.",
  inputType: "Protein sequence",
  outputType: "Shuffled protein FASTA",
  workflow: sequenceWorkflow("protein", "shuffled-protein"),
  options: shuffleOptions
};
