import { tools } from "../tools/registry.js";
import { ToolWorkerClient } from "./worker-client.js";
import { geneticCodes, getCodonsForCode } from "../core/genetic-code.js";
import { runWorkflow, validateWorkflowDefinition } from "../core/workflow-engine.js";
import { codonUsageReferences } from "../reference-data/codon-usage/references.js";
import dnaRnaMotifs from "../reference-data/motifs/dna-rna-motifs.js";
import proteinMotifs from "../reference-data/motifs/protein-motifs.js";
import motifProvenance from "../reference-data/motifs/provenance.js";
import technicalSequenceSummary from "../reference-data/technical-sequences/summary.js";
import technicalSequenceProvenance from "../reference-data/technical-sequences/provenance.js";
import vectorContaminationSummary from "../reference-data/vector-contamination/summary.js";
import vectorContaminationProvenance from "../reference-data/vector-contamination/provenance.js";
import referenceDataManifest from "../reference-data/datasets.js";

const state = {
  selectedTool: tools[0],
  selectedReference: "iupac-nucleotide",
  selectedGeneticCode: "1",
  selectedGeneticCodeAminoAcid: "all",
  selectedGeneticCodeCodon: "all",
  selectedWorkflow: "orf-codon-usage",
  importedWorkflow: null,
  selectedWorkflowStepId: null,
  expandedWorkflowStepIds: new Set(),
  workflowAddStepOpen: false,
  workflowRun: null,
  toolRun: null,
  activeView: "tool",
  activeTags: new Set(),
  outputSearch: {
    tool: { matches: [], currentIndex: -1, debounceTimer: null },
    workflow: { matches: [], currentIndex: -1, debounceTimer: null }
  },
  outputTable: {
    tool: { sortColumn: null, sortDirection: "asc", hiddenColumns: new Set(), columnPreset: "all" },
    workflow: { sortColumn: null, sortDirection: "asc", hiddenColumns: new Set(), columnPreset: "all" }
  },
  outputFormatByTool: new Map(),
  currentToolOutputChoices: []
};

const sortedTools = [...tools].sort((left, right) =>
  left.metadata.name.localeCompare(right.metadata.name)
);

const OUTPUT_HIGHLIGHT_LIMIT = 300_000;
const TABLE_FULL_RENDER_ROW_LIMIT = 1000;
const TABLE_FULL_RENDER_CELL_LIMIT = 20000;
const toolWorkerClient = new ToolWorkerClient();

const elements = {
  appShell: document.querySelector(".app-shell"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  themeToggle: document.querySelector("#themeToggle"),
  toolSearch: document.querySelector("#toolSearch"),
  toolList: document.querySelector("#toolList"),
  referenceList: document.querySelector("#referenceList"),
  toolView: document.querySelector("#toolView"),
  referenceView: document.querySelector("#referenceView"),
  feedbackView: document.querySelector("#feedbackView"),
  workflowView: document.querySelector("#workflowView"),
  appVersion: document.querySelector("#appVersion"),
  selectedReferenceTitle: document.querySelector("#selectedReferenceTitle"),
  selectedReferenceBody: document.querySelector("#selectedReferenceBody"),
  workflowLink: document.querySelector("#workflowLink"),
  feedbackLink: document.querySelector("#feedbackLink"),
  feedbackTemplates: document.querySelector("#feedbackTemplates"),
  workflowPreset: document.querySelector("#workflowPreset"),
  workflowLoadExample: document.querySelector("#workflowLoadExample"),
  workflowClearInput: document.querySelector("#workflowClearInput"),
  workflowInput: document.querySelector("#workflowInput"),
  workflowSummary: document.querySelector("#workflowSummary"),
  runWorkflow: document.querySelector("#runWorkflow"),
  cancelWorkflow: document.querySelector("#cancelWorkflow"),
  workflowExportJson: document.querySelector("#workflowExportJson"),
  workflowImportJson: document.querySelector("#workflowImportJson"),
  workflowValidateJson: document.querySelector("#workflowValidateJson"),
  workflowJson: document.querySelector("#workflowJson"),
  workflowAddStepType: document.querySelector("#workflowAddStepType"),
  workflowAddToolRow: document.querySelector("#workflowAddToolRow"),
  workflowAddTool: document.querySelector("#workflowAddTool"),
  workflowAddStreamRow: document.querySelector("#workflowAddStreamRow"),
  workflowAddStream: document.querySelector("#workflowAddStream"),
  workflowAddFilterFieldRow: document.querySelector("#workflowAddFilterFieldRow"),
  workflowAddFilterField: document.querySelector("#workflowAddFilterField"),
  workflowAddFilterOperatorRow: document.querySelector("#workflowAddFilterOperatorRow"),
  workflowAddFilterOperator: document.querySelector("#workflowAddFilterOperator"),
  workflowAddFilterValueRow: document.querySelector("#workflowAddFilterValueRow"),
  workflowAddFilterValue: document.querySelector("#workflowAddFilterValue"),
  workflowAddSortFieldRow: document.querySelector("#workflowAddSortFieldRow"),
  workflowAddSortField: document.querySelector("#workflowAddSortField"),
  workflowAddSortDirectionRow: document.querySelector("#workflowAddSortDirectionRow"),
  workflowAddSortDirection: document.querySelector("#workflowAddSortDirection"),
  workflowAddGatherRow: document.querySelector("#workflowAddGatherRow"),
  workflowAddGatherAs: document.querySelector("#workflowAddGatherAs"),
  workflowOpenAddStep: document.querySelector("#workflowOpenAddStep"),
  workflowAddStepDraft: document.querySelector("#workflowAddStepDraft"),
  workflowCancelAddStep: document.querySelector("#workflowCancelAddStep"),
  workflowAppendStep: document.querySelector("#workflowAppendStep"),
  workflowBuilderGuidance: document.querySelector("#workflowBuilderGuidance"),
  workflowMessages: document.querySelector("#workflowMessages"),
  workflowStepInspector: document.querySelector("#workflowStepInspector"),
  workflowOutputSummary: document.querySelector("#workflowOutputSummary"),
  workflowOutput: document.querySelector("#workflowOutput"),
  workflowOutputSearch: document.querySelector("#workflowOutputSearch"),
  workflowOutputSearchPrevious: document.querySelector("#workflowOutputSearchPrevious"),
  workflowOutputSearchNext: document.querySelector("#workflowOutputSearchNext"),
  workflowOutputSearchCount: document.querySelector("#workflowOutputSearchCount"),
  workflowOutputHighlight: document.querySelector("#workflowOutputHighlight"),
  workflowOutputViewTabs: document.querySelector("#workflowOutputViewTabs"),
  workflowOutputViewNote: document.querySelector("#workflowOutputViewNote"),
  workflowOutputActions: document.querySelector("#workflowOutputActions"),
  workflowTableOutput: document.querySelector("#workflowTableOutput"),
  workflowDownloadOutput: document.querySelector("#workflowDownloadOutput"),
  workflowCopyOutput: document.querySelector("#workflowCopyOutput"),
  toolCategory: document.querySelector("#toolCategory"),
  toolTitle: document.querySelector("#toolTitle"),
  toolTags: document.querySelector("#toolTags"),
  toolSummary: document.querySelector("#toolSummary"),
  toolOptions: document.querySelector("#toolOptions"),
  restoreDefaults: document.querySelector("#restoreDefaults"),
  sequenceInput: document.querySelector("#sequenceInput"),
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  dropZoneLabel: document.querySelector("#dropZoneLabel"),
  loadExample: document.querySelector("#loadExample"),
  clearInput: document.querySelector("#clearInput"),
  runTool: document.querySelector("#runTool"),
  cancelTool: document.querySelector("#cancelTool"),
  copyOutput: document.querySelector("#copyOutput"),
  downloadOutput: document.querySelector("#downloadOutput"),
  outputSearch: document.querySelector("#outputSearch"),
  outputSearchPrevious: document.querySelector("#outputSearchPrevious"),
  outputSearchNext: document.querySelector("#outputSearchNext"),
  outputSearchCount: document.querySelector("#outputSearchCount"),
  toolOutputHighlight: document.querySelector("#toolOutputHighlight"),
  outputViewTabs: document.querySelector("#outputViewTabs"),
  outputFormatSelect: document.querySelector("#outputFormatSelect"),
  toolOutputActions: document.querySelector("#toolOutputActions"),
  messages: document.querySelector("#messages"),
  visualOutput: document.querySelector("#visualOutput"),
  toolOutput: document.querySelector("#toolOutput"),
  toolTableOutput: document.querySelector("#toolTableOutput")
};

const workflowPresets = [
  {
    id: "orf-codon-usage",
    name: "ORFs to codon usage",
    summary: "Find complete forward-strand ORFs, pass ORF nucleotide records to Codon Usage, and show the codon table.",
    example: `>orf-example-one
AAACCCATGAAATAGGGGATGCCCTAA
>orf-example-two
TTTATGGCTGCTGCTTAACCCATGTTTTAG
>orf-example-three
GGGATGAAACCCGGGTAAATGCCCAAATAG`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "find-orfs",
          type: "tool",
          toolId: "orf-finder",
          selectStream: "orfRecords",
          options: {
            strand: "forward",
            startMode: "start-codon",
            minimumAminoAcids: 1,
            includePartial: false,
            outputFormat: "report"
          }
        },
        {
          id: "codon-usage",
          type: "tool",
          toolId: "codon-usage",
          input: { from: "find-orfs", stream: "orfRecords" },
          selectStream: "table",
          options: { outputFormat: "tsv" }
        }
      ]
    }
  },
  {
    id: "filter-reverse-complement",
    name: "Filter records and reverse complement",
    summary: "Split FASTA records, keep records at least 9 bases long, reverse-complement each, and gather sequence records.",
    example: `>short
ATG
>keep-one
ATGAAATAG
>keep-two
CCCTTTAAA
>keep-three
ACGTRYSWKMBDHVN
>tiny
AC`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        { id: "split", type: "split" },
        {
          id: "filter-length",
          type: "filter",
          criteria: { field: "length", operator: ">=", value: 9 }
        },
        {
          id: "reverse-complement",
          type: "map",
          toolId: "reverse-complement",
          selectStream: "sequenceRecords",
          options: {
            preserveCase: false,
            formatFasta: true
          }
        },
        { id: "gather", type: "gather", as: "sequence-records" }
      ]
    }
  },
  {
    id: "translate-reverse-translate",
    name: "Translate then reverse translate",
    summary: "Translate DNA/RNA to protein records, then reverse translate those protein records using the E. coli codon reference.",
    example: `>coding-one
ATGGCTTTATGG
>coding-two
ATGGCATTATTG`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "translate",
          type: "tool",
          toolId: "translate",
          selectStream: "proteinRecords",
          options: {
            frame: "1",
            geneticCode: "11",
            formatFasta: true
          }
        },
        {
          id: "reverse-translate",
          type: "tool",
          toolId: "reverse-translate",
          input: { from: "translate", stream: "proteinRecords" },
          selectStream: "dnaRecords",
          options: {
            referenceId: "ecoli-k12-mg1655-refseq",
            mode: "most-likely",
            outputFormat: "fasta"
          }
        }
      ]
    }
  },
  {
    id: "stats-gc-filter",
    name: "Sequence stats GC filter",
    summary: "Calculate sequence stats and keep table rows with GC percent at least 60.",
    example: `>one
ACGT
>two
GGNN
>three
ATATAT
>gc-rich
GGGCCCGCGCGC
>mixed-ambiguous
ACGTRYSWKMBDHVN`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "stats",
          type: "tool",
          toolId: "sequence-stats-dna-rna",
          selectStream: "table",
          options: { outputFormat: "tsv" }
        },
        {
          id: "gc-filter",
          type: "filter",
          criteria: { field: "gc_percent", operator: ">=", value: 60 }
        }
      ]
    }
  }
];

const feedbackTemplates = [
  {
    id: "tool-request",
    title: "Tool request",
    summary: "Suggest a new tool, workflow, option, example, or output format.",
    subject: "SMS3 tool request",
    body: `Tool or workflow requested:

What input should it accept?

What output should it produce?

Example sequence or use case:
`
  },
  {
    id: "bug-report",
    title: "Bug report",
    summary: "Report incorrect output, confusing warnings, browser problems, or broken examples.",
    subject: "SMS3 bug report",
    body: `Tool:

What happened?

What did you expect?

Input, options, and browser:
`
  },
  {
    id: "teaching-feedback",
    title: "Teaching feedback",
    summary: "Share tutorial, classroom, documentation, or direct-link needs.",
    subject: "SMS3 teaching feedback",
    body: `Course or tutorial context:

Tools used:

What would make SMS3 easier to teach with?
`
  },
  {
    id: "general",
    title: "General feedback",
    summary: "Send any other SMS3 note.",
    subject: "SMS3 feedback",
    body: `Feedback:
`
  }
];

// Reference values below are UI reference content, not analysis logic.
// Nucleotide base codes cite the DDBJ/ENA/GenBank Feature Table Definition:
// https://www.ddbj.nig.ac.jp/ddbj/feature-table.html
// Amino-acid abbreviations cite the same maintained INSDC feature-table spec.
// Genetic-code names and transl_table identifiers cite NCBI Genetic Codes:
// https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi
function makeCodonReferenceRows() {
  return codonUsageReferences.map((reference) => {
    const skipped = reference.buildStats?.skipped
      ? Object.entries(reference.buildStats.skipped)
          .filter(([, count]) => count > 0)
          .map(([key, count]) => `${key}: ${count}`)
          .join("; ") || "none"
      : "not applicable";
    return [
      reference.name,
      reference.organism,
      `${reference.geneticCode.id}. ${reference.geneticCode.name}`,
      String(reference.totals.senseCodons),
      String(reference.buildStats?.countedCds ?? ""),
      skipped,
      reference.source.accessDate,
      `${reference.source.name} ${reference.source.version}`.trim(),
      reference.description
    ];
  });
}

function makeMotifReferenceRows() {
  return [...dnaRnaMotifs, ...proteinMotifs]
    .sort(
      (left, right) =>
        left.alphabet.localeCompare(right.alphabet) ||
        left.class.localeCompare(right.class) ||
        left.name.localeCompare(right.name)
    )
    .map((motif) => [
      motif.name,
      motif.alphabet === "protein" ? "Protein" : "DNA/RNA",
      motif.class,
      motif.syntax,
      motif.pattern,
      `${motif.source.name} ${motif.source.version}`.trim(),
      motif.source.accessDate,
      motif.description
    ]);
}

function makeTechnicalSequenceReferenceRows() {
  return technicalSequenceSummary
    .map((record) => [
      record.name,
      record.class,
      record.syntax,
      record.pattern,
      `${record.source.name} ${record.source.version}`.trim(),
      record.source.accessDate,
      record.description
    ])
    .sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]));
}

function makeVectorContaminationReferenceRows() {
  return [
    [
      vectorContaminationSummary.dataset,
      vectorContaminationSummary.sourceName,
      vectorContaminationSummary.sourceVersion,
      String(vectorContaminationSummary.recordCount),
      String(vectorContaminationSummary.totalBases),
      String(vectorContaminationSummary.kmerLength),
      String(vectorContaminationSummary.indexFormatVersion),
      vectorContaminationProvenance.accessDate,
      vectorContaminationProvenance.buildScript,
      vectorContaminationSummary.matchModel
    ]
  ];
}

function makeReferenceDataManifestRows() {
  return referenceDataManifest.datasets.map((dataset) => [
    dataset.name,
    dataset.id,
    dataset.fetchScript ?? "none",
    dataset.buildScript,
    dataset.offlineBuild ? "yes" : "no",
    dataset.requiresNetworkForFetch ? "yes" : "no",
    dataset.sourceDirectory ?? "none",
    dataset.generatedFiles.join("; "),
    dataset.validationTest,
    dataset.notes
  ]);
}

function formatToolSummaryContract(contracts, fallback) {
  const labels = (contracts ?? [])
    .map((contract) => describeWorkflowStreamChoice(contract))
    .filter(Boolean);
  const uniqueLabels = [...new Set(labels)];
  return uniqueLabels.length > 0 ? uniqueLabels.join("; ") : fallback;
}

function makeToolSummaryRows() {
  return sortedTools.map((tool) => {
    const { metadata } = tool;
    return [
      metadata.name,
      metadata.inputType,
      formatToolSummaryContract(metadata.workflow?.inputs, metadata.inputType),
      metadata.outputType,
      formatToolSummaryContract(metadata.workflow?.outputs, metadata.outputType),
      metadata.category,
      metadata.tags.join(", "),
      metadata.id,
      `#tool=${metadata.id}`,
      metadata.summary
    ];
  });
}

