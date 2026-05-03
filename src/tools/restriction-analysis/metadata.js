import { restrictionEnzymeRecords } from "../../reference-data/restriction-enzymes/records.js";
import {
  getRestrictionEnzymeChoices,
  restrictionFragmentTableColumns,
  restrictionHitTableColumns,
  restrictionMapTableColumns
} from "../../core/restriction-analysis.js";

export const restrictionAnalysisMetadata = {
  id: "restriction-analysis",
  name: "Restriction Analysis",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "restriction", "enzyme", "digest", "map", "workflow"],
  summary: "Find restriction sites, estimate digest fragments, and draw a simple restriction map.",
  inputType: "DNA sequence",
  outputType: "Restriction report, tables, map",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "restriction-sites", columns: restrictionHitTableColumns },
      { id: "fragments", kind: "table", schema: "restriction-fragments", columns: restrictionFragmentTableColumns },
      { id: "mapTable", kind: "table", schema: "restriction-map", columns: restrictionMapTableColumns },
      { id: "overview", kind: "text", mediaType: "image/svg+xml" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "enzymeIds",
      type: "select",
      label: "Enzymes",
      help: "Choose the bundled common set or one specific enzyme from the current restriction enzyme reference data.",
      defaultValue: "common",
      choices: [
        { value: "common", label: "Common seed set" },
        ...getRestrictionEnzymeChoices(restrictionEnzymeRecords)
      ]
    },
    {
      id: "topology",
      type: "radio",
      label: "Topology",
      help: "Linear treats sequence ends as fragment ends. Circular treats the last base as connected to the first base for fragment and map calculations.",
      defaultValue: "linear",
      choices: [
        { value: "linear", label: "Linear" },
        { value: "circular", label: "Circular" }
      ]
    },
    {
      id: "minimumSites",
      type: "number",
      label: "Minimum sites per enzyme",
      help: "Only show enzymes that cut at least this many times in a record.",
      defaultValue: 1,
      min: 0,
      step: 1
    },
    {
      id: "maximumSites",
      type: "number",
      label: "Maximum sites per enzyme",
      help: "Hide enzymes with more than this many cut sites to reduce dense reports and maps.",
      defaultValue: 999,
      min: 1,
      step: 1
    },
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: false, help: "Keeps alignment gaps while scanning. Gap characters can change reported coordinates and recognition-site matching." },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "svg-overview",
      choices: [
        { value: "svg-overview", label: "SVG restriction map" },
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV site table" }
      ]
    },
    {
      id: "sourceNote",
      type: "note",
      text:
        "Restriction enzyme records are a small bundled seed set from common Type II enzymes, checked against NEB recognition-specificity listings and REBASE literature. Coordinates are 1-based on the submitted sequence."
    }
  ]
};
