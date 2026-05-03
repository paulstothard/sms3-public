const SPLIT_DELIMITERS = {
  lines: /\r\n?|\n/u,
  comma: /,/u,
  semicolon: /;/u,
  tab: /\t/u,
  whitespace: /\s+/u
};

const JOIN_DELIMITERS = {
  lines: "\n",
  comma: ", ",
  semicolon: "; ",
  tab: "\t"
};

function normalizeForCompare(value, caseSensitive) {
  return caseSensitive ? value : value.toLowerCase();
}

function parseNumber(value) {
  const number = Number(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

function compareItems(left, right, sortMode, caseSensitive) {
  if (sortMode === "numeric") {
    const leftNumber = parseNumber(left);
    const rightNumber = parseNumber(right);
    if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    if (leftNumber !== null && rightNumber === null) {
      return -1;
    }
    if (leftNumber === null && rightNumber !== null) {
      return 1;
    }
  }

  return normalizeForCompare(left, caseSensitive).localeCompare(
    normalizeForCompare(right, caseSensitive),
    undefined,
    {
      numeric: sortMode === "natural",
      sensitivity: caseSensitive ? "variant" : "base"
    }
  );
}

function splitItems(input, splitMode) {
  const delimiter = SPLIT_DELIMITERS[splitMode] ?? SPLIT_DELIMITERS.lines;
  return String(input ?? "").split(delimiter);
}

function normalizeItems(items, options, warnings) {
  let normalized = [...items];
  if (options.trimItems !== false) {
    normalized = normalized.map((item) => item.trim());
  }
  if (options.collapseInternalSpaces === true) {
    normalized = normalized.map((item) => item.replace(/ {2,}/g, " "));
  }
  if (options.removeBlankItems !== false) {
    const before = normalized.length;
    normalized = normalized.filter((item) => item !== "");
    const removed = before - normalized.length;
    if (removed > 0) {
      warnings.push(`${removed} blank item${removed === 1 ? "" : "s"} removed.`);
    }
  }
  return normalized;
}

function uniqueItems(items, caseSensitive) {
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = normalizeForCompare(item, caseSensitive);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  return unique;
}

function countItems(items, caseSensitive) {
  const rows = [];
  const indexByKey = new Map();
  for (const item of items) {
    const key = normalizeForCompare(item, caseSensitive);
    const index = indexByKey.get(key);
    if (index === undefined) {
      indexByKey.set(key, rows.length);
      rows.push({ item, count: 1 });
    } else {
      rows[index].count += 1;
    }
  }
  return rows;
}

function makeDelimitedOutput(items, delimiterMode) {
  const delimiter = JOIN_DELIMITERS[delimiterMode] ?? JOIN_DELIMITERS.lines;
  return items.join(delimiter);
}

export const lineListCountColumns = [
  { id: "item", label: "Item", type: "string" },
  { id: "count", label: "Count", type: "number" }
];

export function processLineList(input, options = {}) {
  const warnings = [];
  const splitMode = options.splitMode ?? "lines";
  const operation = options.operation ?? "clean";
  const caseSensitive = options.caseSensitive === true;
  const sortMode = options.sortMode ?? "natural";
  const sortDirection = options.sortDirection === "desc" ? "desc" : "asc";

  const rawItems = splitItems(input, splitMode);
  let items = normalizeItems(rawItems, options, warnings);
  const originalItemCount = rawItems.length;
  const normalizedItemCount = items.length;
  const countRows = countItems(items, caseSensitive)
    .sort((left, right) => {
      const countComparison = right.count - left.count;
      return countComparison === 0 ? compareItems(left.item, right.item, sortMode, caseSensitive) : countComparison;
    });

  if (String(input ?? "").length === 0) {
    warnings.push("No list input was provided.");
  }

  if (operation === "unique") {
    items = uniqueItems(items, caseSensitive);
  } else if (operation === "sort") {
    items = [...items].sort((left, right) => compareItems(left, right, sortMode, caseSensitive));
  } else if (operation === "sort-unique") {
    items = uniqueItems(items, caseSensitive)
      .sort((left, right) => compareItems(left, right, sortMode, caseSensitive));
  } else if (operation === "count") {
    items = countRows.map((row) => `${row.item}\t${row.count}`);
  }

  if (sortDirection === "desc" && operation !== "count") {
    items = [...items].reverse();
  }

  const output = operation === "count"
    ? ["item\tcount", ...items].join("\n")
    : makeDelimitedOutput(items, options.joinMode ?? "lines");

  return {
    output,
    items,
    countRows,
    warnings,
    stats: {
      originalItemCount,
      normalizedItemCount,
      outputItemCount: operation === "count" ? countRows.length : items.length
    }
  };
}

export function summarizeLineList(result, operationLabel) {
  return [
    "Line / List Cleaner",
    "",
    `Operation: ${operationLabel}`,
    `Original items: ${result.stats.originalItemCount}`,
    `Items after cleanup: ${result.stats.normalizedItemCount}`,
    `Output items: ${result.stats.outputItemCount}`
  ].join("\n");
}
