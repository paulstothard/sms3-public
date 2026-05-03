import {
  cleanFilterDnaRnaMetadata,
  cleanFilterProteinMetadata
} from "./clean-filter-sequence/metadata.js";
import {
  runCleanFilterDnaRna,
  runCleanFilterProtein
} from "./clean-filter-sequence/run.js";
import { baseCompositionPlotMetadata } from "./base-composition-plot/metadata.js";
import { runBaseCompositionPlot } from "./base-composition-plot/run.js";
import { codonUsageMetadata } from "./codon-usage/metadata.js";
import { runCodonUsage } from "./codon-usage/run.js";
import { codonUsageComparisonMetadata } from "./codon-usage-comparison/metadata.js";
import { runCodonUsageComparison } from "./codon-usage-comparison/run.js";
import { dnaRnaPatternFinderMetadata } from "./dna-rna-pattern-finder/metadata.js";
import { runDnaRnaPatternFinder } from "./dna-rna-pattern-finder/run.js";
import {
  extractSubsequencesDnaRnaMetadata,
  extractSubsequencesProteinMetadata
} from "./extract-subsequences/metadata.js";
import {
  runExtractSubsequencesDnaRna,
  runExtractSubsequencesProtein
} from "./extract-subsequences/run.js";
import {
  groupNumberDnaRnaMetadata,
  groupNumberProteinMetadata
} from "./group-number-sequence/metadata.js";
import {
  runGroupNumberDnaRna,
  runGroupNumberProtein
} from "./group-number-sequence/run.js";
import { lineListCleanerMetadata } from "./line-list-cleaner/metadata.js";
import { runLineListCleaner } from "./line-list-cleaner/run.js";
import { orfFinderMetadata } from "./orf-finder/metadata.js";
import { runOrfFinder } from "./orf-finder/run.js";
import {
  dnaRnaMotifScannerMetadata,
  proteinMotifScannerMetadata
} from "./motif-scanner/metadata.js";
import {
  runDnaRnaMotifScanner,
  runProteinMotifScanner
} from "./motif-scanner/run.js";
import { technicalSequenceScannerMetadata } from "./technical-sequence-scanner/metadata.js";
import { vectorContaminationScannerMetadata } from "./vector-contamination-scanner/metadata.js";
import { proteinHydropathyMetadata } from "./protein-hydropathy/metadata.js";
import { runProteinHydropathy } from "./protein-hydropathy/run.js";
import { proteinPatternFinderMetadata } from "./protein-pattern-finder/metadata.js";
import { runProteinPatternFinder } from "./protein-pattern-finder/run.js";
import { proteinStatsMetadata } from "./protein-stats/metadata.js";
import { runProteinStats } from "./protein-stats/run.js";
import { reverseComplementMetadata } from "./reverse-complement/metadata.js";
import { runReverseComplement } from "./reverse-complement/run.js";
import { restrictionAnalysisMetadata } from "./restriction-analysis/metadata.js";
import { runRestrictionAnalysis } from "./restriction-analysis/run.js";
import { reverseTranslateMetadata } from "./reverse-translate/metadata.js";
import { runReverseTranslate } from "./reverse-translate/run.js";
import { sequenceStatsDnaRnaMetadata } from "./sequence-stats/metadata.js";
import { runSequenceStatsDnaRna } from "./sequence-stats/run.js";
import { tableViewerCleanerMetadata } from "./table-viewer-cleaner/metadata.js";
import { runTableViewerCleaner } from "./table-viewer-cleaner/run.js";
import { textCleanerFormatterMetadata } from "./text-cleaner-formatter/metadata.js";
import { runTextCleanerFormatter } from "./text-cleaner-formatter/run.js";
import { textSearchReplaceMetadata } from "./text-search-replace/metadata.js";
import { runTextSearchReplace } from "./text-search-replace/run.js";
import { translateMetadata } from "./translate/metadata.js";
import { runTranslate } from "./translate/run.js";

