import { motifMatchTableColumns } from "../../core/motif-scanner.js";
import dnaRnaMotifs from "../../reference-data/motifs/dna-rna-motifs.js";
import proteinMotifs from "../../reference-data/motifs/protein-motifs.js";

function makeClassChoices(motifs) {
  return [
    { value: "all", label: "All classes" },
    ...[...new Set(motifs.map((motif) => motif.class))]
      .sort((left, right) => left.localeCompare(right))
      .map((motifClass) => ({ value: motifClass, label: motifClass }))
  ];
}

function makeMotifChoices(motifs) {
  return [
    { value: "all", label: "All motifs" },
    ...motifs
      .map((motif) => ({ value: motif.id, label: motif.name, dependsOnValue: motif.class }))
      .sort((left, right) => left.label.localeCompare(right.label))
  ];
}

function makeWorkflow(alphabet, schema) {
  return {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema, columns: motifMatchTableColumns },
      { id: "warnings", kind: "warnings" }
    ]
  };
}

const sharedOutputOptions = [
  {
    id: "outputFormat",
    type: "radio",
    label: "Output format",
    defaultValue: "report",
    choices: [
      { value: "report", label: "Summary report" },
      { value: "tsv", label: "TSV table" }
    ]
  }
];

export const dnaRnaMotifScannerMetadata = {
  id: "dna-rna-motif-scanner",
  name: "DNA/RNA Motif Scanner",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "motif", "annotation", "reference data"],
  summary: "Scan DNA/RNA sequences against bundled named motif records with provenance.",
  inputType: "DNA/RNA sequence",
  outputType: "Report, TSV table",
  runInWorker: true,
  workerModule: "../tools/motif-scanner/run.js",
  workerExport: "runDnaRnaMotifScannerWorker",
  workflow: makeWorkflow("dna-rna", "dna-rna-motif-scanner"),
  options: [
    {
      id: "motifClass",
      type: "select",
      label: "Motif class",
      help: "Narrows the motif list to one class. Leave as All classes to scan every bundled motif.",
      defaultValue: "all",
      choices: makeClassChoices(dnaRnaMotifs)
    },
    {
      id: "motifId",
      type: "select",
      label: "Motif",
      help: "Choose a specific bundled motif within the selected class, or leave as All motifs to scan the whole selected class.",
      defaultValue: "all",
      dependsOn: "motifClass",
      choices: makeMotifChoices(dnaRnaMotifs)
    },
    {
      id: "strand",
      type: "radio",
      label: "Strand",
      help: "Both strands searches the submitted DNA/RNA sequence and its reverse complement, while reporting coordinates on the original submitted sequence.",
      defaultValue: "both",
      choices: [
        { value: "forward", label: "Forward only" },
        { value: "both", label: "Both strands" }
      ]
    },
    { id: "allowOverlaps", type: "checkbox", label: "Allow overlapping matches", defaultValue: true, help: "Allows motif hits that share one or more sequence positions." },
    ...sharedOutputOptions,
    {
      id: "databaseNote",
      type: "note",
      text: `Bundled database: ${dnaRnaMotifs.length} cited DNA/RNA motif records. These are candidate patterns, not a comprehensive transcription-factor or regulatory motif database.`
    }
  ]
};

export const proteinMotifScannerMetadata = {
  id: "protein-motif-scanner",
  name: "Protein Motif Scanner",
  category: "Analyze Protein",
  tags: ["protein", "motif", "annotation", "reference data"],
  summary: "Scan protein sequences against bundled named motif records with provenance.",
  inputType: "Protein sequence",
  outputType: "Report, TSV table",
  runInWorker: true,
  workerModule: "../tools/motif-scanner/run.js",
  workerExport: "runProteinMotifScannerWorker",
  workflow: makeWorkflow("protein", "protein-motif-scanner"),
  options: [
    {
      id: "motifClass",
      type: "select",
      label: "Motif class",
      help: "Narrows the motif list to one class. Leave as All classes to scan every bundled motif.",
      defaultValue: "all",
      choices: makeClassChoices(proteinMotifs)
    },
    {
      id: "motifId",
      type: "select",
      label: "Motif",
      help: "Choose a specific bundled motif within the selected class, or leave as All motifs to scan the whole selected class.",
      defaultValue: "all",
      dependsOn: "motifClass",
      choices: makeMotifChoices(proteinMotifs)
    },
    { id: "allowOverlaps", type: "checkbox", label: "Allow overlapping matches", defaultValue: true, help: "Allows motif hits that share one or more residue positions." },
    ...sharedOutputOptions,
    {
      id: "databaseNote",
      type: "note",
      text: `Bundled database: ${proteinMotifs.length} cited protein motif records. Short protein motifs can produce many false positives. Treat matches as candidate sites, not functional annotation.`
    }
  ]
};
