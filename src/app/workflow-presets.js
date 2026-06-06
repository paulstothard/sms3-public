import { humanMitochondrionGenBankExample } from "../examples/organellar-workflow-example.js";
import { arabidopsisChloroplastGenBankExample } from "../examples/chloroplast-workflow-example.js";

export const workflowPresets = [
  {
    id: "annotated-record-genome-figure",
    name: "Annotated record to Genome Figure",
    summary: "Prepare an editable Genome Figure from an annotated nucleotide flatfile record.",
    example: `LOCUS       MAPDEMO                  180 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Synthetic genome-map workflow demo record.
ACCESSION   MAPDEMO
VERSION     MAPDEMO.1
SOURCE      synthetic construct
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     source          1..180
                     /organism="synthetic construct"
                     /mol_type="other DNA"
     promoter        15..45
                     /gene="lac"
                     /note="lac promoter region"
     gene            54..137
                     /gene="lacZalpha"
                     /locus_tag="MAP_0001"
     CDS             54..137
                     /gene="lacZalpha"
                     /locus_tag="MAP_0001"
                     /product="beta-galactosidase alpha peptide fragment"
                     /codon_start=1
                     /transl_table=11
                     /translation="MTMITPSLHACRSTLED"
     misc_feature    143..171
                     /note="multiple cloning site with EcoRI, BamHI, and HindIII"
ORIGIN
        1 ttgacaggat ccgctagcga attcaccatg accatgatca cccccagcct gcacgcctgc
       61 cgcagcaccct ggaagacgac ggatccgcat gcgactacaag cttaacgttg
      121 acgactgagaa ttcaagcttg ggatccctcg agtcgacctg cagaaattcc
//`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "genome-figure",
          type: "tool",
          toolId: "circular-genome-figure",
          selectStream: "figure",
          options: {
            layout: "circular",
            featureLayout: "type-slots",
            labelDensity: "medium"
          }
        }
      ]
    }
  },
  {
    id: "annotated-record-feature-viewer",
    name: "Annotated record to feature viewer",
    summary: "Parse an annotated nucleotide flatfile record and open a feature viewer.",
    example: `LOCUS       FEATUREVIEW              240 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Synthetic annotated feature-viewer workflow demo record.
ACCESSION   FEATUREVIEW
VERSION     FEATUREVIEW.1
SOURCE      synthetic construct
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     source          1..240
                     /organism="synthetic construct"
                     /mol_type="other DNA"
     promoter        18..47
                     /gene="lac"
                     /note="lac promoter region"
     gene            64..165
                     /gene="gfp_fragment"
                     /locus_tag="VIEW_0001"
     CDS             64..165
                     /gene="gfp_fragment"
                     /locus_tag="VIEW_0001"
                     /product="green fluorescent protein fragment"
                     /codon_start=1
                     /transl_table=11
                     /translation="MVSKGEELFTGVVPILVELDGDVNGH"
     rep_origin      186..226
                     /note="short origin-like annotation"
     misc_feature    join(218..240,1..12)
                     /note="origin-spanning feature example"
ORIGIN
        1 gaattcctgc aggtcgactc tagaggatcc ccgggttgac aggatccgcc accatggtga
       61 gcaagggcga ggagctgttc accggggtgg tgcccatcct ggtcgagctg gacggcgacg
      121 ttaacgggca caagttcagc gtgtccggcg agggcgaggg cgatgccacc tacaagctta
      181 cctcgagggg atccgaattc aagcttggta ccgcggccgc tctagagtcg acctgcagaa
//`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "feature-viewer",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "viewer",
          options: {
            outputFormat: "interactive-circular-viewer"
          }
        }
      ]
    }
  },
  {
    id: "organellar-mitochondrial-record-review",
    name: "Mitochondrial record review",
    summary:
      "Review an annotated mitochondrial GenBank, DDBJ, or EMBL record by extracting the whole sequence, calculating sequence statistics, and opening a circular feature viewer.",
    example: humanMitochondrionGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "whole-sequence",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "wholeSequenceRecords",
          options: { outputFormat: "whole-fasta" }
        },
        {
          id: "sequence-stats",
          type: "tool",
          toolId: "sequence-stats-dna-rna",
          input: { from: "whole-sequence", stream: "wholeSequenceRecords" },
          selectStream: "table",
          options: {
            outputFormat: "tsv"
          }
        },
        {
          id: "feature-viewer",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          input: { from: "input", stream: "primary" },
          selectStream: "viewer",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,D-loop,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "interactive-circular-viewer"
          }
        }
      ]
    }
  },
  {
    id: "organellar-chloroplast-record-review",
    name: "Chloroplast record review",
    summary:
      "Review an annotated chloroplast GenBank, DDBJ, or EMBL record by extracting the whole sequence, calculating sequence statistics, and opening a circular feature viewer.",
    example: arabidopsisChloroplastGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "whole-sequence",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "wholeSequenceRecords",
          options: { outputFormat: "whole-fasta" }
        },
        {
          id: "sequence-stats",
          type: "tool",
          toolId: "sequence-stats-dna-rna",
          input: { from: "whole-sequence", stream: "wholeSequenceRecords" },
          selectStream: "table",
          options: {
            outputFormat: "tsv"
          }
        },
        {
          id: "feature-viewer",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          input: { from: "input", stream: "primary" },
          selectStream: "viewer",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,exon,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "interactive-circular-viewer"
          }
        }
      ]
    }
  },
  {
    id: "organellar-feature-table-review",
    name: "Organellar feature table review",
    summary:
      "Extract a focused feature table from an annotated mitochondrial or chloroplast flatfile record for gene, CDS, tRNA, rRNA, control-region, origin, and miscellaneous feature review.",
    example: humanMitochondrionGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "feature-table",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "table",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,D-loop,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "features-tsv"
          }
        }
      ]
    }
  },
  {
    id: "organellar-mitochondrial-genome-figure",
    name: "Mitochondrial Genome Figure",
    summary:
      "Prepare an editable circular Genome Figure from a real annotated mitochondrial GenBank record, after extracting a focused feature table for review.",
    example: humanMitochondrionGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "feature-table",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "table",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,D-loop,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "features-tsv"
          }
        },
        {
          id: "genome-figure",
          type: "tool",
          toolId: "circular-genome-figure",
          input: { from: "input", stream: "primary" },
          selectStream: "figure",
          options: {
            layout: "circular",
            featureLayout: "type-slots",
            labelDensity: "medium"
          }
        }
      ]
    }
  },
  {
    id: "organellar-chloroplast-feature-table-review",
    name: "Chloroplast feature table review",
    summary:
      "Extract a focused feature table from an annotated chloroplast flatfile record for chloroplast gene, CDS, exon, tRNA, rRNA, origin, and miscellaneous feature review.",
    example: arabidopsisChloroplastGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "feature-table",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "table",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,exon,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "features-tsv"
          }
        }
      ]
    }
  },
  {
    id: "organellar-chloroplast-genome-figure",
    name: "Chloroplast Genome Figure",
    summary:
      "Prepare an editable circular Genome Figure from a real annotated chloroplast GenBank record, after extracting a focused feature table for review.",
    example: arabidopsisChloroplastGenBankExample,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "feature-table",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "table",
          options: {
            featureFilter: "gene,CDS,tRNA,rRNA,exon,rep_origin,misc_feature",
            strandFilter: "all",
            outputFormat: "features-tsv"
          }
        },
        {
          id: "genome-figure",
          type: "tool",
          toolId: "circular-genome-figure",
          input: { from: "input", stream: "primary" },
          selectStream: "figure",
          options: {
            layout: "circular",
            featureLayout: "type-slots",
            labelDensity: "medium"
          }
        }
      ]
    }
  },
  {
    id: "annotated-record-restriction-viewer",
    name: "Annotated record to restriction viewer",
    summary: "Extract the nucleotide sequence from a flatfile record, add common restriction-site tracks, and open a linear DNA sequence viewer.",
    example: `LOCUS       VIEWDEMO                 180 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Synthetic viewer workflow demo record.
ACCESSION   VIEWDEMO
VERSION     VIEWDEMO.1
SOURCE      synthetic construct
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     source          1..180
                     /organism="synthetic construct"
                     /mol_type="other DNA"
     promoter        15..45
                     /gene="lac"
                     /note="lac promoter region"
     CDS             54..137
                     /gene="lacZalpha"
                     /locus_tag="VIEW_0001"
                     /product="beta-galactosidase alpha peptide fragment"
                     /codon_start=1
                     /transl_table=11
                     /translation="MTMITPSLHACRSTLED"
ORIGIN
        1 ttgacaggat ccgctagcga attcaccatg accatgatca cccccagcct gcacgcctgc
       61 cgcagcaccct ggaagacgac ggatccgcat gcgactacaag cttaacgttg
      121 acgactgagaa ttcaagcttg ggatccctcg agtcgacctg cagaaattcc
//`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "whole-sequence",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "wholeSequenceRecords",
          options: { outputFormat: "whole-fasta" }
        },
        {
          id: "restriction-viewer",
          type: "tool",
          toolId: "restriction-summary",
          input: { from: "whole-sequence", stream: "wholeSequenceRecords" },
          selectStream: "viewer",
          options: {
            enzymeIds: "common",
            topology: "circular",
            minimumSites: 1,
            maximumSites: 8,
            outputFormat: "interactive-circular-viewer"
          }
        }
      ]
    }
  },
  {
    id: "orf-codon-usage",
    name: "ORFs to codon usage",
    summary: "Find complete forward-strand ORFs, pass ORF nucleotide records to Codon Usage, and show the codon usage table.",
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
          options: { outputFormat: "table" }
        }
      ]
    }
  },
  {
    id: "genbank-cds-codon-usage",
    name: "GenBank CDS to codon usage",
    summary: "Parse annotated flatfile records, pass extracted CDS DNA/RNA records to Codon Usage, and show the codon usage table.",
    example: `LOCUS       TEST0001                  39 bp    DNA     circular SYN 01-JAN-2026
DEFINITION  Synthetic parser example record.
ACCESSION   TEST0001
VERSION     TEST0001.1
SOURCE      synthetic construct
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     source          1..39
                     /organism="synthetic construct"
     CDS             1..9
                     /gene="aaa"
                     /locus_tag="TEST_0001"
                     /product="forward peptide"
                     /protein_id="AAA00001.1"
                     /translation="MKF"
     CDS             complement(22..30)
                     /gene="bbb"
                     /product="reverse peptide"
                     /protein_id="AAA00002.1"
                     /translation="MPF"
ORIGIN
        1 atgaaattta acccgggtta caaagggcat aaatttcca
//`,
    workflow: {
      steps: [
        { id: "input", type: "input", text: "" },
        {
          id: "parse-records",
          type: "tool",
          toolId: "annotated-dna-record-extractor",
          selectStream: "cdsSequenceRecords",
          options: { outputFormat: "cds-fasta" }
        },
        {
          id: "codon-usage",
          type: "tool",
          toolId: "codon-usage",
          input: { from: "parse-records", stream: "cdsSequenceRecords" },
          selectStream: "table",
          options: {
            frame: "1",
            excludeTerminalStop: false,
            outputFormat: "table"
          }
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
  },
  {
    id: "random-rna-stats",
    name: "Random RNA sequence stats",
    summary: "Generate random RNA sequence records, pass them to Sequence Stats, and show the stats table.",
    example: "",
    workflow: {
      steps: [
        {
          id: "random-rna",
          type: "tool",
          toolId: "random-dna-rna",
          selectStream: "sequenceRecords",
          options: {
            nucleotideAlphabet: "rna",
            sequenceLength: 120,
            sequenceCount: 3,
            seed: "",
            outputFormat: "fasta"
          }
        },
        {
          id: "stats",
          type: "tool",
          toolId: "sequence-stats-dna-rna",
          input: { from: "random-rna", stream: "sequenceRecords" },
          selectStream: "table",
          options: { outputFormat: "tsv" }
        }
      ]
    }
  }
];
