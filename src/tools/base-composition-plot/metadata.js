const TABLE_COLUMNS = [
  { id: "record", label: "Record", type: "string" },
  { id: "window_start", label: "Window start", type: "number" },
  { id: "window_end", label: "Window end", type: "number" },
  { id: "position", label: "Position", type: "number" },
  { id: "window_size", label: "Window size", type: "number" },
  { id: "a_count", label: "A count", type: "number" },
  { id: "c_count", label: "C count", type: "number" },
  { id: "g_count", label: "G count", type: "number" },
  { id: "t_u_count", label: "T/U count", type: "number" },
  { id: "ambiguous_count", label: "Ambiguous count", type: "number" },
  { id: "gc_percent", label: "GC percent", type: "number" },
  { id: "at_percent", label: "AT percent", type: "number" },
  { id: "gc_skew", label: "GC skew", type: "number" },
  { id: "at_skew", label: "AT skew", type: "number" },
  { id: "ambiguous_percent", label: "Ambiguous percent", type: "number" },
  { id: "metric_value", label: "Metric value", type: "number" }
];

export const baseCompositionPlotMetadata = {
  id: "base-composition-plot",
  name: "Base Composition Plot",
  category: "Analyze DNA/RNA",
  tags: ["DNA", "RNA", "GC", "composition", "plot", "workflow"],
  summary: "Plot sliding-window DNA/RNA base composition, GC/AT content, and skew metrics.",
  inputType: "DNA/RNA sequence",
  outputType: "Plot, report, table",
  runInWorker: true,
  workerModule: "../tools/base-composition-plot/run.js",
  workerExport: "runBaseCompositionPlotWorker",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "base-composition-plot", columns: TABLE_COLUMNS },
      { id: "plot", kind: "text", mediaType: "image/svg+xml" },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    { id: "keepGaps", type: "checkbox", label: "Keep gap characters (. and -)", defaultValue: false },
    {
      id: "windowSize",
      type: "number",
      label: "Window size",
      defaultValue: 100,
      min: 1,
      max: 1000000,
      step: 1
    },
    {
      id: "stepSize",
      type: "number",
      label: "Step size",
      defaultValue: 25,
      min: 1,
      max: 1000000,
      step: 1
    },
    {
      id: "metric",
      type: "radio",
      label: "Metric",
      defaultValue: "gc_percent",
      choices: [
        { value: "gc_percent", label: "GC percent" },
        { value: "at_percent", label: "AT percent" },
        { value: "gc_skew", label: "GC skew" },
        { value: "at_skew", label: "AT skew" },
        { value: "ambiguous_percent", label: "Ambiguous percent" }
      ]
    },
    {
      id: "outputFormat",
      type: "radio",
      label: "Copy/download format",
      defaultValue: "svg-plot",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" },
        { value: "svg-plot", label: "SVG composition plot" }
      ]
    },
    {
      id: "methodNote",
      type: "note",
      text: "Percent metrics use A+C+G+T+U as the denominator. Skew metrics return n/a when their denominator is zero."
    }
  ]
};

export const baseCompositionPlotTableColumns = TABLE_COLUMNS;
