import { getCodonsForCode } from "./genetic-code.js";

const DNA_IUPAC_BY_BASES = new Map([
  ["A", "A"],
  ["C", "C"],
  ["G", "G"],
  ["T", "T"],
  ["AC", "M"],
  ["AG", "R"],
  ["AT", "W"],
  ["CG", "S"],
  ["CT", "Y"],
  ["GT", "K"],
  ["ACG", "V"],
  ["ACT", "H"],
  ["AGT", "D"],
  ["CGT", "B"],
  ["ACGT", "N"]
]);

const AMBIGUOUS_PROTEIN_RESIDUES = {
  B: ["D", "N"],
  J: ["I", "L"],
  Z: ["E", "Q"],
  X: []
};

export const reverseTranslateTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "reference_id", label: "Reference ID", type: "string" },
  { id: "reference_name", label: "Reference", type: "string" },
  { id: "reference_source", label: "Reference source", type: "string" },
  { id: "position", label: "Position", type: "number" },
  { id: "residue", label: "Residue", type: "string" },
  { id: "codon", label: "Codon", type: "string" },
  { id: "candidate_codons", label: "Candidate codons", type: "string" },
  { id: "reference_fraction", label: "Reference fraction", type: "number" },
  { id: "reference_per_1000", label: "Reference per 1000", type: "number" },
  { id: "mode", label: "Mode", type: "string" },
  { id: "note", label: "Note", type: "string" }
];

function sortCodonsByGeneticCodeOrder(codeId) {
  const order = new Map(getCodonsForCode(codeId).map((item, index) => [item.codon, index]));
  return (left, right) => (order.get(left) ?? 999) - (order.get(right) ?? 999);
}

export function getCodonsByAminoAcid(reference) {
  const codeId = reference?.geneticCode?.id ?? "1";
  const byAminoAcid = new Map();

  for (const item of getCodonsForCode(codeId)) {
    const codonRecord = reference?.codons?.[item.codon] ?? {};
    const codon = {
      codon: item.codon,
      aminoAcid: item.aa,
      referenceFraction: codonRecord.fraction ?? 0,
      referencePer1000: codonRecord.perThousand ?? 0,
      referenceCount: codonRecord.count ?? 0
    };
    byAminoAcid.set(item.aa, [...(byAminoAcid.get(item.aa) ?? []), codon]);
  }

  return byAminoAcid;
}

function getCandidateCodons(residue, codonsByAminoAcid) {
  if (residue === "X") {
    return [...codonsByAminoAcid.entries()]
      .filter(([aminoAcid]) => aminoAcid !== "*")
      .flatMap(([, codons]) => codons);
  }

  const possibleResidues = AMBIGUOUS_PROTEIN_RESIDUES[residue] ?? [residue];
  return possibleResidues.flatMap((aminoAcid) => codonsByAminoAcid.get(aminoAcid) ?? []);
}

function chooseMostLikelyCodon(candidateCodons, codeId) {
  const ordered = [...candidateCodons].sort((left, right) => {
    const fractionDifference = right.referenceFraction - left.referenceFraction;
    if (fractionDifference !== 0) {
      return fractionDifference;
    }
    const per1000Difference = right.referencePer1000 - left.referencePer1000;
    if (per1000Difference !== 0) {
      return per1000Difference;
    }
    return sortCodonsByGeneticCodeOrder(codeId)(left.codon, right.codon);
  });

  return ordered[0];
}

function collapseBaseSetToIupac(bases) {
  const key = [...new Set(bases)].sort().join("");
  return DNA_IUPAC_BY_BASES.get(key) ?? "N";
}

function makeDegenerateCodon(candidateCodons) {
  if (candidateCodons.length === 0) {
    return "NNN";
  }

  const positions = [0, 1, 2].map((position) =>
    collapseBaseSetToIupac(candidateCodons.map((candidate) => candidate.codon[position]))
  );
  return positions.join("");
}

export function reverseTranslateProteinSequence(sequence, reference, options = {}) {
  const mode = options.mode === "degenerate" ? "degenerate" : "most-likely";
  const codeId = reference?.geneticCode?.id ?? "1";
  const codonsByAminoAcid = getCodonsByAminoAcid(reference);
  const dnaParts = [];
  const rows = [];
  const warnings = [];
  const residues = String(sequence ?? "").toUpperCase();

  for (const [index, residue] of Array.from(residues).entries()) {
    let note = "";
    const candidateCodons = getCandidateCodons(residue, codonsByAminoAcid);

    if (candidateCodons.length === 0) {
      dnaParts.push("NNN");
      note = "No codon candidates";
      warnings.push(`Position ${index + 1}: no codon candidates for residue ${residue}; used NNN.`);
      rows.push({
        position: index + 1,
        residue,
        codon: "NNN",
        candidate_codons: "",
        reference_fraction: 0,
        reference_per_1000: 0,
        mode,
        note
      });
      continue;
    }

    if (Object.hasOwn(AMBIGUOUS_PROTEIN_RESIDUES, residue)) {
      if (residue === "X") {
        note = "Ambiguous residue X";
        warnings.push(`Position ${index + 1}: residue X was reverse translated as ${mode === "degenerate" ? "NNN" : "the highest-scoring available codon"}.`);
      } else {
        note = `Ambiguous residue ${residue}`;
        warnings.push(`Position ${index + 1}: residue ${residue} was interpreted as ${AMBIGUOUS_PROTEIN_RESIDUES[residue].join(" or ")}.`);
      }
    }

    const codon =
      mode === "degenerate" ? makeDegenerateCodon(candidateCodons) : chooseMostLikelyCodon(candidateCodons, codeId)?.codon ?? "NNN";
    const selectedCodon = candidateCodons.find((candidate) => candidate.codon === codon);
    dnaParts.push(codon);
    rows.push({
      position: index + 1,
      residue,
      codon,
      candidate_codons: candidateCodons.map((candidate) => candidate.codon).sort(sortCodonsByGeneticCodeOrder(codeId)).join(","),
      reference_fraction: selectedCodon?.referenceFraction ?? 0,
      reference_per_1000: selectedCodon?.referencePer1000 ?? 0,
      mode,
      note
    });
  }

  return {
    dna: dnaParts.join(""),
    rows,
    warnings
  };
}
