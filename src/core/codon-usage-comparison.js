export const codonUsageComparisonTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "reference_id", label: "Reference ID", type: "string" },
  { id: "amino_acid", label: "Amino acid", type: "string" },
  { id: "codon", label: "Codon", type: "string" },
  { id: "observed_count", label: "Observed count", type: "number" },
  { id: "observed_per_1000", label: "Observed per 1000", type: "number" },
  { id: "reference_per_1000", label: "Reference per 1000", type: "number" },
  { id: "per_1000_difference", label: "Per 1000 difference", type: "number" },
  { id: "observed_fraction", label: "Observed fraction", type: "number" },
  { id: "reference_fraction", label: "Reference fraction", type: "number" },
  { id: "fraction_difference", label: "Fraction difference", type: "number" },
  { id: "fraction_ratio", label: "Fraction ratio", type: "number" },
  { id: "amino_acid_total", label: "Amino acid total", type: "number" }
];

function makeRatio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export function compareCodonUsageRows(observedRows = [], reference) {
  if (!reference) {
    return [];
  }

  return observedRows.map((row) => {
    const referenceCodon = reference.codons?.[row.codon] ?? {};
    const referencePer1000 = referenceCodon.perThousand ?? 0;
    const referenceFraction = referenceCodon.fraction ?? 0;
    const observedPer1000 = row.per_1000 ?? 0;
    const observedFraction = row.fraction ?? 0;

    return {
      record: row.record,
      reference_id: reference.id,
      amino_acid: row.amino_acid,
      codon: row.codon,
      observed_count: row.count ?? 0,
      observed_per_1000: observedPer1000,
      reference_per_1000: referencePer1000,
      per_1000_difference: observedPer1000 - referencePer1000,
      observed_fraction: observedFraction,
      reference_fraction: referenceFraction,
      fraction_difference: observedFraction - referenceFraction,
      fraction_ratio: makeRatio(observedFraction, referenceFraction),
      amino_acid_total: row.amino_acid_total ?? 0
    };
  });
}
