const DELIMITER_CANDIDATES = [
  { id: "tab", label: "Tab", value: "\t" },
  { id: "comma", label: "Comma", value: "," },
  { id: "semicolon", label: "Semicolon", value: ";" },
  { id: "pipe", label: "Pipe", value: "|" }
];

function makeWarning(message) {
  return message;
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && character === delimiter) {
      count += 1;
    }
  }

  return count;
}

function splitPhysicalLines(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n").split("\n").filter((line) => line.length > 0);
}

export function detectDelimiter(text) {
  const lines = splitPhysicalLines(text).slice(0, 25);
  if (lines.length === 0) {
    return { delimiter: "\t", delimiterId: "tab", confidence: 0 };
  }

  const scored = DELIMITER_CANDIDATES.map((candidate) => {
    const counts = lines.map((line) => countDelimiterOutsideQuotes(line, candidate.value));
    const positiveCounts = counts.filter((count) => count > 0);
    if (positiveCounts.length === 0) {
      return { ...candidate, score: 0, consistency: 0, averageFields: 1 };
    }

    const frequencies = new Map();
    for (const count of positiveCounts) {
      frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
    }
    const mostCommon = [...frequencies.entries()].sort((a, b) => b[1] - a[1])[0];
    const consistency = mostCommon[1] / positiveCounts.length;
    const coverage = positiveCounts.length / lines.length;
    const averageFields = positiveCounts.reduce((total, count) => total + count + 1, 0) / positiveCounts.length;

    return {
      ...candidate,
      score: consistency * coverage * averageFields,
      consistency,
      averageFields
    };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  return {
    delimiter: best.value,
    delimiterId: best.id,
    confidence: best.score === 0 ? 0 : Number(Math.min(1, best.consistency).toFixed(3))
  };
}

export function parseDelimitedRows(text, delimiter = "\t") {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let hadQuotedField = false;
  const warnings = [];
  const source = String(text ?? "").replace(/\r\n?/g, "\n");

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
        hadQuotedField = true;
      }
      continue;
    }

    if (!inQuotes && character === delimiter) {
      row.push(field);
      field = "";
      hadQuotedField = false;
      continue;
    }

    if (!inQuotes && character === "\n") {
      row.push(field);
      if (row.some((value) => value.length > 0) || hadQuotedField) {
        rows.push(row);
      }
      row = [];
      field = "";
      hadQuotedField = false;
      continue;
    }

    field += character;
  }

  if (inQuotes) {
    warnings.push(makeWarning("A quoted field was not closed before the end of the input."));
  }

  row.push(field);
  if (row.some((value) => value.length > 0) || hadQuotedField) {
    rows.push(row);
  }

  return { rows, warnings };
}

function normalizeColumnId(label, index, usedIds) {
  const base = String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `column_${index + 1}`;
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function inferColumnType(values) {
  const nonEmpty = values.filter((value) => String(value ?? "").trim() !== "");
  if (nonEmpty.length === 0) {
    return "string";
  }
  const numeric = nonEmpty.every((value) => Number.isFinite(Number(String(value).trim())));
  return numeric ? "number" : "string";
}

export function buildTableFromRows(parsedRows, { hasHeader = true } = {}) {
  const warnings = [];
  if (parsedRows.length === 0) {
    return { columns: [], rows: [], warnings: [makeWarning("No table rows were found.")] };
  }

  const expectedWidth = Math.max(...parsedRows.map((row) => row.length));
  const rawHeader = hasHeader
    ? parsedRows[0]
    : Array.from({ length: expectedWidth }, (_, index) => `Column ${index + 1}`);
  const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;

  const usedIds = new Set();
  const seenLabels = new Map();
  const columns = Array.from({ length: expectedWidth }, (_, index) => {
    const rawLabel = String(rawHeader[index] ?? "").trim();
    const label = rawLabel || `Column ${index + 1}`;
    if (!rawLabel) {
      warnings.push(makeWarning(`Column ${index + 1} had an empty header; renamed to "${label}".`));
    }
    const duplicateCount = seenLabels.get(label.toLowerCase()) ?? 0;
    seenLabels.set(label.toLowerCase(), duplicateCount + 1);
    if (duplicateCount > 0) {
      warnings.push(makeWarning(`Duplicate header "${label}" was renamed internally.`));
    }
    return {
      id: normalizeColumnId(label, index, usedIds),
      label,
      type: "string"
    };
  });

  const rows = dataRows.map((dataRow, rowIndex) => {
    if (dataRow.length !== expectedWidth) {
      warnings.push(
        makeWarning(`Row ${hasHeader ? rowIndex + 2 : rowIndex + 1} has ${dataRow.length} field(s); expected ${expectedWidth}.`)
      );
    }
    return Object.fromEntries(
      columns.map((column, columnIndex) => [column.id, dataRow[columnIndex] ?? ""])
    );
  });

  for (const column of columns) {
    column.type = inferColumnType(rows.map((row) => row[column.id]));
    if (rows.length > 0 && rows.every((row) => String(row[column.id] ?? "").trim() === "")) {
      warnings.push(makeWarning(`Column "${column.label}" is empty for all rows.`));
    }
  }

  return { columns, rows, warnings };
}

export function parseDelimitedTable(input, options = {}) {
  const delimiterChoice = options.delimiter ?? "auto";
  const detection = delimiterChoice === "auto"
    ? detectDelimiter(input)
    : {
      delimiter: DELIMITER_CANDIDATES.find((candidate) => candidate.id === delimiterChoice)?.value ?? "\t",
      delimiterId: delimiterChoice,
      confidence: 1
    };
  const parsed = parseDelimitedRows(input, detection.delimiter);
  const table = buildTableFromRows(parsed.rows, { hasHeader: options.hasHeader !== false });

  return {
    delimiter: detection.delimiter,
    delimiterId: detection.delimiterId,
    delimiterConfidence: detection.confidence,
    columns: table.columns,
    rows: table.rows,
    warnings: [...parsed.warnings, ...table.warnings]
  };
}

export function findColumn(columns, name) {
  const query = String(name ?? "").trim().toLowerCase();
  if (!query) {
    return null;
  }
  return columns.find(
    (column) => column.id.toLowerCase() === query || column.label.toLowerCase() === query
  ) ?? null;
}

export function parseColumnList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compareValues(left, right, type) {
  if (type === "number") {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber - rightNumber;
    }
  }
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
}

