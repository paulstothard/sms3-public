import { technicalSequenceTableColumns } from "./run.js";
import technicalSequenceSummary from "../../reference-data/technical-sequences/summary.js";

function makeClassChoices(records) {
  return [
    { value: "all", label: "All classes" },
    ...[...new Set(records.map((record) => record.class))]
      .sort((left, right) => left.localeCompare(right))
      .map((recordClass) => ({ value: recordClass, label: recordClass })),
    { value: "custom", label: "Custom sequences" }
  ];
}

function makeSequenceChoices(records) {
  return [
    { value: "all", label: "All bundled sequences" },
    ...records
      .map((record) => ({ value: record.id, label: record.name, dependsOnValue: record.class }))
      .sort((left, right) => left.label.localeCompare(right.label))
  ];
}

export const technicalSequenceScannerMetadata = {
  id: "technical-sequence-scanner",
  name: "Technical Sequence Scanner",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "technical sequence", "adapter", "primer", "contamination", "reference data"],
  summary: "Scan DNA/RNA sequences for bundled or custom primers, adapters, and other technical sequences.",
  inputType: "DNA/RNA sequence",
  outputType: "Report, TSV table",
  runInWorker: true,
  workerModule: "../tools/technical-sequence-scanner/run.js",
  workerExport: "runTechnicalSequenceScanner",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "report", kind: "text", mediaType: "text/plain" },
      {
        id: "table",
        kind: "table",
        schema: "technical-sequence-scanner",
        columns: technicalSequenceTableColumns
      },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "sequenceClass",
      type: "select",
      label: "Sequence class",
      defaultValue: "all",
      choices: makeClassChoices(technicalSequenceSummary)
    },
    {
      id: "sequenceId",
      type: "select",
      label: "Bundled sequence",
      defaultValue: "all",
      dependsOn: "sequenceClass",
      choices: makeSequenceChoices(technicalSequenceSummary)
    },
    {
      id: "strand",
      type: "radio",
      label: "Strand",
      defaultValue: "both",
      choices: [
        { value: "both", label: "Both strands" },
        { value: "forward", label: "Forward only" }
      ]
    },
    {
      id: "matchMode",
      type: "select",
      label: "Match mode",
      defaultValue: "full",
      choices: [
        { value: "full", label: "Full sequence only" },
        { value: "partial-ends", label: "Partial at sequence ends" },
        { value: "full-or-partial", label: "Full or partial" }
      ]
    },
    {
      id: "minimumPartialLength",
      type: "number",
      label: "Minimum partial length",
      defaultValue: 12,
      min: 4,
      max: 100
    },
    {
      id: "customSequences",
      type: "text",
      label: "Custom sequences",
      defaultValue: ""
    },
    {
      id: "allowOverlaps",
      type: "checkbox",
      label: "Allow overlapping matches",
      defaultValue: true
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" }
      ]
    },
    {
      id: "databaseNote",
      type: "note",
      text: `Bundled database: ${technicalSequenceSummary.length} cited primer/adaptor records. Partial matching checks sequence ends only and does not allow mismatches. This is not an error-tolerant FASTQ adapter trimmer.`
    }
  ]
};