const referenceTopics = [
  {
    id: "tool-summary",
    label: "Tool summary",
    title: "Tool Summary",
    summary: "Registered SMS3 tools, searchable metadata, accepted inputs, produced outputs, tags, and direct-link IDs.",
    columns: ["Tool", "Input label", "Accepted inputs", "Output label", "Produced outputs", "Category", "Tags", "Tool ID", "Direct link", "Summary"],
    rows: makeToolSummaryRows(),
    notes: [
      "Input and output labels are the short user-facing tool descriptions. Accepted inputs and produced outputs are generated from the same workflow metadata used by the workflow builder.",
      "Direct-link IDs are stable enough for tutorials and teaching material.",
      "When adding tools, update metadata deliberately and keep tags within the controlled vocabulary in src/tools/tag-vocabulary.js."
    ],
    citations: []
  },
  {
    id: "iupac-nucleotide",
    label: "IUPAC nucleotide codes",
    title: "IUPAC Nucleotide Codes",
    summary: "DNA/RNA base symbols, ambiguity symbols, and complements used by sequence tools.",
    columns: ["Code", "Meaning", "Complement"],
    rows: [
      ["A", "Adenine", "T or U"],
      ["C", "Cytosine", "G"],
      ["G", "Guanine", "C"],
      ["T", "Thymine", "A"],
      ["U", "Uracil", "A"],
      ["R", "A or G", "Y"],
      ["Y", "C or T/U", "R"],
      ["S", "G or C", "S"],
      ["W", "A or T/U", "W"],
      ["K", "G or T/U", "M"],
      ["M", "A or C", "K"],
      ["B", "C, G, or T/U", "V"],
      ["D", "A, G, or T/U", "H"],
      ["H", "A, C, or T/U", "D"],
      ["V", "A, C, or G", "B"],
      ["N", "Any base", "N"],
      [". or -", "Gap", ". or -"]
    ],
    notes: [
      "SMS3 treats U as the RNA counterpart of T when complementing mixed DNA/RNA input.",
      "Gap handling is tool-specific; tools that preserve gaps should document that behavior."
    ],
    citations: [
      {
        label: "DDBJ/ENA/GenBank Feature Table Definition v11.3, nucleotide base codes",
        url: "https://www.ddbj.nig.ac.jp/ddbj/feature-table.html"
      }
    ]
  },
  {
    id: "iupac-amino-acid",
    label: "IUPAC amino acid codes",
    title: "IUPAC Amino Acid Codes",
    summary: "One-letter and three-letter symbols used for protein sequence input and output.",
    columns: ["Code", "Three-letter", "Meaning"],
    rows: [
      ["A", "Ala", "Alanine"],
      ["B", "Asx", "Aspartic acid or asparagine"],
      ["C", "Cys", "Cysteine"],
      ["D", "Asp", "Aspartic acid"],
      ["E", "Glu", "Glutamic acid"],
      ["F", "Phe", "Phenylalanine"],
      ["G", "Gly", "Glycine"],
      ["H", "His", "Histidine"],
      ["I", "Ile", "Isoleucine"],
      ["J", "Xle", "Leucine or isoleucine"],
      ["K", "Lys", "Lysine"],
      ["L", "Leu", "Leucine"],
      ["M", "Met", "Methionine"],
      ["N", "Asn", "Asparagine"],
      ["O", "Pyl", "Pyrrolysine"],
      ["P", "Pro", "Proline"],
      ["Q", "Gln", "Glutamine"],
      ["R", "Arg", "Arginine"],
      ["S", "Ser", "Serine"],
      ["T", "Thr", "Threonine"],
      ["U", "Sec", "Selenocysteine"],
      ["V", "Val", "Valine"],
      ["W", "Trp", "Tryptophan"],
      ["X", "Xaa", "Unknown or any amino acid"],
      ["Y", "Tyr", "Tyrosine"],
      ["Z", "Glx", "Glutamic acid or glutamine"],
      ["*", "Ter", "Termination"],
      [". or -", "Gap", "Gap"]
    ],
    notes: [
      "Ambiguous and uncommon residue symbols should be handled explicitly by each protein tool.",
      "Protein property tools must document how B, J, O, U, X, Z, stop, and gap symbols affect calculations."
    ],
    citations: [
      {
        label: "DDBJ/ENA/GenBank Feature Table Definition v11.3, amino acid abbreviations",
        url: "https://www.ddbj.nig.ac.jp/ddbj/feature-table.html"
      }
    ]
  },
  {
    id: "genetic-codes",
    label: "Genetic codes",
    title: "Genetic Codes",
    summary: "Inspect NCBI transl_table codon assignments, starts, stops, and differences from the standard code.",
    interactive: "genetic-codes",
    notes: [
      "Use NCBI transl_table IDs in options and structured output so results are reproducible.",
      "Start codons are context dependent: codons marked as starts may initiate translation and be represented as methionine at the beginning of a CDS or ORF, but the same codons use their normal amino-acid assignment when translated internally.",
      "Start-codon behavior is separate from internal codon translation and must be tested separately."
    ],
    citations: [
      {
        label: "NCBI Genetic Codes, last updated Sep. 23, 2024",
        url: "https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi"
      }
    ]
  },
  {
    id: "codon-usage-references",
    label: "Codon usage references",
    title: "Codon Usage References",
    summary: "Bundled codon usage references available to codon comparison and reverse-translation tools.",
    columns: [
      "Reference",
      "Organism",
      "Genetic code",
      "Sense codons",
      "Counted CDS",
      "Skipped records",
      "Access date",
      "Source",
      "Description"
    ],
    rows: makeCodonReferenceRows(),
    notes: [
      "The synthetic equal-synonymous seed is for testing and deterministic examples, not biological interpretation.",
      "Organism-specific references are generated by scripts under scripts/reference-data/ and checked in for offline browser use.",
      "Use docs/reference-data-authoring-guide.md when adding or updating bundled reference datasets."
    ],
    citations: [
      {
        label: "NCBI RefSeq record NC_000913.3",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000913.3"
      },
      {
        label: "NCBI RefSeq record NC_000964.3",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/NC_000964.3"
      },
      {
        label: "S. cerevisiae S288C RefSeq nuclear chromosomes",
        url: "https://www.ncbi.nlm.nih.gov/nuccore/?term=NC_001133+OR+NC_001134+OR+NC_001135+OR+NC_001136+OR+NC_001137+OR+NC_001138+OR+NC_001139+OR+NC_001140+OR+NC_001141+OR+NC_001142+OR+NC_001143+OR+NC_001144+OR+NC_001145+OR+NC_001146+OR+NC_001147+OR+NC_001148"
      }
    ]
  },
  {
    id: "motif-references",
    label: "Motif references",
    title: "Motif References",
    summary: "Bundled motif records available to DNA/RNA and protein motif scanner tools.",
    columns: [
      "Motif",
      "Alphabet",
      "Class",
      "Syntax",
      "Pattern",
      "Source",
      "Access date",
      "Description"
    ],
    rows: makeMotifReferenceRows(),
    notes: [
      `${motifProvenance.dataset} ${motifProvenance.version}: ${motifProvenance.description}`,
      `License note: ${motifProvenance.license}`,
      ...motifProvenance.notes,
      "The current motif set is intentionally small. It validates the scanner, UI, workflow table output, and provenance model before larger external databases are imported.",
      "PFM/PWM transcription-factor profile scanning, such as JASPAR-style searching, is planned as a separate future matrix-scanning tool."
    ],
    citations: [
      {
        label: "PROSITE",
        url: "https://prosite.expasy.org/"
      },
      {
        label: "EMBOSS patmatmotifs project documentation",
        url: "https://emboss.sourceforge.net/apps/release/6.5/emboss/apps/patmatmotifs.html"
      },
      {
        label: "JASPAR",
        url: "https://jaspar.elixir.no/"
      }
    ]
  },
  {
    id: "technical-sequence-references",
    label: "Technical sequence references",
    title: "Technical Sequence References",
    summary: "Bundled primer, adapter, and technical-sequence records available to the Technical Sequence Scanner.",
    columns: ["Sequence", "Class", "Syntax", "Pattern", "Source", "Access date", "Description"],
    rows: makeTechnicalSequenceReferenceRows(),
    notes: [
      `${technicalSequenceProvenance.dataset} ${technicalSequenceProvenance.version}: ${technicalSequenceProvenance.description}`,
      `License note: ${technicalSequenceProvenance.license}`,
      ...technicalSequenceProvenance.notes,
      "The scanner searches both DNA strands by default and can report conservative 5-prime/3-prime partial end matches.",
      "Use dedicated FASTQ trimming tools for error-tolerant adapter removal."
    ],
    citations: [
      {
        label: "Illumina adapter trimming guidance",
        url: "https://knowledge.illumina.com/library-preparation/general/library-preparation-general-reference_material-list/000001314"
      },
      {
        label: "Addgene sequencing primers",
        url: "https://www.addgene.org/mol-bio-reference/sequencing-primers/"
      },
      {
        label: "Cutadapt user guide",
        url: "https://cutadapt.readthedocs.io/en/stable/guide.html"
      },
      {
        label: "NCBI UniVec",
        url: "https://www.ncbi.nlm.nih.gov/tools/vecscreen/univec/"
      }
    ]
  },
  {
    id: "vector-contamination-references",
    label: "Vector contamination references",
    title: "Vector Contamination References",
    summary: "Bundled UniVec_Core-derived records available to the Vector Contamination Scanner.",
    columns: [
      "Dataset",
      "Source",
      "Source version",
      "Records",
      "Bases",
      "Seed length",
      "Index format",
      "Access date",
      "Build script",
      "Match model"
    ],
    rows: makeVectorContaminationReferenceRows(),
    notes: [
      `${vectorContaminationProvenance.dataset} ${vectorContaminationProvenance.version}.`,
      `Redistribution note: ${vectorContaminationProvenance.redistribution}`,
      ...vectorContaminationSummary.notes,
      ...vectorContaminationProvenance.notes,
      "The bundled files are used locally in the browser worker; SMS3 does not send user sequences to NCBI."
    ],
    citations: [
      {
        label: "NCBI UniVec_Core",
        url: "https://ftp.ncbi.nlm.nih.gov/pub/UniVec/UniVec_Core"
      },
      {
        label: "NCBI UniVec README",
        url: "https://ftp.ncbi.nlm.nih.gov/pub/UniVec/README.uv"
      },
      {
        label: "NCBI VecScreen",
        url: "https://www.ncbi.nlm.nih.gov/tools/vecscreen/"
      }
    ]
  },
  {
    id: "reference-data-builds",
    label: "Reference data builds",
    title: "Reference Data Builds",
    summary: "Bundled reference-data families, build scripts, generated files, and validation tests.",
    columns: [
      "Dataset",
      "ID",
      "Fetch script",
      "Build script",
      "Offline build",
      "Network fetch",
      "Source cache",
      "Generated files",
      "Validation test",
      "Notes"
    ],
    rows: makeReferenceDataManifestRows(),
    notes: [
      `Manifest schema version ${referenceDataManifest.schemaVersion}.`,
      "Fetch scripts are maintenance steps and may use network access. Normal browser use and normal tests consume checked-in generated app data.",
      "Run npm run reference-data:build and npm test after changing bundled reference-data files."
    ],
    citations: []
  },
  {
    id: "privacy-offline",
    label: "Privacy/offline note",
    title: "Privacy And Offline Processing",
    summary: "Current SMS3 tools run in the browser with no server-side sequence submission.",
    notes: [
      "Sequence text is processed locally in the browser by the loaded JavaScript files.",
      "Downloads are generated client-side with Blob/object URL APIs.",
      "SMS3 does not use cookies.",
      "The app stores UI preferences in localStorage: sms3-theme for light/dark mode and sms3-sidebar for navigation visibility.",
      "Tool input, workflow input, and output text are not saved to localStorage.",
      "If a future tool needs network access, its UI must say so before any sequence data is sent."
    ],
    citations: []
  },
  {
    id: "citation-guidance",
    label: "How to cite SMS",
    title: "How To Cite SMS",
    summary:
      "Please cite the original Sequence Manipulation Suite paper when SMS3 or legacy SMS tools are useful in your work.",
    interactive: "citation",
    notes: [
      "Use the DOI link when possible so citation databases can resolve the publication cleanly.",
      "Include SMS3 version or access date in methods text when that detail is useful for reproducibility."
    ],
    citations: [
      {
        label: "Publisher page",
        url: "https://doi.org/10.2144/00286ir01"
      },
      {
        label: "PubMed record",
        url: "https://pubmed.ncbi.nlm.nih.gov/10868275/"
      }
    ]
  }
];

const aminoAcidNames = new Map(
  referenceTopics
    .find((topic) => topic.id === "iupac-amino-acid")
    .rows.map(([code, threeLetter, meaning]) => [code, `${meaning} (${threeLetter})`])
);

function renderToolList() {
  const query = elements.toolSearch.value.trim().toLowerCase();
  elements.toolList.textContent = "";

  for (const tool of sortedTools) {
    const searchable = [
      tool.metadata.name,
      tool.metadata.category,
      tool.metadata.summary,
      tool.metadata.inputType,
      tool.metadata.outputType,
      ...tool.metadata.tags
    ]
      .join(" ")
      .toLowerCase();

    if (query && !searchable.includes(query)) {
      continue;
    }

    if (
      state.activeTags.size > 0 &&
      !Array.from(state.activeTags).every((tag) => tool.metadata.tags.includes(tag))
    ) {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      tool === state.selectedTool && state.activeView === "tool" ? "tool-link active" : "tool-link";
    button.textContent = tool.metadata.name;
    button.addEventListener("click", () => {
      selectTool(tool);
    });
    elements.toolList.append(button);
  }
}

function renderReferenceList() {
  elements.referenceList.textContent = "";

  for (const topic of referenceTopics) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      topic.id === state.selectedReference && state.activeView === "reference"
        ? "reference-link active"
        : "reference-link";
    button.textContent = topic.label;
    button.addEventListener("click", () => {
      selectReference(topic.id);
    });
    elements.referenceList.append(button);
  }
}

function renderActiveView() {
  elements.toolView.hidden = state.activeView !== "tool";
  elements.referenceView.hidden = state.activeView !== "reference";
  elements.feedbackView.hidden = state.activeView !== "feedback";
  elements.workflowView.hidden = state.activeView !== "workflow";
  elements.feedbackLink.classList.toggle("active", state.activeView === "feedback");
  elements.workflowLink.classList.toggle("active", state.activeView === "workflow");
}

function selectTool(tool, { updateHash = true } = {}) {
  state.selectedTool = tool;
  state.activeView = "tool";
  renderActiveView();
  renderSelectedTool();
  renderToolList();
  renderReferenceList();
  clearToolInputOutput();
  loadSelectedToolExample();

  if (updateHash) {
    setRouteHash("tool", tool.metadata.id);
  }
}

function selectReference(referenceId, { updateHash = true } = {}) {
  state.selectedReference = referenceId;
  state.activeView = "reference";
  renderActiveView();
  renderReferenceList();
  renderToolList();
  renderSelectedReference();

  if (updateHash) {
    setRouteHash("reference", referenceId);
  }
}

function selectFeedback({ updateHash = true } = {}) {
  state.activeView = "feedback";
  renderActiveView();
  renderToolList();
  renderReferenceList();
  renderFeedbackTemplates();

  if (updateHash) {
    setRouteHash("feedback", "general");
  }
}

function selectWorkflow(workflowId = state.selectedWorkflow, { updateHash = true } = {}) {
  const preset = workflowPresets.find((item) => item.id === workflowId) ?? workflowPresets[0];
  state.selectedWorkflow = preset.id;
  state.selectedWorkflowStepId = null;
  state.expandedWorkflowStepIds = new Set();
  state.activeView = "workflow";
  renderActiveView();
  renderToolList();
  renderReferenceList();
  renderWorkflowView();
  loadWorkflowExample();

  if (updateHash) {
    setRouteHash("workflow", preset.id);
  }
}

function setRouteHash(key, value) {
  const hash = `#${key}=${encodeURIComponent(value)}`;
  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
  }
}

function applyRouteFromHash() {
  const rawHash = window.location.hash.slice(1);
  if (!rawHash) {
    return false;
  }

  const params = new URLSearchParams(rawHash);
  const toolId = params.get("tool") || (rawHash.includes("=") ? "" : rawHash);
  const referenceId = params.get("reference");
  const workflowId = params.get("workflow");

  if (toolId) {
    const tool = sortedTools.find((item) => item.metadata.id === toolId);
    if (tool) {
      selectTool(tool, { updateHash: false });
      return true;
    }
  }

  if (referenceId && referenceTopics.some((topic) => topic.id === referenceId)) {
    selectReference(referenceId, { updateHash: false });
    return true;
  }

  if (params.has("feedback")) {
    selectFeedback({ updateHash: false });
    return true;
  }

  if (workflowId || params.has("workflow")) {
    selectWorkflow(workflowId || state.selectedWorkflow, { updateHash: false });
    return true;
  }

  return false;
}

function renderSelectedTool() {
  const { metadata } = state.selectedTool;
  elements.toolCategory.textContent = metadata.category;
  elements.toolTitle.textContent = metadata.name;
  elements.toolSummary.textContent = metadata.summary;
  elements.toolTags.textContent = "";
  updateInputFileUi(state.selectedTool);
  renderToolOptions(metadata.options ?? []);

  for (const tag of metadata.tags) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = state.activeTags.has(tag) ? "tag-chip active" : "tag-chip";
    item.setAttribute("aria-pressed", String(state.activeTags.has(tag)));
    item.textContent = tag;
    item.addEventListener("click", () => {
      if (state.activeTags.has(tag)) {
        state.activeTags.delete(tag);
      } else {
        state.activeTags.add(tag);
      }
      renderSelectedTool();
      renderToolList();
    });
    elements.toolTags.append(item);
  }
  updateInputActionButtons();
}

function getToolInputFileUi(tool) {
  const metadata = tool?.metadata ?? {};
  const workflowInputs = metadata.workflow?.inputs ?? [];
  const inputTypeLabel = String(metadata.inputType ?? "").trim();
  const inputType = inputTypeLabel.toLowerCase();
  const category = (metadata.category ?? "").toLowerCase();
  const tags = (metadata.tags ?? []).map((tag) => String(tag).toLowerCase());
  const sequenceInput = workflowInputs.find((input) => input.kind === "sequence-records");
  const hasSequenceInput = Boolean(sequenceInput) || inputType.includes("sequence");
  const hasTableInput =
    workflowInputs.some((input) => input.kind === "table") ||
    category.includes("table") ||
    tags.some((tag) => ["table", "csv", "tsv"].includes(tag));

  if (hasTableInput && !hasSequenceInput) {
    return {
      dropLabel: "Drop a CSV, TSV, or text table here",
      accept: ".csv,.tsv,.tab,.txt"
    };
  }

  if (inputType.includes("protein sequence")) {
    return {
      dropLabel: `Drop a ${formatInputTypeForDropLabel(inputTypeLabel)} file here`,
      accept: ".fa,.fasta,.faa,.txt,.seq"
    };
  }

  if (inputType.includes("dna") || inputType.includes("rna")) {
    return {
      dropLabel: inputType.includes("sequence")
        ? `Drop a ${formatInputTypeForDropLabel(inputTypeLabel)} file here`
        : "Drop a DNA/RNA sequence file here",
      accept: ".fa,.fasta,.fna,.ffn,.txt,.gb,.gbk,.genbank,.embl,.seq"
    };
  }

  const alphabet = sequenceInput?.alphabet ?? inputType;
  if (hasSequenceInput && String(alphabet).includes("protein")) {
    return {
      dropLabel: "Drop a protein sequence file here",
      accept: ".fa,.fasta,.faa,.txt,.seq"
    };
  }

  if (
    hasSequenceInput &&
    (String(alphabet).includes("dna") ||
      String(alphabet).includes("rna") ||
      inputType.includes("dna") ||
      inputType.includes("rna"))
  ) {
    return {
      dropLabel: "Drop a DNA/RNA sequence file here",
      accept: ".fa,.fasta,.fna,.ffn,.txt,.gb,.gbk,.genbank,.embl,.seq"
    };
  }

  if (hasSequenceInput) {
    return {
      dropLabel: "Drop a sequence file here",
      accept: ".fa,.fasta,.txt,.seq"
    };
  }

  return {
    dropLabel: "Drop a text file here",
    accept: ".txt,.csv,.tsv,.tab,.fa,.fasta,.seq"
  };
}

function formatInputTypeForDropLabel(inputTypeLabel) {
  if (/^(DNA|RNA|CSV|TSV|FASTA)\b/.test(inputTypeLabel)) {
    return inputTypeLabel;
  }
  return `${inputTypeLabel.slice(0, 1).toLowerCase()}${inputTypeLabel.slice(1)}`;
}

function updateInputFileUi(tool) {
  const inputUi = getToolInputFileUi(tool);
  elements.dropZoneLabel.textContent = inputUi.dropLabel;
  elements.fileInput.setAttribute("accept", inputUi.accept);
}

function renderToolOptions(options) {
  const visibleOptions = options.filter(shouldRenderToolOption);
  if (visibleOptions.length === 0) {
    elements.toolOptions.textContent = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  const defaultValues = getDefaultOptionValues(options);

  for (const option of visibleOptions) {
    appendToolOptionControl(fragment, option, defaultValues);
  }

  elements.toolOptions.replaceChildren(fragment);
  wireDependentToolOptions(options);
}

function shouldRenderToolOption(option) {
  if (option.id === "outputFormat") {
    return false;
  }
  if (option.type === "group") {
    return (option.options ?? []).some(shouldRenderToolOption);
  }
  return true;
}

function appendToolOptionControl(parent, option, defaultValues) {
  if (option.type === "group") {
    const group = document.createElement("section");
    group.className = "option-group";
    const heading = document.createElement("h4");
    heading.append(createOptionLabelContent(option));
    group.append(heading);
    for (const child of option.options ?? []) {
      if (shouldRenderToolOption(child)) {
        appendToolOptionControl(group, child, defaultValues);
      }
    }
    parent.append(group);
    return;
  }

  if (option.type === "select" || (option.type === "radio" && (option.choices ?? []).length > 3)) {
    const label = document.createElement("label");
    label.className = "select-row";
    label.append(createOptionLabelContent(option));
    const select = document.createElement("select");
    select.id = option.id;
    select.name = option.id;
    populateDependentSelect(select, option, defaultValues, option.defaultValue);
    select.value = option.defaultValue;
    label.append(select);
    parent.append(label);
    return;
  }

  if (option.type === "radio") {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.append(createOptionLabelContent(option));
    fieldset.append(legend);

    for (const choice of option.choices) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = option.id;
      input.value = choice.value;
      input.checked = choice.value === option.defaultValue;
      label.append(input, ` ${choice.label}`);
      fieldset.append(label);
    }

    parent.append(fieldset);
    return;
  }

  if (option.type === "checkbox") {
    const label = document.createElement("label");
    label.className = "checkbox-row";
    const input = document.createElement("input");
    input.id = option.id;
    input.type = "checkbox";
    input.checked = option.defaultValue === true;
    label.append(input, createOptionLabelContent(option));
    parent.append(label);
    return;
  }

  if (option.type === "number") {
    const label = document.createElement("label");
    label.className = "number-row";
    label.append(createOptionLabelContent(option));
    const input = document.createElement("input");
    input.id = option.id;
    input.type = "number";
    input.min = option.min;
    input.max = option.max;
    input.value = option.defaultValue;
    label.append(input);
    parent.append(label);
    return;
  }

  if (option.type === "text") {
    const label = document.createElement("label");
    label.className = "text-row";
    label.append(createOptionLabelContent(option));
    const input = document.createElement("input");
    input.id = option.id;
    input.type = "text";
    input.value = option.defaultValue ?? "";
    label.append(input);
    parent.append(label);
    return;
  }

  if (option.type === "note") {
    const note = document.createElement("p");
    note.className = "option-note";
    note.textContent = option.text;
    parent.append(note);
  }
}

function createOptionLabelContent(option) {
  const label = document.createElement("span");
  label.className = "option-label";
  label.append(String(option.label ?? ""));
  const helpText = String(option.help ?? "").trim();
  if (!helpText) {
    return label;
  }

  const help = document.createElement("span");
  help.className = "option-help";
  help.tabIndex = 0;
  help.setAttribute("role", "button");
  help.setAttribute("aria-label", "Show option help");
  help.textContent = "?";

  const popover = document.createElement("span");
  popover.className = "option-help-popover";
  popover.setAttribute("aria-hidden", "true");
  popover.textContent = helpText;
  const positionPopover = () => positionOptionHelpPopover(help, popover);
  help.addEventListener("mouseenter", positionPopover);
  help.addEventListener("focus", positionPopover);
  help.addEventListener("click", positionPopover);
  label.append(" ", help, popover);
  return label;
}

function positionOptionHelpPopover(help, popover) {
  const margin = 12;
  const maxWidth = Math.min(384, Math.max(160, window.innerWidth - margin * 2));
  popover.style.width = `${maxWidth}px`;
  popover.style.maxWidth = `${maxWidth}px`;

  const helpRect = help.getBoundingClientRect();
  const popoverRect = popover.getBoundingClientRect();
  const width = Math.min(popoverRect.width || maxWidth, maxWidth);
  const height = popoverRect.height || 80;
  const preferredLeft = helpRect.left;
  const preferredTop = helpRect.bottom + 8;
  const left = Math.min(
    Math.max(margin, preferredLeft),
    Math.max(margin, window.innerWidth - width - margin)
  );
  let top = preferredTop;
  if (top + height > window.innerHeight - margin) {
    top = helpRect.top - height - 8;
  }
  top = Math.min(
    Math.max(margin, top),
    Math.max(margin, window.innerHeight - height - margin)
  );

  popover.style.setProperty("--option-help-left", `${left}px`);
  popover.style.setProperty("--option-help-top", `${top}px`);
}

