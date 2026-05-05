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
import { fastaValidatorNormalizerMetadata } from "./fasta-validator-normalizer/metadata.js";
import { runFastaValidatorNormalizer } from "./fasta-validator-normalizer/run.js";
import { fastqSummaryMetadata } from "./fastq-summary/metadata.js";
import { runFastqSummary } from "./fastq-summary/run.js";
import { inSilicoPcrMetadata } from "./in-silico-pcr/metadata.js";
import { runInSilicoPcr } from "./in-silico-pcr/run.js";
import { fastaHeaderRenameMetadata } from "./fasta-header-rename/metadata.js";
import { runFastaHeaderRename } from "./fasta-header-rename/run.js";
import { fastaLengthFilterMetadata } from "./fasta-length-filter/metadata.js";
import { runFastaLengthFilter } from "./fasta-length-filter/run.js";
import { fastaExtractByIdMetadata } from "./fasta-extract-by-id/metadata.js";
import { runFastaExtractById } from "./fasta-extract-by-id/run.js";
import { fastaTableConverterMetadata } from "./fasta-table-converter/metadata.js";
import { runFastaTableConverter } from "./fasta-table-converter/run.js";
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
import { listSetCompareMetadata } from "./list-set-compare/metadata.js";
import { runListSetCompare } from "./list-set-compare/run.js";
import { orfFinderMetadata } from "./orf-finder/metadata.js";
import { runOrfFinder } from "./orf-finder/run.js";
import {
  pairwiseAlignCodingDnaMetadata,
  pairwiseAlignDnaRnaMetadata,
  pairwiseAlignProteinMetadata
} from "./pairwise-alignment/metadata.js";
import {
  runPairwiseAlignCodingDna,
  runPairwiseAlignDnaRna,
  runPairwiseAlignProtein
} from "./pairwise-alignment/run.js";
import {
  dnaRnaMotifScannerMetadata,
  proteinMotifScannerMetadata
} from "./motif-scanner/metadata.js";
import {
  runDnaRnaMotifScanner,
  runProteinMotifScanner
} from "./motif-scanner/run.js";
import {
  multipleAlignDnaRnaMetadata,
  multipleAlignProteinMetadata
} from "./multiple-sequence-alignment/metadata.js";
import {
  runMultipleAlignDnaRna,
  runMultipleAlignProtein
} from "./multiple-sequence-alignment/run.js";
import { technicalSequenceScannerMetadata } from "./technical-sequence-scanner/metadata.js";
import { vectorContaminationScannerMetadata } from "./vector-contamination-scanner/metadata.js";
import { vcfGenotypeTableMetadata } from "./vcf-genotype-table/metadata.js";
import { runVcfGenotypeTable } from "./vcf-genotype-table/run.js";
import { proteinHydropathyMetadata } from "./protein-hydropathy/metadata.js";
import { runProteinHydropathy } from "./protein-hydropathy/run.js";
import { proteinPatternFinderMetadata } from "./protein-pattern-finder/metadata.js";
import { runProteinPatternFinder } from "./protein-pattern-finder/run.js";
import { proteinStatsMetadata } from "./protein-stats/metadata.js";
import { runProteinStats } from "./protein-stats/run.js";
import { primerOligoPropertiesMetadata } from "./primer-oligo-properties/metadata.js";
import { runPrimerOligoProperties } from "./primer-oligo-properties/run.js";
import { reverseComplementMetadata } from "./reverse-complement/metadata.js";
import { runReverseComplement } from "./reverse-complement/run.js";
import { recordParserExtractorMetadata } from "./record-parser-extractor/metadata.js";
import { runRecordParserExtractor } from "./record-parser-extractor/run.js";
import { restrictionAnalysisMetadata } from "./restriction-analysis/metadata.js";
import { runRestrictionAnalysis } from "./restriction-analysis/run.js";
import {
  mutateDnaRnaMetadata,
  mutateProteinMetadata,
  randomCodingDnaMetadata,
  randomDnaRnaMetadata,
  randomDnaRnaRegionsMetadata,
  randomProteinMetadata,
  randomProteinRegionsMetadata,
  sampleDnaRnaMetadata,
  sampleProteinMetadata,
  shuffleDnaRnaMetadata,
  shuffleProteinMetadata
} from "./random-sequence/metadata.js";
import {
  runMutateDnaRna,
  runMutateProtein,
  runRandomCodingDna,
  runRandomDnaRna,
  runRandomDnaRnaRegions,
  runRandomProtein,
  runRandomProteinRegions,
  runSampleDnaRna,
  runSampleProtein,
  runShuffleDnaRna,
  runShuffleProtein
} from "./random-sequence/run.js";
import { reverseTranslateMetadata } from "./reverse-translate/metadata.js";
import { runReverseTranslate } from "./reverse-translate/run.js";
import { sequenceStatsDnaRnaMetadata } from "./sequence-stats/metadata.js";
import { runSequenceStatsDnaRna } from "./sequence-stats/run.js";
import { tableViewerCleanerMetadata } from "./table-viewer-cleaner/metadata.js";
import { runTableViewerCleaner } from "./table-viewer-cleaner/run.js";
import { tableSummaryMetadata } from "./table-summary/metadata.js";
import { runTableSummary } from "./table-summary/run.js";
import { tableGroupSummaryMetadata } from "./table-group-summary/metadata.js";
import { runTableGroupSummary } from "./table-group-summary/run.js";
import { tableReshapeMetadata } from "./table-reshape/metadata.js";
import { runTableReshape } from "./table-reshape/run.js";
import { tableJoinMetadata } from "./table-join/metadata.js";
import { runTableJoin } from "./table-join/run.js";
import { tableColumnCalculatorMetadata } from "./table-column-calculator/metadata.js";
import { runTableColumnCalculator } from "./table-column-calculator/run.js";
import { textSearchReplaceMetadata } from "./text-search-replace/metadata.js";
import { runTextSearchReplace } from "./text-search-replace/run.js";
import { translateMetadata } from "./translate/metadata.js";
import { runTranslate } from "./translate/run.js";
import { recordParserExample } from "../examples/record-parser-example.js";

