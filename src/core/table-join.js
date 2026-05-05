import {
  exportDelimitedTable,
  findColumn,
  parseColumnList,
  parseDelimitedTable
} from "./table.js";

function splitTableInputs(input, separator) {
  const lines = String(input ?? "").replace(/\r\n?/g, "\n").split("\n");
  const splitIndex = lines.findIndex((line) => line.trim() === separator);
  if (splitIndex === -1) {
    return {
      leftText: String(input ?? ""),
      rightText: "",
      warnings: [`Separator line "${separator}" was not found; right table is empty.`]
    };
  }
  return {
    leftText: lines.slice(0, splitIndex).join("\n"),
    rightText: lines.slice(splitIndex + 1).join("\n"),
    warnings: []
  };
}

function normalizeColumnId(label, usedIds) {
  const base = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "column";
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function resolveKeyColumns(columns, value, side, warnings) {
  const names = parseColumnList(value);
  const resolved = [];
  for (const name of names) {
    const column = findColumn(columns, name);
    if (column) {
      resolved.push(column);
    } else {
      warnings.push(`${side} key column "${name}" was not found.`);
    }
  }
  return resolved;
}

function makeKey(row, columns, caseSensitive) {
  return JSON.stringify(columns.map((column) => {
    const value = String(row[column.id] ?? "").trim();
    return caseSensitive ? value : value.toLowerCase();
  }));
}

function indexRows(rows, keyColumns, caseSensitive) {
  const index = new Map();
  for (const row of rows) {
    const key = makeKey(row, keyColumns, caseSensitive);
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key).push(row);
  }
  return index;
}

function addOutputColumns(leftColumns, rightColumns, rightKeyColumns) {
  const usedIds = new Set();
  const outputColumns = [];
  const mappings = [];
  for (const column of leftColumns) {
    const output = {
      id: normalizeColumnId(column.label, usedIds),
      label: column.label,
      type: column.type ?? "string"
    };
    outputColumns.push(output);
    mappings.push({ side: "left", source: column, output });
  }
  const rightKeyIds = new Set(rightKeyColumns.map((column) => column.id));
  for (const column of rightColumns) {
    if (rightKeyIds.has(column.id)) {
      continue;
    }
    const output = {
      id: normalizeColumnId(column.label, usedIds),
      label: column.label,
      type: column.type ?? "string"
    };
    outputColumns.push(output);
    mappings.push({ side: "right", source: column, output });
  }
  return { outputColumns, mappings };
}

function combineRows(leftRow, rightRow, mappings) {
  const output = {};
  for (const mapping of mappings) {
    const sourceRow = mapping.side === "left" ? leftRow : rightRow;
    output[mapping.output.id] = sourceRow?.[mapping.source.id] ?? "";
  }
  return output;
}

export function joinTables(input, options = {}) {
  const separator = String(options.separator ?? "---").trim() || "---";
  const split = splitTableInputs(input, separator);
  const delimiter = options.delimiter ?? "auto";
  const left = parseDelimitedTable(split.leftText, {
    delimiter,
    hasHeader: options.hasHeader !== false
  });
  const right = parseDelimitedTable(split.rightText, {
    delimiter,
    hasHeader: options.hasHeader !== false
  });
  const warnings = [...split.warnings, ...left.warnings.map((warning) => `Left table: ${warning}`), ...right.warnings.map((warning) => `Right table: ${warning}`)];
  const leftKeyColumns = resolveKeyColumns(left.columns, options.leftKeyColumns ?? "sample_id", "Left", warnings);
  const rightKeyColumns = resolveKeyColumns(right.columns, options.rightKeyColumns ?? options.leftKeyColumns ?? "sample_id", "Right", warnings);
  const joinType = ["inner", "left", "full"].includes(options.joinType) ? options.joinType : "inner";
  const caseSensitive = options.caseSensitive === true;
  const rightIndex = indexRows(right.rows, rightKeyColumns, caseSensitive);
  const matchedRightRows = new Set();
  const { outputColumns, mappings } = addOutputColumns(left.columns, right.columns, rightKeyColumns);
  const outputRows = [];

  for (const leftRow of left.rows) {
    const key = makeKey(leftRow, leftKeyColumns, caseSensitive);
    const matches = rightIndex.get(key) ?? [];
    if (matches.length === 0) {
      if (joinType === "left" || joinType === "full") {
        outputRows.push(combineRows(leftRow, null, mappings));
      }
      continue;
    }
    for (const rightRow of matches) {
      matchedRightRows.add(rightRow);
      outputRows.push(combineRows(leftRow, rightRow, mappings));
    }
  }
  if (joinType === "full") {
    for (const rightRow of right.rows) {
      if (!matchedRightRows.has(rightRow)) {
        outputRows.push(combineRows(null, rightRow, mappings));
      }
    }
  }

  const duplicateLeftKeys = [...indexRows(left.rows, leftKeyColumns, caseSensitive).values()].filter((rows) => rows.length > 1).length;
  const duplicateRightKeys = [...rightIndex.values()].filter((rows) => rows.length > 1).length;
  if (duplicateLeftKeys > 0) {
    warnings.push(`Left table contains ${duplicateLeftKeys} duplicate key group(s); joined rows may be repeated.`);
  }
  if (duplicateRightKeys > 0) {
    warnings.push(`Right table contains ${duplicateRightKeys} duplicate key group(s); joined rows may be repeated.`);
  }

  const report = [
    "Table join",
    "",
    `Join type: ${joinType}`,
    `Left rows: ${left.rows.length}`,
    `Right rows: ${right.rows.length}`,
    `Output rows: ${outputRows.length}`,
    `Left key columns: ${leftKeyColumns.map((column) => column.label).join(", ") || "none"}`,
    `Right key columns: ${rightKeyColumns.map((column) => column.label).join(", ") || "none"}`
  ].join("\n");

  return {
    left,
    right,
    outputColumns,
    outputRows,
    report,
    warnings
  };
}

export function makeJoinedTableTsv(columns, rows) {
  return exportDelimitedTable(columns, rows, "\t");
}
