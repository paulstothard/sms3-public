export const dnaRnaMotifs = [
  {
    "id": "dna-polyadenylation-signal-aataaa",
    "name": "Polyadenylation signal AATAAA",
    "alphabet": "dna-rna",
    "class": "processing-signal",
    "syntax": "exact",
    "pattern": "AATAAA",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Project-curated exact AATAAA polyadenylation-signal motif.",
      "license": "Project-curated illustrative motif."
    },
    "description": "Exact AATAAA polyadenylation signal candidate.",
    "scope": "DNA/RNA sequences; candidate processing signal only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Exact match against cleaned DNA/RNA sequence; no downstream context or cleavage-site prediction."
    }
  },
  {
    "id": "dna-bacterial-minus-10-pribnow",
    "name": "Bacterial -10 Pribnow-like box",
    "alphabet": "dna-rna",
    "class": "promoter-element",
    "syntax": "exact",
    "pattern": "TATAAT",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Pribnow D. Nucleotide sequence of an RNA polymerase binding site at an early T7 promoter. Proc Natl Acad Sci U S A. 1975;72(3):784-788.",
      "license": "Project-curated motif derived from common bacterial -10 consensus."
    },
    "description": "Exact TATAAT bacterial -10 promoter element candidate.",
    "scope": "DNA/RNA sequences; bacterial-like candidate promoter motif only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Exact match only; promoter spacing, sigma factor, and transcription-start context are not modeled."
    }
  },
  {
    "id": "dna-bacterial-minus-35-core",
    "name": "Bacterial -35 promoter core",
    "alphabet": "dna-rna",
    "class": "promoter-element",
    "syntax": "exact",
    "pattern": "TTGACA",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Project-curated exact TTGACA bacterial -35 promoter consensus motif.",
      "license": "Project-curated illustrative motif."
    },
    "description": "Exact TTGACA bacterial -35 promoter element candidate.",
    "scope": "DNA/RNA sequences; bacterial-like candidate promoter motif only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Exact match only; promoter spacing, sigma factor, and transcription-start context are not modeled."
    }
  },
  {
    "id": "dna-tata-box-like",
    "name": "TATA-box-like promoter element",
    "alphabet": "dna-rna",
    "class": "promoter-element",
    "syntax": "iupac",
    "pattern": "TATAWAWR",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Project-curated broad TATA-box-like IUPAC pattern for motif-scanner development.",
      "license": "Project-curated illustrative motif."
    },
    "description": "Short TATA-box-like IUPAC pattern.",
    "scope": "DNA/RNA sequences; candidate promoter element only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "IUPAC exact match against cleaned DNA/RNA sequence; no promoter or organism context is modeled."
    }
  },
  {
    "id": "dna-kozak-vertebrate-consensus",
    "name": "Vertebrate Kozak consensus",
    "alphabet": "dna-rna",
    "class": "translation-initiation",
    "syntax": "iupac",
    "pattern": "GCCRCCATGG",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Kozak M. An analysis of 5'-noncoding sequences from 699 vertebrate messenger RNAs. Nucleic Acids Res. 1987;15(20):8125-8148.",
      "license": "Project-curated motif derived from published consensus sequence."
    },
    "description": "Vertebrate Kozak-like translation initiation consensus around ATG.",
    "scope": "DNA/RNA sequences; vertebrate-like candidate motif only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "IUPAC exact match to GCCRCCATGG; transcript context, frame, and start-codon annotation are not modeled."
    }
  },
  {
    "id": "dna-shine-dalgarno-core",
    "name": "Shine-Dalgarno core",
    "alphabet": "dna-rna",
    "class": "translation-initiation",
    "syntax": "exact",
    "pattern": "AGGAGG",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Shine J, Dalgarno L. The 3'-terminal sequence of Escherichia coli 16S ribosomal RNA: complementarity to nonsense triplets and ribosome binding sites. Proc Natl Acad Sci U S A. 1974;71(4):1342-1346.",
      "license": "Project-curated motif derived from common bacterial ribosome-binding-site core."
    },
    "description": "Exact AGGAGG Shine-Dalgarno-like ribosome binding site core.",
    "scope": "DNA/RNA sequences; bacterial-like candidate motif only.",
    "match": {
      "strand": "both",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Exact match only; spacing to start codon and anti-Shine-Dalgarno complementarity are not modeled."
    }
  }
];

export default dnaRnaMotifs;
