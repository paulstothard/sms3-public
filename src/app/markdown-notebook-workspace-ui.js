import {
  buildMarkdownNotebook,
  formatMarkdownTableBlock,
  formatMarkdownTableRows
} from "../core/markdown-notebook.js";
import {
  deleteMarkdownNotebookDocument,
  formatMarkdownSavedAt,
  listMarkdownNotebookDocuments,
  loadMarkdownNotebookDocument,
  makeMarkdownDocumentId,
  markdownDefaultFilenameCandidates,
  markdownDefaultFilenameForTemplate,
  markdownDefaultTitleCandidates,
  markdownDocumentTitle,
  markdownFilenameFromLoadedFile,
  markdownFileStemFromFilename,
  markdownNotebookCounts,
  markdownNotebookTemplates,
  markdownTemplateById,
  MARKDOWN_NOTEBOOK_CURRENT_KEY,
  normalizeMarkdownFilename,
  saveMarkdownNotebookDraft,
  saveMarkdownNotebookDocument
} from "./markdown-notebook-model.js";

const MARKDOWN_FORMAT_BUTTONS = [
  { id: "heading", label: "Heading", icon: "H", prefix: "## ", placeholder: "Heading" },
  { id: "bold", label: "Bold", icon: "B", prefix: "**", suffix: "**", placeholder: "bold text" },
  { id: "italic", label: "Italic", icon: "I", prefix: "*", suffix: "*", placeholder: "italic text" },
  { id: "bullet", label: "Bullet list", icon: "•", block: "- item\n- item\n" },
  { id: "numbered", label: "Numbered list", icon: "1.", block: "1. item\n2. item\n" },
  { id: "link", label: "Link", icon: "[]", popover: "link" },
  { id: "code", label: "Code block", icon: "</>", block: "```text\n\n```\n" },
  { id: "table", label: "Table", icon: "▦", popover: "table" }
];

function insertMarkdownAtSelection(editor, { prefix = "", suffix = "", placeholder = "", block = "" }) {
  const start = editor.selectionStart ?? editor.value.length;
  const end = editor.selectionEnd ?? editor.value.length;
  const selected = editor.value.slice(start, end);
  const insertion = block || `${prefix}${selected || placeholder}${suffix}`;
  editor.setRangeText(insertion, start, end, "end");
  const selectedLength = selected.length || placeholder.length;
  const selectionStart = start + prefix.length;
  const selectionEnd = selectionStart + selectedLength;
  if (!block) {
    editor.setSelectionRange(selectionStart, selectionEnd);
  }
  editor.focus();
  editor.dispatchEvent(new Event("input", { bubbles: true }));
}

function isMarkdownTableLine(line) {
  const trimmed = String(line ?? "").trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 3;
}

function getMarkdownLineBounds(text, position) {
  const safePosition = Math.max(0, Math.min(String(text ?? "").length, position));
  const start = String(text ?? "").lastIndexOf("\n", Math.max(0, safePosition - 1)) + 1;
  const nextBreak = String(text ?? "").indexOf("\n", safePosition);
  const end = nextBreak === -1 ? String(text ?? "").length : nextBreak;
  return { start, end };
}