function flattenOptions(options = []) {
  return options.flatMap((option) => option.type === "group" ? flattenOptions(option.options ?? []) : [option]);
}

function getDefaultOptionValues(options) {
  return Object.fromEntries(
    flattenOptions(options)
      .filter((option) => option.id)
      .map((option) => [option.id, option.defaultValue])
  );
}

function getOptionControlValue(root, option, fallback = option.defaultValue) {
  if (option.type === "checkbox") {
    return root.querySelector(`#${option.id}, [name="${option.id}"]`)?.checked ?? fallback;
  }
  return (
    root.querySelector(`select[name="${option.id}"]`)?.value ??
    root.querySelector(`input[name="${option.id}"]:checked`)?.value ??
    root.querySelector(`[name="${option.id}"]`)?.value ??
    fallback
  );
}

function getCurrentOptionValues(root, options) {
  return Object.fromEntries(
    flattenOptions(options)
      .filter((option) => option.id)
      .map((option) => [option.id, getOptionControlValue(root, option)])
  );
}

function getFilteredChoices(option, optionValues) {
  const choices = option.choices ?? [];
  if (!option.dependsOn) {
    return choices;
  }
  const parentValue = optionValues[option.dependsOn];
  if (!parentValue || parentValue === "all") {
    return choices;
  }
  return choices.filter((choice) => choice.value === option.defaultValue || choice.dependsOnValue === parentValue);
}

function populateDependentSelect(select, option, optionValues, preferredValue) {
  const choices = getFilteredChoices(option, optionValues);
  select.textContent = "";
  for (const choice of choices) {
    const choiceOption = document.createElement("option");
    choiceOption.value = choice.value;
    choiceOption.textContent = choice.label;
    select.append(choiceOption);
  }
  select.value = choices.some((choice) => choice.value === preferredValue) ? preferredValue : option.defaultValue;
}

function normalizeDependentOptionValues(options, optionValues) {
  const normalized = { ...optionValues };
  for (const option of options) {
    if (!option.dependsOn) {
      continue;
    }
    const choices = getFilteredChoices(option, normalized);
    if (!choices.some((choice) => choice.value === normalized[option.id])) {
      normalized[option.id] = option.defaultValue;
    }
  }
  return normalized;
}

function wireDependentToolOptions(options) {
  const flatOptions = flattenOptions(options);
  const dependentOptions = flatOptions.filter((option) => option.dependsOn);
  if (dependentOptions.length === 0) {
    return;
  }

  function refreshDependents() {
    const optionValues = getCurrentOptionValues(elements.toolOptions, flatOptions);
    for (const option of dependentOptions) {
      const select = elements.toolOptions.querySelector(`select[name="${option.id}"]`);
      if (!select) {
        continue;
      }
      populateDependentSelect(select, option, optionValues, select.value);
      optionValues[option.id] = select.value;
    }
  }

  for (const option of flatOptions) {
    if (dependentOptions.some((dependent) => dependent.dependsOn === option.id)) {
      elements.toolOptions
        .querySelectorAll(`select[name="${option.id}"], input[name="${option.id}"]`)
        .forEach((control) => control.addEventListener("change", refreshDependents));
    }
  }
  refreshDependents();
}

function restoreCurrentToolDefaults() {
  state.outputFormatByTool.delete(state.selectedTool.metadata.id);
  renderToolOptions(state.selectedTool.metadata.options ?? []);
  clearToolOutput();
}

function appendReferenceTable(topic, parent = elements.selectedReferenceBody) {
  const wrapper = document.createElement("div");
  wrapper.className = "reference-table-wrap";
  const table = document.createElement("table");
  table.className = "reference-table";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const column of topic.columns) {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  }
  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of topic.rows) {
    const tr = document.createElement("tr");
    for (const cell of row) {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  wrapper.append(table);
  parent.append(wrapper);
}

function appendGeneticCodeViewer(topic) {
  const selectedCode = geneticCodes.find((code) => code.id === state.selectedGeneticCode) ?? geneticCodes[0];
  const standardCode = geneticCodes[0];
  const selectedCodons = getCodonsForCode(selectedCode);
  const standardCodons = getCodonsForCode(standardCode);

  const controls = document.createElement("div");
  controls.className = "reference-controls";

  const label = document.createElement("label");
  label.className = "select-row";
  label.textContent = "NCBI genetic code";

  const select = document.createElement("select");
  for (const code of geneticCodes) {
    const option = document.createElement("option");
    option.value = code.id;
    option.textContent = `${code.id}. ${code.name}`;
    select.append(option);
  }
  select.value = selectedCode.id;
  select.addEventListener("change", () => {
    state.selectedGeneticCode = select.value;
    state.selectedGeneticCodeAminoAcid = "all";
    state.selectedGeneticCodeCodon = "all";
    renderSelectedReference();
  });
  label.append(select);
  controls.append(label);

  const aminoAcidLabel = document.createElement("label");
  aminoAcidLabel.className = "select-row";
  aminoAcidLabel.textContent = "Highlight amino acid";

  const aminoAcidSelect = document.createElement("select");
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All codons";
  aminoAcidSelect.append(allOption);

  for (const aa of getAminoAcidHighlightOptions(selectedCodons)) {
    const option = document.createElement("option");
    option.value = aa;
    option.textContent = `${aa} - ${aminoAcidNames.get(aa) ?? "Termination"}`;
    aminoAcidSelect.append(option);
  }

  aminoAcidSelect.value = state.selectedGeneticCodeAminoAcid;
  aminoAcidSelect.addEventListener("change", () => {
    state.selectedGeneticCodeAminoAcid = aminoAcidSelect.value;
    renderSelectedReference();
  });
  aminoAcidLabel.append(aminoAcidSelect);
  controls.append(aminoAcidLabel);

  const codonLabel = document.createElement("label");
  codonLabel.className = "select-row";
  codonLabel.textContent = "Highlight codon";

  const codonSelect = document.createElement("select");
  const allCodonOption = document.createElement("option");
  allCodonOption.value = "all";
  allCodonOption.textContent = "All codons";
  codonSelect.append(allCodonOption);

  for (const codon of selectedCodons.map((item) => item.codon).sort()) {
    const option = document.createElement("option");
    option.value = codon;
    option.textContent = codon;
    codonSelect.append(option);
  }

  codonSelect.value = state.selectedGeneticCodeCodon;
  codonSelect.addEventListener("change", () => {
    state.selectedGeneticCodeCodon = codonSelect.value;
    renderSelectedReference();
  });
  codonLabel.append(codonSelect);
  controls.append(codonLabel);
  elements.selectedReferenceBody.append(controls);

  const stats = document.createElement("div");
  stats.className = "reference-stats";
  stats.append(makeStat("Stops", selectedCodons.filter((item) => item.isStop).map((item) => item.codon).join(", ")));
  stats.append(makeStat("Starts", selectedCodons.filter((item) => item.isStart).map((item) => item.codon).join(", ")));
  elements.selectedReferenceBody.append(stats);

  const grid = document.createElement("div");
  grid.className = "codon-grid";
  for (const item of selectedCodons) {
    grid.append(makeCodonEntry(item, state.selectedGeneticCodeAminoAcid, state.selectedGeneticCodeCodon));
  }
  elements.selectedReferenceBody.append(grid);

  const differences = selectedCodons
    .map((item, index) => ({ item, standard: standardCodons[index] }))
    .filter(({ item, standard }) => item.aa !== standard.aa || item.isStart !== standard.isStart);

  const differenceSection = document.createElement("section");
  differenceSection.className = "reference-subsection";
  const heading = document.createElement("h3");
  heading.textContent = "Differences From Standard Code";
  differenceSection.append(heading);

  if (differences.length === 0) {
    const none = document.createElement("p");
    none.className = "summary";
    none.textContent = "No codon assignment or start-codon differences.";
    differenceSection.append(none);
  } else {
    const differenceTopic = {
      columns: ["Codon", `${selectedCode.id}. ${selectedCode.name}`, "Standard"],
      rows: differences.map(({ item, standard }) => [
        item.codon,
        formatCodonDifference(item),
        formatCodonDifference(standard)
      ])
    };
    appendReferenceTable(differenceTopic, differenceSection);
  }
  elements.selectedReferenceBody.append(differenceSection);

  appendTopicNotesAndCitations(topic);
}

function appendCitationGuidance(topic) {
  const citationText =
    "Stothard P. The sequence manipulation suite: JavaScript programs for analyzing and formatting protein and DNA sequences. BioTechniques. 2000 Jun;28(6):1102-1104. doi: 10.2144/00286ir01. PMID: 10868275.";
  const bibtex = `@article{Stothard2000SequenceManipulationSuite,
  author = {Stothard, Paul},
  title = {The Sequence Manipulation Suite: JavaScript Programs for Analyzing and Formatting Protein and DNA Sequences},
  journal = {BioTechniques},
  year = {2000},
  volume = {28},
  number = {6},
  pages = {1102--1104},
  doi = {10.2144/00286ir01},
  pmid = {10868275}
}`;

  const citation = document.createElement("section");
  citation.className = "citation-card";

  const heading = document.createElement("h3");
  heading.textContent = "Recommended Citation";
  citation.append(heading);

  const text = document.createElement("p");
  text.textContent = citationText;
  citation.append(text);

  const links = document.createElement("div");
  links.className = "citation-links";

  const doi = document.createElement("a");
  doi.href = "https://doi.org/10.2144/00286ir01";
  doi.target = "_blank";
  doi.rel = "noreferrer";
  doi.textContent = "DOI: 10.2144/00286ir01";
  links.append(doi);

  const pubmed = document.createElement("a");
  pubmed.href = "https://pubmed.ncbi.nlm.nih.gov/10868275/";
  pubmed.target = "_blank";
  pubmed.rel = "noreferrer";
  pubmed.textContent = "PMID: 10868275";
  links.append(pubmed);

  citation.append(links);
  elements.selectedReferenceBody.append(citation);

  const bibtexLabel = document.createElement("label");
  bibtexLabel.className = "citation-bibtex";
  bibtexLabel.append("BibTeX");
  const bibtexOutput = document.createElement("textarea");
  bibtexOutput.readOnly = true;
  bibtexOutput.spellcheck = false;
  bibtexOutput.value = bibtex;
  bibtexLabel.append(bibtexOutput);
  elements.selectedReferenceBody.append(bibtexLabel);

  appendTopicNotesAndCitations(topic);
}

function makeMailtoLink(template) {
  const body = `${template.body}

SMS3 version: ${elements.appVersion.textContent || "unknown"}
Current page: ${window.location.href}
`;
  return `mailto:paul.stothard@gmail.com?subject=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(body)}`;
}

function renderFeedbackTemplates() {
  elements.feedbackTemplates.textContent = "";

  for (const template of feedbackTemplates) {
    const link = document.createElement("a");
    link.className = "feedback-template";
    link.href = makeMailtoLink(template);

    const title = document.createElement("strong");
    title.textContent = template.title;

    const summary = document.createElement("span");
    summary.textContent = template.summary;

    link.append(title, summary);
    elements.feedbackTemplates.append(link);
  }
}

async function loadAppVersion() {
  const versionUrls = ["./src/app-version.json", "./package.json"];
  try {
    for (const url of versionUrls) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const versionData = await response.json();
      if (versionData.version) {
        elements.appVersion.textContent = `v${versionData.version}`;
        return;
      }
    }
  } catch {
    elements.appVersion.textContent = "";
  }
}

function getAminoAcidHighlightOptions(codons) {
  const present = new Set(codons.map((item) => item.aa));
  const ordered = "ACDEFGHIKLMNPQRSTVWYBJOUXZ".split("").filter((aa) => present.has(aa));
  if (present.has("*")) {
    ordered.push("*");
  }
  return ordered;
}

function makeCodonEntry(item, selectedAminoAcid = "all", selectedCodon = "all") {
  const entry = document.createElement("div");
  const classes = ["codon-cell"];
  const isSelectedCodon = selectedCodon !== "all" && item.codon === selectedCodon;
  if (item.isStop) {
    classes.push("stop");
  } else if (item.isStart) {
    classes.push("start");
  }
  if (isSelectedCodon) {
    classes.push("highlight", "codon-highlight");
  } else if (selectedCodon !== "all") {
    classes.push("dimmed");
  } else if (selectedAminoAcid !== "all") {
    classes.push(item.aa === selectedAminoAcid ? "highlight" : "dimmed");
  }
  entry.className = classes.join(" ");
  entry.title = `${item.codon}: ${aminoAcidNames.get(item.aa) ?? "Termination"}`;

  const codon = document.createElement("span");
  codon.className = "codon-triplet";
  codon.textContent = item.codon;

  const aa = document.createElement("span");
  aa.className = "codon-aa";
  aa.textContent = item.aa;

  entry.append(codon, aa);

  if (item.isStart || item.isStop) {
    const marker = document.createElement("span");
    marker.className = "codon-marker";
    marker.textContent = item.isStop ? "Stop" : "Start";
    entry.append(marker);
  }

  return entry;
}

function makeStat(label, value) {
  const item = document.createElement("div");
  item.className = "reference-stat";
  const title = document.createElement("span");
  title.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value || "None";
  item.append(title, detail);
  return item;
}

function formatCodonDifference(item) {
  const labels = [item.aa];
  if (item.isStart) {
    labels.push("start");
  }
  if (item.isStop) {
    labels.push("stop");
  }
  return labels.join(", ");
}

function appendTopicNotesAndCitations(topic) {
  if (topic.notes.length > 0) {
    const list = document.createElement("ul");
    list.className = "reference-notes";
    for (const note of topic.notes) {
      const item = document.createElement("li");
      item.textContent = note;
      list.append(item);
    }
    elements.selectedReferenceBody.append(list);
  }

  if (topic.citations.length > 0) {
    const citations = document.createElement("p");
    citations.className = "reference-citations";
    citations.append("Sources: ");
    topic.citations.forEach((citation, index) => {
      if (index > 0) {
        citations.append("; ");
      }
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = citation.label;
      citations.append(link);
    });
    elements.selectedReferenceBody.append(citations);
  }
}

function renderSelectedReference() {
  const topic =
    referenceTopics.find((item) => item.id === state.selectedReference) ?? referenceTopics[0];
  elements.selectedReferenceTitle.textContent = topic.title;
  elements.selectedReferenceBody.textContent = "";

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = topic.summary;
  elements.selectedReferenceBody.append(summary);

  if (topic.interactive === "genetic-codes") {
    appendGeneticCodeViewer(topic);
    return;
  }

  if (topic.interactive === "citation") {
    appendCitationGuidance(topic);
    return;
  }

  if (topic.rows) {
    appendReferenceTable(topic);
  }

  appendTopicNotesAndCitations(topic);
}

function getOptions() {
  const values = {};
  const optionRoot = elements.toolOptions;

  for (const option of flattenOptions(state.selectedTool.metadata.options ?? [])) {
    if (option.type === "radio" || option.type === "select") {
      values[option.id] =
        optionRoot.querySelector(`select[name="${option.id}"]`)?.value ??
        optionRoot.querySelector(`input[name="${option.id}"]:checked`)?.value ??
        option.defaultValue;
    } else if (option.type === "checkbox") {
      values[option.id] = optionRoot.querySelector(`#${option.id}`)?.checked ?? option.defaultValue;
    } else if (option.type === "number") {
      values[option.id] =
        Number.parseInt(optionRoot.querySelector(`#${option.id}`)?.value, 10) ||
        option.defaultValue;
    } else if (option.type === "text") {
      values[option.id] = optionRoot.querySelector(`#${option.id}`)?.value ?? option.defaultValue ?? "";
    }
  }

  const outputFormatOption = getOutputFormatOption(state.selectedTool);
  if (outputFormatOption) {
    values.outputFormat = getSelectedToolOutputFormat(state.selectedTool);
  }

  return values;
}

function renderMessages(result) {
  elements.messages.textContent = "";

  const summary = document.createElement("div");
  summary.className = "message info";
  summary.textContent = `${pluralize(result.recordsProcessed, "record")}, ${pluralize(result.basesProcessed, "base")}, ${pluralize(result.charactersRemoved, "character")} removed.`;
  elements.messages.append(summary);

  appendOutputDetails(elements.messages, getToolOutputDetails(result));
  appendWarningSummary(elements.messages, result.warnings);
}

function appendWarningSummary(parent, warnings, formatter = (warning) => warning) {
  if (!warnings?.length) {
    return;
  }

  const details = document.createElement("details");
  details.className = "message warning warning-summary";

  const summary = document.createElement("summary");
  summary.textContent = pluralize(warnings.length, "warning");
  details.append(summary);

  const list = document.createElement("ul");
  for (const warning of warnings) {
    const item = document.createElement("li");
    item.textContent = formatter(warning);
    list.append(item);
  }
  details.append(list);
  parent.append(details);
}

function describeStructuredOutput(id, stream) {
  if (!stream) {
    return id;
  }
  if (stream.kind === "table") {
    return `${id}: table with ${pluralize(stream.rows?.length ?? 0, "row")} and ${pluralize(stream.columns?.length ?? 0, "column")}`;
  }
  if (stream.kind === "sequence-records") {
    return `${id}: ${stream.alphabet === "protein" ? "protein" : "DNA/RNA"} sequences (${pluralize(stream.records?.length ?? 0, "record")})`;
  }
  if (stream.kind === "warnings") {
    return `${id}: ${pluralize(stream.warnings?.length ?? 0, "warning")}`;
  }
  if (stream.kind === "text") {
    return `${id}: ${describeStream(stream)}`;
  }
  if (stream.kind === "collection") {
    return `${id}: set with ${pluralize(stream.items?.length ?? 0, "item")}`;
  }
  if (stream.records) {
    return `${id}: ${describeStream(stream)} (${pluralize(stream.records.length, "record")})`;
  }
  return `${id}: ${describeStream(stream)}`;
}

function appendOutputDetails(parent, detailsRows) {
  const rows = detailsRows.filter(Boolean);
  if (rows.length === 0) {
    return;
  }

  const details = document.createElement("details");
  details.className = "message output-details";
  const summary = document.createElement("summary");
  summary.textContent = "Output details";
  details.append(summary);

  const list = document.createElement("dl");
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    list.append(term, description);
  }
  details.append(list);
  parent.append(details);
}

function getToolOutputDetails(result) {
  const structuredOutputs = Object.entries(result.streams ?? {})
    .filter(([id]) => id !== "primary")
    .map(([id, stream]) => describeStructuredOutput(id, stream))
    .join("; ");

  return [
    ["Processed", `${pluralize(result.recordsProcessed, "record")}, ${pluralize(result.basesProcessed, "base")}`],
    result.charactersRemoved > 0
      ? ["Cleaned", `${pluralize(result.charactersRemoved, "character")} removed`]
      : null,
    ["Copy/download", `${result.download?.filename ?? "sms3-output.txt"} (${result.download?.mimeType ?? "text/plain"})`],
    structuredOutputs ? ["Structured data", structuredOutputs] : null,
    result.visual?.svg ? ["Visual output", "SVG preview"] : null
  ];
}

function getWorkflowOutputDetails(result, formatted) {
  return [
    ["Workflow run", pluralize(result.steps?.length ?? 0, "step")],
    ["Current output", formatted.summary],
    ["Copy/download", `${formatted.filename ?? "sms3-workflow-output.txt"} (${formatted.mimeType ?? "text/plain"})`],
    formatted.tableStream
      ? ["Structured data", describeStructuredOutput("table", formatted.tableStream)]
      : null
  ];
}

function getOutputSearchParts(scope) {
  return scope === "workflow"
    ? {
        textarea: elements.workflowOutput,
        preview: elements.workflowOutputHighlight,
        input: elements.workflowOutputSearch,
        previous: elements.workflowOutputSearchPrevious,
        next: elements.workflowOutputSearchNext,
        count: elements.workflowOutputSearchCount,
        table: elements.workflowTableOutput
      }
    : {
        textarea: elements.toolOutput,
        preview: elements.toolOutputHighlight,
        input: elements.outputSearch,
        previous: elements.outputSearchPrevious,
        next: elements.outputSearchNext,
        count: elements.outputSearchCount,
        table: elements.toolTableOutput
      };
}

function getOutputViewParts(scope) {
  return scope === "workflow"
    ? {
        tabs: elements.workflowOutputViewTabs,
        note: elements.workflowOutputViewNote,
        actions: elements.workflowOutputActions,
        copyButton: elements.workflowCopyOutput,
        downloadButton: elements.workflowDownloadOutput,
        textarea: elements.workflowOutput,
        preview: elements.workflowOutputHighlight,
        table: elements.workflowTableOutput
      }
    : {
        tabs: elements.outputViewTabs,
        actions: elements.toolOutputActions,
        copyButton: elements.copyOutput,
        downloadButton: elements.downloadOutput,
        textarea: elements.toolOutput,
        preview: elements.toolOutputHighlight,
        table: elements.toolTableOutput
      };
}

