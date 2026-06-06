import {
  deleteWorkspaceFeatureLayer,
  deleteWorkspaceSequence,
  saveWorkspaceSequence
} from "./workspace-storage.js";
import { parseSequenceInput } from "../core/fasta.js";

function fallbackPluralize(count, singular, plural = `${singular}s`) {
  const label = Math.abs(Number(count)) === 1 ? singular : plural;
  return `${Number(count).toLocaleString()} ${label}`;
}

export function createWorkspaceViewController({
  body,
  getSequences,
  getFeatureLayers,
  getStorageStatus,
  setStorageStatus,
  getCompatibleTools,
  openSequenceInTool,
  refresh,
  pluralize = fallbackPluralize
}) {
  function renderEmptyState(parent) {
    const empty = document.createElement("div");
    empty.className = "workspace-empty-state";
    empty.textContent = "No workspace records yet. Add a sequence here, or run a sequence tool and save its sequence output.";
    parent.append(empty);
  }

  function getFeatureLayersForSequence(sequence) {
    return getFeatureLayers().filter((layer) => {
      if (sequence.id && layer.sequenceId) {
        return layer.sequenceId === sequence.id;
      }
      return Boolean(sequence.sequenceHash && layer.sequenceHash && layer.sequenceHash === sequence.sequenceHash);
    });
  }

  function getSequenceForFeatureLayer(layer) {
    return getSequences().find((sequence) => {
      if (sequence.id && layer.sequenceId) {
        return sequence.id === layer.sequenceId;
      }
      return Boolean(sequence.sequenceHash && layer.sequenceHash && sequence.sequenceHash === layer.sequenceHash);
    }) ?? null;
  }

  function renderSequenceCard(sequence) {
    const card = document.createElement("article");
    card.className = "workspace-sequence-card";

    const heading = document.createElement("div");
    heading.className = "workspace-sequence-heading";
    const title = document.createElement("h3");
    title.textContent = sequence.name;
    const meta = document.createElement("p");
    meta.textContent = `${sequence.alphabet === "protein" ? "Protein" : "DNA/RNA"} - ${sequence.length.toLocaleString()} ${sequence.alphabet === "protein" ? "aa" : "bp"}`;
    heading.append(title, meta);
    const featureLayers = getFeatureLayersForSequence(sequence);
    if (featureLayers.length > 0) {
      const layerSummary = document.createElement("p");
      layerSummary.className = "workspace-sequence-summary";
      layerSummary.textContent = `${pluralize(featureLayers.length, "feature layer")} saved for this sequence.`;
      heading.append(layerSummary);
    }

    const compatibleTools = getCompatibleTools(sequence);
    const actions = document.createElement("div");
    actions.className = "workspace-sequence-actions";
    if (compatibleTools.length > 0) {
      const label = document.createElement("label");
      label.className = "select-row workspace-tool-picker";
      label.textContent = "Use in tool";
      const select = document.createElement("select");
      for (const tool of compatibleTools) {
        const option = document.createElement("option");
        option.value = tool.metadata.id;
        option.textContent = tool.metadata.name;
        select.append(option);
      }
      const openButton = document.createElement("button");
      openButton.type = "button";
      openButton.textContent = "Open";
      openButton.addEventListener("click", () => openSequenceInTool(sequence, select.value));
      label.append(select);
      actions.append(label, openButton);
    }
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      await deleteWorkspaceSequence(sequence.id);
      await refresh();
    });
    actions.append(deleteButton);

    card.append(heading, actions);
    return card;
  }

  function renderFeatureLayerCard(layer) {
    const card = document.createElement("article");
    card.className = "workspace-sequence-card workspace-feature-layer-card";

    const heading = document.createElement("div");
    heading.className = "workspace-sequence-heading";
    const title = document.createElement("h3");
    title.textContent = layer.label || "Workspace feature layer";
    const meta = document.createElement("p");
    const alphabetLabel = layer.alphabet === "protein" ? "Protein" : "DNA/RNA";
    meta.textContent = `${alphabetLabel} feature layer - ${pluralize(layer.features?.length ?? 0, "feature")}`;
    heading.append(title, meta);

    const source = document.createElement("p");
    source.className = "workspace-sequence-summary";
    const sequence = getSequenceForFeatureLayer(layer);
    const sourceText = layer.generatedBy?.toolName
      ? `Created by ${layer.generatedBy.toolName}.`
      : "Created from a viewer output.";
    source.textContent = sequence
      ? `${sourceText} Attached to ${sequence.name}.`
      : sourceText;

    const actions = document.createElement("div");
    actions.className = "workspace-sequence-actions";
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", async () => {
      await deleteWorkspaceFeatureLayer(layer.id);
      await refresh();
    });
    actions.append(deleteButton);

    card.append(heading, source, actions);
    return card;
  }

  async function addSequencesFromInput(form) {
    const textarea = form.querySelector("#workspaceAddInput");
    const nameInput = form.querySelector("#workspaceAddName");
    const alphabetSelect = form.querySelector("#workspaceAddAlphabet");
    const status = form.querySelector(".workspace-add-status");
    const records = parseSequenceInput(textarea.value, nameInput.value || "workspace_sequence");
    const alphabet = alphabetSelect.value === "protein" ? "protein" : "dna-rna";
    const cleanRecords = records
      .map((record) => {
        const sequence = String(record.sequence ?? "").replace(/\s+/g, "");
        return {
          name: record.title || nameInput.value || "workspace_sequence",
          sequence,
          alphabet,
          length: sequence.length,
          sourceToolId: "workspace",
          sourceToolName: "Manual workspace entry"
        };
      })
      .filter((record) => record.sequence);
    if (cleanRecords.length === 0) {
      status.textContent = "Enter one plain sequence or FASTA records before adding to the workspace.";
      return;
    }
    try {
      for (const record of cleanRecords) {
        await saveWorkspaceSequence(record);
      }
      textarea.value = "";
      const message = `Added ${pluralize(cleanRecords.length, "sequence")} to the workspace.`;
      status.textContent = message;
      await refresh();
      setStorageStatus(message);
      render();
    } catch (error) {
      status.textContent = error?.message || "Could not save the sequence.";
    }
  }

  function render() {
    if (!body) {
      return;
    }
    const sequences = getSequences();
    const featureLayers = getFeatureLayers();
    body.textContent = "";

    const intro = document.createElement("p");
    intro.className = "summary";
    intro.textContent =
      "Keep local project records, attached feature layers, and reusable analysis outputs together, then open them in compatible SMS3 tools to make viewers, maps, reports, tables, and exports.";

    const addPanel = document.createElement("section");
    addPanel.className = "options-panel workspace-add-panel";
    addPanel.setAttribute("aria-labelledby", "workspaceAddTitle");
    const addHeading = document.createElement("div");
    addHeading.className = "panel-heading";
    const addTitle = document.createElement("h3");
    addTitle.id = "workspaceAddTitle";
    addTitle.textContent = "Add Sequence";
    addHeading.append(addTitle);

    const form = document.createElement("div");
    form.className = "workspace-add-form";
    const nameLabel = document.createElement("label");
    nameLabel.className = "text-row";
    nameLabel.textContent = "Default name";
    const nameInput = document.createElement("input");
    nameInput.id = "workspaceAddName";
    nameInput.type = "text";
    nameInput.value = "workspace_sequence";
    nameLabel.append(nameInput);

    const alphabetLabel = document.createElement("label");
    alphabetLabel.className = "select-row";
    alphabetLabel.textContent = "Sequence type";
    const alphabetSelect = document.createElement("select");
    alphabetSelect.id = "workspaceAddAlphabet";
    for (const [value, label] of [
      ["dna-rna", "DNA/RNA"],
      ["protein", "Protein"]
    ]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      alphabetSelect.append(option);
    }
    alphabetLabel.append(alphabetSelect);

    const textarea = document.createElement("textarea");
    textarea.id = "workspaceAddInput";
    textarea.spellcheck = false;
    textarea.wrap = "off";
    textarea.placeholder = "Paste one plain sequence or FASTA records";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "primary-button";
    addButton.textContent = "Add to workspace";
    const status = document.createElement("p");
    status.className = "workspace-add-status";
    status.textContent = getStorageStatus();
    addButton.addEventListener("click", () => addSequencesFromInput(form));

    form.append(nameLabel, alphabetLabel, textarea, addButton, status);
    addPanel.append(addHeading, form);

    const library = document.createElement("section");
    library.className = "options-panel workspace-library-panel";
    library.setAttribute("aria-labelledby", "workspaceLibraryTitle");
    const libraryHeading = document.createElement("div");
    libraryHeading.className = "panel-heading";
    const libraryTitle = document.createElement("h3");
    libraryTitle.id = "workspaceLibraryTitle";
    libraryTitle.textContent = "Saved Sequences";
    const count = document.createElement("span");
    count.className = "workspace-library-count";
    count.textContent = pluralize(sequences.length, "sequence");
    libraryHeading.append(libraryTitle, count);

    const list = document.createElement("div");
    list.className = "workspace-sequence-list";
    if (sequences.length === 0) {
      renderEmptyState(list);
    } else {
      for (const sequence of sequences) {
        list.append(renderSequenceCard(sequence));
      }
    }
    library.append(libraryHeading, list);

    const layerLibrary = document.createElement("section");
    layerLibrary.className = "options-panel workspace-library-panel workspace-feature-layer-library-panel";
    layerLibrary.setAttribute("aria-labelledby", "workspaceFeatureLayerLibraryTitle");
    const layerHeading = document.createElement("div");
    layerHeading.className = "panel-heading";
    const layerTitle = document.createElement("h3");
    layerTitle.id = "workspaceFeatureLayerLibraryTitle";
    layerTitle.textContent = "Feature Layers";
    const layerCount = document.createElement("span");
    layerCount.className = "workspace-library-count";
    layerCount.textContent = pluralize(featureLayers.length, "layer");
    layerHeading.append(layerTitle, layerCount);

    const layerList = document.createElement("div");
    layerList.className = "workspace-sequence-list workspace-feature-layer-list";
    if (featureLayers.length === 0) {
      const emptyLayerMessage = document.createElement("p");
      emptyLayerMessage.className = "workspace-empty-state";
      emptyLayerMessage.textContent = "No saved feature layers yet. Run a viewer output with feature tracks, then save the layer here.";
      layerList.append(emptyLayerMessage);
    } else {
      for (const layer of featureLayers) {
        layerList.append(renderFeatureLayerCard(layer));
      }
    }
    layerLibrary.append(layerHeading, layerList);

    body.append(intro, addPanel, library, layerLibrary);
  }

  return {
    render
  };
}
