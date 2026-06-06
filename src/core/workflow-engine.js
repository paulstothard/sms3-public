import { formatFastaRecord, parseSequenceInput } from "./fasta.js";
import { isWorkflowStreamCompatible } from "./workflow-contracts.js";
import { makeCollectionStream, makeTableStream, makeTextStream } from "./workflow.js";

const STEP_TYPES = new Set(["input", "tool", "select-stream", "split", "filter", "sort", "take", "map", "gather"]);

function makeAbortError() {
  const error = new Error("Workflow run was cancelled.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw makeAbortError();
  }
}

function makeToolMap(tools = []) {
  return new Map(tools.map((tool) => [tool.metadata.id, tool]));
}

function makeStepWarning(step, message) {
  return {
    stepId: step.id,
    stepType: step.type,
    message
  };
}

function getToolOutputContract(tool, streamId = "primary") {
  return tool?.metadata.workflow?.outputs?.find((output) => output.id === streamId);
}

function flattenOptions(options = []) {
  return options.flatMap((option) =>
    option.type === "group" ? flattenOptions(option.options ?? []) : [option]
  );
}

function inferOutputFormatForStream(tool, streamName = "primary") {
  if (streamName === "primary") {
    return undefined;
  }

  const outputFormat = flattenOptions(tool?.metadata.options ?? []).find((option) => option.id === "outputFormat");
  const choices = new Set((outputFormat?.choices ?? []).map((choice) => choice.value));
  const candidates = {
    report: ["report"],
    table: ["table", "tsv", "csv"],
    tsv: ["tsv"],
    featuresTsv: ["features-tsv", "tsv"],
    summaryTable: ["summary-tsv", "tsv"],
    codonTable: ["codon-tsv"],
    textMap: ["text-map"],
    overview: ["svg-overview", "linear-svg-map", "svg-map"],
    plot: ["plot", "svg-plot", "svg"],
    viewer: ["interactive-viewer"],
    fasta: ["fasta"],
    sequenceRecords: ["fasta"],
    nucleotideFasta: ["nucleotide-fasta", "fasta"],
    proteinFasta: ["protein-fasta", "fasta"],
    wholeFasta: ["whole-fasta", "fasta"],
    cdsFasta: ["cds-fasta", "fasta"],
    cleanedText: ["cleaned"],
    listText: ["text"],
    groupedText: ["text"],
    text: ["text"]
  }[streamName] ?? [];

  return candidates.find((candidate) => choices.has(candidate));
}

function makeToolOptionsForSelectedStream(tool, step) {
  const options = { ...(step.options ?? {}) };
  if (!Object.hasOwn(options, "outputFormat")) {
    const inferred = inferOutputFormatForStream(tool, step.selectStream ?? "primary");
    if (inferred) {
      options.outputFormat = inferred;
    }
  }
  return options;
}

function makeToolOptionsForInput(tool, step, inputValue) {
  const options = makeToolOptionsForSelectedStream(tool, step);
  return options;
}

function getStream(result, streamName = "primary") {
  if (!result?.streams) {
    return undefined;
  }
  return result.streams[streamName];
}

function getStepStream(stepResult, streamName = "primary") {
  if (!stepResult) {
    return undefined;
  }

  if (streamName === "primary") {
    return stepResult.value;
  }

  return getStream(stepResult.result, streamName);
}

function sequenceRecordsToFasta(stream) {
  return stream.records
    .map((record) => formatFastaRecord(record.title ?? "sequence", record.sequence ?? "", 60))
    .join("\n");
}

function streamToToolInput(value) {
  if (typeof value === "string") {
    return value;
  }

  if (!value) {
    return "";
  }

  if (value.kind === "text") {
    return value.text;
  }

  if (value.kind === "sequence-records") {
    return sequenceRecordsToFasta(value);
  }

  if (value.kind === "orf-records") {
    return value.records
      .map((record) => formatFastaRecord(record.header ?? `${record.record} ORF ${record.orf}`, record.nucleotide ?? "", 60))
      .join("\n");
  }

  if (value.kind === "collection") {
    return value.items.map((item) => streamToToolInput(item)).join("\n");
  }

  return value.text ?? "";
}

function makeSequenceRecordsFromText(text, alphabet = "dna-rna") {
  return {
    kind: "sequence-records",
    schema: "workflow-sequence-records",
    alphabet,
    records: parseSequenceInput(text, "sequence").map((record) => ({
      title: record.title,
      sequence: record.sequence,
      sourceTitle: record.title
    }))
  };
}