function getOutputActionKind(mimeType = "", label = "") {
  const normalized = `${mimeType} ${label}`.toLowerCase();
  if (normalized.includes("svg")) {
    return "SVG";
  }
  if (normalized.includes("fasta")) {
    return "FASTA";
  }
  if (normalized.includes("csv")) {
    return "CSV";
  }
  if (normalized.includes("tsv") || normalized.includes("tab-separated")) {
    return "TSV";
  }
  if (normalized.includes("json")) {
    return "JSON";
  }
  if (normalized.includes("report")) {
    return "report";
  }
  return "text";
}

function updateOutputActions(scope, { hidden = false, mimeType = "", label = "" } = {}) {
  const parts = getOutputViewParts(scope);
  parts.actions.hidden = hidden;
  if (hidden) {
    return;
  }
  const kind = getOutputActionKind(mimeType, label);
  parts.downloadButton.textContent = `Download ${kind}`;
  parts.copyButton.textContent = `Copy ${kind}`;
}

function appendOutputText(parent, text) {
  if (text) {
    parent.append(document.createTextNode(text));
  }
}

function renderOutputHighlight(scope) {
  const search = state.outputSearch[scope];
  const parts = getOutputSearchParts(scope);
  const text = parts.textarea.value;
  const query = parts.input.value;
  parts.preview.textContent = "";

  if (!query || search.matches.length === 0 || text.length > OUTPUT_HIGHLIGHT_LIMIT) {
    parts.preview.hidden = true;
    parts.textarea.style.visibility = "";
    return;
  }

  let cursor = 0;
  search.matches.forEach((match, index) => {
    appendOutputText(parts.preview, text.slice(cursor, match.start));
    const mark = document.createElement("mark");
    mark.className = index === search.currentIndex ? "current-output-match" : "";
    mark.textContent = text.slice(match.start, match.end);
    parts.preview.append(mark);
    cursor = match.end;
  });
  appendOutputText(parts.preview, text.slice(cursor));
  parts.preview.hidden = false;
  parts.textarea.style.visibility = "hidden";
}

function findLiteralMatches(text, query) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const matches = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    matches.push({ start: index, end: index + needle.length });
    index = haystack.indexOf(needle, index + Math.max(needle.length, 1));
  }
  return matches;
}

function normalizeSequenceSearchText(text) {
  const normalized = [];
  const sourceIndexes = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (/[A-Za-z*]/.test(character)) {
      normalized.push(character.toLowerCase());
      sourceIndexes.push(index);
    }
  }
  return { text: normalized.join(""), sourceIndexes };
}

function findSequenceLikeMatches(text, query) {
  if (!/^[A-Za-z*\s]+$/.test(query)) {
    return [];
  }
  const normalizedQuery = normalizeSequenceSearchText(query).text;
  if (normalizedQuery.length < 3) {
    return [];
  }
  const normalizedText = normalizeSequenceSearchText(text);
  const matches = [];
  let index = normalizedText.text.indexOf(normalizedQuery);
  while (index !== -1) {
    matches.push({
      start: normalizedText.sourceIndexes[index],
      end: normalizedText.sourceIndexes[index + normalizedQuery.length - 1] + 1
    });
    index = normalizedText.text.indexOf(normalizedQuery, index + Math.max(normalizedQuery.length, 1));
  }
  return matches;
}

function findOutputTextMatches(text, query) {
  const literalMatches = findLiteralMatches(text, query);
  return literalMatches.length > 0 ? literalMatches : findSequenceLikeMatches(text, query);
}

function selectOutputMatch(scope) {
  if (isTableViewActive(scope)) {
    selectTableOutputMatch(scope);
    return;
  }
  const search = state.outputSearch[scope];
  const parts = getOutputSearchParts(scope);
  if (search.currentIndex < 0 || search.matches.length === 0) {
    return;
  }
  if (!parts.preview.hidden) {
    const mark = parts.preview.querySelector(".current-output-match");
    if (mark) {
      const verticalTarget = mark.offsetTop - parts.preview.clientHeight / 2 + mark.offsetHeight / 2;
      const horizontalTarget = mark.offsetLeft - parts.preview.clientWidth / 2 + mark.offsetWidth / 2;
      parts.preview.scrollTop = Math.max(0, verticalTarget);
      parts.preview.scrollLeft = Math.max(0, horizontalTarget);
    }
    return;
  }
  const match = search.matches[search.currentIndex];
  parts.textarea.focus({ preventScroll: true });
  parts.textarea.setSelectionRange(match.start, match.end);
}

function renderOutputSearch(scope) {
  if (isTableViewActive(scope)) {
    renderTableOutputSearch(scope);
    return;
  }
  const search = state.outputSearch[scope];
  const parts = getOutputSearchParts(scope);
  if (parts.textarea.dataset.visualOutput === "true") {
    search.matches = [];
    search.currentIndex = -1;
    parts.count.textContent = "No search";
    parts.previous.disabled = true;
    parts.next.disabled = true;
    parts.preview.hidden = true;
    parts.preview.textContent = "";
    return;
  }
  const query = parts.input.value;
  if (!query) {
    search.matches = [];
    search.currentIndex = -1;
    parts.count.textContent = "No search";
    parts.previous.disabled = true;
    parts.next.disabled = true;
    renderOutputHighlight(scope);
    return;
  }

  search.matches = findOutputTextMatches(parts.textarea.value, query);
  search.currentIndex = search.matches.length > 0 ? 0 : -1;
  parts.count.textContent =
    search.matches.length > 0 ? `1 of ${search.matches.length}` : "No matches";
  parts.previous.disabled = search.matches.length < 2;
  parts.next.disabled = search.matches.length < 2;
  renderOutputHighlight(scope);
  selectOutputMatch(scope);
}

function queueOutputSearch(scope) {
  window.clearTimeout(state.outputSearch[scope].debounceTimer);
  state.outputSearch[scope].debounceTimer = window.setTimeout(() => renderOutputSearch(scope), 180);
}

function moveOutputSearch(scope, direction) {
  const search = state.outputSearch[scope];
  if (search.matches.length === 0) {
    return;
  }
  search.currentIndex = (search.currentIndex + direction + search.matches.length) % search.matches.length;
  const parts = getOutputSearchParts(scope);
  parts.count.textContent = `${search.currentIndex + 1} of ${search.matches.length}`;
  if (isTableViewActive(scope)) {
    selectTableOutputMatch(scope);
    return;
  }
  renderOutputHighlight(scope);
  selectOutputMatch(scope);
}

function clearToolInputOutput() {
  elements.sequenceInput.value = "";
  elements.toolOutput.value = "";
  elements.toolOutput.dataset.rawOutput = "";
  elements.toolOutput.dataset.tableTsv = "";
  elements.toolOutput.dataset.visualOutput = "false";
  elements.toolOutputHighlight.hidden = true;
  elements.toolOutputHighlight.textContent = "";
  elements.toolOutput.hidden = false;
  clearToolTableOutput();
  elements.toolOutput.dataset.filename = "sms3-output.txt";
  elements.toolOutput.dataset.mimeType = "text/plain";
  elements.visualOutput.hidden = true;
  elements.visualOutput.textContent = "";
  elements.messages.textContent = "";
  state.currentToolOutputChoices = [];
  elements.outputFormatSelect.textContent = "";
  elements.outputViewTabs.hidden = true;
  elements.toolOutputActions.hidden = true;
  setOutputFormatLabel("tool", null);
  renderOutputSearch("tool");
  updateInputActionButtons();
}

function clearToolOutput() {
  elements.toolOutput.value = "";
  elements.toolOutput.dataset.rawOutput = "";
  elements.toolOutput.dataset.tableTsv = "";
  elements.toolOutput.dataset.visualOutput = "false";
  elements.toolOutputHighlight.hidden = true;
  elements.toolOutputHighlight.textContent = "";
  elements.toolOutput.hidden = false;
  clearToolTableOutput();
  elements.visualOutput.hidden = true;
  elements.visualOutput.textContent = "";
  elements.messages.textContent = "";
  state.currentToolOutputChoices = [];
  elements.outputFormatSelect.textContent = "";
  elements.outputViewTabs.hidden = true;
  elements.toolOutputActions.hidden = true;
  setOutputFormatLabel("tool", null);
  renderOutputSearch("tool");
}

function loadSelectedToolExample() {
  elements.sequenceInput.value = state.selectedTool.example ?? "";
  clearToolOutput();
  updateInputActionButtons();
}

function updateInputActionButtons() {
  elements.clearInput.hidden = false;
  elements.workflowClearInput.hidden = false;
}

function getOutputFormatOption(tool = state.selectedTool) {
  return flattenOptions(tool?.metadata.options ?? []).find((option) => option.id === "outputFormat");
}

function getSelectedToolOutputFormat(tool = state.selectedTool) {
  const option = getOutputFormatOption(tool);
  if (!option) {
    return null;
  }
  return state.outputFormatByTool.get(tool.metadata.id) ?? option.defaultValue;
}

function setSelectedToolOutputFormat(tool, value) {
  const option = getOutputFormatOption(tool);
  if (!option) {
    return;
  }
  const validValues = new Set((option.choices ?? []).map((choice) => choice.value));
  state.outputFormatByTool.set(tool.metadata.id, validValues.has(value) ? value : option.defaultValue);
}

function getCurrentToolOutputFormatLabel(result) {
  const options = flattenOptions(state.selectedTool.metadata.options ?? []);
  const values = getOptions();
  const formatOption = options.find((option) => option.id === "outputFormat")
    ?? options.find((option) => option.label === "Copy/download format");

  if (formatOption) {
    const choice = (formatOption.choices ?? []).find((item) => item.value === values[formatOption.id]);
    if (choice?.label) {
      return choice.label;
    }
  }

  const filename = result.download?.filename?.toLowerCase() ?? "";
  const mimeType = result.download?.mimeType ?? "";
  if (filename.endsWith(".tsv") || mimeType === "text/tab-separated-values") {
    return "TSV table";
  }
  if (filename.endsWith(".csv") || mimeType === "text/csv") {
    return "CSV table";
  }
  if (filename.endsWith(".svg") || mimeType.includes("svg")) {
    return "SVG";
  }
  if (filename.endsWith(".fasta") || filename.endsWith(".fa")) {
    return "FASTA";
  }
  if (mimeType.includes("json")) {
    return "JSON";
  }
  return "Text";
}

function alignTsv(tsv) {
  const rows = String(tsv ?? "")
    .split(/\r?\n/)
    .map((line) => line.split("\t"));
  const widths = [];

  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length);
    });
  }

  return rows
    .map((row) =>
      row.map((cell, index) => (index === row.length - 1 ? cell : cell.padEnd(widths[index]))).join("  ")
    )
    .join("\n");
}

function tableStreamToTsv(stream) {
  const columnIds = stream.columns?.length > 0 ? stream.columns.map((column) => column.id) : Object.keys(stream.rows?.[0] ?? {});
  return [
    columnIds.join("\t"),
    ...(stream.rows ?? []).map((row) => columnIds.map((columnId) => row[columnId] ?? "").join("\t"))
  ].join("\n");
}

function tableRowsToTsv(columns, rows) {
  const columnIds = columns.map((column) => column.id);
  return [
    columnIds.join("\t"),
    ...rows.map((row) => columnIds.map((columnId) => row[columnId] ?? "").join("\t"))
  ].join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function tableStreamToCsv(stream) {
  const columns = getTableColumns(stream);
  return tableRowsToCsv(columns, stream.rows ?? []);
}

function tableRowsToCsv(columns, rows) {
  const columnIds = columns.map((column) => column.id);
  return [
    columnIds.map(escapeCsvCell).join(","),
    ...rows.map((row) => columnIds.map((columnId) => escapeCsvCell(row[columnId])).join(","))
  ].join("\n");
}

function resetOutputTableSort(scope) {
  state.outputTable[scope].sortColumn = null;
  state.outputTable[scope].sortDirection = "asc";
  state.outputTable[scope].hiddenColumns = new Set();
  state.outputTable[scope].columnPreset = "all";
}

function clearTableOutput(scope) {
  const parts = getOutputViewParts(scope);
  parts.table.hidden = true;
  parts.table.textContent = "";
  parts.table.dataset.active = "false";
  parts.table.dataset.hasTable = "false";
  parts.table._tableStream = null;
  parts.textarea.hidden = false;
  parts.textarea.style.visibility = "";
  resetOutputTableSort(scope);
}

function clearToolTableOutput() {
  clearTableOutput("tool");
}

function clearWorkflowTableOutput() {
  clearTableOutput("workflow");
}

function isTableViewActive(scope) {
  const table = getOutputViewParts(scope).table;
  return table.dataset.active === "true" && !table.hidden;
}

function setOutputFormatLabel(scope, label) {
  const parts = getOutputViewParts(scope);
  const selectedLabel = label || "Not run";
  if (scope === "workflow") {
    parts.tabs.hidden = !label;
    parts.note.textContent = selectedLabel;
  }
}

function appendHighlightedCellText(parent, text, query) {
  const source = String(text ?? "");
  if (!query) {
    parent.textContent = source;
    return false;
  }
  const lowerSource = source.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const start = lowerSource.indexOf(lowerQuery);
  if (start === -1) {
    parent.textContent = source;
    return false;
  }
  parent.append(document.createTextNode(source.slice(0, start)));
  const mark = document.createElement("mark");
  mark.textContent = source.slice(start, start + query.length);
  parent.append(mark, document.createTextNode(source.slice(start + query.length)));
  return true;
}

function compareTableValues(left, right, type) {
  if (type === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
  }
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

function getTableColumns(stream) {
  const rows = stream?.rows ?? [];
  return stream?.columns?.length > 0
    ? stream.columns
    : Object.keys(rows[0] ?? {}).map((id) => ({ id, label: id }));
}

function getVisibleTableColumns(scope, columns) {
  const hiddenColumns = state.outputTable[scope].hiddenColumns;
  const visibleColumns = columns.filter((column) => !hiddenColumns.has(column.id));
  return visibleColumns.length > 0 ? visibleColumns : columns;
}

function getTableViewData(scope, stream) {
  const rows = stream?.rows ?? [];
  const columns = getTableColumns(stream);
  const visibleColumns = getVisibleTableColumns(scope, columns);
  const sortedRows = getSortedTableRows(scope, rows, visibleColumns);
  const displayInfo = getTableDisplayInfo(sortedRows, visibleColumns);
  return { rows, columns, visibleColumns, sortedRows, ...displayInfo };
}

function getTableDisplayInfo(sortedRows, visibleColumns) {
  const cellCount = sortedRows.length * Math.max(1, visibleColumns.length);
  const isPreview = sortedRows.length > TABLE_FULL_RENDER_ROW_LIMIT || cellCount > TABLE_FULL_RENDER_CELL_LIMIT;
  if (!isPreview) {
    return {
      displayedRows: sortedRows,
      isPreview,
      displayLimit: sortedRows.length,
      cellCount
    };
  }

  const rowLimitFromCells = Math.max(1, Math.floor(TABLE_FULL_RENDER_CELL_LIMIT / Math.max(1, visibleColumns.length)));
  const displayLimit = Math.min(TABLE_FULL_RENDER_ROW_LIMIT, rowLimitFromCells);
  return {
    displayedRows: sortedRows.slice(0, displayLimit),
    isPreview,
    displayLimit,
    cellCount
  };
}

function getSortedTableRows(scope, rows, columns) {
  const sortColumn = state.outputTable[scope].sortColumn;
  if (!sortColumn) {
    return rows;
  }
  const column = columns.find((item) => item.id === sortColumn);
  if (!column) {
    return rows;
  }
  const direction = state.outputTable[scope].sortDirection === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    const comparison = compareTableValues(left[sortColumn], right[sortColumn], column.type);
    return comparison * direction;
  });
}

function getTableSortLabel(scope, column) {
  if (state.outputTable[scope].sortColumn !== column.id) {
    return "";
  }
  return state.outputTable[scope].sortDirection === "desc" ? " desc" : " asc";
}

function getColumnPresetDefinitions(columns) {
  const ids = new Set(columns.map((column) => column.id));
  const presets = [{ id: "all", label: "All columns", columnIds: columns.map((column) => column.id) }];
  if (columns.length > 6) {
    presets.push({
      id: "summary",
      label: "Summary",
      columnIds: columns.slice(0, Math.min(6, columns.length)).map((column) => column.id)
    });
  }
  const coordinateIds = columns
    .filter((column) => /(^|_)(start|end|length|strand|frame|position|query|reference|ref)/i.test(column.id))
    .map((column) => column.id);
  if (coordinateIds.length > 0 && coordinateIds.length < columns.length) {
    presets.push({ id: "coordinates", label: "Coordinates", columnIds: coordinateIds });
  }
  const referenceIds = columns
    .filter((column) => /(motif|reference|source|database|class|name|id)/i.test(column.id))
    .map((column) => column.id);
  if (referenceIds.length > 0 && referenceIds.length < columns.length) {
    presets.push({ id: "reference", label: "Reference", columnIds: referenceIds });
  }
  return presets.filter((preset, index, all) =>
    preset.columnIds.length > 0 &&
    preset.columnIds.every((id) => ids.has(id)) &&
    all.findIndex((item) => item.id === preset.id) === index
  );
}

function applyTableColumnPreset(scope, columns, preset) {
  const tableState = state.outputTable[scope];
  const presets = getColumnPresetDefinitions(columns);
  const selected = presets.find((item) => item.id === preset) ?? presets[0];
  const visibleIds = new Set(selected.columnIds);
  tableState.columnPreset = selected.id;
  tableState.hiddenColumns = new Set(columns.map((column) => column.id).filter((id) => !visibleIds.has(id)));
}

function getVisibleTableText(scope, stream) {
  const { visibleColumns, displayedRows } = getTableViewData(scope, stream);
  return getOutputViewParts(scope).textarea.dataset.mimeType === "text/csv"
    ? tableRowsToCsv(visibleColumns, displayedRows)
    : tableRowsToTsv(visibleColumns, displayedRows);
}

function getFullTableText(scope, stream) {
  const { visibleColumns, sortedRows } = getTableViewData(scope, stream);
  return getOutputViewParts(scope).textarea.dataset.mimeType === "text/csv"
    ? tableRowsToCsv(visibleColumns, sortedRows)
    : tableRowsToTsv(visibleColumns, sortedRows);
}

function downloadText(text, filename, mimeType = "text/plain") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getVisibleTableFilename(scope) {
  const parts = getOutputViewParts(scope);
  const filename = parts.textarea.dataset.filename ?? (scope === "workflow" ? "sms3-workflow-output.tsv" : "sms3-output.tsv");
  const extension = parts.textarea.dataset.mimeType === "text/csv" ? "csv" : "tsv";
  return filename.toLowerCase().match(/\.(csv|tsv)$/)
    ? filename.replace(/\.(csv|tsv)$/i, `-visible.${extension}`)
    : `${filename}-visible.${extension}`;
}

function getVisibleTableMimeType(scope) {
  return getOutputViewParts(scope).textarea.dataset.mimeType === "text/csv"
    ? "text/csv"
    : "text/tab-separated-values";
}

function renderTableControls(scope, stream, columns, sortedRows, displayedRows, isPreview) {
  const tableState = state.outputTable[scope];
  const controls = document.createElement("div");
  controls.className = "table-output-controls";

  const actions = document.createElement("div");
  actions.className = "table-output-actions";

  const copyVisible = document.createElement("button");
  copyVisible.type = "button";
  copyVisible.textContent = isPreview ? "Copy displayed" : "Copy";
  copyVisible.title = "Copy the displayed table rows and columns";
  copyVisible.disabled = displayedRows.length === 0;
  copyVisible.addEventListener("click", async () => {
    await navigator.clipboard.writeText(getVisibleTableText(scope, stream));
  });
  actions.append(copyVisible);

  const downloadVisible = document.createElement("button");
  downloadVisible.type = "button";
  downloadVisible.textContent = isPreview ? "Download displayed" : "Download";
  downloadVisible.title = "Download the displayed table rows and columns";
  downloadVisible.disabled = displayedRows.length === 0;
  downloadVisible.addEventListener("click", () => {
    downloadText(getVisibleTableText(scope, stream), getVisibleTableFilename(scope), getVisibleTableMimeType(scope));
  });
  actions.append(downloadVisible);

  if (isPreview) {
    const copyAll = document.createElement("button");
    copyAll.type = "button";
    copyAll.textContent = "Copy all";
    copyAll.title = "Copy all sorted rows and visible columns";
    copyAll.disabled = sortedRows.length === 0;
    copyAll.addEventListener("click", async () => {
      await navigator.clipboard.writeText(getFullTableText(scope, stream));
    });
    actions.append(copyAll);

    const downloadAll = document.createElement("button");
    downloadAll.type = "button";
    downloadAll.textContent = "Download all";
    downloadAll.title = "Download all sorted rows and visible columns";
    downloadAll.disabled = sortedRows.length === 0;
    downloadAll.addEventListener("click", () => {
      downloadText(
        getFullTableText(scope, stream),
        getVisibleTableFilename(scope).replace("-visible.", "-all."),
        getVisibleTableMimeType(scope)
      );
    });
    actions.append(downloadAll);
  }

  controls.append(actions);

  const options = document.createElement("div");
  options.className = "table-output-options";

  const columnDetails = document.createElement("details");
  columnDetails.className = "table-column-chooser";
  const columnSummary = document.createElement("summary");
  const hiddenCount = tableState.hiddenColumns.size;
  columnSummary.textContent = hiddenCount > 0
    ? `${columns.length - hiddenCount} of ${columns.length} columns`
    : `All ${columns.length} columns`;
  columnDetails.append(columnSummary);

  const columnPanel = document.createElement("div");
  columnPanel.className = "table-column-panel";

  const presets = getColumnPresetDefinitions(columns);
  if (presets.length > 1) {
    const presetLabel = document.createElement("label");
    presetLabel.textContent = "Column set";
    const presetSelect = document.createElement("select");
    presetSelect.className = "table-column-preset";
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.id;
      option.textContent = preset.label;
      presetSelect.append(option);
    }
    presetSelect.value = presets.some((preset) => preset.id === tableState.columnPreset)
      ? tableState.columnPreset
      : "all";
    presetSelect.addEventListener("change", () => {
      applyTableColumnPreset(scope, columns, presetSelect.value);
      renderTableOutputSearch(scope);
    });
    presetLabel.append(presetSelect);
    columnPanel.append(presetLabel);
  }

  const columnGrid = document.createElement("div");
  columnGrid.className = "table-column-grid";
  for (const column of columns) {
    const columnLabel = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = !tableState.hiddenColumns.has(column.id);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        tableState.hiddenColumns.delete(column.id);
      } else if (columns.length - tableState.hiddenColumns.size > 1) {
        tableState.hiddenColumns.add(column.id);
      }
      tableState.columnPreset = "custom";
      renderTableOutputSearch(scope);
    });
    columnLabel.append(checkbox, document.createTextNode(column.label ?? column.id));
    columnGrid.append(columnLabel);
  }
  columnPanel.append(columnGrid);
  columnDetails.append(columnPanel);
  options.append(columnDetails);
  controls.append(options);

  return controls;
}

