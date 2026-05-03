const COMMON_CHARACTER_REPLACEMENTS = new Map([
  ["\u00a0", " "],
  ["\u2007", " "],
  ["\u202f", " "],
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201c", "\""],
  ["\u201d", "\""],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2212", "-"],
  ["\u2026", "..."]
]);

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function countMatches(text, pattern) {
  return [...String(text ?? "").matchAll(pattern)].length;
}

function normalizeCommonCharacters(text) {
  let replacements = 0;
  let output = "";
  for (const character of text) {
    if (COMMON_CHARACTER_REPLACEMENTS.has(character)) {
      output += COMMON_CHARACTER_REPLACEMENTS.get(character);
      replacements += 1;
    } else {
      output += character;
    }
  }
  return { text: output, replacements };
}

function trimLine(line, trimMode) {
  if (trimMode === "left") {
    return line.replace(/^\s+/u, "");
  }
  if (trimMode === "right") {
    return line.replace(/\s+$/u, "");
  }
  if (trimMode === "both") {
    return line.trim();
  }
  return line;
}

function convertLeadingSpacesToTabs(line, tabWidth) {
  const match = line.match(/^ +/u);
  if (!match) {
    return line;
  }
  const spaces = match[0].length;
  const tabs = Math.floor(spaces / tabWidth);
  const remainder = spaces % tabWidth;
  return `${"\t".repeat(tabs)}${" ".repeat(remainder)}${line.slice(spaces)}`;
}