function formatMarkdownTableAtSelection(editor) {
  const value = editor.value;
  let start = editor.selectionStart ?? 0;
  let end = editor.selectionEnd ?? start;
  if (end > start) {
    start = getMarkdownLineBounds(value, start).start;
    end = getMarkdownLineBounds(value, end).end;
  } else {
    const current = getMarkdownLineBounds(value, start);
    const lines = value.split("\n");
    let lineStart = 0;
    let lineIndex = 0;
    for (let index = 0; index < lines.length; index += 1) {
      const lineEnd = lineStart + lines[index].length;
      if (current.start >= lineStart && current.start <= lineEnd) {
        lineIndex = index;
        break;
      }
      lineStart = lineEnd + 1;
    }
    if (!isMarkdownTableLine(lines[lineIndex])) {
      return false;
    }
    let first = lineIndex;
    let last = lineIndex;
    while (first > 0 && isMarkdownTableLine(lines[first - 1])) first -= 1;
    while (last + 1 < lines.length && isMarkdownTableLine(lines[last + 1])) last += 1;
    start = lines.slice(0, first).join("\n").length;
    if (first > 0) start += 1;
    end = lines.slice(0, last + 1).join("\n").length;
  }
  const selectedBlock = value.slice(start, end);
  const selectedLines = selectedBlock.split(/\r?\n/).filter((line) => line.trim());
  if (selectedLines.length < 2 || !selectedLines.every(isMarkdownTableLine)) {
    return false;
  }
  const formatted = formatMarkdownTableBlock(selectedBlock);
  if (formatted === selectedBlock) {
    return false;
  }
  editor.setRangeText(formatted, start, end, "select");
  editor.focus();
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function createMarkdownPopoverField(labelText, control) {
  const label = document.createElement("label");
  label.className = "markdown-popover-field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, control);
  return label;
}

function compactToolbarButton(button, visibleText, accessibleLabel, title = accessibleLabel) {
  button.textContent = visibleText;
  if (accessibleLabel && accessibleLabel !== visibleText) {
    button.setAttribute("aria-label", accessibleLabel);
  }
  if (title) {
    button.title = title;
  }
}

function createMarkdownPopover(name, titleText, createButton) {
  const popover = document.createElement("div");
  popover.className = "markdown-workspace-popover";
  popover.dataset.markdownPopover = name;
  popover.hidden = true;
  const header = document.createElement("div");
  header.className = "markdown-popover-header";
  const title = document.createElement("h4");
  title.textContent = titleText;
  const close = createButton("Close", "markdown-popover-close");
  close.dataset.closePopover = "true";
  header.append(title, close);
  const body = document.createElement("div");
  body.className = "markdown-popover-body";
  popover.append(header, body);
  return { popover, body, close };
}

function renderMarkdownPreview(container, markdown) {
  container.textContent = "";
  const source = String(markdown ?? "");
  const lines = source.split(/\r?\n/);
  let codeBlock = null;
  let currentList = null;

  const closeList = () => {
    currentList = null;
  };
  const appendParagraph = (text) => {
    closeList();
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    container.append(paragraph);
  };
  const appendListItem = (ordered, text) => {
    const tagName = ordered ? "ol" : "ul";
    if (!currentList || currentList.tagName.toLowerCase() !== tagName) {
      closeList();
      currentList = document.createElement(tagName);
      container.append(currentList);
    }
    const item = document.createElement("li");
    item.textContent = text;
    currentList.append(item);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      closeList();
      if (codeBlock) {
        codeBlock = null;
      } else {
        codeBlock = document.createElement("pre");
        const code = document.createElement("code");
        codeBlock.append(code);
        container.append(codeBlock);
      }
      continue;
    }
    if (codeBlock) {
      codeBlock.firstChild.textContent += `${line}\n`;
      continue;
    }
    if (!trimmed) {
      closeList();
      continue;
    }
    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(4, heading[1].length);
      const node = document.createElement(`h${level}`);
      node.textContent = heading[2];
      container.append(node);
      continue;
    }
    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      appendListItem(false, unordered[1]);
      continue;
    }
    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      appendListItem(true, ordered[1]);
      continue;
    }
    if (/^\|.+\|$/.test(trimmed)) {
      closeList();
      const pre = document.createElement("pre");
      pre.textContent = trimmed;
      container.append(pre);
      continue;
    }
    appendParagraph(trimmed.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1"));
  }
}

function createMarkdownFormatToolbar(editor, openPopover) {
  const toolbar = document.createElement("div");
  toolbar.className = "markdown-format-toolbar";
  toolbar.setAttribute("aria-label", "Markdown formatting");
  for (const format of MARKDOWN_FORMAT_BUTTONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "markdown-format-button";
    button.dataset.format = format.id;
    button.setAttribute("aria-label", format.label);
    button.title = format.label;
    const icon = document.createElement("span");
    icon.className = `markdown-format-icon markdown-format-icon-${format.id}`;
    icon.textContent = format.icon;
    const text = document.createElement("span");
    text.className = "markdown-format-label";
    text.textContent = format.label;
    button.append(icon, text);
    if (format.popover) {
      button.dataset.openPopover = format.popover;
      button.addEventListener("click", () => {
        if (format.id === "table" && formatMarkdownTableAtSelection(editor)) {
          return;
        }
        openPopover(format.popover);
      });
    } else {
      button.addEventListener("click", () => insertMarkdownAtSelection(editor, format));
    }
    toolbar.append(button);
  }
  return toolbar;
}