function runWorkerOnlyTool() {
  throw new Error("This tool runs in a Web Worker. Use the app worker runner or provide a workflow runTool callback.");
}

export const tools = [
  {
    metadata: reverseComplementMetadata,
    run: runReverseComplement,
    example: `>sample sequence
gckugcgaygartty
>ambiguous sample
ACGTRYSWKMBDHVN`
  },
  {
    metadata: cleanFilterDnaRnaMetadata,
    run: runCleanFilterDnaRna,
    example: `>messy DNA
Acg t-ryswkmbdhvn123`
  },
  {
    metadata: cleanFilterProteinMetadata,
    run: runCleanFilterProtein,
    example: `>messy protein
Mtey-klvXZBJOU* 789`
  },
  {
    metadata: baseCompositionPlotMetadata,
    run: runBaseCompositionPlot,
    example: `>GC-rich then AT-rich example
GCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGC
GCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGC
ATATATATATATATATATATATATATATATATATATATATATATATATATATATATATAT
ATATATATATATATATATATATATATATATATATATATATATATATATATATATATATAT
GGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGCGGGC
AAATAAATAAATAAATAAATAAATAAATAAATAAATAAATAAATAAATAAATAAATAAAT
>G-rich then C-rich example
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC
GCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGCGC
NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN`
  },
  {
    metadata: codonUsageMetadata,
    run: runCodonUsage,
    example: `>balanced_coding_example
ATGGCTGCTGCTGGTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGT
GGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGTGGTAAATTTCCCAAATAA
>gc_biased_coding_example
ATGGCCGCCGCCGCCGCCGCCGGCGGCGGCGGCGGCGGCCGCCGCCGCCGCCGCCGCCGGC
GGCGGCGGCGGCGGCCGCCGCCGCCGCCGCCGCCGGCGGCGGCGGCGGCGGGCTAA`
  },
  {
    metadata: codonUsageComparisonMetadata,
    run: runCodonUsageComparison,
    example: `>coding sequence
ATGGCTGCTTAA
>codon-biased example
ATGGCCGCCGCCGCCGCCGCCGCCGCCGCCGCCGCTAA`
  },
  {
    metadata: dnaRnaPatternFinderMetadata,
    run: runDnaRnaPatternFinder,
    example: `>motif example
CCCATGAAATAGGGGATGCCCTAA
>ambiguous motif example
ATGNNNACGTRYSWKM`
  },
  {
    metadata: dnaRnaMotifScannerMetadata,
    run: runDnaRnaMotifScanner,
    example: `>regulatory motif example
GCCRCCATGGTTAGGAGGTTATAATGTTGACAAATAAATATAAT
>polyA reverse example
TTTATTCCCGGGTTGACATATAAT`
  },
  {
    metadata: technicalSequenceScannerMetadata,
    run: runWorkerOnlyTool,
    example: `>adapter and primer example
AAATGTAAAACGACGGCCAGTCCCTTTAGATCGGAAGAGCACACGTCTGAACTCCAGTCACTGTCTCTTATACACATCT
>reverse adapter example
TTTGACTGGAGTTCAGACGTGTGCTCTTCCGATCTAAAGGGGATGTGTATAAGAGACAG`
  },
  {
    metadata: tableViewerCleanerMetadata,
    run: runTableViewerCleaner,
    example: `sample,group,gc_percent,notes
A1,control,51.2,"clear, usable row"
A2,control,47.8,
B1,treatment,63.4,"quoted ""high GC"" note"
B1,treatment,63.4,"quoted ""high GC"" note"
B2,treatment,58.1,"contains	tab text"`
  },
  {
    metadata: lineListCleanerMetadata,
    run: runLineListCleaner,
    example: `sample10
sample2
sample1
Sample2

sample10
  sample3  `
  },
  {
    metadata: textCleanerFormatterMetadata,
    run: runTextCleanerFormatter,
    example: `  Sample ID\t\tValue   Notes

  A-001\t\t42      \u201cquoted note\u201d
  A-002\t\t   51      has\u00a0nonbreaking space

  Long paragraph line one
  continues on another line and can be wrapped or unwrapped.   `
  },
  {
    metadata: textSearchReplaceMetadata,
    run: runTextSearchReplace,
    example: `sample_001	control	51.2
sample_002	treatment	63.4
blank row
sample_010	treatment	58.1`
  },
  {
    metadata: vectorContaminationScannerMetadata,
    run: runWorkerOnlyTool,
    example: `>UniVec_Core forward example
NNNNNAAGGAGAGGACGCTGTCAGAGGACGGTTACGAACGTAGGACAGAAGGGAGAGTTTT
>UniVec_Core reverse example
AAAACCCCTCTCCCTTCTGTCCTACGTTCGTAACCGTCCTCTGACAGCGTCCTCTCCTTNNNNN`
  },
  {
    metadata: restrictionAnalysisMetadata,
    run: runRestrictionAnalysis,
    example: `>plasmid digest example
AAAGAATTCTTTGGATCCAAACTGCAGTTTAAGCTTAAAGCGGCCGCAAAGTCGACAAATCTAGATT
>ambiguous restriction example
CCCGANTCGGGAGCTCCCATGGGGCC`
  },
  {
    metadata: extractSubsequencesDnaRnaMetadata,
    run: runExtractSubsequencesDnaRna,
    example: `>sample DNA
ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG
>ambiguous region
ACGTRYSWKMBDHVN`
  },
  {
    metadata: extractSubsequencesProteinMetadata,
    run: runExtractSubsequencesProtein,
    example: `>sample protein
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQV
>short motif protein
ACDEFGHIKLMNPQRSTVWY`
  },
  {
    metadata: groupNumberDnaRnaMetadata,
    run: runGroupNumberDnaRna,
    example: `>sample DNA
ACGTACGTACGTACGTACGTACGTNNNN`
  },
  {
    metadata: groupNumberProteinMetadata,
    run: runGroupNumberProtein,
    example: `>sample protein
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPT`
  },
  {
    metadata: proteinHydropathyMetadata,
    run: runProteinHydropathy,
    example: `>signal_anchor_like
MKTIIALSYIFCLVFADYKDDDDKGGGGSSSSNNNNQQQQEEEEDDDD
VVVVVVVVVVLLLLLLLLLLIIIIIIIIIIFFFFFFFFFFGGGGKKKK
>soluble_mixed_profile
MSSGNTSTNNQSDEEDKRKQLEEELAKLRQQLGADGAVVLGAGGVGKS
ALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYS`
  },
  {
    metadata: proteinPatternFinderMetadata,
    run: runProteinPatternFinder,
    example: `>glycosylation candidate
MNNSTPAANVTKNNSSK
>signal peptide tag
MKTIIALSYIFCLVFADYKDDDDK`
  },
  {
    metadata: proteinMotifScannerMetadata,
    run: runProteinMotifScanner,
    example: `>motif-rich protein
MAAKKKKGGNNSTAGTAREGAASTDEAAASKL
>candidate myristoylation
MGNNSTAA`
  },
  {
    metadata: proteinStatsMetadata,
    run: runProteinStats,
    example: `>sample protein
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQV
>protein with ambiguity
ACDEFGHIKLMNPQRSTVWYBXZOU*-`
  },
  {
    metadata: reverseTranslateMetadata,
    run: runReverseTranslate,
    example: `>short protein
MALW
>ambiguous protein
BJZX`
  },
  {
    metadata: translateMetadata,
    run: runTranslate,
    example: `>standard example
ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG
>ambiguous RNA
augcccnnnuua`
  },
  {
    metadata: sequenceStatsDnaRnaMetadata,
    run: runSequenceStatsDnaRna,
    example: `>mixed DNA
ACGTACGTNNNNRYSWKMBDHVX
>rna with gaps
augcau--nn`
  },
  {
    metadata: orfFinderMetadata,
    run: runOrfFinder,
    example: `>orf example
CCCATGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
TAA
>reverse strand example
TTATTTCATGGG`
  }
];