function runWorkerOnlyTool() {
  throw new Error("This tool runs in a Web Worker. Use the app worker runner or provide a workflow runTool callback.");
}

export const tools = [
  {
    metadata: reverseComplementMetadata,
    run: runReverseComplement,
    example: `>NM_000546.6_p53_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
>IUPAC_control_fragment
ACGTRYSWKMBDHVN`
  },
  {
    metadata: cleanFilterDnaRnaMetadata,
    run: runCleanFilterDnaRna,
    example: `>NM_007294.4_BRCA1_messy_fragment
Atg gat tta tct gct ctt cgc gtt gaa gaa gta caa aat gtc attaatgctNNN123`
  },
  {
    metadata: cleanFilterProteinMetadata,
    run: runCleanFilterProtein,
    example: `>NP_000537.3_p53_messy_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP XZ* 789`
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
    example: `>NM_000546.6_p53_cds_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
ATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGAT
>GC_rich_coding_control
ATGGCCGCCGCCGCCGCCGCCGGCGGCGGCGGCGGCGGCCGCCGCCGCCGCCGCCGCCTAA`
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
    metadata: multipleAlignDnaRnaMetadata,
    run: runMultipleAlignDnaRna,
    example: `>HBB_human_fragment
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGT
>HBB_chimp_fragment
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGT
>HBB_mouse_fragment
ATGGTGCACCTGACTCCTGAGGAGAAGTCTGCCGTTACCGCCCTGTGGGGCAAGGTGAACGTGGATGAAGTTGGT`
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
    metadata: tableSummaryMetadata,
    run: runTableSummary,
    example: `sample_id,collection_date,treatment,replicate,concentration_ng_ul,od260_280,qc_pass,notes
SRR2584863,2024-01-12,control,1,38.4,1.91,true,bulk RNA replicate
SRR2584864,2024-01-12,control,2,42.1,1.87,true,bulk RNA replicate
SRR2584865,2024-01-13,heat_shock,1,55.8,1.83,true,30 minute heat shock
SRR2584866,2024-01-13,heat_shock,2,NA,1.79,false,low concentration
SRR2584867,2024-01-14,recovery,1,47.5,1.88,true,2 hour recovery
SRR2584868,2024-01-14,recovery,2,49.2,1.90,true,2 hour recovery
SRR2584869,2024-01-15,control,3,39.7,1.92,true,library repeated
SRR2584870,2024-01-15,heat_shock,3,57.3,1.81,true,library repeated`
  },
  {
    metadata: tableGroupSummaryMetadata,
    run: runTableGroupSummary,
    example: `sample_id,collection_date,treatment,replicate,concentration_ng_ul,od260_280,qc_pass,notes
SRR2584863,2024-01-12,control,1,38.4,1.91,true,bulk RNA replicate
SRR2584864,2024-01-12,control,2,42.1,1.87,true,bulk RNA replicate
SRR2584865,2024-01-13,heat_shock,1,55.8,1.83,true,30 minute heat shock
SRR2584866,2024-01-13,heat_shock,2,NA,1.79,false,low concentration
SRR2584867,2024-01-14,recovery,1,47.5,1.88,true,2 hour recovery
SRR2584868,2024-01-14,recovery,2,49.2,1.90,true,2 hour recovery
SRR2584869,2024-01-15,control,3,39.7,1.92,true,library repeated
SRR2584870,2024-01-15,heat_shock,3,57.3,1.81,true,library repeated`
  },
  {
    metadata: tableReshapeMetadata,
    run: runTableReshape,
    example: `sample_id,treatment,gene_id,tpm
SRR2584863,control,TP53,18.4
SRR2584863,control,BRCA1,5.2
SRR2584863,control,MYC,44.1
SRR2584864,control,TP53,19.7
SRR2584864,control,BRCA1,4.8
SRR2584864,control,MYC,41.9
SRR2584865,heat_shock,TP53,31.2
SRR2584865,heat_shock,BRCA1,6.1
SRR2584865,heat_shock,MYC,60.5`
  },
  {
    metadata: tableJoinMetadata,
    run: runTableJoin,
    example: `sample_id,treatment,replicate
SRR2584863,control,1
SRR2584864,control,2
SRR2584865,heat_shock,1
SRR2584866,heat_shock,2
SRR2584867,recovery,1
---
sample_id,fastq_1,fastq_2,read_pairs_millions
SRR2584863,SRR2584863_R1.fastq.gz,SRR2584863_R2.fastq.gz,18.2
SRR2584864,SRR2584864_R1.fastq.gz,SRR2584864_R2.fastq.gz,17.9
SRR2584865,SRR2584865_R1.fastq.gz,SRR2584865_R2.fastq.gz,22.4
SRR2584866,SRR2584866_R1.fastq.gz,SRR2584866_R2.fastq.gz,21.8
SRR2584868,SRR2584868_R1.fastq.gz,SRR2584868_R2.fastq.gz,19.1`
  },
  {
    metadata: tableColumnCalculatorMetadata,
    run: runTableColumnCalculator,
    example: `sample_id,total_reads,mapped_reads,duplicate_reads
SRR2584863,18200000,17654000,1250000
SRR2584864,17900000,17084000,1180000
SRR2584865,22400000,21123000,1740000
SRR2584866,21800000,19876000,2010000
SRR2584867,19100000,18312000,1325000`
  },
  {
    metadata: vcfGenotypeTableMetadata,
    run: runVcfGenotypeTable,
    example: `##fileformat=VCFv4.2
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	SRR2584863	SRR2584864	SRR2584865
1	10177	rs367896724	A	AC	100	PASS	AC=1	GT:GQ:DP	0/1:42:18	0/0:55:20	./.:.:0
1	11008	rs575272151	C	G	99	PASS	AC=1	GT:GQ:DP	0/0:60:22	0/1:48:19	0/0:52:21`
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
    metadata: listSetCompareMetadata,
    run: runListSetCompare,
    example: `BRCA1
TP53
MYC
EGFR
BRCA1
NM_007294.4
---
TP53
KRAS
EGFR
NM_007294.4
NM_000546.6
KRAS`
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
    metadata: recordParserExtractorMetadata,
    run: runRecordParserExtractor,
    example: recordParserExample
  },
  {
    metadata: mutateDnaRnaMetadata,
    run: runMutateDnaRna,
    example: `>coding-like DNA
ATGGCTGCTGCTGGTGGTGGTAAATTTCCCAAATAA`
  },
  {
    metadata: mutateProteinMetadata,
    run: runMutateProtein,
    example: `>NP_000537.3_p53_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP`
  },
  {
    metadata: randomCodingDnaMetadata,
    run: runRandomCodingDna,
    example: `Random coding DNA generator. Input text is ignored; set length, count, genetic code, and optional seed in the options.`
  },
  {
    metadata: randomDnaRnaMetadata,
    run: runRandomDnaRna,
    example: `Random DNA/RNA generator. Input text is ignored; set length, count, and optional seed in the options.`
  },
  {
    metadata: randomDnaRnaRegionsMetadata,
    run: runRandomDnaRnaRegions,
    example: `>NM_000546.6_p53_region_replacement_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT`
  },
  {
    metadata: randomProteinMetadata,
    run: runRandomProtein,
    example: `Random protein generator. Input text is ignored; set length, count, and optional seed in the options.`
  },
  {
    metadata: randomProteinRegionsMetadata,
    run: runRandomProteinRegions,
    example: `>NP_000537.3_p53_region_replacement_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP`
  },
  {
    metadata: sampleDnaRnaMetadata,
    run: runSampleDnaRna,
    example: `>NM_000546.6_p53_base_sampling_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT`
  },
  {
    metadata: sampleProteinMetadata,
    run: runSampleProtein,
    example: `>NP_000537.3_p53_residue_sampling_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP`
  },
  {
    metadata: shuffleDnaRnaMetadata,
    run: runShuffleDnaRna,
    example: `>NM_007294.4_BRCA1_shuffle_fragment
ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTA`
  },
  {
    metadata: shuffleProteinMetadata,
    run: runShuffleProtein,
    example: `>NP_000537.3_p53_shuffle_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP`
  },
  {
    metadata: extractSubsequencesDnaRnaMetadata,
    run: runExtractSubsequencesDnaRna,
    example: `>NM_000546.6_p53_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
>IUPAC_control_fragment
ACGTRYSWKMBDHVN`
  },
  {
    metadata: extractSubsequencesProteinMetadata,
    run: runExtractSubsequencesProtein,
    example: `>NP_000537.3_p53_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP
>UniProt_P04637_region
SDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFT`
  },
  {
    metadata: fastaValidatorNormalizerMetadata,
    run: runFastaValidatorNormalizer,
    example: `>clean_record
ACGTACGTACGT
>record with spacing
ACGT ACGT

>duplicate
MTEYKLVVVG
>duplicate
GAGGVGKSAL`
  },
  {
    metadata: fastqSummaryMetadata,
    run: runFastqSummary,
    example: `@SRR2584863.1 1 length=24
ACGTGCTAGCTAGGCTNNACGTAC
+
IIIIIIIIIIIIIIII!!IIIIII
@SRR2584863.2 2 length=24
TGCATGCATGCATGCATGCATGCA
+
IIIIIIIIIIIIIIIIIIIIIIII
@SRR2584863.3 3 length=24
GGGGCCCCAAAATTTTGGCCAACT
+
HHHHHHHHHHHHHHHHHHHHHHHH
@SRR2584863.4 4 length=24
NNNNACGTACGTACGTACGTNNNN
+
!!!!IIIIIIIIIIIIIIII!!!!`
  },
  {
    metadata: inSilicoPcrMetadata,
    run: runInSilicoPcr,
    example: `>pUC19_mcs_region
TTGACGGCTAGCTCAGTCCTAGGTACCGGATCCGATGCTAGCGGGAATTCGAGCTCGGTACCAAGCTTACGCGT
---
>BamHI_forward
GGATCCGATGCT
>HindIII_reverse
AAGCTTGGTACC
>EcoRI_forward
GAATTCGAGCTC`
  },
  {
    metadata: fastaLengthFilterMetadata,
    run: runFastaLengthFilter,
    example: `>short_insert
ACGTTGCA
>medium_construct
ATGGCTGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGT
>long_reference_fragment
ATGGCTGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGT
>empty_record`
  },
  {
    metadata: fastaExtractByIdMetadata,
    run: runFastaExtractById,
    example: `>NM_000546.6 Homo sapiens tumor protein p53 transcript variant 1
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
ATGGAAACTACTTCCTGAAAACAACGTTCTGTCCCCCTTGCCGTCCCAAGCAATGGATGATTTGAT
>NM_007294.4 Homo sapiens BRCA1 DNA repair associated transcript variant 1
ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTA
GAGTGTCCCATCTGTCTGGAGTTGATCAAGGAACCTGTCTCCACAAAGTGTGACCACATATTTTGC
>NM_002467.6 Homo sapiens MYC proto-oncogene transcript variant 1
ATGCCCCTCAACGTTAGCTTCACCAACAGGAACTATGACCTCGACTACGACTCGGTGCAGCCGTAT
TTCTACTGCGACGAGGAGGAGAATGTCAAGAGGCGAACACACAACGTCTTGGAGCGCCAGAGGAGG
---
NM_007294.4
NM_000546.6`
  },
  {
    metadata: fastaTableConverterMetadata,
    run: runFastaTableConverter,
    example: `>NM_000546.6 Homo sapiens tumor protein p53 transcript variant 1
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
>NM_007294.4 Homo sapiens BRCA1 DNA repair associated transcript variant 1
ATGGATTTATCTGCTCTTCGCGTTGAAGAAGTACAAAATGTCATTAATGCTATGCAGAAAATCTTA
>NM_002467.6 Homo sapiens MYC proto-oncogene transcript variant 1
ATGCCCCTCAACGTTAGCTTCACCAACAGGAACTATGACCTCGACTACGACTCGGTGCAGCCGTAT`
  },
  {
    metadata: fastaHeaderRenameMetadata,
    run: runFastaHeaderRename,
    example: `>sample 1 / forward read
ACGTACGTACGT
>sample 2 / reverse read
TTTTCCCCAAAAGGGG
>sample 10 / control read
GATTACAGATTACA`
  },
  {
    metadata: groupNumberDnaRnaMetadata,
    run: runGroupNumberDnaRna,
    example: `>NM_000546.6_p53_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT`
  },
  {
    metadata: groupNumberProteinMetadata,
    run: runGroupNumberProtein,
    example: `>NP_000537.3_p53_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP`
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
    metadata: multipleAlignProteinMetadata,
    run: runMultipleAlignProtein,
    example: `>HBB_human_fragment
MVHLTPEEKSAVTALWGKVNVDEVG
>HBB_chimp_fragment
MVHLTPEEKSAVTALWGKVNVDEVG
>HBB_mouse_fragment
MVHLTPEEKSAVTGLWGKVNVDEVG`
  },
  {
    metadata: primerOligoPropertiesMetadata,
    run: runPrimerOligoProperties,
    example: `>TP53_exon4_forward_primer
GAGGAGCCGCAGTCAGATC
>TP53_exon4_reverse_primer
CTGACAGGGGCTCGACTAC
>BRCA1_fragment_screening_primer
TGTGACCACATATTTTGCAA`
  },
  {
    metadata: pairwiseAlignDnaRnaMetadata,
    run: runPairwiseAlignDnaRna,
    example: `>sequence one
ATGGCTGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGTGGTAAATTTCCCAAATAA
>sequence two
ATGGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGACGCTGCTGGTGGTAAATTTCCCAAATAA`
  },
  {
    metadata: pairwiseAlignCodingDnaMetadata,
    run: runPairwiseAlignCodingDna,
    example: `>coding sequence one
ATGGCTGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGATGCTGCTGGTGGTAAATTTCCCAAAGCT
>coding sequence two
ATGGCTGCTGGTGGTAAATTTCCCAAAGGTTCTTCTGAAATCGACGCTGCTGGTGGTAAATTTCCCAAAGCT`
  },
  {
    metadata: pairwiseAlignProteinMetadata,
    run: runPairwiseAlignProtein,
    example: `>human_like
MTEYKLVVVGAGGVGKSALTIQLIQNHFVDEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRTGE
>related
MTEYKLVVVGAGGIGKSALTIQLIQNHFVEEYDPTIEDSYRKQVVIDGETCLLDILDTAGQEEYSAMRDQYMRAGE`
  },
  {
    metadata: proteinStatsMetadata,
    run: runProteinStats,
    example: `>NP_000537.3_p53_fragment
MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP
>protein_ambiguity_control
ACDEFGHIKLMNPQRSTVWYBXZOU*-`
  },
  {
    metadata: reverseTranslateMetadata,
    run: runReverseTranslate,
    example: `>NP_000537.3_p53_short_fragment
MEEPQSDPSVEPPLSQETFSDLW
>protein_ambiguity_control
BJZX`
  },
  {
    metadata: translateMetadata,
    run: runTranslate,
    example: `>NM_000546.6_p53_cds_fragment
ATGGAGGAGCCGCAGTCAGATCCTAGCGTCGAGCCCCCTCTGAGTCAGGAAACATTTTCAGACCT
>RNA_ambiguity_control
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
    example: `>NC_001422.1_phiX174_fragment
AAAGTTTATCGCTTCCATGACGCAGAAGTTAACACTTTCGGTGGAAATGTTGATGGAGTTC
ATGCCCGGTGATGACGATGAGGCTACTGCTGACTCTCAACATTCTACTCCTCCAAAAAAGA
AGAGAAAGGTAGAAGACCCCAAGGACTTTCCTTCAGAATTGCTAAGTTTTTTGAGTCATGCTAA`
  }
];
