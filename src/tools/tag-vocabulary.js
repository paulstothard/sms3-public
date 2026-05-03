export const toolTagVocabulary = [
  "DNA",
  "RNA",
  "protein",
  "table",
  "text",
  "FASTA",
  "CSV",
  "TSV",
  "IUPAC",
  "GC",
  "ORF",
  "GRAVY",
  "Kyte-Doolittle",
  "pI",
  "adapter",
  "annotation",
  "charge",
  "cleaning",
  "codon",
  "composition",
  "contamination",
  "coordinates",
  "digest",
  "enzyme",
  "format conversion",
  "genetic code",
  "hydropathy",
  "map",
  "mass",
  "motif",
  "pattern",
  "plot",
  "primer",
  "reference data",
  "regex",
  "restriction",
  "search",
  "statistics",
  "technical sequence",
  "translation",
  "validation",
  "vector",
  "workflow"
];

export const toolTagVocabularySet = new Set(toolTagVocabulary);

const toolTagOrderGroups = [
  ["DNA", "RNA", "protein", "table", "text"],
  ["FASTA", "CSV", "TSV", "IUPAC"],
  [
    "GC",
    "composition",
    "ORF",
    "genetic code",
    "technical sequence",
    "vector",
    "adapter",
    "primer",
    "contamination",
    "restriction",
    "enzyme",
    "digest",
    "motif",
    "annotation",
    "codon",
    "hydropathy",
    "GRAVY",
    "Kyte-Doolittle",
    "mass",
    "charge",
    "pI",
    "pattern",
    "validation"
  ],
  ["cleaning", "coordinates", "format conversion", "map", "plot", "regex", "search", "statistics", "translation"],
  ["workflow", "reference data"]
];

const toolTagOrderRank = new Map(
  toolTagOrderGroups.flatMap((group, groupIndex) =>
    group.map((tag, tagIndex) => [tag, groupIndex * 100 + tagIndex])
  )
);

export function validateToolTags(metadata) {
  const tags = metadata.tags ?? [];
  const errors = [];
  const seen = new Set();
  let previousRank = -1;
  for (const tag of tags) {
    if (!toolTagVocabularySet.has(tag)) {
      errors.push(`${metadata.id}: unsupported tag "${tag}"`);
    }
    if (seen.has(tag)) {
      errors.push(`${metadata.id}: duplicate tag "${tag}"`);
    }
    const rank = toolTagOrderRank.get(tag);
    if (rank !== undefined && rank < previousRank) {
      errors.push(`${metadata.id}: tag "${tag}" is out of order`);
    }
    previousRank = Math.max(previousRank, rank ?? previousRank);
    seen.add(tag);
  }
  return errors;
}
