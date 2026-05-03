export function makeTextStream(text, mediaType = "text/plain") {
  return {
    kind: "text",
    mediaType,
    text: String(text ?? "")
  };
}

export function makeTableStream(columns, rows, schema = "") {
  return {
    kind: "table",
    schema,
    columns,
    rows
  };
}

export function makeWarningsStream(warnings) {
  return {
    kind: "warnings",
    warnings: warnings.map((message) =>
      typeof message === "string" ? { message } : message
    )
  };
}

export function makeCollectionStream(items, itemKind = "") {
  return {
    kind: "collection",
    itemKind,
    items
  };
}

export function makeToolResult({
  output,
  download,
  warnings = [],
  recordsProcessed = 0,
  basesProcessed = 0,
  charactersRemoved = 0,
  streams = {},
  visual
}) {
  return {
    output,
    download,
    warnings,
    recordsProcessed,
    basesProcessed,
    charactersRemoved,
    streams: {
      primary: makeTextStream(output, download?.mimeType ?? "text/plain"),
      warnings: makeWarningsStream(warnings),
      ...streams
    },
    visual
  };
}
