import { proteinStatsTableColumns } from "./run.js";

export const proteinStatsMetadata = {
  id: "protein-stats",
  name: "Protein Stats",
  category: "Analyze Protein",
  tags: ["protein", "mass", "charge", "pI", "statistics"],
  summary:
    "Summarize protein length, residue counts, molecular weight, net charge, and estimated isoelectric point.",
  inputType: "Protein sequence",
  outputType: "Protein statistics report, table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "protein" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "protein-stats", columns: proteinStatsTableColumns },
      { id: "statsRecords", kind: "stats-records", schema: "protein-stats" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: true },
    {
      id: "chargePh",
      type: "number",
      label: "Net charge pH",
      defaultValue: 7,
      min: 0,
      max: 14,
      step: 0.1
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Output format",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" }
      ]
    },
    {
      id: "methodNote",
      type: "note",
      text: "Molecular weight uses average peptide-residue masses plus one H2O. Charge and pI use Henderson-Hasselbalch equations with EMBOSS Epk.dat pKa defaults and include termini."
    },
    {
      id: "citationNote",
      type: "note",
      text: "References: ExPASy ProtParam documentation; EMBOSS pepstats and iep documentation."
    }
  ]
};
