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

export const COMMON_DNA_LADDER_BP = [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 750, 500, 250, 100];

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

function pushLinearFragmentSegment(parts, { x1, x2, y, label, labelY = y + 26 }) {
  const fragmentWidth = Math.max(1, x2 - x1);
  parts.push(`<rect class="fragment" x="${x1.toFixed(2)}" y="${y - 6}" width="${fragmentWidth.toFixed(2)}" height="12"/>`);
  if (label && fragmentWidth >= 48) {
    parts.push(`<text class="fragment-label" x="${((x1 + x2) / 2).toFixed(2)}" y="${labelY}">${escapeXml(label)}</text>`);
  }
  return fragmentWidth;
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

    let hasCircularWrapFragment = false;
    for (const fragment of record.fragments ?? []) {
      if (fragment.length <= 0) {
        continue;
      }
      if (fragment.topology === "circular") {
        if (fragment.start > fragment.end) {
          hasCircularWrapFragment = true;
          const rightWidth = pushLinearFragmentSegment(parts, {
            x1: scaleX(fragment.start - 1),
            x2: scaleX(length),
            y,
            label: `${fragment.length} bp total`,
            labelY: y + 26
          });
          const leftWidth = pushLinearFragmentSegment(parts, {
            x1: scaleX(0),
            x2: scaleX(fragment.end),
            y,
            label: rightWidth >= 48 ? "" : `${fragment.length} bp total`,
            labelY: y + 26
          });
          if (rightWidth < 48 && leftWidth < 48 && rightWidth + leftWidth >= 48) {
            parts.push(`<text class="fragment-label" x="${margin.left + 44}" y="${y + 26}">${fragment.length} bp total</text>`);
          }
        } else {
          pushLinearFragmentSegment(parts, {
            x1: scaleX(fragment.start - 1),
            x2: scaleX(fragment.end),
            y,
            label: `${fragment.length} bp`
          });
        }
        continue;
      }
      pushLinearFragmentSegment(parts, {
        x1: scaleX(fragment.start - 1),
        x2: scaleX(fragment.end),
        y,
        label: `${fragment.length} bp`
      });
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
    if (hasCircularWrapFragment) {
      parts.push(`<text class="note" x="${labelLeft}" y="${y + 52}">Circular wrap-around fragment is split at the displayed sequence ends; the labeled total is one digest fragment.</text>`);
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

function apparentGelSize(fragment, record, options = {}) {
  const uncutCircular = options.topology === "circular" && (record.hits ?? []).length === 0 && fragment.topology === "circular";
  return uncutCircular ? Math.max(20, fragment.length * 0.68) : fragment.length;
}

export function makeRestrictionGelSvg(records, options = {}) {
  const laneCount = records.length + 1;
  const margin = { top: 96, right: 30, bottom: 54, left: 58 };
  const width = Math.max(720, margin.left + margin.right + laneCount * 110);
  const laneWidth = (width - margin.left - margin.right) / laneCount;
  const gelWidth = width;
  const gelHeight = 430;
  const height = margin.top + gelHeight + margin.bottom;
  const laneCenter = (index) => margin.left + laneWidth * index + laneWidth / 2;
  const minBp = 80;
  const maxBp = Math.max(
    12000,
    ...COMMON_DNA_LADDER_BP,
    ...records.flatMap((record) => (record.fragments ?? []).map((fragment) => fragment.length))
  );
  const logMin = Math.log10(minBp);
  const logMax = Math.log10(maxBp);
  const yForSize = (size) => {
    const clamped = Math.max(minBp, Math.min(maxBp, size));
    const fraction = (logMax - Math.log10(clamped)) / Math.max(0.1, logMax - logMin);
    return margin.top + 18 + fraction * (gelHeight - 38);
  };
  const bandWidthForSize = (size) => Math.max(28, Math.min(58, 34 + Math.log10(Math.max(100, size)) * 4));
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Simulated restriction digest gel">`,
    "<defs>",
    '<filter id="bandBlur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="1.6"/></filter>',
    '<linearGradient id="gelBackground" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#101c35"/><stop offset="0.55" stop-color="#172a4c"/><stop offset="1" stop-color="#203862"/></linearGradient>',
    '<radialGradient id="wellGlow" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#4b6f9e" stop-opacity="0.45"/><stop offset="1" stop-color="#14233e" stop-opacity="0"/></radialGradient>',
    "</defs>",
    "<style>",
    ".title{font:700 18px system-ui,sans-serif;fill:#18202a}",
    ".subtitle{font:12px system-ui,sans-serif;fill:#53616d}",
    ".lane-label{font:600 11px system-ui,sans-serif;fill:#24313d;text-anchor:middle}",
    ".size-label{font:10px system-ui,sans-serif;fill:#d7e8ff;text-anchor:end}",
    ".gel-note{font:11px system-ui,sans-serif;fill:#53616d}",
    ".band{fill:#c9efff;opacity:0.86;filter:url(#bandBlur)}",
    ".ladder-band{fill:#e7f8ff;opacity:0.94;filter:url(#bandBlur)}",
    "</style>",
    `<rect x="0" y="0" width="${width}" height="${height}" fill="white"/>`,
    '<text class="title" x="24" y="34">Simulated restriction digest gel</text>',
    `<text class="subtitle" x="24" y="54">One sample lane per sequence, plus a common 100 bp-10 kb DNA ladder.</text>`,
    `<rect x="${margin.left}" y="${margin.top}" width="${gelWidth - margin.left - margin.right}" height="${gelHeight}" rx="8" fill="url(#gelBackground)"/>`,
    `<rect x="${margin.left}" y="${margin.top}" width="${gelWidth - margin.left - margin.right}" height="${gelHeight}" rx="8" fill="url(#wellGlow)" opacity="0.65"/>`
  ];

  for (let index = 0; index < laneCount; index += 1) {
    const center = laneCenter(index);
    parts.push(`<rect x="${(center - 24).toFixed(1)}" y="${margin.top + 8}" width="48" height="16" rx="4" fill="#091426" opacity="0.72"/>`);
    parts.push(`<line x1="${center.toFixed(1)}" y1="${margin.top + 26}" x2="${center.toFixed(1)}" y2="${margin.top + gelHeight - 10}" stroke="#d8ecff" stroke-opacity="0.055" stroke-width="54"/>`);
  }

  parts.push(`<text class="lane-label" x="${laneCenter(0)}" y="${margin.top - 14}">Ladder</text>`);
  for (const size of COMMON_DNA_LADDER_BP) {
    const y = yForSize(size);
    const intensity = [10000, 5000, 3000, 1000, 500].includes(size) ? 1 : 0.72;
    parts.push(`<rect class="ladder-band" x="${(laneCenter(0) - bandWidthForSize(size) / 2).toFixed(1)}" y="${(y - 2.2).toFixed(1)}" width="${bandWidthForSize(size).toFixed(1)}" height="4.4" rx="2.2" opacity="${intensity}"/>`);
    if ([10000, 5000, 3000, 1000, 500, 100].includes(size)) {
      parts.push(`<text class="size-label" x="${(laneCenter(0) - 36).toFixed(1)}" y="${(y + 3).toFixed(1)}">${size.toLocaleString()}</text>`);
    }
  }

  records.forEach((record, recordIndex) => {
    const laneIndex = recordIndex + 1;
    const center = laneCenter(laneIndex);
    const label = truncateTextToWidth(record.title, laneWidth - 8, 6.2);
    parts.push(`<text class="lane-label" x="${center.toFixed(1)}" y="${margin.top - 14}" data-full-title="${escapeXml(record.title)}">${escapeXml(label)}</text>`);
    const fragments = record.fragments?.length ? record.fragments : [{ length: record.length, topology: options.topology ?? "linear" }];
    for (const fragment of fragments) {
      if (fragment.length <= 0) {
        continue;
      }
      const apparentSize = apparentGelSize(fragment, record, options);
      const y = yForSize(apparentSize);
      const bandWidth = bandWidthForSize(fragment.length);
      const isUncutCircular = options.topology === "circular" && (record.hits ?? []).length === 0 && fragment.topology === "circular";
      const heightScale = isUncutCircular ? 5.8 : 4.2;
      const opacity = Math.max(0.38, Math.min(0.92, 0.42 + Math.log10(Math.max(100, fragment.length)) / 8));
      parts.push(`<rect class="band" x="${(center - bandWidth / 2).toFixed(1)}" y="${(y - heightScale / 2).toFixed(1)}" width="${bandWidth.toFixed(1)}" height="${heightScale.toFixed(1)}" rx="${(heightScale / 2).toFixed(1)}" opacity="${opacity.toFixed(2)}"/>`);
      if (isUncutCircular) {
        parts.push(`<path d="M ${(center - bandWidth / 2).toFixed(1)} ${(y + 5).toFixed(1)} C ${(center - 10).toFixed(1)} ${(y + 9).toFixed(1)}, ${(center + 10).toFixed(1)} ${(y + 1).toFixed(1)}, ${(center + bandWidth / 2).toFixed(1)} ${(y + 5).toFixed(1)}" fill="none" stroke="#e2f8ff" stroke-opacity="0.55" stroke-width="1.2"/>`);
      }
    }
  });

  parts.push(`<text class="gel-note" x="24" y="${height - 20}">Qualitative log-size gel; uncut circular DNA is drawn with faster apparent mobility.</text>`);
  parts.push("</svg>");
  return parts.join("");
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