export function applyTableOperations(table, options = {}) {
  const warnings = [];
  let columns = table.columns.map((column) => ({ ...column }));
  let rows = table.rows.map((row) => ({ ...row }));

  const filterColumn = findColumn(columns, options.filterColumn);
  const filterOperator = options.filterOperator ?? "none";
  if (filterOperator !== "none") {
    if (!filterColumn) {
      warnings.push(makeWarning(`Filter column "${options.filterColumn ?? ""}" was not found.`));
    } else {
      const filterValue = String(options.filterValue ?? "");
      const filterNumber = Number(filterValue);
      rows = rows.filter((row) => {
        const cell = String(row[filterColumn.id] ?? "");
        const cellNumber = Number(cell);
        if (filterOperator === "contains") {
          return cell.toLowerCase().includes(filterValue.toLowerCase());
        }
        if (filterOperator === "equals") {
          return cell === filterValue;
        }
        if (filterOperator === "not_empty") {
          return cell.trim() !== "";
        }
        if (filterOperator === "empty") {
          return cell.trim() === "";
        }
        if (!Number.isFinite(cellNumber) || !Number.isFinite(filterNumber)) {
          return false;
        }
        if (filterOperator === "gt") {
          return cellNumber > filterNumber;
        }
        if (filterOperator === "gte") {
          return cellNumber >= filterNumber;
        }
        if (filterOperator === "lt") {
          return cellNumber < filterNumber;
        }
        if (filterOperator === "lte") {
          return cellNumber <= filterNumber;
        }
        return true;
      });
    }
  }

  const sortColumn = findColumn(columns, options.sortColumn);
  const sortDirection = options.sortDirection ?? "none";
  if (sortDirection !== "none") {
    if (!sortColumn) {
      warnings.push(makeWarning(`Sort column "${options.sortColumn ?? ""}" was not found.`));
    } else {
      rows = [...rows].sort((left, right) => {
        const comparison = compareValues(left[sortColumn.id], right[sortColumn.id], sortColumn.type);
        return sortDirection === "desc" ? -comparison : comparison;
      });
    }
  }

  const columnAction = options.columnAction ?? (options.selectedColumns ? "keep" : "all");
  const selectedNames = parseColumnList(options.columnList ?? options.selectedColumns);
  if (columnAction === "keep" && selectedNames.length > 0) {
    const selectedColumns = [];
    for (const name of selectedNames) {
      const column = findColumn(columns, name);
      if (column) {
        selectedColumns.push(column);
      } else {
        warnings.push(makeWarning(`Column "${name}" was requested but not found.`));
      }
    }
    if (selectedColumns.length > 0) {
      columns = selectedColumns;
      rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column.id, row[column.id] ?? ""])));
    }
  } else if (columnAction === "remove" && selectedNames.length > 0) {
    const removeColumns = new Set();
    for (const name of selectedNames) {
      const column = findColumn(columns, name);
      if (column) {
        removeColumns.add(column.id);
      } else {
        warnings.push(makeWarning(`Column "${name}" was requested but not found.`));
      }
    }
    const keptColumns = columns.filter((column) => !removeColumns.has(column.id));
    if (keptColumns.length > 0) {
      columns = keptColumns;
      rows = rows.map((row) => Object.fromEntries(columns.map((column) => [column.id, row[column.id] ?? ""])));
    } else if (removeColumns.size > 0) {
      warnings.push(makeWarning("Column removal was ignored because it would remove every column."));
    }
  }

  if (options.removeDuplicates === true) {
    const seen = new Set();
    rows = rows.filter((row) => {
      const key = JSON.stringify(columns.map((column) => row[column.id] ?? ""));
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return { columns, rows, warnings };
}

function escapeDelimitedValue(value, delimiter) {
  const text = String(value ?? "");
  if (text.includes('"') || text.includes("\n") || text.includes("\r") || text.includes(delimiter)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function exportDelimitedTable(columns, rows, delimiter = "\t") {
  const lines = [
    columns.map((column) => escapeDelimitedValue(column.label, delimiter)).join(delimiter)
  ];

  for (const row of rows) {
    lines.push(columns.map((column) => escapeDelimitedValue(row[column.id], delimiter)).join(delimiter));
  }

  return lines.join("\n");
}

export function summarizeTable(columns, rows, delimiterId = "tab") {
  const lines = [
    "Table summary",
    `Delimiter: ${delimiterId}`,
    `Columns: ${columns.length}`,
    `Rows: ${rows.length}`
  ];
  if (columns.length > 0) {
    lines.push(`Column names: ${columns.map((column) => column.label).join(", ")}`);
  }
  return lines.join("\n");
}