function splitSequenceRecords(stream) {
  return makeCollectionStream(
    stream.records.map((record) => ({
      ...stream,
      records: [record]
    })),
    `sequence-records:${stream.alphabet ?? ""}`
  );
}

function compareValue(actual, operator, expected) {
  if (operator === "contains") {
    return String(actual ?? "").includes(String(expected ?? ""));
  }
  if (operator === "matches") {
    return new RegExp(String(expected ?? "")).test(String(actual ?? ""));
  }
  if (operator === "!=") {
    return actual !== expected;
  }
  if (operator === ">") {
    return Number(actual) > Number(expected);
  }
  if (operator === ">=") {
    return Number(actual) >= Number(expected);
  }
  if (operator === "<") {
    return Number(actual) < Number(expected);
  }
  if (operator === "<=") {
    return Number(actual) <= Number(expected);
  }
  return actual === expected;
}

function getFieldValue(item, field) {
  if (field === "length" && typeof item.sequence === "string") {
    return item.sequence.length;
  }
  return item[field];
}

function hasFieldValue(item, field) {
  if (!item || !field) {
    return false;
  }
  return (field === "length" && typeof item.sequence === "string") || Object.hasOwn(item, field);
}

function collectFieldNamesFromItems(items = []) {
  const names = new Set();
  for (const item of items) {
    for (const key of Object.keys(item ?? {})) {
      names.add(key);
    }
    if (typeof item?.sequence === "string") {
      names.add("length");
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right));
}

function collectFieldNames(value) {
  if (value?.kind === "collection") {
    return [...new Set(value.items.flatMap((item) => collectFieldNames(item)))].sort((left, right) => left.localeCompare(right));
  }
  if (value?.kind === "sequence-records") {
    return collectFieldNamesFromItems(value.records);
  }
  if (value?.kind === "table") {
    const columnIds = (value.columns ?? []).map((column) => column.id).filter(Boolean);
    return [...new Set([...columnIds, ...collectFieldNamesFromItems(value.rows)])].sort((left, right) => left.localeCompare(right));
  }
  return [];
}

function streamHasField(value, field) {
  if (!field) {
    return true;
  }
  if (value?.kind === "collection") {
    return value.items.length === 0 || value.items.some((item) => streamHasField(item, field));
  }
  if (value?.kind === "sequence-records") {
    return value.records.length === 0 || value.records.some((record) => hasFieldValue(record, field));
  }
  if (value?.kind === "table") {
    return value.rows.length === 0 || value.rows.some((row) => hasFieldValue(row, field));
  }
  return true;
}

function makeMissingFieldWarnings(step, value, operation) {
  const field = step.criteria?.field;
  if (!field || streamHasField(value, field)) {
    return [];
  }

  const fields = collectFieldNames(value);
  const suffix = fields.length > 0 ? ` Available fields include: ${fields.slice(0, 12).join(", ")}.` : "";
  return [makeStepWarning(step, `Field "${field}" was not found for ${operation}.${suffix}`)];
}

function filterSequenceRecords(stream, criteria = {}) {
  const field = criteria.field ?? "title";
  const operator = criteria.operator ?? "contains";
  const expected = criteria.value ?? "";

  return {
    ...stream,
    records: stream.records.filter((record) => compareValue(getFieldValue(record, field), operator, expected))
  };
}

function filterTable(stream, criteria = {}) {
  const field = criteria.field;
  const operator = criteria.operator ?? "==";
  const expected = criteria.value;

  return {
    ...stream,
    rows: stream.rows.filter((row) => compareValue(row[field], operator, expected))
  };
}

function compareSortValues(left, right, direction = "asc") {
  const multiplier = direction === "desc" ? -1 : 1;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumeric =
    left !== null &&
    left !== undefined &&
    left !== "" &&
    right !== null &&
    right !== undefined &&
    right !== "" &&
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber);

  if (bothNumeric) {
    return (leftNumber - rightNumber) * multiplier;
  }

  return String(left ?? "").localeCompare(String(right ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  }) * multiplier;
}

function sortItems(items, criteria = {}) {
  const field = criteria.field ?? "title";
  const direction = criteria.direction === "desc" ? "desc" : "asc";

  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const comparison = compareSortValues(
        getFieldValue(left.item, field),
        getFieldValue(right.item, field),
        direction
      );
      return comparison || left.index - right.index;
    })
    .map((wrapped) => wrapped.item);
}

function getTakeCount(step) {
  const count = Number.parseInt(step.count ?? 10, 10);
  return Number.isFinite(count) ? Math.max(0, count) : 10;
}

