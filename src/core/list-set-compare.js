import { exportDelimitedTable } from "./table.js";

export const listSetCompareColumns = [
  { id: "item", label: "Item", type: "string" },
  { id: "in_a", label: "In A", type: "boolean" },
  { id: "in_b", label: "In B", type: "boolean" },
  { id: "count_a", label: "Count A", type: "number" },
  { id: "count_b", label: "Count B", type: "number" },
  { id: "lists", label: "Lists", type: "string" },
  { id: "total_count", label: "Total count", type: "number" },
  { id: "category", label: "Category", type: "string" }
];

function listName(index) {
  return String.fromCharCode(65 + index);
}

function parseInputLists(input, separator) {
  const lines = String(input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const lists = [[]];
  for (const line of lines) {
    if (line.trim() === separator) {
      lists.push([]);
    } else {
      lists[lists.length - 1].push(line);
    }
  }
  if (lists.length === 1) {
    return {
      lists,
      warnings: [`Separator line "${separator}" was not found; all input was treated as list A.`]
    };
  }
  return {
    lists,
    warnings: []
  };
}

function normalizeItem(item, options) {
  const trimmed = options.trimItems !== false ? String(item ?? "").trim() : String(item ?? "");
  return options.caseSensitive === true ? trimmed : trimmed.toLowerCase();
}

function countItems(lines, options) {
  const counts = new Map();
  const labels = new Map();
  for (const line of lines) {
    const label = options.trimItems !== false ? String(line ?? "").trim() : String(line ?? "");
    if (!label || (options.ignoreCommentLines !== false && label.startsWith("#"))) {
      continue;
    }
    const key = normalizeItem(label, options);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!labels.has(key)) {
      labels.set(key, label);
    }
  }
  return { counts, labels };
}

function orderedKeys(countSets) {
  const keys = [];
  const seen = new Set();
  for (const counts of countSets) {
    for (const key of counts.keys()) {
      if (!seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    }
  }
  return keys;
}

export function compareLists(input, options = {}) {
  const separator = String(options.separator ?? "---").trim() || "---";
  const parsed = parseInputLists(input, separator);
  const lists = parsed.lists.map((list) => countItems(list, options));
  const rows = orderedKeys(lists.map((list) => list.counts)).map((key) => {
    const counts = lists.map((list) => list.counts.get(key) ?? 0);
    const presentIndexes = counts.map((count, index) => count > 0 ? index : -1).filter((index) => index >= 0);
    const item = lists.find((list) => list.labels.has(key))?.labels.get(key) ?? key;
    const inA = counts[0] > 0;
    const inB = counts[1] > 0;
    const listNames = presentIndexes.map(listName);
    const category = presentIndexes.length === lists.length
      ? "shared_all"
      : presentIndexes.length === 1
        ? `${listNames[0].toLowerCase()}_only`
        : `shared_${listNames.join("").toLowerCase()}`;
    return {
      item,
      in_a: inA,
      in_b: inB,
      count_a: counts[0] ?? 0,
      count_b: counts[1] ?? 0,
      lists: listNames.join(","),
      total_count: counts.reduce((sum, count) => sum + count, 0),
      category
    };
  });
  const shared = rows.filter((row) => row.category === "shared_all");
  const aOnly = rows.filter((row) => row.category === "a_only");
  const bOnly = rows.filter((row) => row.category === "b_only");
  const perListLines = lists.map((list, index) => `List ${listName(index)} unique items: ${list.counts.size}`);
  const report = [
    "List set compare",
    "",
    `Lists compared: ${lists.length}`,
    ...perListLines,
    `Shared by all lists: ${shared.length}`,
    `A-only items: ${aOnly.length}`,
    `B-only items: ${bOnly.length}`,
    `Case-sensitive: ${options.caseSensitive === true ? "yes" : "no"}`
  ].join("\n");

  return {
    rows,
    shared,
    aOnly,
    bOnly,
    listCount: lists.length,
    listSizes: lists.map((list) => list.counts.size),
    report,
    warnings: parsed.warnings
  };
}

export function makeListSetTableTsv(rows) {
  return exportDelimitedTable(listSetCompareColumns, rows, "\t");
}

export function formatItemList(rows) {
  return rows.map((row) => row.item).join("\n");
}

export function makeListSetVennSvg(result) {
  const listCount = result.listCount ?? 2;
  if (listCount < 2 || listCount > 3) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 180" role="img" aria-label="Venn diagram unavailable"><style>text{font:14px system-ui,sans-serif;fill:#111827}.note{fill:#475569}</style><text x="32" y="50">Venn diagram</text><text class="note" x="32" y="86">SVG Venn output is available for two or three lists. This run has ${listCount} lists.</text></svg>`;
  }
  const rows = result.rows ?? [];
  const count = (predicate) => rows.filter(predicate).length;
  const aOnly = count((row) => row.category === "a_only");
  const bOnly = count((row) => row.category === "b_only");
  const all = count((row) => row.category === "shared_all");
  const abOnly = listCount === 3 ? count((row) => row.category === "shared_ab") : all;
  const cOnly = count((row) => row.category === "c_only");
  const acOnly = count((row) => row.category === "shared_ac");
  const bcOnly = count((row) => row.category === "shared_bc");
  if (listCount === 2) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 300" role="img" aria-label="Two-list Venn diagram"><style>.circle{fill-opacity:.28;stroke-width:2}.label{font:600 15px system-ui,sans-serif;fill:#111827}.count{font:700 18px system-ui,sans-serif;fill:#111827}.title{font:600 18px system-ui,sans-serif;fill:#111827}</style><text class="title" x="32" y="34">List set compare</text><circle class="circle" cx="245" cy="150" r="105" fill="#60a5fa" stroke="#2563eb"></circle><circle class="circle" cx="375" cy="150" r="105" fill="#f59e0b" stroke="#d97706"></circle><text class="label" x="190" y="268">List A</text><text class="label" x="390" y="268">List B</text><text class="count" x="190" y="155" text-anchor="middle">${aOnly}</text><text class="count" x="310" y="155" text-anchor="middle">${all}</text><text class="count" x="430" y="155" text-anchor="middle">${bOnly}</text></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 380" role="img" aria-label="Three-list Venn diagram"><style>.circle{fill-opacity:.28;stroke-width:2}.label{font:600 15px system-ui,sans-serif;fill:#111827}.count{font:700 17px system-ui,sans-serif;fill:#111827}.title{font:600 18px system-ui,sans-serif;fill:#111827}</style><text class="title" x="32" y="34">List set compare</text><circle class="circle" cx="285" cy="160" r="112" fill="#60a5fa" stroke="#2563eb"></circle><circle class="circle" cx="395" cy="160" r="112" fill="#f59e0b" stroke="#d97706"></circle><circle class="circle" cx="340" cy="250" r="112" fill="#34d399" stroke="#059669"></circle><text class="label" x="205" y="305">List A</text><text class="label" x="445" y="305">List B</text><text class="label" x="322" y="356">List C</text><text class="count" x="240" y="145" text-anchor="middle">${aOnly}</text><text class="count" x="440" y="145" text-anchor="middle">${bOnly}</text><text class="count" x="340" y="300" text-anchor="middle">${cOnly}</text><text class="count" x="340" y="135" text-anchor="middle">${abOnly}</text><text class="count" x="292" y="232" text-anchor="middle">${acOnly}</text><text class="count" x="388" y="232" text-anchor="middle">${bcOnly}</text><text class="count" x="340" y="205" text-anchor="middle">${all}</text></svg>`;
}