function renderTableStream(scope, stream, query = "") {
  const parts = getOutputViewParts(scope);
  parts.table.textContent = "";
  const { rows, columns, visibleColumns, sortedRows, displayedRows, isPreview, cellCount } = getTableViewData(scope, stream);
  const heading = document.createElement("h4");
  heading.className = "table-output-heading";
  heading.textContent = "Table";
  const summary = document.createElement("div");
  summary.className = "table-output-summary";
  const sortColumn = visibleColumns.find((column) => column.id === state.outputTable[scope].sortColumn);
  summary.textContent = `${isPreview ? `${displayedRows.length} displayed from ` : ""}${sortedRows.length} of ${pluralize(rows.length, "row")}, ${visibleColumns.length} of ${pluralize(columns.length, "column")}${
    sortColumn ? `; sorted by ${sortColumn.label ?? sortColumn.id} ${state.outputTable[scope].sortDirection}` : ""
  }`;
  parts.table.append(heading, summary);
  if (isPreview) {
    const warning = document.createElement("div");
    warning.className = "table-output-warning";
    warning.textContent = `Large table preview: rendering ${pluralize(displayedRows.length, "row")} from ${pluralize(sortedRows.length, "row")} (${cellCount.toLocaleString()} cells). Use Copy all or Download all for the full visible-column data.`;
    parts.table.append(warning);
  }
  parts.table.append(renderTableControls(scope, stream, columns, sortedRows, displayedRows, isPreview));
  const table = document.createElement("table");
  table.className = "result-table";
  table.style.setProperty("--visible-table-columns", Math.max(1, visibleColumns.length));
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const column of visibleColumns) {
    const th = document.createElement("th");
    th.scope = "col";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "table-sort-button";
    button.textContent = `${column.label ?? column.id}${getTableSortLabel(scope, column)}`;
    button.addEventListener("click", () => {
      if (state.outputTable[scope].sortColumn === column.id) {
        state.outputTable[scope].sortDirection = state.outputTable[scope].sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.outputTable[scope].sortColumn = column.id;
        state.outputTable[scope].sortDirection = column.type === "number" ? "desc" : "asc";
      }
      renderTableOutputSearch(scope);
    });
    th.append(button);
    headerRow.append(th);
  }
  thead.append(headerRow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  for (const row of displayedRows) {
    const tr = document.createElement("tr");
    for (const column of visibleColumns) {
      const td = document.createElement("td");
      const matched = appendHighlightedCellText(td, row[column.id] ?? "", query);
      if (matched) {
        td.classList.add("output-table-match");
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  parts.table.append(table);
}

function renderTableOutputSearch(scope) {
  const search = state.outputSearch[scope];
  const parts = getOutputSearchParts(scope);
  const query = parts.input.value;
  const tableStream = parts.table._tableStream;
  if (!tableStream) {
    renderOutputSearch(scope);
    return;
  }
  renderTableStream(scope, tableStream, query);
  const matches = [...parts.table.querySelectorAll(".output-table-match")];
  search.matches = matches;
  search.currentIndex = query && matches.length > 0 ? 0 : -1;
  const summary = parts.table.querySelector(".table-output-summary");
  if (summary && query) {
    summary.textContent += `; ${pluralize(matches.length, "matching cell")}`;
  }
  parts.count.textContent = !query
    ? "No search"
    : matches.length > 0
      ? `1 of ${matches.length}`
      : "No matches";
  parts.previous.disabled = matches.length < 2;
  parts.next.disabled = matches.length < 2;
  selectTableOutputMatch(scope);
}

function scrollElementInsideContainer(element, container) {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  container.scrollTop += elementRect.top - containerRect.top - container.clientHeight / 2 + elementRect.height / 2;
  container.scrollLeft += elementRect.left - containerRect.left - container.clientWidth / 2 + elementRect.width / 2;
}

function selectTableOutputMatch(scope) {
  const search = state.outputSearch[scope];
  const matches = search.matches ?? [];
  for (const cell of matches) {
    cell.classList.remove("current-output-table-match");
  }
  if (search.currentIndex < 0 || matches.length === 0) {
    return;
  }
  const cell = matches[search.currentIndex];
  cell.classList.add("current-output-table-match");
  scrollElementInsideContainer(cell, getOutputViewParts(scope).table);
}

function renderTableOutputForScope(scope, tableStream, preferTable = false) {
  const parts = getOutputViewParts(scope);
  const hasTable = Boolean(tableStream?.columns?.length && Array.isArray(tableStream.rows));
  parts.table._tableStream = hasTable ? tableStream : null;
  parts.table.dataset.hasTable = String(hasTable);
  parts.textarea.dataset.tableTsv = hasTable ? tableStreamToTsv(tableStream) : "";
  parts.textarea.dataset.visualOutput = "false";
  resetOutputTableSort(scope);

  if (!hasTable) {
    clearTableOutput(scope);
    return;
  }

  renderTableStream(scope, tableStream);
  parts.table.hidden = false;
  parts.table.dataset.active = preferTable ? "true" : "false";
  parts.textarea.hidden = preferTable;
  parts.preview.hidden = true;
  parts.textarea.style.visibility = "";
  renderOutputSearch(scope);
}

function renderWorkflowTableOutput(tableStream, preferTable = false) {
  renderTableOutputForScope("workflow", tableStream, preferTable);
}

function renderVisualOutput(svg) {
  if (!svg) {
    elements.visualOutput.hidden = true;
    elements.visualOutput.textContent = "";
    return;
  }
  elements.visualOutput.hidden = false;
  elements.visualOutput.textContent = "";
  const heading = document.createElement("h4");
  heading.className = "visual-output-heading";
  heading.textContent = "Preview";
  elements.visualOutput.append(heading);
  elements.visualOutput.insertAdjacentHTML("beforeend", svg);
}

function applyToolOutputChoice(choice) {
  elements.toolOutput.dataset.rawOutput = choice.text;
  const skipDisplayText = choice.tableStream && (choice.tableStream.rows?.length ?? 0) > TABLE_FULL_RENDER_ROW_LIMIT;
  elements.toolOutput.value = skipDisplayText
    ? ""
    : choice.download.mimeType === "text/tab-separated-values"
      ? alignTsv(choice.text)
      : choice.text;
  elements.toolOutput.dataset.filename = choice.download.filename ?? "sms3-output.txt";
  elements.toolOutput.dataset.mimeType = choice.download.mimeType ?? "text/plain";
  elements.outputFormatSelect.value = choice.format;
  setSelectedToolOutputFormat(state.selectedTool, choice.format);
  setOutputFormatLabel("tool", choice.label);
  renderTableOutputForScope("tool", choice.tableStream, Boolean(choice.tableStream));
  renderVisualOutput(choice.svg);
  elements.toolOutput.dataset.visualOutput = choice.svg ? "true" : "false";
  elements.toolOutput.hidden = Boolean(choice.tableStream || choice.svg);
  updateOutputActions("tool", {
    hidden: Boolean(choice.tableStream),
    mimeType: choice.download.mimeType,
    label: choice.label
  });
  renderOutputSearch("tool");
}

function renderToolOutputFormatSelect(choices, selectedFormat) {
  state.currentToolOutputChoices = choices;
  elements.outputFormatSelect.textContent = "";
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.format;
    option.textContent = choice.label;
    elements.outputFormatSelect.append(option);
  }
  const selected = choices.find((choice) => choice.format === selectedFormat) ?? choices[0];
  elements.outputViewTabs.hidden = false;
  elements.outputFormatSelect.closest("label").hidden = choices.length <= 1;
  if (selected) {
    applyToolOutputChoice(selected);
  }
}

function makeDownloadInfoForFormat(format, result) {
  const baseName = state.selectedTool.metadata.id;
  if (format === getSelectedToolOutputFormat(state.selectedTool)) {
    return result.download ?? { filename: `${baseName}.txt`, mimeType: "text/plain;charset=utf-8" };
  }
  if (format === "tsv") {
    return { filename: `${baseName}.tsv`, mimeType: "text/tab-separated-values" };
  }
  if (format === "csv") {
    return { filename: `${baseName}.csv`, mimeType: "text/csv" };
  }
  if (format === "svg-plot" || format === "svg-overview") {
    return { filename: `${baseName}.svg`, mimeType: "image/svg+xml;charset=utf-8" };
  }
  if (format === "fasta" || format === "nucleotide-fasta" || format === "protein-fasta") {
    return { filename: `${baseName}.fasta`, mimeType: "text/x-fasta;charset=utf-8" };
  }
  return { filename: `${baseName}.txt`, mimeType: "text/plain;charset=utf-8" };
}

function getTextForOutputFormat(format, result) {
  if (format === getSelectedToolOutputFormat(state.selectedTool)) {
    return result.output;
  }
  if (format === "report") {
    return result.streams?.report?.text;
  }
  if (format === "tsv") {
    return result.streams?.tsv?.text ?? (result.streams?.table ? tableStreamToTsv(result.streams.table) : undefined);
  }
  if (format === "csv") {
    return result.streams?.table ? tableStreamToCsv(result.streams.table) : undefined;
  }
  if (format === "svg-plot") {
    return result.streams?.plot?.text;
  }
  if (format === "svg-overview") {
    return result.streams?.overview?.text;
  }
  if (format === "fasta") {
    return result.streams?.fasta?.text;
  }
  if (format === "nucleotide-fasta") {
    return result.streams?.nucleotideFasta?.text;
  }
  if (format === "protein-fasta") {
    return result.streams?.proteinFasta?.text;
  }
  return undefined;
}

function makeOutputChoice(format, label, result) {
  const text = getTextForOutputFormat(format, result);
  if (typeof text !== "string") {
    return null;
  }
  const download = makeDownloadInfoForFormat(format, result);
  return {
    format,
    label,
    text,
    download,
    tableStream: format === "tsv" || format === "csv" ? result.streams?.table : null,
    svg: download.mimeType.includes("svg") ? text : null
  };
}

function getToolOutputChoices(result) {
  const outputFormatOption = getOutputFormatOption(state.selectedTool);
  if (!outputFormatOption) {
    return [
      {
        format: "primary",
        label: getCurrentToolOutputFormatLabel(result),
        text: result.output,
        download: result.download ?? { filename: "sms3-output.txt", mimeType: "text/plain" },
        tableStream: null,
        svg: result.download?.mimeType?.includes("svg") ? result.output : null
      }
    ];
  }
  return (outputFormatOption.choices ?? [])
    .map((choice) => makeOutputChoice(choice.value, choice.label, result))
    .filter(Boolean);
}

function sequenceRecordsToFasta(stream) {
  return (stream.records ?? [])
    .map((record) => `>${record.title ?? "sequence"}\n${record.sequence ?? ""}`)
    .join("\n");
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatWorkflowValue(value) {
  if (!value) {
    return { text: "", rawText: "", summary: "No output", isTsv: false };
  }

  if (value.kind === "table") {
    const rawText = tableStreamToTsv(value);
    const skipDisplayText = (value.rows?.length ?? 0) > TABLE_FULL_RENDER_ROW_LIMIT;
    return {
      text: skipDisplayText ? "" : alignTsv(rawText),
      rawText,
      summary: `Workflow output: table rows (${pluralize(value.rows?.length ?? 0, "row")})`,
      outputLabel: "TSV table",
      isTsv: true,
      tableStream: value,
      filename: "sms3-workflow-output.tsv",
      mimeType: "text/tab-separated-values"
    };
  }

  if (value.kind === "sequence-records") {
    const rawText = sequenceRecordsToFasta(value);
    return {
      text: rawText,
      rawText,
      summary: `Workflow output: ${value.alphabet === "protein" ? "protein" : "DNA/RNA"} sequences (${pluralize(value.records?.length ?? 0, "record")})`,
      outputLabel: "FASTA sequences",
      isTsv: false,
      filename: "sms3-workflow-output.fasta",
      mimeType: "text/x-fasta;charset=utf-8"
    };
  }

  if (value.kind === "text") {
    return {
      text: value.text ?? "",
      rawText: value.text ?? "",
      summary: "Workflow output: readable text",
      outputLabel: value.mediaType?.includes("svg") ? "SVG" : "Text",
      isTsv: false,
      filename: "sms3-workflow-output.txt",
      mimeType: value.mediaType ?? "text/plain;charset=utf-8"
    };
  }

  if (value.kind === "collection") {
    const rawText = JSON.stringify(value, null, 2);
    return {
      text: rawText,
      rawText,
      summary: `Workflow output: set (${pluralize(value.items?.length ?? 0, "item")})`,
      outputLabel: "JSON",
      isTsv: false,
      filename: "sms3-workflow-output.json",
      mimeType: "application/json"
    };
  }

  const rawText = JSON.stringify(value, null, 2);
  return {
    text: rawText,
    rawText,
    summary: `Workflow output: ${describeStream(value)}`,
    outputLabel: "JSON",
    isTsv: false,
    filename: "sms3-workflow-output.json",
    mimeType: "application/json"
  };
}

function getSelectedWorkflowPreset() {
  return workflowPresets.find((preset) => preset.id === state.selectedWorkflow) ?? workflowPresets[0];
}

function cloneWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow));
}

function getActiveWorkflowDefinition() {
  return state.importedWorkflow ?? getSelectedWorkflowPreset().workflow;
}

function setWorkflowDefinition(workflow) {
  state.importedWorkflow = workflow;
  elements.workflowJson.value = JSON.stringify(workflow, null, 2);
}

function getSelectedWorkflowStep(workflow) {
  const steps = workflow.steps ?? [];
  if (steps.length === 0) {
    state.selectedWorkflowStepId = null;
    return undefined;
  }

  let step = steps.find((item) => item.id === state.selectedWorkflowStepId);
  if (!step) {
    step =
      [...steps].reverse().find((item) => item.type !== "input") ??
      steps[0];
    state.selectedWorkflowStepId = step.id;
  }
  return step;
}

function pruneExpandedWorkflowSteps(workflow) {
  const stepIds = new Set((workflow.steps ?? []).map((step) => step.id));
  for (const stepId of [...state.expandedWorkflowStepIds]) {
    if (!stepIds.has(stepId)) {
      state.expandedWorkflowStepIds.delete(stepId);
    }
  }
}

function makeRunnableWorkflow(workflowDefinition = getActiveWorkflowDefinition()) {
  const workflow = cloneWorkflow(workflowDefinition);
  const inputStep = workflow.steps.find((step) => step.type === "input");
  if (inputStep) {
    inputStep.text = elements.workflowInput.value;
  }
  return workflow;
}

function getToolById(toolId) {
  return tools.find((tool) => tool.metadata.id === toolId);
}

function makeDefaultOptions(tool) {
  const options = {};
  for (const option of flattenOptions(tool?.metadata.options ?? [])) {
    if (
      option.type === "radio" ||
      option.type === "select" ||
      option.type === "checkbox" ||
      option.type === "number" ||
      option.type === "text"
    ) {
      options[option.id] = option.defaultValue;
    }
  }
  return options;
}

function makeStepId(workflow, baseId) {
  const existing = new Set((workflow.steps ?? []).map((step) => step.id));
  let candidate = baseId;
  let index = 2;
  while (existing.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }
  return candidate;
}

function getEditableWorkflow() {
  const workflow = workflowFromJsonOrActive();
  workflow.steps = Array.isArray(workflow.steps) ? workflow.steps : [];
  return workflow;
}

function workflowFromJsonOrActive() {
  if (elements.workflowJson.value.trim()) {
    const parsed = parseWorkflowJson();
    if (parsed.errors.length === 0) {
      return parsed.workflow;
    }
  }
  return cloneWorkflow(getActiveWorkflowDefinition());
}

function getWorkflowLastOutput(workflow) {
  let lastOutput;
  let lastTool;

  for (const step of workflow.steps ?? []) {
    if (step.type === "input") {
      lastOutput = { id: "primary", kind: "text", mediaType: step.mediaType ?? "text/plain" };
      continue;
    }

    if (step.type === "tool") {
      lastTool = getToolById(step.toolId);
      lastOutput = lastTool?.metadata.workflow?.outputs?.find((output) => output.id === (step.selectStream ?? "primary"));
      continue;
    }

    if (step.type === "select-stream") {
      const output = lastTool?.metadata.workflow?.outputs?.find((item) => item.id === step.stream);
      if (output) {
        lastOutput = output;
      }
      continue;
    }

    if (step.type === "split") {
      lastOutput = { kind: "collection", itemKind: "sequence-records", itemDescription: "sequence records" };
      continue;
    }

    if (step.type === "map") {
      const tool = getToolById(step.toolId);
      const stream = step.selectStream ?? "primary";
      const output = tool?.metadata.workflow?.outputs?.find((item) => item.id === stream);
      lastOutput = {
        kind: "collection",
        itemKind: output?.kind ?? stream,
        itemDescription: makeWorkflowCollectionDescription(output, stream)
      };
      lastTool = tool;
      continue;
    }

    if (step.type === "gather") {
      lastOutput =
        step.as === "table"
          ? { kind: "table" }
          : step.as === "text"
            ? { kind: "text" }
            : { kind: "sequence-records" };
    }
  }

  return lastOutput;
}

function getWorkflowOutputAtIndex(workflow, targetIndex) {
  let lastOutput;
  let lastTool;

  for (const [index, step] of (workflow.steps ?? []).entries()) {
    if (step.type === "input") {
      lastOutput = { id: "primary", kind: "text", mediaType: step.mediaType ?? "text/plain" };
      lastTool = undefined;
    } else if (step.type === "tool") {
      lastTool = getToolById(step.toolId);
      lastOutput = lastTool?.metadata.workflow?.outputs?.find((output) => output.id === (step.selectStream ?? "primary"));
    } else if (step.type === "select-stream") {
      const output = lastTool?.metadata.workflow?.outputs?.find((item) => item.id === step.stream);
      if (output) {
        lastOutput = output;
      }
    } else if (step.type === "split") {
      lastOutput = { kind: "collection", itemKind: "sequence-records", itemDescription: "sequence records" };
    } else if (step.type === "map") {
      const tool = getToolById(step.toolId);
      const stream = step.selectStream ?? "primary";
      const output = tool?.metadata.workflow?.outputs?.find((item) => item.id === stream);
      lastOutput = {
        kind: "collection",
        itemKind: output?.kind ?? stream,
        itemDescription: makeWorkflowCollectionDescription(output, stream)
      };
      lastTool = tool;
    } else if (step.type === "gather") {
      lastOutput =
        step.as === "table"
          ? { kind: "table" }
          : step.as === "text"
            ? { kind: "text" }
            : { kind: "sequence-records" };
    }

    if (index === targetIndex) {
      return lastOutput;
    }
  }

  return lastOutput;
}

function getSelectedWorkflowStepIndex(workflow) {
  return (workflow.steps ?? []).findIndex((step) => step.id === state.selectedWorkflowStepId);
}

function getWorkflowInsertionIndex(workflow) {
  return (workflow.steps ?? []).length;
}

function getWorkflowOutputAtInsertionPoint(workflow) {
  const insertionIndex = getWorkflowInsertionIndex(workflow);
  return insertionIndex > 0 ? getWorkflowOutputAtIndex(workflow, insertionIndex - 1) : undefined;
}