function runTakeStep(step, value) {
  const count = getTakeCount(step);
  if (value?.kind === "collection") {
    return {
      ...value,
      items: value.items.slice(0, count)
    };
  }

  if (value?.kind === "sequence-records") {
    return {
      ...value,
      records: value.records.slice(0, count)
    };
  }

  if (value?.kind === "table") {
    return {
      ...value,
      rows: value.rows.slice(0, count)
    };
  }

  return value;
}

function runSortStep(step, value) {
  if (value?.kind === "collection") {
    return {
      ...value,
      items: value.items.map((item) => runSortStep(step, item))
    };
  }

  if (value?.kind === "sequence-records") {
    return {
      ...value,
      records: sortItems(value.records, step.criteria)
    };
  }

  if (value?.kind === "table") {
    return {
      ...value,
      rows: sortItems(value.rows, step.criteria)
    };
  }

  return value;
}

function gatherSequenceRecordStreams(items) {
  const first = items.find((item) => item.kind === "sequence-records");
  return {
    kind: "sequence-records",
    schema: first?.schema ?? "workflow-gathered-sequence-records",
    alphabet: first?.alphabet ?? "",
    records: items.flatMap((item) => (item.kind === "sequence-records" ? item.records : []))
  };
}

function gatherTableStreams(items) {
  const first = items.find((item) => item.kind === "table");
  return makeTableStream(
    first?.columns ?? [],
    items.flatMap((item) => (item.kind === "table" ? item.rows : [])),
    first?.schema ?? "workflow-gathered-table"
  );
}

function gatherTextStreams(items) {
  return makeTextStream(
    items.map((item) => (item.kind === "text" ? item.text : streamToToolInput(item))).join("\n"),
    "text/plain"
  );
}

function gatherCollection(collection, as = "auto") {
  const items = collection.items ?? [];
  if (items.length === 0) {
    return makeCollectionStream([], collection.itemKind ?? "");
  }

  if (as === "table" || (as === "auto" && items.every((item) => item.kind === "table"))) {
    return gatherTableStreams(items);
  }

  if (as === "text" || (as === "auto" && items.every((item) => item.kind === "text"))) {
    return gatherTextStreams(items);
  }

  if (as === "fasta" || as === "sequence-records" || items.every((item) => item.kind === "sequence-records")) {
    return gatherSequenceRecordStreams(items);
  }

  return collection;
}

function runInputStep(step) {
  if (step.stream?.kind) {
    return step.stream;
  }

  return makeTextStream(step.text ?? "", step.mediaType ?? "text/plain");
}

function runSelectStreamStep(step, context) {
  const source = step.fromStep ? context.stepResults.get(step.fromStep) : { result: context.lastToolResult };
  const stream = step.fromStep ? getStepStream(source, step.stream) : getStream(source.result, step.stream);
  if (!stream) {
    throw new Error(`Step "${step.id}" could not select missing stream "${step.stream}".`);
  }
  return stream;
}

function resolveStepInput(step, value, context) {
  if (!step.input) {
    return value;
  }

  const sourceStepId = step.input.from;
  const streamName = step.input.stream ?? "primary";
  const source = context.stepResults.get(sourceStepId);
  if (!source) {
    throw new Error(`Step "${step.id}" references missing input step "${sourceStepId}".`);
  }

  const stream = getStepStream(source, streamName);
  if (!stream) {
    throw new Error(`Step "${step.id}" could not read missing input stream "${streamName}" from step "${sourceStepId}".`);
  }

  return stream;
}

function selectToolResultStream(step, result) {
  const streamName = step.selectStream ?? "primary";
  const selected = getStream(result, streamName);
  if (!selected) {
    throw new Error(`Step "${step.id}" could not select missing output stream "${streamName}".`);
  }
  return selected;
}

function runSplitStep(step, value) {
  if (value?.kind === "sequence-records") {
    return splitSequenceRecords(value);
  }

  return splitSequenceRecords(makeSequenceRecordsFromText(streamToToolInput(value), step.alphabet ?? "dna-rna"));
}

function runFilterStep(step, value) {
  if (value?.kind === "collection") {
    return {
      ...value,
      items: value.items.map((item) => runFilterStep(step, item)).filter((item) => item.kind !== "sequence-records" || item.records.length > 0)
    };
  }

  if (value?.kind === "sequence-records") {
    return filterSequenceRecords(value, step.criteria);
  }

  if (value?.kind === "table") {
    return filterTable(value, step.criteria);
  }

  return value;
}

