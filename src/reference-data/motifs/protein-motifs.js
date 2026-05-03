export const proteinMotifs = [
  {
    "id": "protein-n-myristoylation-site",
    "name": "N-myristoylation site",
    "alphabet": "protein",
    "class": "lipidation-site",
    "syntax": "regex",
    "pattern": "G[^EDRKHPFYW]..[STAGCN][^P]",
    "source": {
      "name": "PROSITE",
      "version": "PS00008 pattern version 1",
      "accessDate": "2026-05-02",
      "url": "https://prosite.expasy.org/PS00008",
      "citation": "PROSITE PS00008 / PDOC00008; consensus G-{EDRKHPFYW}-x(2)-[STAGCN]-{P}.",
      "license": "Pattern represented as project-curated metadata; review PROSITE terms before bundling larger derived datasets."
    },
    "description": "Candidate N-myristoylation motif near glycine.",
    "scope": "Protein sequences; candidate motif only, usually interpreted near an exposed N terminus.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression translation of PROSITE pattern G-{EDRKHPFYW}-x(2)-[STAGCN]-{P}; N-terminal processing context is not modeled."
    }
  },
  {
    "id": "protein-n-glycosylation-sequon",
    "name": "N-glycosylation sequon",
    "alphabet": "protein",
    "class": "modification-site",
    "syntax": "regex",
    "pattern": "N[^P][ST][^P]",
    "source": {
      "name": "PROSITE",
      "version": "PS00001 pattern version 1",
      "accessDate": "2026-05-02",
      "url": "https://prosite.expasy.org/PS00001",
      "citation": "PROSITE PS00001 / PDOC00001; consensus N-{P}-[ST]-{P}.",
      "license": "Pattern represented as project-curated metadata; review PROSITE terms before bundling larger derived datasets."
    },
    "description": "Canonical N-X-S/T sequon excluding proline at X and immediately after S/T.",
    "scope": "Protein sequences; candidate sequon only, not evidence of glycosylation.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression translation of PROSITE pattern N-{P}-[ST]-{P}; no structural or cellular-context prediction."
    }
  },
  {
    "id": "protein-nls-basic-cluster",
    "name": "Basic cluster nuclear localization signal",
    "alphabet": "protein",
    "class": "NLS",
    "syntax": "regex",
    "pattern": "[KR]{4,}",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Curated as a broad basic-cluster candidate NLS pattern; not a substitute for sequence-context or localization prediction.",
      "license": "Project-curated illustrative motif."
    },
    "description": "Broad candidate pattern for monopartite basic-cluster nuclear localization signals.",
    "scope": "Protein sequences; broad candidate motif with many false positives.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression exact match against cleaned protein sequence; no structural, disorder, or localization context is modeled."
    }
  },
  {
    "id": "protein-casein-kinase-ii-site",
    "name": "Casein kinase II phosphorylation site",
    "alphabet": "protein",
    "class": "phosphorylation-site",
    "syntax": "regex",
    "pattern": "[ST]..[DE]",
    "source": {
      "name": "PROSITE",
      "version": "PS00006 pattern version 1",
      "accessDate": "2026-05-02",
      "url": "https://prosite.expasy.org/PS00006",
      "citation": "PROSITE PS00006 / PDOC00006; consensus [ST]-x(2)-[DE].",
      "license": "Pattern represented as project-curated metadata; review PROSITE terms before bundling larger derived datasets."
    },
    "description": "Short candidate casein kinase II phosphorylation motif.",
    "scope": "Protein sequences; high-frequency candidate motif with many false positives.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression translation of PROSITE pattern [ST]-x(2)-[DE]; kinase context and accessibility are not modeled."
    }
  },
  {
    "id": "protein-pkc-phosphorylation-site",
    "name": "Protein kinase C phosphorylation site",
    "alphabet": "protein",
    "class": "phosphorylation-site",
    "syntax": "regex",
    "pattern": "[ST].[RK]",
    "source": {
      "name": "PROSITE",
      "version": "PS00005 pattern version 1",
      "accessDate": "2026-05-02",
      "url": "https://prosite.expasy.org/PS00005",
      "citation": "PROSITE PS00005 / PDOC00005; consensus [ST]-x-[RK].",
      "license": "Pattern represented as project-curated metadata; review PROSITE terms before bundling larger derived datasets."
    },
    "description": "Short candidate protein kinase C phosphorylation motif.",
    "scope": "Protein sequences; high-frequency candidate motif with many false positives.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression translation of PROSITE pattern [ST]-x-[RK]; kinase context and accessibility are not modeled."
    }
  },
  {
    "id": "protein-c-terminal-peroxisomal-targeting-signal",
    "name": "C-terminal peroxisomal targeting signal type 1",
    "alphabet": "protein",
    "class": "targeting-signal",
    "syntax": "regex",
    "pattern": "[SAPTC][KRH][LMI]$",
    "source": {
      "name": "SMS3 curated motif set",
      "version": "2026-05 seed",
      "accessDate": "2026-05-02",
      "url": "",
      "citation": "Curated broad PTS1 candidate pattern based on common SKL-like C-terminal tripeptides.",
      "license": "Project-curated illustrative motif."
    },
    "description": "Broad SKL-like candidate peroxisomal targeting signal at the protein C terminus.",
    "scope": "Protein sequences; candidate C-terminal motif only.",
    "match": {
      "strand": "not-applicable",
      "coordinateSystem": "1-based inclusive",
      "overlappingDefault": true,
      "score": "not-applicable",
      "assumptions": "Regular-expression match requires the motif at the cleaned protein C terminus; organism-specific PTS1 rules are not modeled."
    }
  }
];

export default proteinMotifs;