function wrapParagraph(paragraph, lineWidth) {
  const words = paragraph.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) {
    return "";
  }
  const lines = [];
  let current = "";
  for (const word of words) {
    const chunks = splitLongWord(word, lineWidth);
    for (const chunk of chunks) {
      if (!current) {
        current = chunk;
      } else if (current.length + 1 + chunk.length <= lineWidth) {
        current = `${current} ${chunk}`;
      } else {
        lines.push(current);
        current = chunk;
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.join("\n");
}

function splitLongWord(word, lineWidth) {
  if (word.length <= lineWidth) {
    return [word];
  }
  const chunks = [];
  for (let index = 0; index < word.length; index += lineWidth) {
    chunks.push(word.slice(index, index + lineWidth));
  }
  return chunks;
}

function splitParagraphs(lines) {
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line.trim() === "") {
      if (current.length > 0) {
        paragraphs.push(current);
        current = [];
      }
      paragraphs.push(null);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    paragraphs.push(current);
  }
  return paragraphs;
}

function applyWrapMode(lines, wrapMode, lineWidth) {
  if (wrapMode === "preserve") {
    return lines;
  }

  const paragraphs = splitParagraphs(lines);
  const output = [];
  for (const paragraph of paragraphs) {
    if (paragraph === null) {
      if (output.length === 0 || output[output.length - 1] !== "") {
        output.push("");
      }
      continue;
    }
    const unwrapped = paragraph.map((line) => line.trim()).join(" ").replace(/ {2,}/gu, " ");
    if (wrapMode === "wrap") {
      output.push(...wrapParagraph(unwrapped, lineWidth).split("\n"));
    } else {
      output.push(unwrapped);
    }
  }
  return output;
}

function countLineEndingStyle(text) {
  const crlf = countMatches(text, /\r\n/g);
  const normalized = text.replace(/\r\n/g, "");
  const cr = countMatches(normalized, /\r/g);
  const lf = countMatches(normalized, /\n/g);
  return { crlf, cr, lf };
}

export function cleanFormatText(input, options = {}) {
  const warnings = [];
  const original = String(input ?? "");
  const stats = {
    originalCharacters: original.length,
    originalLines: original.length === 0 ? 0 : original.replace(/\r\n?/g, "\n").split("\n").length,
    finalCharacters: 0,
    finalLines: 0,
    commonCharactersReplaced: 0,
    nonAsciiRemoved: 0,
    blankLinesRemoved: 0,
    tabsConverted: 0,
    leadingSpaceRunsConverted: 0,
    repeatedSpaceRunsCollapsed: 0,
    lineEndingChanges: 0
  };

  if (original.length === 0) {
    warnings.push("No text input was provided.");
  }

  const lineEndings = countLineEndingStyle(original);
  stats.lineEndingChanges = lineEndings.crlf + lineEndings.cr;
  let text = original.replace(/\r\n?/g, "\n");

  if (options.normalizeCommonCharacters !== false) {
    const normalized = normalizeCommonCharacters(text);
    text = normalized.text;
    stats.commonCharactersReplaced = normalized.replacements;
  }

  if (options.removeNonAscii === true) {
    const before = text.length;
    text = text.replace(/[^\x09\x0a\x20-\x7e]/gu, "");
    stats.nonAsciiRemoved = before - text.length;
    if (stats.nonAsciiRemoved > 0) {
      warnings.push(`${stats.nonAsciiRemoved} non-ASCII character(s) were removed.`);
    }
  }

  const tabWidth = clampInteger(options.tabWidth, 4, 1, 16);
  if (String(options.tabWidth ?? "") !== "" && Number.parseInt(options.tabWidth, 10) !== tabWidth) {
    warnings.push(`Tab width was limited to ${tabWidth}.`);
  }

  if (options.tabMode === "tabs-to-spaces") {
    stats.tabsConverted = countMatches(text, /\t/g);
    text = text.replace(/\t/g, " ".repeat(tabWidth));
  }

  let lines = text.split("\n");
  lines = lines.map((line) => trimLine(line, options.trimMode ?? "both"));

  if (options.collapseSpaces === true) {
    stats.repeatedSpaceRunsCollapsed = lines.reduce(
      (total, line) => total + countMatches(line, / {2,}/g),
      0
    );
    lines = lines.map((line) => line.replace(/ {2,}/g, " "));
  }

  if (options.tabMode === "spaces-to-tabs") {
    const before = lines.join("\n");
    lines = lines.map((line) => convertLeadingSpacesToTabs(line, tabWidth));
    const after = lines.join("\n");
    stats.leadingSpaceRunsConverted = before === after ? 0 : countMatches(before, /^ +/gm);
  }

  if (options.removeBlankLines === true) {
    const before = lines.length;
    lines = lines.filter((line) => line.trim() !== "");
    stats.blankLinesRemoved = before - lines.length;
  }

  const lineWidth = clampInteger(options.lineWidth, 80, 10, 500);
  if (String(options.lineWidth ?? "") !== "" && Number.parseInt(options.lineWidth, 10) !== lineWidth) {
    warnings.push(`Line width was limited to ${lineWidth}.`);
  }
  lines = applyWrapMode(lines, options.wrapMode ?? "preserve", lineWidth);

  const newline = options.lineEnding === "crlf" ? "\r\n" : "\n";
  text = lines.join(newline);
  stats.finalCharacters = text.length;
  stats.finalLines = text.length === 0 ? 0 : lines.length;

  return {
    text,
    warnings,
    stats,
    changed: text !== original,
    charactersRemoved: Math.max(0, stats.originalCharacters - stats.finalCharacters)
  };
}

export function summarizeTextFormatting(stats, changed) {
  return [
    "Text Cleaner / Formatter",
    "",
    `Changed: ${changed ? "yes" : "no"}`,
    `Original characters: ${stats.originalCharacters}`,
    `Final characters: ${stats.finalCharacters}`,
    `Original lines: ${stats.originalLines}`,
    `Final lines: ${stats.finalLines}`,
    `Line endings normalized: ${stats.lineEndingChanges}`,
    `Common pasted characters replaced: ${stats.commonCharactersReplaced}`,
    `Non-ASCII characters removed: ${stats.nonAsciiRemoved}`,
    `Blank lines removed: ${stats.blankLinesRemoved}`,
    `Tabs converted to spaces: ${stats.tabsConverted}`,
    `Leading space runs converted to tabs: ${stats.leadingSpaceRunsConverted}`,
    `Repeated space runs collapsed: ${stats.repeatedSpaceRunsCollapsed}`
  ].join("\n");
}