async function runWorkflowTool(tool, input, options, context) {
  throwIfAborted(context.signal);
  return context.runTool(tool, input, options, {
    signal: context.signal,
    step: context.currentStep,
    stepIndex: context.currentStepIndex,
    totalSteps: context.totalSteps
  });
}

async function runToolStep(step, value, context) {
  const tool = context.toolMap.get(step.toolId);
  if (!tool) {
    throw new Error(`Step "${step.id}" references unknown tool "${step.toolId}".`);
  }

  const inputValue = resolveStepInput(step, value, context);
  const result = await runWorkflowTool(tool, streamToToolInput(inputValue), makeToolOptionsForInput(tool, step, inputValue), context);
  context.lastToolResult = result;
  return selectToolResultStream(step, result);
}

async function runMapToolStep(step, value, context) {
  const inputValue = resolveStepInput(step, value, context);
  if (inputValue?.kind !== "collection") {
    throw new Error(`Step "${step.id}" expected a collection input for map.`);
  }

  const tool = context.toolMap.get(step.toolId);
  if (!tool) {
    throw new Error(`Step "${step.id}" references unknown tool "${step.toolId}".`);
  }

  const toolResults = [];
  const items = [];
  for (const [index, item] of inputValue.items.entries()) {
    throwIfAborted(context.signal);
    const result = await runWorkflowTool(tool, streamToToolInput(item), makeToolOptionsForSelectedStream(tool, step), context);
    toolResults.push(result);
    const streamName = step.selectStream ?? "primary";
    const selected = getStream(result, streamName);
    if (!selected) {
      throw new Error(`Step "${step.id}" item ${index + 1} could not select missing stream "${streamName}".`);
    }
    items.push(selected);
  }

  const warnings = toolResults.flatMap((result) => result.warnings ?? []);
  context.lastToolResult = toolResults.at(-1);
  return {
    value: makeCollectionStream(items, step.selectStream ?? "primary"),
    mappedResults: toolResults,
    warnings
  };
}

function runGatherStep(step, value) {
  if (value?.kind !== "collection") {
    return value;
  }
  return gatherCollection(value, step.as ?? "auto");
}

async function runStep(step, value, context) {
  if (step.type === "input") {
    return { value: runInputStep(step), result: undefined, warnings: [] };
  }
  if (step.type === "tool") {
    const resultValue = await runToolStep(step, value, context);
    return { value: resultValue, result: context.lastToolResult, warnings: context.lastToolResult?.warnings ?? [] };
  }
  if (step.type === "select-stream") {
    return { value: runSelectStreamStep(step, context), result: undefined, warnings: [] };
  }
  if (step.type === "split") {
    return { value: runSplitStep(step, value), result: undefined, warnings: [] };
  }
  if (step.type === "filter") {
    return {
      value: runFilterStep(step, value),
      result: undefined,
      warnings: makeMissingFieldWarnings(step, value, "filtering")
    };
  }
  if (step.type === "sort") {
    return {
      value: runSortStep(step, value),
      result: undefined,
      warnings: makeMissingFieldWarnings(step, value, "sorting")
    };
  }
  if (step.type === "take") {
    return { value: runTakeStep(step, value), result: undefined, warnings: [] };
  }
  if (step.type === "map") {
    const mapped = await runMapToolStep(step, value, context);
    return { value: mapped.value, result: { mappedResults: mapped.mappedResults }, warnings: mapped.warnings };
  }
  if (step.type === "gather") {
    return { value: runGatherStep(step, value), result: undefined, warnings: [] };
  }

  throw new Error(`Step "${step.id}" has unsupported type "${step.type}".`);
}

