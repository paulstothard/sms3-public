import { multipleAlignmentTableColumns } from "../../core/multiple-sequence-alignment.js";

function buildMetadata(alphabet) {
  const isProtein = alphabet === "protein";
  return {
    id: isProtein ? "multiple-align-protein" : "multiple-align-dna-rna",
    name: isProtein ? "Multiple Align Protein" : "Multiple Align DNA/RNA",
    category: isProtein ? "Analyze Protein" : "Analyze DNA/RNA",
    tags: [isProtein ? "protein" : "DNA", "FASTA", "alignment", "workflow"],
    summary: `Progressively align multiple ${isProtein ? "protein" : "DNA/RNA"} FASTA records using affine pairwise alignments.`,
    inputType: `${isProtein ? "Protein" : "DNA/RNA"} FASTA records`,
    outputType: "Multiple alignment report, FASTA, CLUSTAL, table, or colored SVG",
    workflow: {
      inputs: [
        { id: "input", kind: "text", mediaType: "text/plain" },
        { id: "sequenceRecords", kind: "sequence-records", alphabet: isProtein ? "protein" : "dna-rna" }
      ],
      outputs: [
        { id: "primary", kind: "text", mediaType: "text/plain" },
        { id: "report", kind: "text", mediaType: "text/plain" },
        { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
        { id: "clustal", kind: "text", mediaType: "text/plain" },
        { id: "table", kind: "table", schema: isProtein ? "multiple-alignment-protein" : "multiple-alignment-dna-rna", columns: multipleAlignmentTableColumns },
        { id: "coloredSvg", kind: "text", mediaType: "image/svg+xml" },
        { id: "warnings", kind: "warnings" }
      ]
    },
    runInWorker: true,
    workerModule: "../tools/multiple-sequence-alignment/run.js",
    workerExport: isProtein ? "runMultipleAlignProtein" : "runMultipleAlignDnaRna",
    options: [
      ...(isProtein ? [] : [
        { id: "matchScore", type: "number", label: "Match score", defaultValue: 5, step: 1 },
        { id: "similarScore", type: "number", label: "Ambiguous overlap score", defaultValue: 1, step: 1 },
        { id: "mismatchScore", type: "number", label: "Mismatch score", defaultValue: -4, step: 1 }
      ]),
      { id: "gapOpen", type: "number", label: "Gap open penalty", defaultValue: 10, min: 0, step: 1 },
      { id: "gapExtend", type: "number", label: "Gap extend penalty", defaultValue: 1, min: 0, step: 1 },
      { id: "lineWidth", type: "number", label: "Alignment columns per block", defaultValue: 60, min: 20, max: 120, step: 1 },
      {
        id: "outputFormat",
        type: "radio",
        label: "Output format",
        defaultValue: "clustal",
        choices: [
          { value: "clustal", label: "CLUSTAL alignment" },
          { value: "aligned-fasta", label: "Aligned FASTA" },
          { value: "report", label: "Summary report" },
          { value: "tsv", label: "TSV column table" },
          { value: "svg-color", label: "Colored SVG" }
        ]
      },
      {
        id: "methodNote",
        type: "note",
        text: `Progressive star alignment chooses a center sequence from pairwise global alignments, then merges center-to-sequence alignments. ${isProtein ? "Protein scoring uses BLOSUM62." : "DNA/RNA scoring uses identity plus ambiguous IUPAC overlap."}`
      }
    ]
  };
}

export const multipleAlignDnaRnaMetadata = buildMetadata("dna-rna");
export const multipleAlignProteinMetadata = buildMetadata("protein");
