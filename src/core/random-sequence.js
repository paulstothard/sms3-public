import { parseSequenceInput } from "./fasta.js";
import { cleanSequence } from "./sequence.js";
import { getCodonsForCode } from "./genetic-code.js";

export const DNA_RNA_RANDOM_ALPHABET = ["A", "C", "G", "T"];
export const RNA_RANDOM_ALPHABET = ["A", "C", "G", "U"];
export const PROTEIN_RANDOM_ALPHABET = ["A", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "P", "Q", "R", "S", "T", "V", "W", "Y"];

export function generateRandomSeed() {
  const bytes = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(36).padStart(7, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36)}`;
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed) || 0x9e3779b9;
  return function seededRandom() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function resolveRandom(options = {}) {
  const seed = String(options.seed ?? "").trim() || generateRandomSeed();
  return {
    seed,
    random: createSeededRandom(seed)
  };
}

export function randomInteger(random, maxExclusive) {
  return Math.floor(random() * Math.max(1, maxExclusive));
}

export function chooseRandom(random, values) {
  return values[randomInteger(random, values.length)];
}

export function randomSequence(length, alphabet, random) {
  const size = Math.max(0, Number.parseInt(length, 10) || 0);
  let sequence = "";
  for (let index = 0; index < size; index += 1) {
    sequence += chooseRandom(random, alphabet);
  }
  return sequence;
}

export function shuffleSequence(sequence, random) {
  const characters = Array.from(String(sequence ?? ""));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(random, index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export function sampleSequence(sequence, length, random) {
  const source = Array.from(String(sequence ?? ""));
  if (source.length === 0) {
    return "";
  }
  return randomSequence(length, source, random);
}

export function mutateSequence(sequence, options = {}, random) {
  const source = Array.from(String(sequence ?? ""));
  const alphabet = options.alphabetValues ?? DNA_RNA_RANDOM_ALPHABET;
  const mutationCount = Math.max(0, Number.parseInt(options.mutationCount, 10) || 0);
  const protectedStart = Math.max(0, Number.parseInt(options.protectedStart, 10) || 0);
  const protectedEnd = Math.max(0, Number.parseInt(options.protectedEnd, 10) || 0);
  const mutableStart = Math.min(source.length, protectedStart);
  const mutableEnd = Math.max(mutableStart, source.length - protectedEnd);
  const rows = [];

  if (mutableEnd <= mutableStart) {
    return { sequence: source.join(""), rows };
  }

  for (let index = 0; index < mutationCount; index += 1) {
    const positionIndex = mutableStart + randomInteger(random, mutableEnd - mutableStart);
    const original = source[positionIndex] ?? "";
    const upperOriginal = original.toUpperCase();
    const choices = alphabet.filter((value) => value !== upperOriginal);
    const replacement = chooseRandom(random, choices.length > 0 ? choices : alphabet);
    source[positionIndex] = replacement;
    rows.push({
      mutation_number: index + 1,
      position: positionIndex + 1,
      original,
      replacement
    });
  }

  return { sequence: source.join(""), rows };
}

export function replaceRandomRegions(sequence, options = {}, random) {
  const source = Array.from(String(sequence ?? ""));
  const alphabet = options.alphabetValues ?? DNA_RNA_RANDOM_ALPHABET;
  const regionCount = Math.max(0, Number.parseInt(options.regionCount, 10) || 0);
  const regionLength = Math.max(1, Number.parseInt(options.regionLength, 10) || 1);
  const rows = [];

  if (source.length === 0) {
    return { sequence: "", rows };
  }

  for (let index = 0; index < regionCount; index += 1) {
    const maxStart = Math.max(0, source.length - regionLength);
    const startIndex = randomInteger(random, maxStart + 1);
    const endIndex = Math.min(source.length, startIndex + regionLength);
    const original = source.slice(startIndex, endIndex).join("");
    const replacement = randomSequence(endIndex - startIndex, alphabet, random);
    source.splice(startIndex, endIndex - startIndex, ...Array.from(replacement));
    rows.push({
      region_number: index + 1,
      start: startIndex + 1,
      end: endIndex,
      original,
      replacement
    });
  }

  return { sequence: source.join(""), rows };
}

function normalizeCodon(value) {
  return String(value ?? "").trim().toUpperCase().replace(/U/g, "T");
}

export function buildRandomCodingDnaRecord(options = {}, random) {
  const codonCount = Math.max(2, Number.parseInt(options.codonCount, 10) || 30);
  const codons = getCodonsForCode(options.geneticCode ?? "1");
  const startCodons = codons.filter((item) => item.isStart).map((item) => item.codon);
  const codingCodons = codons.filter((item) => !item.isStop).map((item) => item.codon);
  const stopCodons = codons.filter((item) => item.isStop).map((item) => item.codon);
  const codingCodonSet = new Set(codingCodons);
  const startChoice = String(options.startCodonChoice ?? "random");
  const warnings = [];
  let selectedStartCodon = "";
  let startCodonMode = startChoice;

  if (startChoice === "none") {
    startCodonMode = "none";
  } else if (startChoice === "custom") {
    const customCodon = normalizeCodon(options.customStartCodon);
    if (/^[ACGT]{3}$/.test(customCodon) && codingCodonSet.has(customCodon)) {
      selectedStartCodon = customCodon;
      startCodonMode = "custom";
    } else {
      selectedStartCodon = chooseRandom(random, startCodons.length > 0 ? startCodons : ["ATG"]);
      startCodonMode = "random";
      warnings.push("Custom start codon was not a valid sense codon for the selected genetic code, so a random valid start codon was used.");
    }
  } else if (startChoice.startsWith("codon:")) {
    const selectedCodon = normalizeCodon(startChoice.slice("codon:".length));
    if (/^[ACGT]{3}$/.test(selectedCodon) && codingCodonSet.has(selectedCodon)) {
      selectedStartCodon = selectedCodon;
      startCodonMode = "selected";
    } else {
      selectedStartCodon = chooseRandom(random, startCodons.length > 0 ? startCodons : ["ATG"]);
      startCodonMode = "random";
      warnings.push("Selected start codon was not a valid sense codon for the selected genetic code, so a random valid start codon was used.");
    }
  } else {
    selectedStartCodon = chooseRandom(random, startCodons.length > 0 ? startCodons : ["ATG"]);
    startCodonMode = "random";
  }

  const output = selectedStartCodon ? [selectedStartCodon] : [];
  for (let index = output.length; index < codonCount - 1; index += 1) {
    output.push(chooseRandom(random, codingCodons));
  }
  output.push(chooseRandom(random, stopCodons.length > 0 ? stopCodons : ["TAA"]));
  return {
    sequence: output.join(""),
    startCodon: selectedStartCodon,
    startCodonMode,
    warnings
  };
}

export function randomCodingDnaSequence(options = {}, random) {
  return buildRandomCodingDnaRecord(options, random).sequence;
}

export function parseAndCleanRecords(input, alphabet) {
  const records = parseSequenceInput(input, "sequence");
  let charactersRemoved = 0;
  const cleanedRecords = records.map((record) => {
    const cleaned = cleanSequence(record.sequence, { alphabet, preserveCase: false, keepGaps: false });
    charactersRemoved += cleaned.removedCount;
    return {
      ...record,
      sequence: cleaned.sequence,
      removedCount: cleaned.removedCount
    };
  });
  return { records: cleanedRecords, charactersRemoved };
}