function describeStream(stream) {
  if (!stream) {
    return "unknown result";
  }
  if (stream.kind === "sequence-records") {
    return stream.alphabet === "protein" ? "protein sequences" : "DNA/RNA sequences";
  }
  if (stream.kind === "collection") {
    const itemDescription =
      stream.itemDescription ??
      (stream.itemKind === "sequence-records" ? "sequence records" : stream.itemKind);
    return itemDescription ? `set of ${itemDescription}` : "set";
  }
  if (stream.kind === "table") {
    return "table rows";
  }
  if (stream.kind === "orf-records") {
    return "ORFs";
  }
  if (stream.kind === "stats-records") {
    return "statistics records";
  }
  if (stream.kind === "text-records") {
    return "text records";
  }
  if (stream.kind === "warnings") {
    return "warnings";
  }
  if (stream.kind === "text") {
    if (stream.mediaType?.includes("fasta")) {
      return "FASTA records";
    }
    if (stream.mediaType?.includes("svg")) {
      return "plot or image";
    }
    if (stream.mediaType?.includes("tab-separated-values")) {
      return "TSV table";
    }
    return "readable text";
  }
  return stream.kind;
}

function getWorkflowSchemaLabel(schema) {
  const labels = {
    "base-composition-plot": "Composition table",
    "codon-usage-comparison": "Codon comparison table",
    "codon-usage": "Codon count table",
    "dna-rna-pattern-finder": "Match table",
    "dna-rna-motif-scanner": "Motif match table",
    "extract-subsequences": "Extracted-region table",
    "generic-table": "Table rows",
    "orf-finder": "ORF table",
    "protein-hydropathy": "Hydropathy table",
    "protein-motif-scanner": "Motif match table",
    "protein-pattern-finder": "Match table",
    "protein-stats": "Protein statistics table",
    "restriction-fragments": "Digest fragments",
    "restriction-map": "Map features",
    "restriction-sites": "Restriction site table",
    "reverse-translate": "Codon choice table",
    "sequence-stats-dna-rna": "Sequence statistics table",
    "technical-sequence-scanner": "Technical sequence match table",
    "vector-contamination-scanner": "Vector contamination match table",
    "translate-dna-rna": "Translation table"
  };
  return labels[schema];
}

function describeWorkflowStreamChoice(stream) {
  if (!stream) {
    return "Unknown result";
  }
  if (stream.label) {
    return stream.label;
  }
  if (stream.id === "primary") {
    return stream.mediaType?.includes("fasta") ? "FASTA records" : "Displayed output";
  }
  if (stream.id === "sequenceRecords") {
    return stream.alphabet === "protein" ? "Protein sequences" : "DNA/RNA sequences";
  }
  if (stream.id === "cleanedText") {
    return "Cleaned text";
  }
  if (stream.id === "proteinRecords") {
    return "Protein sequences";
  }
  if (stream.id === "dnaRecords") {
    return "DNA/RNA sequences";
  }
  if (stream.id === "orfRecords") {
    return "ORFs";
  }
  if (stream.id === "matchedRegions") {
    return "Matched sequence regions";
  }
  if (stream.id === "nucleotideFasta") {
    return "ORF nucleotide FASTA";
  }
  if (stream.id === "proteinFasta") {
    return "ORF protein FASTA";
  }
  if (stream.id === "fasta") {
    return "FASTA records";
  }
  if (stream.id === "report") {
    return "Summary report";
  }
  if (stream.id === "tsv") {
    return "TSV table";
  }
  if (stream.id === "groupedText") {
    return "Grouped sequence text";
  }
  if (stream.id === "translations") {
    return "Translation table";
  }
  if (stream.id === "fragments") {
    return "Digest fragments";
  }
  if (stream.id === "mapTable") {
    return "Map features";
  }
  if (stream.id === "plot") {
    return "Plot";
  }
  if (stream.id === "overview") {
    return "Overview graphic";
  }
  if (stream.id === "table") {
    return getWorkflowSchemaLabel(stream.schema) ?? "Table rows";
  }
  if (stream.id === "statsRecords") {
    return "Statistics records";
  }
  if (stream.id === "textRecords") {
    return "Text records";
  }
  if (stream.id === "warnings") {
    return "Warnings";
  }
  return describeStream(stream);
}

function isAdvancedWorkflowOutput(stream, outputs = []) {
  if (!stream) {
    return true;
  }
  if (stream.hidden || stream.advanced || stream.kind === "warnings" || stream.kind === "stats-records" || stream.kind === "text-records") {
    return true;
  }
  return stream.id === "primary" && outputs.some((output) => output.id !== "primary" && output.kind !== "warnings");
}

function getUserSelectableWorkflowOutputs(tool) {
  const outputs = tool?.metadata.workflow?.outputs ?? [];
  const visible = outputs.filter((stream) => !isAdvancedWorkflowOutput(stream, outputs));
  return visible.length > 0 ? visible : outputs.filter((stream) => stream.kind !== "warnings");
}

function getWorkflowOutputPriority(stream) {
  const priorityById = {
    orfRecords: 1,
    proteinRecords: 2,
    sequenceRecords: 3,
    table: 4,
    translations: 4,
    matchedRegions: 5,
    fasta: 6,
    nucleotideFasta: 6,
    proteinFasta: 6,
    report: 7,
    groupedText: 8,
    tsv: 9,
    plot: 10,
    overview: 10,
    primary: 20
  };
  return priorityById[stream?.id] ?? 15;
}

function getRecommendedWorkflowOutputId(tool) {
  const outputs = getUserSelectableWorkflowOutputs(tool);
  return [...outputs].sort((left, right) => getWorkflowOutputPriority(left) - getWorkflowOutputPriority(right))[0]?.id ?? "primary";
}

function getWorkflowFieldChoicesForStream(stream) {
  if (!stream) {
    return [];
  }

  if (stream.kind === "table" && Array.isArray(stream.columns) && stream.columns.length > 0) {
    return stream.columns.map((column) => ({
      value: column.id,
      label: `${column.label ?? column.id} (${column.id})`
    }));
  }

  if (stream.kind === "sequence-records" || (stream.kind === "collection" && stream.itemKind === "sequence-records")) {
    return [
      { value: "title", label: "Title (title)" },
      { value: "length", label: "Length (length)" },
      { value: "sequence", label: "Sequence (sequence)" }
    ];
  }

  return [];
}

function getWorkflowFieldChoicesAtInsertionPoint(workflow) {
  return getWorkflowFieldChoicesForStream(getWorkflowOutputAtInsertionPoint(workflow));
}

function getWorkflowFieldChoicesBeforeStep(workflow, step) {
  const stepIndex = (workflow.steps ?? []).findIndex((item) => item.id === step.id);
  return getWorkflowFieldChoicesForStream(stepIndex > 0 ? getWorkflowOutputAtIndex(workflow, stepIndex - 1) : undefined);
}

function replaceWorkflowFieldControl(row, elementKey, choices, fallback) {
  const existing = elements[elementKey];
  const previousValue = existing?.value ?? fallback;
  const control = choices.length > 0 ? document.createElement("select") : document.createElement("input");
  control.id = existing?.id ?? elementKey;

  if (choices.length > 0) {
    control.className = "workflow-field-select";
    for (const choice of choices) {
      const option = document.createElement("option");
      option.value = choice.value;
      option.textContent = choice.label;
      control.append(option);
    }
    control.value = choices.some((choice) => choice.value === previousValue)
      ? previousValue
      : choices.some((choice) => choice.value === fallback)
        ? fallback
        : choices[0].value;
    row.className = "select-row";
  } else {
    control.type = "text";
    control.value = previousValue || fallback;
    row.className = "number-row";
  }

  existing?.replaceWith(control);
  elements[elementKey] = control;
}

function getWorkflowStepFlow(workflow, targetIndex) {
  let lastOutput;
  let lastTool;
  const stepOutputs = new Map();
  const stepTools = new Map();

  function getBoundInput(step) {
    if (!step.input) {
      return lastOutput;
    }

    const sourceOutput = stepOutputs.get(step.input.from);
    const streamName = step.input.stream ?? "primary";
    if (streamName === "primary") {
      return sourceOutput;
    }

    const sourceTool = stepTools.get(step.input.from);
    return sourceTool?.metadata.workflow?.outputs?.find((item) => item.id === streamName) ?? sourceOutput;
  }

  for (const [index, step] of (workflow.steps ?? []).entries()) {
    const input = getBoundInput(step);
    let output = lastOutput;

    if (step.type === "input") {
      output = { id: "primary", kind: "text", mediaType: step.mediaType ?? "text/plain" };
      lastTool = undefined;
      stepOutputs.set(step.id, output);
      stepTools.delete(step.id);
    } else if (step.type === "tool") {
      const tool = getToolById(step.toolId);
      output = tool?.metadata.workflow?.outputs?.find((item) => item.id === (step.selectStream ?? "primary"));
      lastTool = tool;
      stepOutputs.set(step.id, output);
      stepTools.set(step.id, tool);
    } else if (step.type === "select-stream") {
      const selected = lastTool?.metadata.workflow?.outputs?.find((item) => item.id === step.stream);
      output = selected ?? output;
      stepOutputs.set(step.id, output);
      stepTools.delete(step.id);
    } else if (step.type === "split") {
      output = { kind: "collection", itemKind: "sequence-records", itemDescription: "sequence records" };
      stepOutputs.set(step.id, output);
      stepTools.delete(step.id);
    } else if (step.type === "map") {
      const tool = getToolById(step.toolId);
      const stream = step.selectStream ?? "primary";
      const selected = tool?.metadata.workflow?.outputs?.find((item) => item.id === stream);
      output = {
        kind: "collection",
        itemKind: selected?.kind ?? stream,
        itemDescription: selected ? describeStream(selected) : stream
      };
      lastTool = tool;
      stepOutputs.set(step.id, output);
      stepTools.set(step.id, tool);
    } else if (step.type === "gather") {
      output =
        step.as === "table"
          ? { kind: "table" }
          : step.as === "text"
            ? { kind: "text" }
            : { kind: "sequence-records" };
      stepOutputs.set(step.id, output);
      stepTools.delete(step.id);
    } else {
      stepOutputs.set(step.id, output);
      stepTools.delete(step.id);
    }

    if (index === targetIndex) {
      return { input, output };
    }

    lastOutput = output;
  }

  return { input: lastOutput, output: lastOutput };
}

function getWorkflowStepDisplayName(step) {
  if (!step) {
    return "earlier step";
  }
  if (step.type === "input") {
    return "Workflow Input";
  }
  if (step.type === "tool" || step.type === "map") {
    return getToolById(step.toolId)?.metadata.name ?? step.toolId ?? "tool step";
  }
  if (step.type === "select-stream") {
    return "Choose a different result";
  }
  return workflowStepTypeLabels[step.type] ?? step.type ?? "earlier step";
}

function getWorkflowStepInputDescription(workflow, step) {
  if (!step.input) {
    return "";
  }

  const sourceStep = (workflow?.steps ?? []).find((item) => item.id === step.input.from);
  const streamName = step.input.stream ?? "primary";
  let stream;

  if (streamName === "primary") {
    const sourceIndex = (workflow?.steps ?? []).findIndex((item) => item.id === step.input.from);
    stream = sourceIndex >= 0 ? getWorkflowStepFlow(workflow, sourceIndex).output : undefined;
  } else if (sourceStep?.type === "tool" || sourceStep?.type === "map") {
    stream = getToolById(sourceStep.toolId)?.metadata.workflow?.outputs?.find((item) => item.id === streamName);
  }

  return `${describeStream(stream ?? { kind: streamName })} from ${getWorkflowStepDisplayName(sourceStep)}`;
}

function getWorkflowStepOutputDescription(step, flow) {
  if (step.type === "tool" && step.selectStream && step.selectStream !== "primary") {
    return describeWorkflowStreamChoice(flow.output);
  }
  if (step.type === "map" && step.selectStream && step.selectStream !== "primary") {
    return describeWorkflowStreamChoice(flow.output);
  }
  return "";
}

function describeWorkflowStep(step, workflow) {
  if (step.type === "input") {
    return "Start from pasted or loaded sequence text";
  }
  if (step.type === "tool") {
    const tool = tools.find((item) => item.metadata.id === step.toolId);
    const input = step.input ? ` using ${getWorkflowStepInputDescription(workflow, step)}` : "";
    const flow = workflow ? getWorkflowStepFlow(workflow, (workflow.steps ?? []).findIndex((item) => item.id === step.id)) : {};
    const output = getWorkflowStepOutputDescription(step, flow);
    return `Run ${tool?.metadata.name ?? step.toolId}${input}${output ? `; output ${output}` : ""}`;
  }
  if (step.type === "select-stream") {
    const flow = workflow ? getWorkflowStepFlow(workflow, (workflow.steps ?? []).findIndex((item) => item.id === step.id)) : {};
    return `Use ${describeWorkflowStreamChoice(flow.output ?? { kind: step.stream })}`;
  }
  if (step.type === "split") {
    return "Split multi-record FASTA into individual records";
  }
  if (step.type === "filter") {
    const criteria = step.criteria ?? {};
    return `Keep items where ${criteria.field ?? "field"} ${criteria.operator ?? "contains"} ${criteria.value ?? ""}`;
  }
  if (step.type === "sort") {
    const criteria = step.criteria ?? {};
    return `Sort by ${criteria.field ?? "title"} ${criteria.direction === "desc" ? "descending" : "ascending"}`;
  }
  if (step.type === "map") {
    const tool = tools.find((item) => item.metadata.id === step.toolId);
    const input = step.input ? ` from ${getWorkflowStepInputDescription(workflow, step)}` : "";
    const flow = workflow ? getWorkflowStepFlow(workflow, (workflow.steps ?? []).findIndex((item) => item.id === step.id)) : {};
    const output = getWorkflowStepOutputDescription(step, flow);
    return `Run ${tool?.metadata.name ?? step.toolId} on each item${input}${output ? `; output ${output}` : ""}`;
  }
  if (step.type === "gather") {
    return `Gather items as ${step.as ?? "auto"}`;
  }
  return step.type;
}

function renderWorkflowView() {
  const preset = getSelectedWorkflowPreset();

  elements.workflowPreset.textContent = "";
  for (const item of workflowPresets) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    elements.workflowPreset.append(option);
  }
  elements.workflowPreset.value = preset.id;

  elements.workflowSummary.textContent = "";
  updateInputActionButtons();
  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = state.importedWorkflow
    ? "Imported workflow JSON is active. The preset selector remains available for replacing it."
    : preset.summary;
  elements.workflowSummary.append(summary);

  const activeWorkflow = getActiveWorkflowDefinition();
  pruneExpandedWorkflowSteps(activeWorkflow);
  const selectedStep = getSelectedWorkflowStep(activeWorkflow);
  const lastOutput = getWorkflowLastOutput(activeWorkflow);
  const current = document.createElement("div");
  current.className = "workflow-current-stream";
  const currentLabel = document.createElement("span");
  currentLabel.textContent = "Current output";
  const currentValue = document.createElement("strong");
  currentValue.textContent = describeStream(lastOutput);
  current.append(currentLabel, currentValue);
  elements.workflowSummary.append(current);

  const list = document.createElement("ol");
  list.className = "workflow-step-list";
  const steps = activeWorkflow.steps ?? [];
  steps.forEach((step, index) => {
    const flow = getWorkflowStepFlow(activeWorkflow, index);
    const isExpanded = state.expandedWorkflowStepIds.has(step.id);
    const item = document.createElement("li");
    item.className = "workflow-step-item";
    item.dataset.stepId = step.id;
    item.dataset.expanded = String(isExpanded);
    const card = document.createElement("div");
    card.className = "workflow-step-card";
    card.dataset.expanded = String(isExpanded);
    card.dataset.selected = String(step.id === selectedStep?.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "workflow-step-toggle";
    button.setAttribute("aria-expanded", String(isExpanded));
    button.title = `${isExpanded ? "Collapse" : "Expand"} step ${step.id}`;
    button.addEventListener("click", () => {
      state.selectedWorkflowStepId = step.id;
      if (state.expandedWorkflowStepIds.has(step.id)) {
        state.expandedWorkflowStepIds.delete(step.id);
      } else {
        state.expandedWorkflowStepIds.add(step.id);
      }
      renderWorkflowView();
    });
    const title = document.createElement("strong");
    title.textContent = getWorkflowStepDisplayName(step);
    const detail = document.createElement("span");
    detail.className = "workflow-step-detail";
    detail.textContent = describeWorkflowStep(step, activeWorkflow);
    const stepFlow = document.createElement("small");
    if (step.type === "input") {
      stepFlow.textContent = "Uses Workflow Input.";
    } else {
      const inputDescription = step.input
        ? getWorkflowStepInputDescription(activeWorkflow, step)
        : describeStream(flow.input);
      stepFlow.textContent = `Gets ${inputDescription}; produces ${describeWorkflowStreamChoice(flow.output)}`;
    }

    const actions = document.createElement("div");
    actions.className = "workflow-step-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "icon-button workflow-delete-step";
    deleteButton.setAttribute("aria-label", `Remove step ${step.id}`);
    deleteButton.disabled = step.type === "input";
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v5"></path><path d="M14 11v5"></path></svg>`;
    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      removeWorkflowStep(step.id);
    });
    actions.append(deleteButton);
    button.append(title, detail, stepFlow);
    card.append(button, actions);
    item.append(card);
    if (isExpanded) {
      const editor = document.createElement("div");
      editor.className = "workflow-step-editor";
      renderWorkflowStepEditor(editor, step);
      item.append(editor);
    }
    list.append(item);
  });
  elements.workflowSummary.append(list);
  renderWorkflowBuilderControls();
}

function getCompatibleToolsForAppend(workflow) {
  const lastOutput = getWorkflowOutputAtInsertionPoint(workflow);
  if (!lastOutput) {
    return tools;
  }
  if (lastOutput.kind === "collection") {
    return [];
  }

  return tools.filter((tool) =>
    (tool.metadata.workflow?.inputs ?? []).some((input) => {
      if (input.kind !== lastOutput.kind) {
        return false;
      }
      if (input.alphabet && lastOutput.alphabet && input.alphabet !== lastOutput.alphabet) {
        return false;
      }
      return true;
    })
  );
}

function getSelectableStreamsForAppend(workflow) {
  const insertionIndex = getWorkflowInsertionIndex(workflow);
  const previousSteps = (workflow.steps ?? []).slice(0, insertionIndex);
  const lastToolStep = [...previousSteps].reverse().find((step) => step.type === "tool" || step.type === "map");
  const tool = getToolById(lastToolStep?.toolId);
  const outputs = getUserSelectableWorkflowOutputs(tool);
  return outputs.length > 0 ? outputs : [{ id: "primary", kind: "text", mediaType: "text/plain" }];
}

function getWorkflowBuilderGuidance(workflow, stepType) {
  const lastOutput = getWorkflowOutputAtInsertionPoint(workflow);
  const current = describeStream(lastOutput);
  if (!lastOutput) {
    return "Choose the first workflow action.";
  }
  return `Add the next compatible action. Current output: ${current}.`;
}

const workflowStepTypeLabels = {
  tool: "Run a compatible tool",
  "select-stream": "Choose a different result",
  split: "Split FASTA records",
  filter: "Filter rows or records",
  sort: "Sort rows or records",
  gather: "Gather mapped results",
  map: "Run tool on each record"
};

const displayFormatWorkflowOptionIds = new Set(["outputFormat", "formatFasta", "lineWidth"]);

function makeWorkflowCollectionDescription(output, fallback = "result") {
  if (!output) {
    return fallback;
  }
  return describeStream(output);
}

function hasSelectableStreamsForAppend(workflow) {
  return getSelectableStreamsForAppend(workflow).length > 1;
}

function getCompatibleStepTypesForAppend(workflow) {
  const lastOutput = getWorkflowOutputAtInsertionPoint(workflow);
  const stepTypes = [];

  if (getCompatibleToolsForAppend(workflow).length > 0) {
    stepTypes.push("tool");
  }

  if (!lastOutput || lastOutput.kind === "text" || lastOutput.kind === "sequence-records") {
    stepTypes.push("split");
  }

  if (lastOutput?.kind === "collection") {
    stepTypes.push("map", "filter", "sort", "gather");
  } else if (lastOutput?.kind === "sequence-records" || lastOutput?.kind === "table") {
    stepTypes.push("filter", "sort");
  }

  if (hasSelectableStreamsForAppend(workflow)) {
    stepTypes.push("select-stream");
  }

  return [...new Set(stepTypes)];
}

function getUnavailableStepTypeReasons(workflow, availableStepTypes) {
  const lastOutput = getWorkflowOutputAtInsertionPoint(workflow);
  const available = new Set(availableStepTypes);
  const reasons = [];

  if (!available.has("tool")) {
    reasons.push(
      lastOutput?.kind === "collection"
        ? "Run a compatible tool needs a single result; use Run tool on each record for a set."
        : "Run a compatible tool is unavailable because no tool accepts the current output."
    );
  }

  if (!available.has("split")) {
    reasons.push("Split FASTA records needs text or sequence records.");
  }

  if (!available.has("map")) {
    reasons.push("Run tool on each record needs a set from Split FASTA records.");
  }

  if (!available.has("filter") && !available.has("sort")) {
    reasons.push("Filter and Sort need rows, sequence records, or a set.");
  }

  if (!available.has("gather")) {
    reasons.push("Gather mapped results needs a set.");
  }

  if (!available.has("select-stream")) {
    reasons.push("Choose a different result needs another usable output from the latest tool.");
  }

  return reasons;
}

