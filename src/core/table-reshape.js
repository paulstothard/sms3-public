import {
  exportDelimitedTable,
  findColumn,
  parseColumnList,
  parseDelimitedTable
} from "./table.js";

function coerceTableInput(input, options = {}) {
  if (input?.kind === "table" && Array.isArray(input.columns) && Array.isArray(input.rows)) {
    return {
      columns: input.columns,
      rows: input.rows,
      delimiterId: "structured table",
      warnings: []
    };
  }
  return parseDelimitedTable(String(input ?? ""), {
    delimiter: options.delimiter ?? "auto",
    hasHeader: options.hasHeader !== false
  });
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

function resolveColumns(columns, value, warnings, label) {
  const names = parseColumnList(value);
  const resolved = [];
  for (const name of names) {
    const column = findColumn(columns, name);
    if (column) {
      resolved.push(column);
    } else {
      warnings.push(`${label} column "${name}" was not found.`);
    }
  }
  return resolved;
}

function aggregateValues(values, mode) {
  if (values.length === 0) {
    return "";
  }
  if (mode === "last") {
    return values[values.length - 1];
  }
  if (mode === "sum" || mode === "mean") {
    const numeric = values.map(Number).filter((value) => Number.isFinite(value));
    if (numeric.length === 0) {
      return "";
    }
    const sum = numeric.reduce((total, value) => total + value, 0);
    return Number((mode === "mean" ? sum / numeric.length : sum).toFixed(6));
  }
  return values[0];
}

function reshapeLongToWide(parsed, options, warnings) {
  const idColumns = resolveColumns(parsed.columns, options.idColumns, warnings, "ID");
  const namesColumn = findColumn(parsed.columns, options.namesFrom);
  const valuesColumn = findColumn(parsed.columns, options.valuesFrom);
  if (!namesColumn) {
    warnings.push(`Names-from column "${options.namesFrom ?? ""}" was not found.`);
  }
  if (!valuesColumn) {
    warnings.push(`Values-from column "${options.valuesFrom ?? ""}" was not found.`);
  }
  if (idColumns.length === 0 || !namesColumn || !valuesColumn) {
    return { columns: [], rows: [] };
  }

  const usedIds = new Set();
  const outputColumns = idColumns.map((column) => ({
    id: normalizeColumnId(column.label, usedIds),
    label: column.label,
    type: column.type ?? "string"
  }));
  const outputColumnByName = new Map();
  const grouped = new Map();
  const aggregate = options.duplicateMode ?? "first";

  for (const row of parsed.rows) {
    const idValues = idColumns.map((column) => String(row[column.id] ?? ""));
    const groupKey = JSON.stringify(idValues);
    const wideName = String(row[namesColumn.id] ?? "").trim();
    if (!wideName) {
      continue;
    }
    if (!outputColumnByName.has(wideName)) {
      const column = {
        id: normalizeColumnId(wideName, usedIds),
        label: wideName,
        type: valuesColumn.type ?? "string"
      };
      outputColumnByName.set(wideName, column);
      outputColumns.push(column);
    }
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, { idValues, values: new Map() });
    }
    const group = grouped.get(groupKey);
    if (!group.values.has(wideName)) {
      group.values.set(wideName, []);
    }
    group.values.get(wideName).push(row[valuesColumn.id] ?? "");
  }

  const rows = [...grouped.values()].map((group) => {
    const outputRow = {};
    idColumns.forEach((column, index) => {
      outputRow[outputColumns[index].id] = group.idValues[index];
    });
    for (const [wideName, column] of outputColumnByName.entries()) {
      outputRow[column.id] = aggregateValues(group.values.get(wideName) ?? [], aggregate);
    }
    return outputRow;
  });
  return { columns: outputColumns, rows };
}

function reshapeWideToLong(parsed, options, warnings) {
  const idColumns = resolveColumns(parsed.columns, options.idColumns, warnings, "ID");
  const valueColumns = resolveColumns(parsed.columns, options.valueColumns, warnings, "Value");
  if (idColumns.length === 0 || valueColumns.length === 0) {
    return { columns: [], rows: [] };
  }

  const usedIds = new Set();
  const outputColumns = [
    ...idColumns.map((column) => ({
      id: normalizeColumnId(column.label, usedIds),
      label: column.label,
      type: column.type ?? "string"
    })),
    { id: normalizeColumnId(options.namesTo || "feature", usedIds), label: options.namesTo || "feature", type: "string" },
    { id: normalizeColumnId(options.valuesTo || "value", usedIds), label: options.valuesTo || "value", type: "string" }
  ];
  const namesToColumn = outputColumns[outputColumns.length - 2];
  const valuesToColumn = outputColumns[outputColumns.length - 1];
  const rows = [];
  for (const row of parsed.rows) {
    for (const valueColumn of valueColumns) {
      const outputRow = {};
      idColumns.forEach((column, index) => {
        outputRow[outputColumns[index].id] = row[column.id] ?? "";
      });
      outputRow[namesToColumn.id] = valueColumn.label;
      outputRow[valuesToColumn.id] = row[valueColumn.id] ?? "";
      rows.push(outputRow);
    }
  }
  return { columns: outputColumns, rows };
}

export function reshapeTable(input, options = {}) {
  const parsed = coerceTableInput(input, options);
  const warnings = [...parsed.warnings];
  const mode = options.mode === "wide-to-long" ? "wide-to-long" : "long-to-wide";
  const reshaped = mode === "wide-to-long"
    ? reshapeWideToLong(parsed, options, warnings)
    : reshapeLongToWide(parsed, options, warnings);

  const report = [
    "Table reshape",
    "",
    `Mode: ${mode}`,
    `Input rows: ${parsed.rows.length}`,
    `Input columns: ${parsed.columns.length}`,
    `Output rows: ${reshaped.rows.length}`,
    `Output columns: ${reshaped.columns.length}`
  ].join("\n");

  return {
    columns: parsed.columns,
    rows: parsed.rows,
    outputColumns: reshaped.columns,
    outputRows: reshaped.rows,
    report,
    warnings,
    delimiterId: parsed.delimiterId
  };
}

export function makeReshapedTableTsv(columns, rows) {
  return exportDelimitedTable(columns, rows, "\t");
}