export function validateWorkflowDefinition(workflow, options = {}) {
  const errors = [];
  const steps = workflow?.steps;
  const toolMap = makeToolMap(options.tools ?? []);
  let lastOutput;
  let lastTool;
  const stepOutputs = new Map();
  const stepTools = new Map();

  function getBoundInput(step) {
    if (!step.input) {
      return lastOutput;
    }

    if (!step.input.from || typeof step.input.from !== "string") {
      errors.push(`Step "${step.id}" input must specify a source step.`);
      return undefined;
    }

    const sourceOutput = stepOutputs.get(step.input.from);
    if (!sourceOutput) {
      errors.push(`Step "${step.id}" references missing input step "${step.input.from}".`);
      return undefined;
    }

    const streamName = step.input.stream ?? "primary";
    if (streamName === "primary") {
      return sourceOutput;
    }

    const sourceTool = stepTools.get(step.input.from);
    const output = getToolOutputContract(sourceTool, streamName);
    if (!output) {
      errors.push(`Step "${step.id}" references missing input stream "${streamName}" on step "${step.input.from}".`);
    }
    return output;
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return ["Workflow must contain at least one step."];
  }

  steps.forEach((step, index) => {
    const stepId = step?.id ?? `step-${index + 1}`;

    if (!step || typeof step !== "object") {
      errors.push(`Step ${index + 1} must be an object.`);
      return;
    }

    if (!STEP_TYPES.has(step.type)) {
      errors.push(`Step "${stepId}" has unsupported type "${step.type}".`);
      return;
    }

    if (step.type === "input") {
      lastOutput = { id: "primary", kind: "text", mediaType: step.mediaType ?? "text/plain" };
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
      return;
    }

    if (step.type === "tool" || step.type === "map") {
      const tool = toolMap.get(step.toolId);
      if (!tool) {
        errors.push(`Step "${stepId}" references unknown tool "${step.toolId}".`);
        return;
      }

      const inputOutput = getBoundInput({ ...step, id: stepId });
      if (inputOutput && step.type === "tool") {
        const compatible = (tool.metadata.workflow?.inputs ?? []).some((input) =>
          isWorkflowStreamCompatible(inputOutput, input)
        );
        if (!compatible) {
          errors.push(`Step "${stepId}" may not accept input stream kind "${inputOutput.kind}".`);
        }
      }

      const selectedStream = step.selectStream ?? "primary";
      const output = getToolOutputContract(tool, selectedStream);
      if (!output) {
        errors.push(`Step "${stepId}" references missing output stream "${selectedStream}" on tool "${tool.metadata.id}".`);
      } else {
        lastOutput = step.type === "map" ? { kind: "collection", itemKind: output.kind } : output;
        lastTool = tool;
        stepOutputs.set(stepId, lastOutput);
        stepTools.set(stepId, tool);
      }
      return;
    }

    if (step.type === "select-stream") {
      if (!step.stream || typeof step.stream !== "string") {
        errors.push(`Step "${stepId}" must specify a stream to select.`);
      }
      const output = getToolOutputContract(lastTool, step.stream);
      if (lastTool && step.stream && !output) {
        errors.push(`Step "${stepId}" references missing output stream "${step.stream}" on tool "${lastTool.metadata.id}".`);
      }
      lastOutput = output;
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
      return;
    }

    if (step.type === "split") {
      lastOutput = { kind: "collection", itemKind: "sequence-records" };
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
      return;
    }

    if (step.type === "filter") {
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
      return;
    }

    if (step.type === "sort" || step.type === "take") {
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
      return;
    }

    if (step.type === "gather") {
      lastOutput =
        step.as === "table"
          ? { kind: "table" }
          : step.as === "text"
            ? { kind: "text" }
            : { kind: "sequence-records" };
      stepOutputs.set(stepId, lastOutput);
      stepTools.delete(stepId);
    }
  });

  return errors;
}

export async function runWorkflow(workflow, options = {}) {
  const steps = workflow?.steps ?? [];
  const context = {
    toolMap: makeToolMap(options.tools ?? []),
    runTool: options.runTool ?? ((tool, input, toolOptions) => tool.run(input, toolOptions)),
    signal: options.signal,
    onStepStart: options.onStepStart ?? (() => {}),
    totalSteps: steps.length,
    currentStep: undefined,
    currentStepIndex: -1,
    stepResults: new Map(),
    lastToolResult: undefined
  };
  const warnings = [];
  let value;

  for (const [index, step] of steps.entries()) {
    const normalizedStep = {
      id: step.id ?? `step-${index + 1}`,
      ...step
    };
    throwIfAborted(options.signal);
    context.currentStep = normalizedStep;
    context.currentStepIndex = index;
    context.onStepStart(normalizedStep, index, steps.length);
    const stepResult = await runStep(normalizedStep, value, context);
    throwIfAborted(options.signal);
    value = stepResult.value;
    const stepWarnings = (stepResult.warnings ?? []).map((warning) =>
      typeof warning === "string" ? makeStepWarning(normalizedStep, warning) : { ...warning, stepId: normalizedStep.id }
    );
    warnings.push(...stepWarnings);
    context.stepResults.set(normalizedStep.id, {
      step: normalizedStep,
      value,
      result: stepResult.result,
      warnings: stepWarnings
    });
  }

  return {
    value,
    warnings,
    steps: Array.from(context.stepResults.values())
  };
}
