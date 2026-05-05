import { pairedFastqColumns } from "../../core/paired-fastq-checker.js";

export const pairedFastqCheckerMetadata = {
  id: "paired-fastq-checker",
  name: "Paired FASTQ Checker",
  category: "Analyze Sequences",
  tags: ["DNA", "text", "validation", "workflow"],
  summary: "Parse pasted FASTQ filenames, infer sample/lane/read pairs, and report missing or duplicate mates.",
  inputType: "FASTQ filename list",
  outputType: "Pairing report or TSV table",
  workflow: {
    inputs: [{ id: "input", kind: "text", mediaType: "text/plain" }],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "paired-fastq-checker", columns: pairedFastqColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  runInWorker: true,
  workerModule: "../tools/paired-fastq-checker/run.js",
  workerExport: "runPairedFastqChecker",
  options: [
    {
      type: "group",
      label: "Output format",
      options: [
        {
          id: "outputFormat",
          type: "radio",
          label: "Format",
          defaultValue: "table-tsv",
          choices: [
            { value: "table-tsv", label: "Pairing TSV" },
            { value: "report", label: "Summary report" }
          ]
        }
      ]
    }
  ]
};
