import { findPatternMatches } from "./pattern.js";
import { complementDnaRnaSequence, makeSequenceContext } from "./sequence.js";

export const restrictionHitTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "enzyme", label: "Enzyme", type: "string" },
  { id: "recognition", label: "Recognition", type: "string" },
  { id: "strand", label: "Strand", type: "string" },
  { id: "site_start", label: "Site start", type: "number" },
  { id: "site_end", label: "Site end", type: "number" },
  { id: "cut_after", label: "Cut after base", type: "number" },
  { id: "overhang", label: "Overhang", type: "string" },
  { id: "left_context", label: "Left context", type: "string" },
  { id: "matched_text", label: "Matched text", type: "string" },
  { id: "right_context", label: "Right context", type: "string" },
  { id: "context_sequence", label: "Context sequence", type: "string" }
];

export const restrictionFragmentTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "fragment", label: "Fragment", type: "number" },
  { id: "start", label: "Start", type: "number" },
  { id: "end", label: "End", type: "number" },
  { id: "length", label: "Length", type: "number" },
  { id: "topology", label: "Topology", type: "string" }
];

export const restrictionMapTableColumns = [
  ...restrictionHitTableColumns,
  { id: "record_length", label: "Record length", type: "number" }
];

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

function normalizeEnzymeIds(enzymeIds, records) {
  const validIds = new Set(records.map((record) => record.id));
  const selected = String(enzymeIds ?? "common")
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (selected.length === 0 || selected.includes("common") || selected.includes("all")) {
    return records.map((record) => record.id);
  }

  return selected.filter((id) => validIds.has(id));
}

function makeOrientationPatterns(enzyme) {
  const forward = enzyme.recognition.toUpperCase().replace(/[^A-Z]/g, "");
  const reverse = reverseComplement(forward);
  const patterns = [{ strand: "+", pattern: forward, cutOffset: enzyme.cutTop }];
  if (reverse !== forward) {
    patterns.push({
      strand: "-",
      pattern: reverse,
      cutOffset: forward.length - enzyme.cutBottom
    });
  }
  return patterns;
}