function renderWorkflowStepTypeChoices(workflow) {
  const previousValue = elements.workflowAddStepType.value;
  const stepTypes = getCompatibleStepTypesForAppend(workflow);
  elements.workflowAddStepType.textContent = "";

  for (const stepType of stepTypes) {
    const option = document.createElement("option");
    option.value = stepType;
    option.textContent = workflowStepTypeLabels[stepType] ?? stepType;
    elements.workflowAddStepType.append(option);
  }

  if (stepTypes.includes(previousValue)) {
    elements.workflowAddStepType.value = previousValue;
  } else if (stepTypes.length > 0) {
    elements.workflowAddStepType.value = stepTypes[0];
  }

  elements.workflowOpenAddStep.disabled = stepTypes.length === 0;

  return stepTypes;
}

function renderWorkflowBuilderGuidance(workflow, stepType, availableStepTypes) {
  elements.workflowBuilderGuidance.textContent = "";
  const guidance = document.createElement("p");
  guidance.textContent = getWorkflowBuilderGuidance(workflow, stepType);
  elements.workflowBuilderGuidance.append(guidance);

  const hiddenReasons = getUnavailableStepTypeReasons(workflow, availableStepTypes);
  if (hiddenReasons.length === 0) {
    return;
  }

  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Why are some actions unavailable?";
  const list = document.createElement("ul");
  for (const reason of hiddenReasons) {
    const item = document.createElement("li");
    item.textContent = reason;
    list.append(item);
  }
  details.append(summary, list);
  elements.workflowBuilderGuidance.append(details);
}

function renderWorkflowBuilderControls() {
  const workflow = workflowFromJsonOrActive();
  const availableStepTypes = renderWorkflowStepTypeChoices(workflow);
  elements.workflowAddStepDraft.hidden = !state.workflowAddStepOpen;
  elements.workflowOpenAddStep.hidden = state.workflowAddStepOpen;
  elements.workflowOpenAddStep.setAttribute("aria-expanded", String(state.workflowAddStepOpen));
  if (!state.workflowAddStepOpen) {
    elements.workflowBuilderGuidance.textContent = "";
    return;
  }
  const stepType = elements.workflowAddStepType.value;
  const showTool = stepType === "tool" || stepType === "map";
  const showStream = stepType === "select-stream" || stepType === "map";
  const showFilter = stepType === "filter";
  const showSort = stepType === "sort";
  const showGather = stepType === "gather";

  elements.workflowAddToolRow.hidden = !showTool;
  elements.workflowAddStreamRow.hidden = !showStream;
  elements.workflowAddFilterFieldRow.hidden = !showFilter;
  elements.workflowAddFilterOperatorRow.hidden = !showFilter;
  elements.workflowAddFilterValueRow.hidden = !showFilter;
  elements.workflowAddSortFieldRow.hidden = !showSort;
  elements.workflowAddSortDirectionRow.hidden = !showSort;
  elements.workflowAddGatherRow.hidden = !showGather;
  renderWorkflowBuilderGuidance(workflow, stepType, availableStepTypes);

  const fieldChoices = getWorkflowFieldChoicesAtInsertionPoint(workflow);
  if (showFilter) {
    replaceWorkflowFieldControl(elements.workflowAddFilterFieldRow, "workflowAddFilterField", fieldChoices, "length");
  }
  if (showSort) {
    replaceWorkflowFieldControl(elements.workflowAddSortFieldRow, "workflowAddSortField", fieldChoices, "length");
  }

  if (showTool) {
    const previousValue = elements.workflowAddTool.value;
    const toolChoices = stepType === "tool" ? getCompatibleToolsForAppend(workflow) : tools;
    elements.workflowAddTool.textContent = "";
    for (const tool of toolChoices) {
      const option = document.createElement("option");
      option.value = tool.metadata.id;
      option.textContent = tool.metadata.name;
      elements.workflowAddTool.append(option);
    }
    if (toolChoices.some((tool) => tool.metadata.id === previousValue)) {
      elements.workflowAddTool.value = previousValue;
    }
  }

  if (showStream) {
    const previousValue = elements.workflowAddStream.value;
    const streams =
      stepType === "map"
        ? getUserSelectableWorkflowOutputs(getToolById(elements.workflowAddTool.value))
        : getSelectableStreamsForAppend(workflow);
    elements.workflowAddStream.textContent = "";
    for (const stream of streams) {
      const option = document.createElement("option");
      option.value = stream.id;
      option.textContent = describeWorkflowStreamChoice(stream);
      elements.workflowAddStream.append(option);
    }
    if (streams.some((stream) => stream.id === previousValue)) {
      elements.workflowAddStream.value = previousValue;
    }
  }
}

function getStreamsBeforeStep(workflow, stepId) {
  const steps = workflow.steps ?? [];
  const selectedIndex = steps.findIndex((step) => step.id === stepId);
  const beforeSteps = selectedIndex >= 0 ? steps.slice(0, selectedIndex) : steps;
  const lastToolStep = [...beforeSteps].reverse().find((step) => step.type === "tool" || step.type === "map");
  const tool = getToolById(lastToolStep?.toolId);
  const outputs = getUserSelectableWorkflowOutputs(tool);
  return outputs.length > 0 ? outputs : [{ id: "primary", kind: "text", mediaType: "text/plain" }];
}

function stepFeedsExplicitWorkflowInput(workflow, stepId) {
  return (workflow.steps ?? []).some((item) => item.input?.from === stepId);
}

function shouldShowWorkflowOption(workflow, step, option) {
  const selectedStream = step.selectStream ?? "primary";

  if (!displayFormatWorkflowOptionIds.has(option.id)) {
    return true;
  }

  if (option.id === "outputFormat") {
    if (selectedStream !== "primary") {
      return false;
    }
    return !stepFeedsExplicitWorkflowInput(workflow, step.id);
  }

  return selectedStream === "primary" || selectedStream === "fasta";
}

function updateSelectedWorkflowStep(mutator, message) {
  const workflow = workflowFromJsonOrActive();
  const step = getSelectedWorkflowStep(workflow);
  if (!step) {
    return;
  }

  mutator(step, workflow);
  setWorkflowDefinition(workflow);
  clearWorkflowOutput();
  renderWorkflowView();
  addWorkflowMessage(message);
}

function makeTextInput(labelText, value, onChange) {
  const label = document.createElement("label");
  label.className = "number-row";
  label.append(labelText);
  const input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.addEventListener("change", () => onChange(input.value));
  label.append(input);
  return label;
}

function makeSelectInput(labelText, value, choices, onChange) {
  const label = document.createElement("label");
  label.className = "select-row";
  label.textContent = labelText;
  const select = document.createElement("select");
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.value;
    option.textContent = choice.label;
    select.append(option);
  }
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  label.append(select);
  return label;
}

function makeFieldInput(labelText, value, choices, fallback, onChange) {
  if (choices.length > 0) {
    const normalizedChoices = choices.some((choice) => choice.value === value) || !value
      ? choices
      : [{ value, label: `Unknown field (${value})` }, ...choices];
    const selectValue = normalizedChoices.some((choice) => choice.value === value)
      ? value
      : normalizedChoices.some((choice) => choice.value === fallback)
        ? fallback
        : normalizedChoices[0].value;
    return makeSelectInput(labelText, selectValue, normalizedChoices, onChange);
  }
  return makeTextInput(labelText, value ?? fallback, onChange);
}

function renderWorkflowOperationEditor(workflow, step, container) {
  const grid = document.createElement("div");
  grid.className = "workflow-option-grid";

  if (step.type === "split") {
    const note = document.createElement("p");
    note.className = "workflow-builder-guidance";
    note.textContent = "Split has no settings yet. It turns incoming sequence text into one record per FASTA entry.";
    container.append(note);
    return;
  }

  if (step.type === "filter") {
    const criteria = step.criteria ?? {};
    const fieldChoices = getWorkflowFieldChoicesBeforeStep(workflow, step);
    grid.append(
      makeFieldInput("Field", criteria.field ?? "length", fieldChoices, "length", (value) =>
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.criteria = { ...(selectedStep.criteria ?? {}), field: value || "length" };
          },
          `Updated ${step.id} filter field.`
        )
      )
    );
    grid.append(
      makeSelectInput(
        "Operator",
        criteria.operator ?? ">=",
        [
          { value: ">=", label: ">=" },
          { value: ">", label: ">" },
          { value: "<=", label: "<=" },
          { value: "<", label: "<" },
          { value: "==", label: "==" },
          { value: "!=", label: "!=" },
          { value: "contains", label: "contains" },
          { value: "matches", label: "matches" }
        ],
        (value) =>
          updateSelectedWorkflowStep(
            (selectedStep) => {
              selectedStep.criteria = { ...(selectedStep.criteria ?? {}), operator: value };
            },
            `Updated ${step.id} filter operator.`
          )
      )
    );
    grid.append(
      makeTextInput("Value", criteria.value ?? "", (value) =>
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.criteria = { ...(selectedStep.criteria ?? {}), value };
          },
          `Updated ${step.id} filter value.`
        )
      )
    );
  }

  if (step.type === "sort") {
    const criteria = step.criteria ?? {};
    const fieldChoices = getWorkflowFieldChoicesBeforeStep(workflow, step);
    grid.append(
      makeFieldInput("Sort field", criteria.field ?? "length", fieldChoices, "length", (value) =>
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.criteria = { ...(selectedStep.criteria ?? {}), field: value || "length" };
          },
          `Updated ${step.id} sort field.`
        )
      )
    );
    grid.append(
      makeSelectInput(
        "Direction",
        criteria.direction === "desc" ? "desc" : "asc",
        [
          { value: "asc", label: "Ascending" },
          { value: "desc", label: "Descending" }
        ],
        (value) =>
          updateSelectedWorkflowStep(
            (selectedStep) => {
              selectedStep.criteria = { ...(selectedStep.criteria ?? {}), direction: value === "desc" ? "desc" : "asc" };
            },
            `Updated ${step.id} sort direction.`
          )
      )
    );
  }

  if (step.type === "gather") {
    grid.append(
      makeSelectInput(
        "Gather as",
        step.as ?? "auto",
        [
          { value: "auto", label: "Auto" },
          { value: "sequence-records", label: "Sequence records" },
          { value: "table", label: "Table" },
          { value: "text", label: "Text" }
        ],
        (value) =>
          updateSelectedWorkflowStep(
            (selectedStep) => {
              selectedStep.as = value;
            },
            `Updated ${step.id} gather mode.`
          )
      )
    );
  }

  container.append(grid);
}

function renderWorkflowStepEditor(container, step) {
  const workflow = workflowFromJsonOrActive();
  const heading = document.createElement("h4");
  heading.textContent = `Step settings: ${getWorkflowStepDisplayName(step)}`;
  container.append(heading);

  const help = document.createElement("p");
  help.className = "summary";
  help.textContent = describeWorkflowStep(step, workflow);
  container.append(help);

  if (step.type === "input") {
    const note = document.createElement("p");
    note.className = "workflow-builder-guidance";
    note.textContent = "The input step uses the Workflow Input box below when the workflow runs.";
    container.append(note);
    return;
  }

  if (step.type === "select-stream") {
    const grid = document.createElement("div");
    grid.className = "workflow-option-grid";
    const label = document.createElement("label");
    label.className = "select-row";
    label.textContent = "Result to use";
    const select = document.createElement("select");
    select.name = "stream";
    const visibleStreams = getStreamsBeforeStep(workflow, step.id);
    const stepIndex = (workflow.steps ?? []).findIndex((item) => item.id === step.id);
    const previousToolStep = [...((workflow.steps ?? []).slice(0, stepIndex))].reverse().find((item) => item.type === "tool" || item.type === "map");
    const currentTool = getToolById(previousToolStep?.toolId);
    const currentStream = (currentTool?.metadata.workflow?.outputs ?? []).find((stream) => stream.id === step.stream);
    const streams = currentStream && !visibleStreams.some((stream) => stream.id === currentStream.id)
      ? [currentStream, ...visibleStreams]
      : visibleStreams;
    for (const stream of streams) {
      const option = document.createElement("option");
      option.value = stream.id;
      option.textContent = describeWorkflowStreamChoice(stream);
      select.append(option);
    }
    select.value = step.stream ?? streams[0]?.id ?? "primary";
    select.addEventListener("change", () => {
      updateSelectedWorkflowStep(
        (selectedStep) => {
          selectedStep.stream = select.value;
        },
        `Updated ${step.id} selected result.`
      );
    });
    label.append(select);
    grid.append(label);
    container.append(grid);
    return;
  }

  if (step.type === "filter" || step.type === "sort" || step.type === "gather" || step.type === "split") {
    renderWorkflowOperationEditor(workflow, step, container);
    return;
  }

  const tool = getToolById(step.toolId);
  const editableOptions = flattenOptions(tool?.metadata.options ?? []).filter((option) =>
    (
      option.type === "radio" ||
      option.type === "select" ||
      option.type === "checkbox" ||
      option.type === "number" ||
      option.type === "text"
    ) &&
    shouldShowWorkflowOption(workflow, step, option)
  );

  const grid = document.createElement("div");
  grid.className = "workflow-option-grid";
  step.options = normalizeDependentOptionValues(editableOptions, {
    ...makeDefaultOptions(tool),
    ...(step.options ?? {})
  });

  if (step.input) {
    const note = document.createElement("p");
    note.className = "workflow-builder-guidance";
    note.textContent = `Input: ${getWorkflowStepInputDescription(workflow, step)}.`;
    container.append(note);
  }

  if (step.type === "map" || step.type === "tool") {
    const outputs = getUserSelectableWorkflowOutputs(tool);
    const selectedStream = outputs.some((stream) => stream.id === (step.selectStream ?? "primary"))
      ? (step.selectStream ?? "primary")
      : (tool?.metadata.workflow?.outputs ?? []).some((stream) => stream.id === (step.selectStream ?? "primary"))
        ? (step.selectStream ?? "primary")
        : getRecommendedWorkflowOutputId(tool);
    const label = document.createElement("label");
    label.className = "select-row";
    label.textContent = step.type === "map" ? "Keep from each record" : "Result to pass on";
    const select = document.createElement("select");
    select.name = "selectStream";
    const selectOutputs = outputs.some((stream) => stream.id === selectedStream)
      ? outputs
      : [
          ...((tool?.metadata.workflow?.outputs ?? []).filter((stream) => stream.id === selectedStream)),
          ...outputs
        ];
    for (const stream of selectOutputs) {
      const option = document.createElement("option");
      option.value = stream.id;
      option.textContent = describeWorkflowStreamChoice(stream);
      select.append(option);
    }
    select.value = selectedStream;
    select.addEventListener("change", () => {
      updateSelectedWorkflowStep(
        (selectedStep) => {
          selectedStep.selectStream = select.value;
        },
        `Updated ${step.id} result.`
      );
    });
    label.append(select);
    grid.append(label);
  }

  for (const option of editableOptions) {
    if (option.type === "radio" || option.type === "select") {
      const label = document.createElement("label");
      label.className = "select-row";
      label.append(createOptionLabelContent(option));
      const select = document.createElement("select");
      select.name = option.id;
      populateDependentSelect(select, option, step.options, step.options[option.id] ?? option.defaultValue);
      select.addEventListener("change", () =>
        updateSelectedWorkflowStep(
          (selectedStep) => {
            const nextOptions = { ...(selectedStep.options ?? {}), [option.id]: select.value };
            selectedStep.options = normalizeDependentOptionValues(editableOptions, nextOptions);
          },
          `Updated ${step.id} option ${option.label}.`
        )
      );
      label.append(select);
      grid.append(label);
      continue;
    }

    if (option.type === "checkbox") {
      const label = document.createElement("label");
      label.className = "checkbox-row";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = option.id;
      input.checked = step.options[option.id] ?? option.defaultValue;
      input.addEventListener("change", () =>
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.options = { ...(selectedStep.options ?? {}), [option.id]: input.checked };
          },
          `Updated ${step.id} option ${option.label}.`
        )
      );
      label.append(input, createOptionLabelContent(option));
      grid.append(label);
      continue;
    }

    if (option.type === "number") {
      const label = document.createElement("label");
      label.className = "number-row";
      label.append(createOptionLabelContent(option));
      const input = document.createElement("input");
      input.type = "number";
      input.name = option.id;
      input.min = option.min;
      input.max = option.max;
      input.value = step.options[option.id] ?? option.defaultValue;
      input.addEventListener("change", () => {
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.options = {
              ...(selectedStep.options ?? {}),
              [option.id]: Number.parseInt(input.value, 10) || option.defaultValue
            };
          },
          `Updated ${step.id} option ${option.label}.`
        );
      });
      label.append(input);
      grid.append(label);
      continue;
    }

    if (option.type === "text") {
      const label = document.createElement("label");
      label.className = "text-row";
      label.append(createOptionLabelContent(option));
      const input = document.createElement("input");
      input.type = "text";
      input.name = option.id;
      input.value = step.options[option.id] ?? option.defaultValue ?? "";
      input.addEventListener("change", () => {
        updateSelectedWorkflowStep(
          (selectedStep) => {
            selectedStep.options = { ...(selectedStep.options ?? {}), [option.id]: input.value };
          },
          `Updated ${step.id} option ${option.label}.`
        );
      });
      label.append(input);
      grid.append(label);
    }
  }

  container.append(grid);
}

function clearWorkflowOutput() {
  elements.workflowOutput.value = "";
  elements.workflowOutput.dataset.rawOutput = "";
  elements.workflowOutput.dataset.tableTsv = "";
  elements.workflowOutputHighlight.hidden = true;
  elements.workflowOutputHighlight.textContent = "";
  elements.workflowOutput.hidden = false;
  clearWorkflowTableOutput();
  elements.workflowOutput.dataset.filename = "sms3-workflow-output.txt";
  elements.workflowOutput.dataset.mimeType = "text/plain";
  elements.workflowOutputSummary.textContent = "";
  elements.workflowMessages.textContent = "";
  elements.workflowStepInspector.textContent = "";
  setOutputFormatLabel("workflow", null);
  elements.workflowOutputActions.hidden = true;
  renderOutputSearch("workflow");
}

function clearWorkflowJson() {
  elements.workflowJson.value = "";
  state.importedWorkflow = null;
  state.selectedWorkflowStepId = null;
  state.expandedWorkflowStepIds = new Set();
}

function addMessage(text, className = "info") {
  const message = document.createElement("div");
  message.className = `message ${className}`;
  message.textContent = text;
  elements.messages.append(message);
}

function addWorkflowMessage(text, className = "info") {
  const message = document.createElement("div");
  message.className = `message ${className}`;
  message.textContent = text;
  elements.workflowMessages.append(message);
}

function setWorkflowRunning(isRunning) {
  elements.runWorkflow.disabled = isRunning;
  elements.cancelWorkflow.hidden = !isRunning;
  elements.cancelWorkflow.disabled = !isRunning;
}

function setToolRunning(isRunning) {
  elements.runTool.disabled = isRunning;
  elements.cancelTool.hidden = !isRunning;
  elements.cancelTool.disabled = !isRunning;
}

function cancelSelectedWorkflowRun() {
  if (!state.workflowRun) {
    return;
  }
  state.workflowRun.abortController.abort();
  state.workflowRun.cancelActiveTool?.();
  elements.cancelWorkflow.disabled = true;
  elements.workflowMessages.textContent = "";
  addWorkflowMessage("Cancelling workflow run...");
}

function cancelSelectedToolRun() {
  if (!state.toolRun) {
    return;
  }
  state.toolRun.abortController.abort();
  state.toolRun.cancelActiveTool?.();
  elements.cancelTool.disabled = true;
  elements.messages.textContent = "";
  addMessage(`Cancelling ${state.selectedTool.metadata.name}...`);
}

function getToolRunStatus(tool) {
  return `Running ${tool?.metadata.name ?? "tool"}...`;
}

function getWorkflowStepRunStatus(step, index, total) {
  return `Running step ${index + 1} of ${total}: ${getWorkflowStepDisplayName(step)}.`;
}

function describeWorkerProgress(tool, message = {}) {
  if (message.phase === "parsing-input") {
    return `Parsing input for ${tool.metadata.name}...`;
  }
  if (message.phase === "loading-reference-data") {
    return `Loading reference data for ${tool.metadata.name}...`;
  }
  if (message.phase === "scanning" && message.totalRecords) {
    return `Scanning ${message.recordsProcessed.toLocaleString()} of ${message.totalRecords.toLocaleString()} records with ${tool.metadata.name}...`;
  }
  if (message.phase === "scanning-frames" && message.totalFrames) {
    return `Scanning ${message.framesProcessed.toLocaleString()} of ${message.totalFrames.toLocaleString()} frames with ${tool.metadata.name}...`;
  }
  if (message.phase === "scanning-records" && message.totalRecords) {
    return `Scanning ${message.recordsProcessed.toLocaleString()} of ${message.totalRecords.toLocaleString()} records with ${tool.metadata.name}...`;
  }
  if (message.phase === "building-windows" && message.totalRecords) {
    return `Building windows for ${message.recordsProcessed.toLocaleString()} of ${message.totalRecords.toLocaleString()} records with ${tool.metadata.name}...`;
  }
  if (message.phase === "building-output") {
    return `Building output for ${tool.metadata.name}...`;
  }
  if (message.phase === "started") {
    return getToolRunStatus(tool);
  }
  return "";
}

