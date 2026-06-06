const SHOWCASE_VISUAL_INCLUDE = /\b(plot|map|gel|figure|heatmap|cloud|sankey|venn|upset|tree|chromatogram|diagram|poster)\b|\bcolored alignment\b|\bdot plot\b|svg/i;
const SHOWCASE_VIEWER_INCLUDE = /\bviewer\b|\binteractive-viewer\b/i;
const SHOWCASE_VISUAL_EXCLUDE = /\b(json|table|report|text|fasta|fastq|tsv|csv|xlsx|records?|summary)\b/i;

function makeShowcaseStatus(text, className = "") {
  const status = document.createElement("p");
  status.className = ["showcase-status", className].filter(Boolean).join(" ");
  status.textContent = text;
  return status;
}

function normalizeShowcaseSvg(svg) {
  if (typeof SVGSVGElement !== "undefined" && !(svg instanceof SVGSVGElement)) {
    return;
  }
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) {
    return;
  }
  const [, , width, height] = viewBox.trim().split(/\s+/u).map(Number);
  if (Number.isFinite(width) && width > 0 && !svg.hasAttribute("width")) {
    svg.setAttribute("width", String(Math.ceil(width)));
  }
  if (Number.isFinite(height) && height > 0 && !svg.hasAttribute("height")) {
    svg.setAttribute("height", String(Math.ceil(height)));
  }
  if (!svg.hasAttribute("preserveAspectRatio")) {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
}

function getShowcaseOutputOption(metadata, flattenOptions) {
  return flattenOptions(metadata.options ?? []).find((option) => option.id === "outputFormat");
}

function isShowcaseVisualChoice(tool, choice) {
  const text = `${choice?.label ?? ""} ${choice?.value ?? ""}`;
  if (SHOWCASE_VISUAL_EXCLUDE.test(text)) {
    return false;
  }
  if (SHOWCASE_VISUAL_INCLUDE.test(text)) {
    return true;
  }
  const viewerOutputs = tool?.metadata?.workflow?.outputs?.filter((output) => output.kind === "viewer") ?? [];
  return viewerOutputs.length > 0 && SHOWCASE_VIEWER_INCLUDE.test(text);
}

function makeShowcaseItems({ tools, flattenOptions, getDefaultOptionValues, compareToolCategories }) {
  return tools.flatMap((tool) => {
    const outputOption = getShowcaseOutputOption(tool.metadata, flattenOptions);
    return (outputOption?.choices ?? [])
      .filter((choice) => isShowcaseVisualChoice(tool, choice))
      .map((choice) => {
        const options = {
          ...getDefaultOptionValues(tool.metadata.options ?? []),
          [outputOption.id]: choice.value
        };
        return {
          id: `${tool.metadata.id}:${choice.value}`,
          toolId: tool.metadata.id,
          title: `${tool.metadata.name}: ${choice.label}`,
          summary: `Generated from the bundled ${tool.metadata.name} example using the ${choice.label} output.`,
          outputLabel: choice.label,
          options
        };
      });
  }).sort((left, right) => {
    const leftTool = tools.find((tool) => tool.metadata.id === left.toolId);
    const rightTool = tools.find((tool) => tool.metadata.id === right.toolId);
    return compareToolCategories(leftTool?.metadata.category, rightTool?.metadata.category) ||
      String(leftTool?.metadata.name || left.toolId).localeCompare(String(rightTool?.metadata.name || right.toolId)) ||
      left.title.localeCompare(right.title);
  });
}

function renderShowcaseViewer(preview, viewer, context) {
  const viewerOptions = { preserveState: false };
  if (viewer?.viewerType === "protein-sequence-viewer") {
    context.renderProteinViewer?.(preview, viewer, viewerOptions);
  } else if (viewer?.layout === "circular") {
    context.renderCircularDnaViewer?.(preview, viewer, viewerOptions);
  } else {
    context.renderDnaViewer?.(preview, viewer, viewerOptions);
  }
}

async function renderShowcaseCard(card, item, token, context) {
  const tool = context.tools.find((candidate) => candidate.metadata.id === item.toolId);
  const preview = card.querySelector(".showcase-preview");
  const status = card.querySelector(".showcase-run-status");
  if (!tool || !preview || !status) {
    return;
  }

  try {
    const result = await context.runTool(tool, tool.example ?? "", item.options ?? {});
    if (context.state.showcaseRenderToken !== token) {
      return;
    }
    const svg = result.visual?.svg ?? (String(result.output ?? "").trimStart().startsWith("<svg") ? result.output : "");
    preview.textContent = "";
    if (svg) {
      preview.insertAdjacentHTML("beforeend", svg);
      preview.querySelectorAll("svg").forEach(normalizeShowcaseSvg);
    } else if (result.visual?.viewer) {
      renderShowcaseViewer(preview, result.visual.viewer, context);
    } else if (result.visual?.proteinStructure) {
      context.renderProteinStructureViewer?.(preview, result.visual.proteinStructure);
    } else if (result.visual?.figure) {
      context.renderGenomeFigure(preview, result.visual.figure);
      preview.querySelectorAll("svg").forEach(normalizeShowcaseSvg);
    } else {
      const pre = document.createElement("pre");
      pre.textContent = String(result.output ?? "").slice(0, 1600);
      preview.append(pre);
    }
    const warningCount = result.warnings?.length ?? 0;
    status.textContent = warningCount
      ? `Generated from ${tool.metadata.name}; ${item.outputLabel}; ${warningCount} warning(s).`
      : `Generated from ${tool.metadata.name}; ${item.outputLabel}.`;
    status.classList.remove("error");
  } catch (error) {
    if (context.state.showcaseRenderToken !== token) {
      return;
    }
    preview.textContent = "";
    preview.append(makeShowcaseStatus(error.message || "Preview generation failed.", "error"));
    status.textContent = "Preview generation failed.";
    status.classList.add("error");
  }
}

export function appendShowcase(topic, context) {
  const token = {};
  context.state.showcaseRenderToken = token;
  const grid = document.createElement("div");
  grid.className = "showcase-grid";
  const showcaseItems = makeShowcaseItems(context);
  const renderQueue = [];

  for (const item of showcaseItems) {
    const tool = context.tools.find((candidate) => candidate.metadata.id === item.toolId);
    const card = document.createElement("article");
    card.className = "showcase-card";

    const header = document.createElement("div");
    header.className = "showcase-card-header";
    const heading = document.createElement("h3");
    heading.textContent = item.title;
    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = tool ? `Open ${tool.metadata.name}` : "Tool unavailable";
    openButton.disabled = !tool;
    openButton.addEventListener("click", () => {
      if (tool) {
        context.selectTool(tool);
      }
    });
    header.append(heading, openButton);

    const summary = document.createElement("p");
    summary.className = "summary";
    summary.textContent = item.summary;

    const preview = document.createElement("div");
    preview.className = "showcase-preview";
    preview.append(makeShowcaseStatus("Generating preview from current tool code..."));

    const status = makeShowcaseStatus(
      tool ? `Queued ${tool.metadata.name}.` : "Tool is not registered.",
      tool ? "showcase-run-status" : "showcase-run-status error"
    );

    card.append(header, summary, preview, status);
    grid.append(card);

    if (tool) {
      renderQueue.push({ card, item });
    }
  }

  context.container.append(grid);
  context.appendTopicNotesAndCitations(topic);
  void (async () => {
    for (const entry of renderQueue) {
      if (context.state.showcaseRenderToken !== token) {
        return;
      }
      await renderShowcaseCard(entry.card, entry.item, token, context);
    }
  })();
}