export function createMarkdownWorkspaceController({
  container,
  sourceInput,
  toolOptions,
  markdownInputFileName,
  createField,
  createButton,
  readToolInputFileText,
  downloadText,
  getFallbackOptions,
  getSelectedToolExample,
  getFileNameDefaultValue,
  syncHiddenOptions
}) {
  function getControl(name) {
    return container?.querySelector(`[data-markdown-control="${name}"]`);
  }

  function setStatus(message) {
    const status = getControl("status");
    if (status) {
      status.textContent = message;
    }
  }

  function readState() {
    if (!container || container.hidden) {
      return null;
    }
    const editor = getControl("editor");
    if (!editor) {
      return null;
    }
    return {
      markdown: editor.value,
      templateId: getControl("templateId")?.value ?? "protocol-notes",
      title: getControl("title")?.value ?? "",
      date: getControl("date")?.value ?? "",
      fileName: getControl("fileName")?.value ?? "",
      includeFrontMatter: getControl("includeFrontMatter")?.checked ?? false,
      activeDocumentId: getControl("documentList")?.value ?? ""
    };
  }

  function getOptions() {
    const workspaceState = readState();
    if (workspaceState) {
      return {
        templateId: workspaceState.templateId,
        title: workspaceState.title,
        date: workspaceState.date,
        fileName: markdownFileStemFromFilename(workspaceState.fileName),
        includeFrontMatter: workspaceState.includeFrontMatter,
        outputFormat: "markdown"
      };
    }
    const fallbackOptions = getFallbackOptions();
    return {
      ...fallbackOptions,
      fileName: markdownFileStemFromFilename(markdownInputFileName?.value || fallbackOptions.fileName)
    };
  }

  function selectedTemplate() {
    const workspaceTemplateId = getControl("templateId")?.value;
    const fallbackOptions = getFallbackOptions();
    const selectedId =
      workspaceTemplateId ||
      toolOptions?.querySelector("#templateId")?.value ||
      fallbackOptions.templateId ||
      "protocol-notes";
    return markdownTemplateById(selectedId);
  }

  function syncInputFilenameFromOptions() {
    if (!markdownInputFileName) {
      return;
    }
    const template = selectedTemplate();
    const current = markdownInputFileName.value.trim();
    if (!current || current === "protocol-notes.md") {
      markdownInputFileName.value = normalizeMarkdownFilename(template?.fileStem || getFileNameDefaultValue());
    }
  }

  function syncTemplateDefaults() {
    if (!markdownInputFileName) {
      return;
    }
    const template = selectedTemplate();
    const previousTemplate = markdownNotebookTemplates.find((item) => item.id === markdownInputFileName.dataset.templateId);
    const titleInput = toolOptions.querySelector("#title");
    const fileNameOptionInput = toolOptions.querySelector("#fileName");
    const previousFilenameCandidates = [
      normalizeMarkdownFilename(previousTemplate?.fileStem),
      ...markdownNotebookTemplates.map((item) => normalizeMarkdownFilename(item.fileStem))
    ].filter(Boolean);
    const previousTitleCandidates = [
      previousTemplate?.defaultTitle,
      ...markdownNotebookTemplates.map((item) => item.defaultTitle)
    ].filter(Boolean);

    if (!markdownInputFileName.value.trim() || previousFilenameCandidates.includes(normalizeMarkdownFilename(markdownInputFileName.value))) {
      markdownInputFileName.value = normalizeMarkdownFilename(template.fileStem);
    }
    if (fileNameOptionInput && (!fileNameOptionInput.value.trim() || previousFilenameCandidates.includes(normalizeMarkdownFilename(fileNameOptionInput.value)))) {
      fileNameOptionInput.value = template.fileStem || fileNameOptionInput.value;
    }
    if (titleInput && (!titleInput.value.trim() || previousTitleCandidates.includes(titleInput.value.trim()))) {
      titleInput.value = template.defaultTitle || titleInput.value;
    }
    markdownInputFileName.dataset.templateId = template.id;
  }

  function getInputFilename() {
    const workspaceFilename = getControl("fileName")?.value;
    return normalizeMarkdownFilename(workspaceFilename || markdownInputFileName?.value || getFallbackOptions().fileName);
  }

  function setEditorValue(markdown, message) {
    const editor = getControl("editor");
    if (!editor) {
      return;
    }
    editor.value = markdown;
    sourceInput.value = markdown;
    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
    syncHiddenOptions();
    const status = getControl("status");
    if (status) {
      status.textContent = message;
    }
    setStatus(message);
  }

  function syncFromSource(message = "Loaded Markdown source.") {
    if (!container || container.hidden) {
      return;
    }
    const editor = getControl("editor");
    if (!editor) {
      return;
    }
    editor.value = sourceInput.value || "";
    const status = getControl("status");
    if (status) {
      status.textContent = message;
    }
    setStatus(message);
  }

  function insertTemplate() {
    const built = buildMarkdownNotebook("", getOptions());
    sourceInput.value = built.markdown;
    if (markdownInputFileName) {
      markdownInputFileName.value = built.filename;
    }
    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
    return built;
  }

  function render(previousState = null) {
    if (!container) {
      return;
    }
    container._notebookAbortController?.abort();
    const eventController = new AbortController();
    container._notebookAbortController = eventController;

    const defaultTemplateId = previousState?.templateId || toolOptions.querySelector("#templateId")?.value || "protocol-notes";
    const template = markdownTemplateById(defaultTemplateId);
    const defaultTitle = previousState?.title || toolOptions.querySelector("#title")?.value || template.defaultTitle || "SMS3 Notebook";
    const defaultDate = previousState?.date || toolOptions.querySelector("#date")?.value || "";
    const defaultFilename = normalizeMarkdownFilename(previousState?.fileName || toolOptions.querySelector("#fileName")?.value || template.fileStem || "sms3-notebook");
    const defaultFrontMatter = previousState?.includeFrontMatter ?? toolOptions.querySelector("#includeFrontMatter")?.checked ?? false;
    const initialMarkdown = previousState?.markdown ?? sourceInput.value ?? "";
    let activeDocumentId = previousState?.activeDocumentId || MARKDOWN_NOTEBOOK_CURRENT_KEY;
    const markdown = initialMarkdown || buildMarkdownNotebook("", {
      templateId: template.id,
      title: defaultTitle,
      date: defaultDate,
      fileName: markdownFileStemFromFilename(defaultFilename),
      includeFrontMatter: defaultFrontMatter
    }).markdown;
    let savedDocumentIds = new Set();

    container.textContent = "";

    const shell = document.createElement("div");
    shell.className = "markdown-workspace-shell";

    const main = document.createElement("section");
    main.className = "markdown-workspace-main";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".md,.markdown,.txt";
    fileInput.setAttribute("aria-label", "Open Markdown file");
    const fileLabel = document.createElement("label");
    fileLabel.className = "file-button markdown-file-button";
    fileLabel.setAttribute("aria-label", "Open .md");
    fileLabel.title = "Open Markdown file";
    const fileLabelText = document.createElement("span");
    fileLabelText.textContent = "Open";
    fileLabel.append(fileInput, fileLabelText);

    const blankDocumentButton = createButton("New");
    const useTemplateButton = createButton("Start from template");
    const useExampleButton = createButton("Load example");
    const saveDocumentButton = createButton("Save browser draft");
    const loadDocumentButton = createButton("Load draft");
    const duplicateDocumentButton = createButton("Duplicate");
    const deleteDocumentButton = createButton("Delete");
    const copyButton = createButton("Copy Markdown");
    const downloadButton = createButton("Download .md", "primary-button");
    const templatesButton = createButton("Templates");
    const settingsButton = createButton("Settings");
    const previewButton = createButton("Split preview");
    compactToolbarButton(saveDocumentButton, "Save draft", "Save browser draft", "Save browser draft");
    compactToolbarButton(downloadButton, "Download", "Download .md", "Download Markdown file");
    compactToolbarButton(copyButton, "Copy", "Copy Markdown", "Copy Markdown to clipboard");
    compactToolbarButton(loadDocumentButton, "Load selected", "Load selected draft", "Load selected saved draft");
    duplicateDocumentButton.title = "Duplicate selected draft";
    deleteDocumentButton.setAttribute("aria-label", "Delete draft");
    deleteDocumentButton.title = "Delete selected draft";
    previewButton.setAttribute("aria-pressed", "false");

    const editor = document.createElement("textarea");
    editor.className = "markdown-workspace-editor";
    editor.value = markdown;
    editor.spellcheck = true;
    editor.wrap = "soft";
    editor.dataset.markdownControl = "editor";
    editor.setAttribute("aria-label", "Markdown notebook editor");

    const documentSelect = document.createElement("select");
    documentSelect.dataset.markdownControl = "documentList";
    documentSelect.setAttribute("aria-label", "Saved drafts");

    const templateSelect = document.createElement("select");
    templateSelect.dataset.markdownControl = "templateId";
    templateSelect.setAttribute("aria-label", "Template");
    for (const item of markdownNotebookTemplates) {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.label;
      templateSelect.append(option);
    }
    templateSelect.value = template.id;

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = defaultTitle;
    titleInput.dataset.markdownControl = "title";
    titleInput.dataset.userEdited = markdownDefaultTitleCandidates().includes(defaultTitle) ? "false" : "true";

    const dateInput = document.createElement("input");
    dateInput.type = "text";
    dateInput.value = defaultDate;
    dateInput.placeholder = "Today";
    dateInput.dataset.markdownControl = "date";

    const filenameInput = document.createElement("input");
    filenameInput.type = "text";
    filenameInput.value = defaultFilename;
    filenameInput.dataset.markdownControl = "fileName";
    filenameInput.dataset.userEdited = markdownDefaultFilenameCandidates().includes(normalizeMarkdownFilename(defaultFilename)) ? "false" : "true";

    const frontMatterLabel = document.createElement("label");
    frontMatterLabel.className = "markdown-workspace-checkbox";
    const frontMatterInput = document.createElement("input");
    frontMatterInput.type = "checkbox";
    frontMatterInput.checked = defaultFrontMatter;
    frontMatterInput.dataset.markdownControl = "includeFrontMatter";
    frontMatterLabel.append(frontMatterInput, document.createTextNode("Add YAML front matter"));

    const popoverLayer = document.createElement("div");
    popoverLayer.className = "markdown-popover-layer";
    const openPopovers = new Map();
    const closeAllPopovers = (except = "") => {
      for (const [name, popover] of openPopovers) {
        if (name !== except) {
          popover.hidden = true;
        }
      }
    };
    const openPopover = (name) => {
      const popover = openPopovers.get(name);
      if (!popover) return;
      const willOpen = popover.hidden;
      closeAllPopovers(name);
      popover.hidden = !willOpen;
      if (!popover.hidden) {
        popover.querySelector("input, select, button")?.focus();
      }
    };

    const formatToolbar = createMarkdownFormatToolbar(editor, openPopover);

    const linkTextInput = document.createElement("input");
    linkTextInput.type = "text";
    linkTextInput.placeholder = "link text";
    const linkUrlInput = document.createElement("input");
    linkUrlInput.type = "url";
    linkUrlInput.placeholder = "https://example.org";
    const insertLinkButton = createButton("Insert link", "primary-button");
    const linkPopover = createMarkdownPopover("link", "Insert Link", createButton);
    linkPopover.body.append(
      createMarkdownPopoverField("Text", linkTextInput),
      createMarkdownPopoverField("URL", linkUrlInput),
      insertLinkButton
    );
    const tableRowsInput = document.createElement("input");
    tableRowsInput.type = "number";
    tableRowsInput.min = "1";
    tableRowsInput.max = "20";
    tableRowsInput.value = "2";
    const tableColumnsInput = document.createElement("input");
    tableColumnsInput.type = "number";
    tableColumnsInput.min = "1";
    tableColumnsInput.max = "10";
    tableColumnsInput.value = "2";
    const insertTableButton = createButton("Insert table", "primary-button");
    const tablePopover = createMarkdownPopover("table", "Insert Table", createButton);
    tablePopover.body.append(
      createMarkdownPopoverField("Columns", tableColumnsInput),
      createMarkdownPopoverField("Rows", tableRowsInput),
      insertTableButton
    );
    popoverLayer.append(linkPopover.popover, tablePopover.popover);
    openPopovers.set("link", linkPopover.popover);
    openPopovers.set("table", tablePopover.popover);
    for (const popover of [linkPopover, tablePopover]) {
      popover.close.addEventListener("click", () => closeAllPopovers());
    }

    const fileGroup = document.createElement("div");
    fileGroup.className = "markdown-toolbar-group markdown-toolbar-file-group";
    fileGroup.setAttribute("aria-label", "Document actions");
    fileGroup.append(blankDocumentButton, fileLabel, saveDocumentButton, downloadButton, copyButton);

    const draftGroup = document.createElement("div");
    draftGroup.className = "markdown-toolbar-group markdown-toolbar-draft-group";
    const draftLabel = document.createElement("label");
    draftLabel.className = "markdown-toolbar-select-label";
    const draftText = document.createElement("span");
    draftText.textContent = "Saved drafts";
    draftLabel.append(draftText, documentSelect);
    draftGroup.append(draftLabel, loadDocumentButton, duplicateDocumentButton, deleteDocumentButton);

    const workspaceGroup = document.createElement("div");
    workspaceGroup.className = "markdown-toolbar-group markdown-toolbar-workspace-group";
    workspaceGroup.setAttribute("aria-label", "Notebook panels");
    workspaceGroup.append(templatesButton, settingsButton);

    const drawerHeader = document.createElement("div");
    drawerHeader.className = "markdown-drawer-header";
    const drawerTitle = document.createElement("h4");
    drawerTitle.textContent = "Notebook";
    const closeDrawerButton = createButton("Close", "markdown-drawer-close");
    drawerHeader.append(drawerTitle, closeDrawerButton);

    const templatePanel = document.createElement("section");
    templatePanel.className = "markdown-drawer-panel";
    templatePanel.dataset.markdownDrawerPanel = "templates";
    const templatePanelHeading = document.createElement("h5");
    templatePanelHeading.textContent = "Start Content";
    const templatePanelNote = document.createElement("p");
    templatePanelNote.textContent = "Choose a template only when you want to replace the current document.";
    const templateLabel = document.createElement("label");
    templateLabel.className = "markdown-toolbar-select-label";
    const templateText = document.createElement("span");
    templateText.textContent = "Template";
    templateLabel.append(templateText, templateSelect);
    const templateActions = document.createElement("div");
    templateActions.className = "markdown-drawer-actions";
    templateActions.append(useTemplateButton, useExampleButton);
    templatePanel.append(templatePanelHeading, templatePanelNote, templateLabel, templateActions);

    const settingsPanel = document.createElement("section");
    settingsPanel.className = "markdown-drawer-panel";
    settingsPanel.dataset.markdownDrawerPanel = "settings";
    settingsPanel.hidden = true;
    const settingsPanelHeading = document.createElement("h5");
    settingsPanelHeading.textContent = "Document Settings";
    settingsPanel.append(
      settingsPanelHeading,
      createField("Title", titleInput),
      createField("Date", dateInput),
      createField("Download filename", filenameInput),
      frontMatterLabel
    );

    const sidePanel = document.createElement("aside");
    sidePanel.className = "markdown-workspace-drawer";
    sidePanel.hidden = true;
    sidePanel.setAttribute("aria-label", "Markdown notebook sidebar");
    sidePanel.append(drawerHeader, templatePanel, settingsPanel);

    const toolbar = document.createElement("div");
    toolbar.className = "markdown-workspace-toolbar";
    toolbar.append(fileGroup, draftGroup, workspaceGroup);

    const formatRow = document.createElement("div");
    formatRow.className = "markdown-format-row";
    previewButton.classList.add("markdown-preview-toggle");
    formatRow.append(formatToolbar, previewButton);

    const editorLayout = document.createElement("div");
    editorLayout.className = "markdown-editor-layout";
    const editorPane = document.createElement("div");
    editorPane.className = "markdown-editor-pane";
    editorPane.append(editor);
    const previewPane = document.createElement("section");
    previewPane.className = "markdown-preview-pane";
    previewPane.hidden = true;
    const previewHeading = document.createElement("h4");
    previewHeading.textContent = "Preview";
    const previewContent = document.createElement("div");
    previewContent.className = "markdown-preview-content";
    previewPane.append(previewHeading, previewContent);
    editorLayout.append(editorPane, previewPane);

    const editorSurface = document.createElement("div");
    editorSurface.className = "markdown-editor-surface";
    editorSurface.append(formatRow, editorLayout);

    const workspaceBody = document.createElement("div");
    workspaceBody.className = "markdown-workspace-body";
    workspaceBody.append(editorSurface, sidePanel);

    const statusBar = document.createElement("div");
    statusBar.className = "markdown-workspace-status-bar";
    const documentNameStatus = document.createElement("span");
    documentNameStatus.dataset.markdownControl = "documentNameStatus";
    const countStatus = document.createElement("span");
    countStatus.dataset.markdownControl = "countStatus";
    const draftSaveHint = document.createElement("span");
    draftSaveHint.className = "markdown-workspace-draft-hint";
    draftSaveHint.dataset.markdownControl = "draftSaveHint";
    const saveStatus = document.createElement("span");
    saveStatus.className = "markdown-workspace-status";
    saveStatus.dataset.markdownControl = "status";
    saveStatus.textContent = "Ready";
    statusBar.append(documentNameStatus, countStatus, draftSaveHint, saveStatus);

    const closeSidePanel = () => {
      sidePanel.hidden = true;
      workspaceBody.classList.remove("markdown-workspace-body-with-drawer");
      templatesButton.classList.remove("is-active");
      settingsButton.classList.remove("is-active");
      templatesButton.setAttribute("aria-expanded", "false");
      settingsButton.setAttribute("aria-expanded", "false");
    };
    const openSidePanel = (panelName) => {
      closeAllPopovers();
      const isAlreadyOpen = !sidePanel.hidden && sidePanel.dataset.activePanel === panelName;
      if (isAlreadyOpen) {
        closeSidePanel();
        return;
      }
      sidePanel.hidden = false;
      sidePanel.dataset.activePanel = panelName;
      workspaceBody.classList.add("markdown-workspace-body-with-drawer");
      templatePanel.hidden = panelName !== "templates";
      settingsPanel.hidden = panelName !== "settings";
      drawerTitle.textContent = panelName === "templates" ? "Templates" : "Document Settings";
      templatesButton.classList.toggle("is-active", panelName === "templates");
      settingsButton.classList.toggle("is-active", panelName === "settings");
      templatesButton.setAttribute("aria-expanded", panelName === "templates" ? "true" : "false");
      settingsButton.setAttribute("aria-expanded", panelName === "settings" ? "true" : "false");
      const activePanel = panelName === "templates" ? templatePanel : settingsPanel;
      activePanel.querySelector("select, input, button")?.focus();
    };
    templatesButton.addEventListener("click", () => openSidePanel("templates"));
    settingsButton.addEventListener("click", () => openSidePanel("settings"));
    closeDrawerButton.addEventListener("click", closeSidePanel);

    main.append(toolbar, popoverLayer, workspaceBody, statusBar);
    shell.append(main);
    container.append(shell);
    sourceInput.value = markdown;
    syncHiddenOptions();

    let autosaveTimer = null;
    const updateMetrics = () => {
      const counts = markdownNotebookCounts(editor.value);
      documentNameStatus.textContent = normalizeMarkdownFilename(filenameInput.value || "untitled-notes.md");
      countStatus.textContent = `${counts.words.toLocaleString()} words, ${counts.characters.toLocaleString()} characters`;
      if (!previewPane.hidden) {
        renderMarkdownPreview(previewContent, editor.value);
      }
    };
    const updateStatus = (message) => {
      setStatus(message);
      saveStatus.textContent = message;
    };
    const isSelectedSavedDraft = () => (
      activeDocumentId &&
      activeDocumentId !== MARKDOWN_NOTEBOOK_CURRENT_KEY &&
      savedDocumentIds.has(activeDocumentId)
    );
    const updateDraftSaveHint = () => {
      if (isSelectedSavedDraft()) {
        draftSaveHint.textContent = "Save updates the selected draft. Duplicate keeps a separate copy.";
        saveDocumentButton.title = "Save changes to the selected browser draft. Use Duplicate to keep a separate copy.";
      } else {
        draftSaveHint.textContent = "Unsaved document. Save draft creates a browser draft.";
        saveDocumentButton.title = "Save this document as a browser draft.";
      }
    };
    const refreshDocumentList = async (selectedId = activeDocumentId) => {
      try {
        const allDocuments = await listMarkdownNotebookDocuments();
        const documents = allDocuments.filter((savedDocument) => savedDocument.id !== MARKDOWN_NOTEBOOK_CURRENT_KEY);
        savedDocumentIds = new Set(documents.map((savedDocument) => savedDocument.id));
        documentSelect.textContent = "";
        const hasSelectedSavedDocument = selectedId && documents.some((savedDocument) => savedDocument.id === selectedId);
        if (selectedId && !hasSelectedSavedDocument) {
          const current = document.createElement("option");
          current.value = selectedId;
          current.textContent = "Current unsaved document";
          documentSelect.append(current);
        }
        if (documents.length === 0) {
          if (!selectedId) {
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "No saved documents yet";
            documentSelect.append(empty);
          }
        } else {
          for (const savedDocument of documents) {
            const option = document.createElement("option");
            option.value = savedDocument.id;
            const updated = formatMarkdownSavedAt(savedDocument.updatedAt);
            option.textContent = updated ? `${savedDocument.title} - ${updated}` : savedDocument.title;
            documentSelect.append(option);
          }
        }
        if (selectedId && [...documentSelect.options].some((option) => option.value === selectedId)) {
          documentSelect.value = selectedId;
          activeDocumentId = selectedId;
        } else if (!selectedId && documentSelect.options.length > 0) {
          documentSelect.selectedIndex = 0;
          activeDocumentId = documentSelect.value;
        }
        syncHiddenOptions();
        updateDraftSaveHint();
        updateMetrics();
      } catch (error) {
        updateStatus(error.message || "Could not list saved documents");
      }
    };
    const saveDocument = async ({ newCopy = false } = {}) => {
      try {
        const updatingExisting = !newCopy && isSelectedSavedDraft();
        const documentId = await saveMarkdownNotebookDocument({
          id: updatingExisting ? activeDocumentId : "",
          markdown: editor.value,
          filename: getInputFilename(),
          templateId: templateSelect.value,
          title: titleInput.value
        });
        activeDocumentId = documentId;
        await refreshDocumentList(documentId);
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (newCopy) {
          updateStatus(`Duplicated as a new browser draft at ${timestamp}`);
        } else if (updatingExisting) {
          updateStatus(`Updated selected browser draft at ${timestamp}`);
        } else {
          updateStatus(`Saved as a new browser draft at ${timestamp}`);
        }
      } catch (error) {
        updateStatus(error.message || "Document save failed");
      }
    };
    const saveRecoveryDraft = async () => {
      try {
        await saveMarkdownNotebookDraft({
          markdown: editor.value,
          filename: getInputFilename()
        });
      } catch {
        // Recovery autosave is best-effort; explicit Save reports failures.
      }
    };

    const markChanged = () => {
      sourceInput.value = editor.value;
      syncHiddenOptions();
      updateStatus("Unsaved changes");
      updateMetrics();
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(saveRecoveryDraft, 1200);
    };

    editor.addEventListener("input", markChanged);
    for (const control of [titleInput, dateInput, filenameInput, frontMatterInput]) {
      control.addEventListener("input", () => {
        if (control === titleInput || control === filenameInput) {
          control.dataset.userEdited = "true";
        }
        syncHiddenOptions();
        updateStatus("Document details updated");
        updateMetrics();
      });
      control.addEventListener("change", () => {
        syncHiddenOptions();
        updateStatus("Document details updated");
        updateMetrics();
      });
    }

    templateSelect.addEventListener("change", () => {
      const selectedTemplate = markdownTemplateById(templateSelect.value);
      const currentFilename = normalizeMarkdownFilename(filenameInput.value);
      if (filenameInput.dataset.userEdited !== "true" || !filenameInput.value.trim() || markdownDefaultFilenameCandidates().includes(currentFilename)) {
        filenameInput.value = markdownDefaultFilenameForTemplate(selectedTemplate);
        filenameInput.dataset.userEdited = "false";
      }
      if (titleInput.dataset.userEdited !== "true" || !titleInput.value.trim() || markdownDefaultTitleCandidates().includes(titleInput.value.trim())) {
        titleInput.value = selectedTemplate.defaultTitle;
        titleInput.dataset.userEdited = "false";
      }
      syncHiddenOptions();
      updateStatus("Template selected. Use Start from template to replace the editor text.");
      updateMetrics();
    });

    blankDocumentButton.addEventListener("click", () => {
      const blankTitle = "Untitled notes";
      titleInput.value = blankTitle;
      titleInput.dataset.userEdited = "false";
      filenameInput.value = "untitled-notes.md";
      filenameInput.dataset.userEdited = "false";
      activeDocumentId = makeMarkdownDocumentId();
      refreshDocumentList(activeDocumentId);
      setEditorValue(`# ${blankTitle}\n\n`, "Started a blank notebook");
      closeAllPopovers();
      closeSidePanel();
      updateMetrics();
    });

    useTemplateButton.addEventListener("click", () => {
      const built = buildMarkdownNotebook("", getOptions());
      filenameInput.value = built.filename;
      filenameInput.dataset.userEdited = "false";
      titleInput.dataset.userEdited = "false";
      activeDocumentId = makeMarkdownDocumentId();
      refreshDocumentList(activeDocumentId);
      setEditorValue(built.markdown, "Started a new notebook from the selected template");
      closeAllPopovers();
      closeSidePanel();
      updateMetrics();
    });

    useExampleButton.addEventListener("click", () => {
      const exampleMarkdown = getSelectedToolExample();
      filenameInput.value = "sms3-notebook-example.md";
      filenameInput.dataset.userEdited = "false";
      titleInput.value = markdownDocumentTitle(exampleMarkdown, filenameInput.value);
      titleInput.dataset.userEdited = "false";
      activeDocumentId = makeMarkdownDocumentId();
      refreshDocumentList(activeDocumentId);
      setEditorValue(exampleMarkdown, "Loaded the bundled notebook example");
      closeAllPopovers();
      closeSidePanel();
      updateMetrics();
    });

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) {
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        updateStatus(`${file.name} is larger than 25 MB.`);
        return;
      }
      try {
        const text = await readToolInputFileText(file, { onMessage: updateStatus });
        filenameInput.value = markdownFilenameFromLoadedFile(file.name);
        filenameInput.dataset.userEdited = "false";
        titleInput.value = markdownDocumentTitle(text, filenameInput.value);
        titleInput.dataset.userEdited = "false";
        activeDocumentId = makeMarkdownDocumentId();
        await refreshDocumentList(activeDocumentId);
        setEditorValue(text, `Opened ${file.name}`);
        closeAllPopovers();
        closeSidePanel();
        updateMetrics();
      } catch (error) {
        updateStatus(error.message || `Could not open ${file.name}`);
      }
    });

    saveDocumentButton.addEventListener("click", () => saveDocument());
    loadDocumentButton.addEventListener("click", async () => {
      try {
        const documentId = documentSelect.value;
        if (!documentId) {
          updateStatus("No saved document selected");
          return;
        }
        const savedDocument = await loadMarkdownNotebookDocument(documentId);
        if (!savedDocument) {
          updateStatus("That draft has not been saved yet. Use Save to keep it in browser.");
          await refreshDocumentList(activeDocumentId);
          return;
        }
        activeDocumentId = savedDocument.id;
        filenameInput.value = normalizeMarkdownFilename(savedDocument.filename);
        titleInput.value = savedDocument.title || markdownDocumentTitle(savedDocument.markdown, savedDocument.filename);
        templateSelect.value = markdownTemplateById(savedDocument.templateId).id;
        setEditorValue(savedDocument.markdown ?? "", `Loaded saved draft: ${titleInput.value}`);
        updateDraftSaveHint();
        closeAllPopovers();
        updateMetrics();
      } catch (error) {
        updateStatus(error.message || "Document load failed");
      }
    });
    duplicateDocumentButton.addEventListener("click", async () => {
      await saveDocument({ newCopy: true });
    });
    deleteDocumentButton.addEventListener("click", async () => {
      const documentId = documentSelect.value;
      if (!documentId) {
        updateStatus("No saved document selected");
        return;
      }
      try {
        await deleteMarkdownNotebookDocument(documentId);
        activeDocumentId = makeMarkdownDocumentId();
        await refreshDocumentList("");
        updateStatus("Deleted selected saved document");
        closeAllPopovers();
      } catch (error) {
        updateStatus(error.message || "Document delete failed");
      }
    });
    documentSelect.addEventListener("change", () => {
      activeDocumentId = documentSelect.value;
      syncHiddenOptions();
      updateDraftSaveHint();
    });
    copyButton.addEventListener("click", async () => {
      await navigator.clipboard.writeText(editor.value);
      updateStatus("Copied Markdown");
      closeAllPopovers();
    });
    downloadButton.addEventListener("click", () => {
      downloadText(editor.value, getInputFilename(), "text/markdown;charset=utf-8");
      updateStatus("Downloaded Markdown");
      closeAllPopovers();
    });
    insertLinkButton.addEventListener("click", () => {
      const text = linkTextInput.value.trim() || editor.value.slice(editor.selectionStart, editor.selectionEnd) || "link text";
      const url = linkUrlInput.value.trim() || "https://example.org";
      insertMarkdownAtSelection(editor, { block: `[${text}](${url})` });
      linkTextInput.value = "";
      linkUrlInput.value = "";
      closeAllPopovers();
    });
    insertTableButton.addEventListener("click", () => {
      const columnCount = Math.max(1, Math.min(10, Number.parseInt(tableColumnsInput.value, 10) || 2));
      const rowCount = Math.max(1, Math.min(20, Number.parseInt(tableRowsInput.value, 10) || 2));
      const headers = Array.from({ length: columnCount }, (_, index) => `Column ${index + 1}`);
      const rows = Array.from({ length: rowCount }, () => headers.map(() => ""));
      const table = `${formatMarkdownTableRows(headers, rows)}\n`;
      insertMarkdownAtSelection(editor, { block: table });
      closeAllPopovers();
    });
    previewButton.addEventListener("click", () => {
      const showPreview = previewPane.hidden;
      previewPane.hidden = !showPreview;
      editorLayout.classList.toggle("markdown-editor-layout-split", showPreview);
      previewButton.classList.toggle("is-active", showPreview);
      previewButton.setAttribute("aria-pressed", showPreview ? "true" : "false");
      previewButton.textContent = showPreview ? "Edit only" : "Split preview";
      updateMetrics();
    });
    document.addEventListener("pointerdown", (event) => {
      if (!shell.contains(event.target)) {
        closeAllPopovers();
        return;
      }
      if (event.target.closest("[data-markdown-popover]") || event.target.closest("[data-open-popover]")) {
        return;
      }
      closeAllPopovers();
    }, { signal: eventController.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAllPopovers();
        closeSidePanel();
      }
    }, { signal: eventController.signal });
    updateMetrics();
    refreshDocumentList(activeDocumentId);
  }

  return {
    getControl,
    getInputFilename,
    getOptions,
    insertTemplate,
    readState,
    render,
    selectedTemplate,
    setStatus,
    syncFromSource,
    syncInputFilenameFromOptions,
    syncTemplateDefaults
  };
}