function showWorkflowWorkerProgress(tool, context, message) {
  const detail = describeWorkerProgress(tool, message);
  if (!detail) {
    return;
  }
  elements.workflowMessages.textContent = "";
  addWorkflowMessage(
    `Step ${context.stepIndex + 1} of ${context.totalSteps}: ${detail}`
  );
}

function makeRunAbortError(message = "Tool run was cancelled.") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function loadWorkflowExample() {
  elements.workflowInput.value = getSelectedWorkflowPreset().example;
  clearWorkflowOutput();
  updateInputActionButtons();
}

function clearWorkflowInput() {
  elements.workflowInput.value = "";
  clearWorkflowOutput();
  updateInputActionButtons();
}

function exportSelectedWorkflowJson() {
  state.importedWorkflow = null;
  state.selectedWorkflowStepId = null;
  state.expandedWorkflowStepIds = new Set();
  const workflow = cloneWorkflow(getSelectedWorkflowPreset().workflow);
  const inputStep = workflow.steps.find((step) => step.type === "input");
  if (inputStep) {
    inputStep.text = "";
  }
  elements.workflowJson.value = JSON.stringify(workflow, null, 2);
  renderWorkflowView();
  clearWorkflowOutput();
  addWorkflowMessage("Exported preset workflow JSON.");
}

function parseWorkflowJson() {
  try {
    return { workflow: JSON.parse(elements.workflowJson.value), errors: [] };
  } catch (error) {
    return { workflow: null, errors: [`Workflow JSON could not be parsed: ${error.message}`] };
  }
}

function importWorkflowJson() {
  const parsed = parseWorkflowJson();
  const errors = parsed.errors.length > 0 ? parsed.errors : validateWorkflowDefinition(parsed.workflow, { tools });
  elements.workflowMessages.textContent = "";

  if (errors.length > 0) {
    state.importedWorkflow = null;
    renderWorkflowView();
    clearWorkflowOutput();
    errors.forEach((error) => addWorkflowMessage(error, "warning"));
    return false;
  }

  state.importedWorkflow = parsed.workflow;
  state.selectedWorkflowStepId = null;
  state.expandedWorkflowStepIds = new Set();
  renderWorkflowView();
  clearWorkflowOutput();
  addWorkflowMessage("Imported workflow JSON.");
  return true;
}

function validateWorkflowJsonFromEditor() {
  const parsed = parseWorkflowJson();
  const errors = parsed.errors.length > 0 ? parsed.errors : validateWorkflowDefinition(parsed.workflow, { tools });
  elements.workflowMessages.textContent = "";

  if (errors.length > 0) {
    errors.forEach((error) => addWorkflowMessage(error, "warning"));
    return false;
  }

  addWorkflowMessage("Workflow JSON is valid.");
  return true;
}

function summarizeWorkflowStepValue(value) {
  if (!value) {
    return "no output";
  }
  if (value.kind === "text") {
    return describeStream(value);
  }
  if (value.kind === "table") {
    return `table rows (${pluralize(value.rows?.length ?? 0, "row")})`;
  }
  if (value.kind === "sequence-records") {
    return `${value.alphabet === "protein" ? "protein" : "DNA/RNA"} sequences (${pluralize(value.records?.length ?? 0, "record")})`;
  }
  if (value.kind === "orf-records") {
    return `ORFs (${pluralize(value.records?.length ?? 0, "record")})`;
  }
  if (value.kind === "collection") {
    return `set (${pluralize(value.items?.length ?? 0, "item")})`;
  }
  return value.kind ?? "unknown output";
}

function renderWorkflowStepInspector(result, workflowDefinition = getActiveWorkflowDefinition()) {
  elements.workflowStepInspector.textContent = "";

  if (!result?.steps?.length) {
    return;
  }

  const details = document.createElement("details");
  details.className = "workflow-run-details";
  const summary = document.createElement("summary");
  summary.textContent = "Step outputs";
  details.append(summary);

  for (const [index, stepResult] of result.steps.entries()) {
    const item = document.createElement("div");
    item.className = "workflow-step-result";
    const stepLabel = document.createElement("span");
    stepLabel.className = "workflow-step-result-title";
    stepLabel.textContent = `Step ${index + 1}: ${describeWorkflowStep(stepResult.step, workflowDefinition)}`;
    const stepOutput = document.createElement("span");
    stepOutput.className = "workflow-step-result-value";
    stepOutput.textContent = `Produced: ${summarizeWorkflowStepValue(stepResult.value)}`;
    item.append(stepLabel, stepOutput);

    if (stepResult.warnings.length > 0) {
      const warnings = document.createElement("ul");
      warnings.className = "reference-notes";
      for (const warning of stepResult.warnings) {
        const warningItem = document.createElement("li");
        warningItem.textContent = warning.message;
        warnings.append(warningItem);
      }
      item.append(warnings);
    }

    details.append(item);
  }

  elements.workflowStepInspector.append(details);
}

function appendWorkflowStep() {
  const workflow = getEditableWorkflow();
  const stepType = elements.workflowAddStepType.value;
  const insertionIndex = getWorkflowInsertionIndex(workflow);
  let step;

  if (stepType === "tool") {
    const tool = getToolById(elements.workflowAddTool.value) ?? tools[0];
    step = {
      id: makeStepId(workflow, tool.metadata.id),
      type: "tool",
      toolId: tool.metadata.id,
      selectStream: getRecommendedWorkflowOutputId(tool),
      options: makeDefaultOptions(tool)
    };
  } else if (stepType === "map") {
    const tool = getToolById(elements.workflowAddTool.value) ?? tools[0];
    step = {
      id: makeStepId(workflow, `map-${tool.metadata.id}`),
      type: "map",
      toolId: tool.metadata.id,
      selectStream: elements.workflowAddStream.value || getRecommendedWorkflowOutputId(tool),
      options: makeDefaultOptions(tool)
    };
  } else if (stepType === "select-stream") {
    step = {
      id: makeStepId(workflow, `select-${elements.workflowAddStream.value || "stream"}`),
      type: "select-stream",
      stream: elements.workflowAddStream.value || "primary"
    };
  } else if (stepType === "split") {
    step = {
      id: makeStepId(workflow, "split"),
      type: "split"
    };
  } else if (stepType === "filter") {
    step = {
      id: makeStepId(workflow, "filter"),
      type: "filter",
      criteria: {
        field: elements.workflowAddFilterField.value || "length",
        operator: elements.workflowAddFilterOperator.value || ">=",
        value: elements.workflowAddFilterValue.value || ""
      }
    };
  } else if (stepType === "sort") {
    step = {
      id: makeStepId(workflow, "sort"),
      type: "sort",
      criteria: {
        field: elements.workflowAddSortField.value || "title",
        direction: elements.workflowAddSortDirection.value === "desc" ? "desc" : "asc"
      }
    };
  } else if (stepType === "gather") {
    step = {
      id: makeStepId(workflow, "gather"),
      type: "gather",
      as: elements.workflowAddGatherAs.value || "auto"
    };
  }

  if (!step) {
    return;
  }

  workflow.steps.splice(insertionIndex, 0, step);
  state.selectedWorkflowStepId = step.id;
  state.expandedWorkflowStepIds.add(step.id);
  state.workflowAddStepOpen = false;
  setWorkflowDefinition(workflow);
  renderWorkflowView();
  clearWorkflowOutput();
  addWorkflowMessage(`Inserted ${describeWorkflowStep(step, workflow)}.`);
}

function openWorkflowAddStepDraft() {
  state.workflowAddStepOpen = true;
  renderWorkflowView();
}

function cancelWorkflowAddStepDraft() {
  state.workflowAddStepOpen = false;
  renderWorkflowView();
}

function removeWorkflowStep(stepId = state.selectedWorkflowStepId) {
  const workflow = getEditableWorkflow();
  const steps = workflow.steps ?? [];
  const targetIndex = steps.findIndex((step) => step.id === stepId);
  const target = steps[targetIndex];

  if (!target) {
    elements.workflowMessages.textContent = "";
    addWorkflowMessage("No workflow step to remove.", "warning");
    return;
  }

  if (target.type === "input") {
    elements.workflowMessages.textContent = "";
    addWorkflowMessage("The input step cannot be removed.", "warning");
    return;
  }

  const [removed] = steps.splice(targetIndex, 1);
  state.expandedWorkflowStepIds.delete(removed.id);
  state.selectedWorkflowStepId = steps[Math.min(targetIndex, steps.length - 1)]?.id ?? null;
  setWorkflowDefinition(workflow);
  renderWorkflowView();
  clearWorkflowOutput();
  addWorkflowMessage(`Removed step ${removed.id ?? removed.type}.`);
}

async function runAppTool(tool, input, options = {}, context = {}) {
  const { onProgress, signal } = context;
  if (tool.metadata.runInWorker) {
    const run = toolWorkerClient.runTool({
      toolId: tool.metadata.id,
      input,
      options,
      onProgress: (message) => {
        onProgress?.(message);
        if (state.workflowRun && context.step) {
          showWorkflowWorkerProgress(tool, context, message);
        }
      }
    });
    const abortActiveRun = () => run.cancel();
    signal?.addEventListener("abort", abortActiveRun, { once: true });
    if (state.workflowRun && signal === state.workflowRun.abortController.signal) {
      state.workflowRun.cancelActiveTool = run.cancel;
    }
    if (state.toolRun && signal === state.toolRun.abortController.signal) {
      state.toolRun.cancelActiveTool = run.cancel;
    }
    try {
      return await run.promise;
    } finally {
      signal?.removeEventListener("abort", abortActiveRun);
      if (state.workflowRun?.cancelActiveTool === run.cancel) {
        state.workflowRun.cancelActiveTool = null;
      }
      if (state.toolRun?.cancelActiveTool === run.cancel) {
        state.toolRun.cancelActiveTool = null;
      }
    }
  }

  if (signal?.aborted) {
    throw makeRunAbortError();
  }
  return tool.run(input, options);
}

async function runSelectedWorkflow() {
  if (state.workflowRun) {
    return;
  }
  const abortController = new AbortController();
  state.workflowRun = {
    abortController,
    cancelActiveTool: null
  };
  setWorkflowRunning(true);
  try {
    if (elements.workflowJson.value.trim()) {
      const parsed = parseWorkflowJson();
      const errors = parsed.errors.length > 0 ? parsed.errors : validateWorkflowDefinition(parsed.workflow, { tools });
      if (errors.length > 0) {
        elements.workflowMessages.textContent = "";
        errors.forEach((error) => addWorkflowMessage(error, "warning"));
        return;
      }
      state.importedWorkflow = parsed.workflow;
      renderWorkflowView();
    }

    const workflow = makeRunnableWorkflow();
    clearWorkflowOutput();
    addWorkflowMessage("Running workflow...");
    const result = await runWorkflow(workflow, {
      tools,
      runTool: runAppTool,
      signal: abortController.signal,
      onStepStart: (step, index, total) => {
        elements.workflowMessages.textContent = "";
        addWorkflowMessage(getWorkflowStepRunStatus(step, index, total));
      }
    });
    const formatted = formatWorkflowValue(result.value);
    elements.workflowOutput.value = formatted.text;
    elements.workflowOutput.dataset.rawOutput = formatted.rawText;
    elements.workflowOutput.dataset.filename = formatted.filename ?? "sms3-workflow-output.txt";
    elements.workflowOutput.dataset.mimeType = formatted.mimeType ?? "text/plain";
    elements.workflowOutputSummary.textContent = formatted.summary;
    setOutputFormatLabel("workflow", formatted.outputLabel);
    renderWorkflowTableOutput(formatted.tableStream, Boolean(formatted.tableStream));
    updateOutputActions("workflow", {
      hidden: Boolean(formatted.tableStream),
      mimeType: formatted.mimeType,
      label: formatted.outputLabel
    });
    elements.workflowMessages.textContent = "";
    renderWorkflowStepInspector(result, workflow);
    addWorkflowMessage(`Ran ${pluralize(result.steps.length, "step")}.`);
    appendOutputDetails(elements.workflowMessages, getWorkflowOutputDetails(result, formatted));
    appendWarningSummary(
      elements.workflowMessages,
      result.warnings,
      (warning) => `${warning.stepId}: ${warning.message}`
    );
    renderOutputSearch("workflow");
  } catch (error) {
    clearWorkflowOutput();
    if (error.name === "AbortError" || abortController.signal.aborted) {
      addWorkflowMessage("Workflow run cancelled.");
    } else {
      addWorkflowMessage(`Could not run workflow: ${error.message}`, "warning");
    }
  } finally {
    state.workflowRun = null;
    setWorkflowRunning(false);
  }
}

function displayToolResult(result) {
  const choices = getToolOutputChoices(result);
  renderToolOutputFormatSelect(choices, getSelectedToolOutputFormat(state.selectedTool));
  renderMessages(result);
}

async function runSelectedTool() {
  if (state.toolRun) {
    return;
  }
  const abortController = new AbortController();
  state.toolRun = {
    abortController,
    cancelActiveTool: null
  };
  setToolRunning(true);
  try {
    elements.messages.textContent = "";
    addMessage(getToolRunStatus(state.selectedTool));
    displayToolResult(
      await runAppTool(state.selectedTool, elements.sequenceInput.value, getOptions(), {
        signal: abortController.signal,
        onProgress: (message) => {
          const detail = describeWorkerProgress(state.selectedTool, message);
          if (!detail) {
            return;
          }
          elements.messages.textContent = "";
          addMessage(detail);
        }
      })
    );
  } catch (error) {
    elements.messages.textContent = "";
    elements.visualOutput.hidden = true;
    elements.visualOutput.textContent = "";
    if (error.name === "AbortError" || abortController.signal.aborted) {
      addMessage(`${state.selectedTool.metadata.name} run cancelled.`);
    } else {
      addMessage(`Could not run ${state.selectedTool.metadata.name}: ${error.message}`, "warning");
    }
  } finally {
    state.toolRun = null;
    setToolRunning(false);
  }
}

async function loadInputFile(file) {
  if (!file) {
    return;
  }

  if (file.size > 25 * 1024 * 1024) {
    addMessage(`${file.name}: file is larger than 25 MB.`, "warning");
    return;
  }

  try {
    elements.sequenceInput.value = await file.text();
    elements.toolOutput.value = "";
    elements.toolOutput.dataset.rawOutput = "";
    elements.toolOutputHighlight.hidden = true;
    elements.toolOutputHighlight.textContent = "";
    elements.toolOutput.hidden = false;
    elements.visualOutput.hidden = true;
    elements.visualOutput.textContent = "";
    elements.messages.textContent = "";
    renderOutputSearch("tool");
    updateInputActionButtons();
    addMessage(`Loaded ${file.name} (${file.size.toLocaleString()} bytes).`);
  } catch {
    addMessage(`${file.name}: could not read this file as text.`, "warning");
  }
}

function applyStoredTheme() {
  const theme = localStorage.getItem("sms3-theme");
  if (theme === "dark" || (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.dataset.theme = "dark";
  }
  elements.themeToggle.checked = document.documentElement.dataset.theme === "dark";
}

function applyStoredSidebarState() {
  const collapsed = localStorage.getItem("sms3-sidebar") === "collapsed";
  elements.appShell.classList.toggle("sidebar-collapsed", collapsed);
  elements.sidebarToggle.setAttribute("aria-pressed", String(collapsed));
  elements.sidebarToggle.setAttribute(
    "aria-label",
    collapsed ? "Show navigation" : "Hide navigation"
  );
}

elements.toolSearch.addEventListener("input", renderToolList);
elements.workflowLink.addEventListener("click", () => {
  selectWorkflow();
});
elements.feedbackLink.addEventListener("click", () => {
  selectFeedback();
});
elements.workflowPreset.addEventListener("change", () => {
  state.selectedWorkflow = elements.workflowPreset.value;
  clearWorkflowJson();
  renderWorkflowView();
  loadWorkflowExample();
  setRouteHash("workflow", state.selectedWorkflow);
});
elements.workflowLoadExample.addEventListener("click", loadWorkflowExample);
elements.workflowClearInput.addEventListener("click", clearWorkflowInput);
elements.workflowInput.addEventListener("input", updateInputActionButtons);
elements.workflowExportJson.addEventListener("click", exportSelectedWorkflowJson);
elements.workflowImportJson.addEventListener("click", importWorkflowJson);
elements.workflowValidateJson.addEventListener("click", validateWorkflowJsonFromEditor);
elements.workflowAddStepType.addEventListener("change", renderWorkflowBuilderControls);
elements.workflowAddTool.addEventListener("change", renderWorkflowBuilderControls);
elements.workflowOpenAddStep.addEventListener("click", openWorkflowAddStepDraft);
elements.workflowCancelAddStep.addEventListener("click", cancelWorkflowAddStepDraft);
elements.workflowAppendStep.addEventListener("click", appendWorkflowStep);
elements.runWorkflow.addEventListener("click", runSelectedWorkflow);
elements.cancelWorkflow.addEventListener("click", cancelSelectedWorkflowRun);
elements.workflowCopyOutput.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.workflowOutput.dataset.rawOutput || elements.workflowOutput.value);
});

elements.workflowDownloadOutput.addEventListener("click", () => {
  downloadText(
    elements.workflowOutput.dataset.rawOutput || elements.workflowOutput.value,
    elements.workflowOutput.dataset.filename || "sms3-workflow-output.txt",
    elements.workflowOutput.dataset.mimeType || "text/plain"
  );
});
elements.workflowOutputSearch.addEventListener("input", () => queueOutputSearch("workflow"));
elements.workflowOutputSearchPrevious.addEventListener("click", () => moveOutputSearch("workflow", -1));
elements.workflowOutputSearchNext.addEventListener("click", () => moveOutputSearch("workflow", 1));
elements.loadExample.addEventListener("click", loadSelectedToolExample);
elements.clearInput.addEventListener("click", clearToolInputOutput);
elements.sequenceInput.addEventListener("input", updateInputActionButtons);
elements.cancelTool.addEventListener("click", cancelSelectedToolRun);
elements.restoreDefaults.addEventListener("click", restoreCurrentToolDefaults);
elements.fileInput.addEventListener("change", async () => {
  await loadInputFile(elements.fileInput.files?.[0]);
  elements.fileInput.value = "";
});
elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("drag-over");
});
elements.dropZone.addEventListener("dragleave", () => {
  elements.dropZone.classList.remove("drag-over");
});
elements.dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("drag-over");
  await loadInputFile(event.dataTransfer.files?.[0]);
});
elements.runTool.addEventListener("click", runSelectedTool);
elements.outputFormatSelect.addEventListener("change", () => {
  const choice = state.currentToolOutputChoices.find((item) => item.format === elements.outputFormatSelect.value);
  if (choice) {
    applyToolOutputChoice(choice);
  }
});
elements.copyOutput.addEventListener("click", async () => {
  await navigator.clipboard.writeText(elements.toolOutput.dataset.rawOutput || elements.toolOutput.value);
});
elements.outputSearch.addEventListener("input", () => queueOutputSearch("tool"));
elements.outputSearchPrevious.addEventListener("click", () => moveOutputSearch("tool", -1));
elements.outputSearchNext.addEventListener("click", () => moveOutputSearch("tool", 1));
elements.downloadOutput.addEventListener("click", () => {
  downloadText(
    elements.toolOutput.dataset.rawOutput || elements.toolOutput.value,
    elements.toolOutput.dataset.filename || "sms3-output.txt",
    elements.toolOutput.dataset.mimeType || "text/plain"
  );
});
elements.themeToggle.addEventListener("change", () => {
  const next = elements.themeToggle.checked ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("sms3-theme", next);
});
elements.sidebarToggle.addEventListener("click", () => {
  const collapsed = !elements.appShell.classList.contains("sidebar-collapsed");
  elements.appShell.classList.toggle("sidebar-collapsed", collapsed);
  localStorage.setItem("sms3-sidebar", collapsed ? "collapsed" : "expanded");
  elements.sidebarToggle.setAttribute("aria-pressed", String(collapsed));
  elements.sidebarToggle.setAttribute(
    "aria-label",
    collapsed ? "Show navigation" : "Hide navigation"
  );
});
window.addEventListener("popstate", applyRouteFromHash);
window.addEventListener("hashchange", applyRouteFromHash);

applyStoredTheme();
applyStoredSidebarState();
loadAppVersion();
if (!applyRouteFromHash()) {
  renderActiveView();
  renderSelectedTool();
  renderToolList();
  renderReferenceList();
  renderSelectedReference();
  renderFeedbackTemplates();
  renderWorkflowView();
  loadSelectedToolExample();
  loadWorkflowExample();
}