export function getRestrictionEnzymeChoices(records) {
  return records
    .map((record) => ({ value: record.id, label: `${record.name} (${record.recognition})` }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function selectRestrictionEnzymes(records, enzymeIds) {
  const selectedIds = normalizeEnzymeIds(enzymeIds, records);
  const selected = records.filter((record) => selectedIds.includes(record.id));
  return selected.length > 0 ? selected : records;
}

export function findRestrictionSites(sequence, enzymes) {
  const hits = [];

  for (const enzyme of enzymes) {
    for (const orientation of makeOrientationPatterns(enzyme)) {
      const matches = findPatternMatches(sequence, orientation.pattern, {
        alphabet: "dna-rna",
        patternMode: "iupac",
        caseInsensitive: true,
        allowOverlaps: true
      });

      for (const match of matches) {
        const sequenceContext = makeSequenceContext(sequence, match.start, match.end);
        hits.push({
          enzyme: enzyme.name,
          enzyme_id: enzyme.id,
          recognition: enzyme.recognition,
          strand: orientation.strand,
          site_start: match.start,
          site_end: match.end,
          cut_after: match.start + orientation.cutOffset - 1,
          overhang: enzyme.overhang,
          ...sequenceContext
        });
      }
    }
  }

  return hits.sort((left, right) =>
    left.site_start - right.site_start ||
    left.cut_after - right.cut_after ||
    left.enzyme.localeCompare(right.enzyme)
  );
}

export function getUniqueCutPositions(hits, sequenceLength) {
  return [...new Set(
    hits
      .map((hit) => hit.cut_after)
      .filter((position) => Number.isFinite(position) && position >= 0 && position <= sequenceLength)
  )].sort((left, right) => left - right);
}

export function makeRestrictionFragments(sequenceLength, hits, topology = "linear") {
  const cutPositions = getUniqueCutPositions(hits, sequenceLength);
  if (topology === "circular") {
    if (cutPositions.length === 0) {
      return [{ fragment: 1, start: 1, end: sequenceLength, length: sequenceLength, topology: "circular" }];
    }
    return cutPositions.map((position, index) => {
      const next = cutPositions[(index + 1) % cutPositions.length];
      const length = index === cutPositions.length - 1 ? sequenceLength - position + next : next - position;
      return {
        fragment: index + 1,
        start: position + 1,
        end: next,
        length,
        topology: "circular"
      };
    });
  }

  const boundaries = [0, ...cutPositions.filter((position) => position > 0 && position < sequenceLength), sequenceLength];
  return boundaries.slice(0, -1).map((start, index) => ({
    fragment: index + 1,
    start: start + 1,
    end: boundaries[index + 1],
    length: boundaries[index + 1] - start,
    topology: "linear"
  }));
}

function estimateTextWidth(text, characterWidth = 7.5) {
  return String(text ?? "").length * characterWidth;
}

function truncateTextToWidth(text, maxWidth, characterWidth = 7) {
  const source = String(text ?? "");
  const maxCharacters = Math.max(4, Math.floor(maxWidth / characterWidth));
  if (source.length <= maxCharacters) {
    return source;
  }
  return `${source.slice(0, maxCharacters - 3)}...`;
}

function tryPlaceLabel(lanes, center, width, maxLanes = 4, padding = 6) {
  const left = center - width / 2 - padding;
  const right = center + width / 2 + padding;
  for (let lane = 0; lane < maxLanes; lane += 1) {
    const placed = lanes[lane] ?? [];
    if (placed.every((label) => right < label.left || left > label.right)) {
      placed.push({ left, right });
      lanes[lane] = placed;
      return lane;
    }
  }
  return -1;
}

function labelAnchorForAngle(angle) {
  const cosine = Math.cos(angle);
  if (cosine > 0.25) {
    return "start";
  }
  if (cosine < -0.25) {
    return "end";
  }
  return "middle";
}

function makeLabelBox(x, y, width, anchor, padding = 5) {
  const textHeight = 12;
  const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return {
    left: left - padding,
    right: left + width + padding,
    top: y - textHeight - padding,
    bottom: y + padding
  };
}

function boxesOverlap(left, right) {
  return left.left <= right.right && left.right >= right.left && left.top <= right.bottom && left.bottom >= right.top;
}

function makeSvgScaffold(width, height, title, extraStyles = []) {
  const textColor = "#263238";
  const mutedColor = "#5c6b75";
  const lineColor = "#5f6f79";
  const hitColor = "#c84b31";
  const accentColor = "#1f7a8c";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">`,
    "<style>",
    `.title{font:700 18px system-ui,sans-serif;fill:${textColor}}`,
    `.label{font:600 12px system-ui,sans-serif;fill:${textColor}}`,
    `.record-label{font:600 12px system-ui,sans-serif;fill:${textColor}}`,
    `.record-length{font:11px system-ui,sans-serif;fill:${mutedColor}}`,
    `.small{font:11px system-ui,sans-serif;fill:${mutedColor}}`,
    `.note{font:11px system-ui,sans-serif;fill:${mutedColor}}`,
    `.axis{stroke:${lineColor};stroke-width:3;stroke-linecap:round}`,
    `.tick{stroke:${lineColor};stroke-width:1}`,
    `.site{stroke:${hitColor};stroke-width:2}`,
    `.site-label{font:10px system-ui,sans-serif;fill:${hitColor};text-anchor:middle}`,
    `.fragment{fill:${accentColor};opacity:0.14}`,
    `.fragment-label{font:10px system-ui,sans-serif;fill:${accentColor};text-anchor:middle}`,
    `.label-suppressed{font:10px system-ui,sans-serif;fill:${mutedColor};text-anchor:middle}`,
    ...extraStyles,
    "</style>",
    `<rect x="0" y="0" width="${width}" height="${height}" fill="white"/>`
  ];
}

function renderLinearRestrictionMap(records, options = {}) {
  const width = 920;
  const siteLabelLaneCount = 3;
  const siteLabelLaneSpacing = 13;
  const siteLabelTopPadding = 24;
  const rowHeight = 164;
  const margin = { top: 76, right: 36, bottom: 42, left: 28 };
  const height = Math.max(180, margin.top + margin.bottom + records.length * rowHeight);
  const plotWidth = width - margin.left - margin.right;
  const labelLeft = 18;
  const labelMaxWidth = width - labelLeft - margin.right;
  const title = "Restriction map";
  const parts = makeSvgScaffold(width, height, title);
  const isCircularOverview = options.topology === "circular";
  parts.push(`<text class="title" x="${labelLeft}" y="26">${title}</text>`);
  parts.push(
    `<text class="note" x="${labelLeft}" y="44">${
      isCircularOverview && records.length > 1
        ? "Circular digest fragments are computed circularly; multi-record overview is drawn linearly with each record scaled independently."
        : "Each record is scaled independently to its own sequence length."
    }</text>`
  );

  records.forEach((record, recordIndex) => {
    const rowTop = margin.top + recordIndex * rowHeight;
    const y = rowTop + 92;
    const length = Math.max(1, record.length);
    const scaleX = (position) => margin.left + (position / length) * plotWidth;
    const displayTitle = truncateTextToWidth(record.title, labelMaxWidth, 7.5);
    parts.push(`<text class="record-label" x="${labelLeft}" y="${rowTop + 14}" data-full-title="${escapeXml(record.title)}">${escapeXml(displayTitle)}</text>`);
    parts.push(`<text class="record-length" x="${labelLeft}" y="${rowTop + 32}">${length} bp</text>`);
    parts.push(`<line class="axis" x1="${margin.left}" y1="${y}" x2="${margin.left + plotWidth}" y2="${y}"/>`);
    parts.push(`<line class="tick" x1="${margin.left}" y1="${y - 8}" x2="${margin.left}" y2="${y + 8}"/>`);
    parts.push(`<line class="tick" x1="${margin.left + plotWidth}" y1="${y - 8}" x2="${margin.left + plotWidth}" y2="${y + 8}"/>`);

    for (const fragment of record.fragments ?? []) {
      if (fragment.length <= 0 || fragment.topology === "circular") {
        continue;
      }
      const x1 = scaleX(fragment.start - 1);
      const x2 = scaleX(fragment.end);
      const fragmentWidth = Math.max(1, x2 - x1);
      parts.push(`<rect class="fragment" x="${x1.toFixed(2)}" y="${y - 6}" width="${fragmentWidth.toFixed(2)}" height="12"/>`);
      if (fragmentWidth >= 48) {
        parts.push(`<text class="fragment-label" x="${((x1 + x2) / 2).toFixed(2)}" y="${y + 26}">${fragment.length} bp</text>`);
      }
    }

    const lanes = [];
    let suppressedLabelCount = 0;
    for (const hit of record.hits ?? []) {
      const x = scaleX(hit.cut_after);
      const labelWidth = estimateTextWidth(hit.enzyme);
      const lane = tryPlaceLabel(lanes, x, labelWidth, siteLabelLaneCount, 12);
      parts.push(`<line class="site" x1="${x.toFixed(2)}" y1="${y - 18}" x2="${x.toFixed(2)}" y2="${y + 18}"/>`);
      if (lane >= 0) {
        const labelY = y - siteLabelTopPadding - lane * siteLabelLaneSpacing;
        parts.push(`<text class="site-label" x="${x.toFixed(2)}" y="${labelY}">${escapeXml(hit.enzyme)}</text>`);
      } else {
        suppressedLabelCount += 1;
      }
    }
    if (suppressedLabelCount > 0) {
      parts.push(`<text class="label-suppressed" x="${margin.left + plotWidth - 16}" y="${y + 38}">${suppressedLabelCount} dense label${suppressedLabelCount === 1 ? "" : "s"} in table</text>`);
    }
  });

  parts.push("</svg>");
  return parts.join("");
}

function renderCircularRestrictionMap(record) {
  const width = 640;
  const height = 640;
  const center = { x: width / 2, y: height / 2 + 16 };
  const radius = 184;
  const title = "Circular restriction map";
  const parts = makeSvgScaffold(width, height, title, [
    ".circle-axis{fill:none;stroke:#5f6f79;stroke-width:4}",
    ".radial{stroke:#c84b31;stroke-width:2}",
    ".fragment-arc{fill:none;stroke:#1f7a8c;stroke-width:12;opacity:0.18;stroke-linecap:round}"
  ]);
  const length = Math.max(1, record.length);
  const angleForPosition = (position) => -Math.PI / 2 + (position / length) * Math.PI * 2;
  const point = (angle, distance = radius) => ({
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance
  });

  parts.push(`<text class="title" x="40" y="36">${title}</text>`);
  parts.push(`<text class="label" x="40" y="60">${escapeXml(record.title)}</text>`);
  parts.push(`<text class="small" x="40" y="78">${length} bp; circular topology</text>`);
  parts.push(`<circle class="circle-axis" cx="${center.x}" cy="${center.y}" r="${radius}"/>`);

  for (const fragment of record.fragments ?? []) {
    if (fragment.length <= 0) {
      continue;
    }
    const start = Math.max(0, fragment.start - 1);
    const end = fragment.end <= start ? fragment.end + length : fragment.end;
    const startAngle = angleForPosition(start);
    const endAngle = angleForPosition(end);
    const startPoint = point(startAngle, radius);
    const endPoint = point(endAngle, radius);
    const largeArc = fragment.length / length > 0.5 ? 1 : 0;
    parts.push(`<path class="fragment-arc" d="M ${startPoint.x.toFixed(2)} ${startPoint.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x.toFixed(2)} ${endPoint.y.toFixed(2)}"/>`);
    const midAngle = startAngle + (fragment.length / length) * Math.PI;
    const midPoint = point(midAngle, radius - 34);
    if ((fragment.length / length) * Math.PI * 2 * radius >= 60) {
      parts.push(`<text class="fragment-label" x="${midPoint.x.toFixed(2)}" y="${midPoint.y.toFixed(2)}">${fragment.length} bp</text>`);
    }
  }

  const placedLabelBoxes = [];
  for (const hit of record.hits ?? []) {
    const angle = angleForPosition(hit.cut_after);
    const inner = point(angle, radius - 18);
    const outer = point(angle, radius + 18);
    const labelWidth = estimateTextWidth(hit.enzyme);
    const anchor = labelAnchorForAngle(angle);
    const labelDistances = [radius + 30, radius + 44, radius + 58];
    let label = null;
    for (const distance of labelDistances) {
      const candidate = point(angle, distance);
      const box = makeLabelBox(candidate.x, candidate.y, labelWidth, anchor, 5);
      if (placedLabelBoxes.every((placedBox) => !boxesOverlap(box, placedBox))) {
        label = { ...candidate, box };
        break;
      }
    }
    if (!label) {
      const fallback = point(angle, labelDistances.at(-1));
      label = { ...fallback, box: makeLabelBox(fallback.x, fallback.y, labelWidth, anchor, 5) };
    }
    placedLabelBoxes.push(label.box);
    parts.push(`<line class="radial" x1="${inner.x.toFixed(2)}" y1="${inner.y.toFixed(2)}" x2="${outer.x.toFixed(2)}" y2="${outer.y.toFixed(2)}"/>`);
    parts.push(`<text class="site-label" x="${label.x.toFixed(2)}" y="${label.y.toFixed(2)}" text-anchor="${anchor}">${escapeXml(hit.enzyme)}</text>`);
  }

  parts.push("</svg>");
  return parts.join("");
}

export function makeRestrictionMapSvg(records, options = {}) {
  if (options.topology === "circular" && records.length === 1) {
    return renderCircularRestrictionMap(records[0]);
  }
  return renderLinearRestrictionMap(records, options);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
