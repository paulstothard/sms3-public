function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncateLabel(value, maxLength = 30) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function lastInformativeWords(value, maxLength = 28) {
  const stop = new Set([
    "dna",
    "rna",
    "protein",
    "putative",
    "hypothetical",
    "fragment",
    "partial"
  ]);
  const words = String(value ?? "")
    .replace(/[;,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .filter((word) => !stop.has(word.toLowerCase()));
  const picked = [];
  for (const word of words.reverse()) {
    picked.unshift(word);
    if (picked.join(" ").length >= maxLength - 4) {
      break;
    }
  }
  return truncateLabel(picked.join(" ") || value, maxLength);
}

function polarToCartesian(centerX, centerY, radius, angleDegrees) {
  const radians = (angleDegrees - 90) * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(radians),
    y: centerY + radius * Math.sin(radians)
  };
}

function describeArc(centerX, centerY, radius, startAngle, endAngle) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

function estimateTextWidth(text, fontSize = 13) {
  return String(text ?? "").length * fontSize * 0.58;
}

function featureLabelPriority(feature) {
  if (feature.className === "coding") {
    return 0;
  }
  if (feature.className === "gene") {
    return 1;
  }
  if (feature.className === "regulatory") {
    return 2;
  }
  if (feature.className === "repeat" || feature.className === "other") {
    return 3;
  }
  if (feature.className === "variant") {
    return 9;
  }
  return 5;
}

function largestPartLength(feature) {
  const parts = feature.parts?.length ? feature.parts : [feature];
  return Math.max(...parts.map((part) => part.end - part.start + 1));
}

const defaultFeatureStyles = {
  coding: { label: "CDS/exon", fill: "#2563eb", stroke: "#1d4ed8" },
  gene: { label: "Gene", fill: "#16a34a", stroke: "#15803d" },
  source: { label: "Source", fill: "#94a3b8", stroke: "#64748b" },
  regulatory: { label: "Regulatory", fill: "#d97706", stroke: "#b45309" },
  repeat: { label: "Repeat", fill: "#9333ea", stroke: "#7e22ce" },
  variant: { label: "Variation", fill: "#dc2626", stroke: "#b91c1c" },
  other: { label: "Other", fill: "#0891b2", stroke: "#0e7490" }
};

function normalizeFeature(feature, sequenceLength) {
  const rawStart = Number(feature.start);
  const rawEnd = Number(feature.end);
  const spansOrigin = Number.isFinite(rawStart) && Number.isFinite(rawEnd) && rawStart > rawEnd;
  const start = spansOrigin
    ? Math.max(1, Math.min(sequenceLength, rawEnd))
    : Math.max(1, Math.min(sequenceLength, rawStart));
  const end = spansOrigin
    ? Math.max(1, Math.min(sequenceLength, rawStart))
    : Math.max(start, Math.min(sequenceLength, rawEnd));
  const rawParts = Array.isArray(feature.parts) && feature.parts.length > 0
    ? feature.parts
    : spansOrigin
      ? [
          { start: rawStart, end: sequenceLength, strand: feature.strand },
          { start: 1, end: rawEnd, strand: feature.strand }
        ]
      : [{ start, end, strand: feature.strand }];
  const parts = rawParts
    .map((part) => {
      const partStart = Math.max(1, Math.min(sequenceLength, Number(part.start)));
      const partEnd = Math.max(partStart, Math.min(sequenceLength, Number(part.end)));
      return {
        start: partStart,
        end: partEnd,
        strand: part.strand ?? feature.strand ?? "+"
      };
    })
    .filter((part) => Number.isFinite(part.start) && Number.isFinite(part.end));
  return {
    ...feature,
    start,
    end,
    parts,
    className: feature.className ?? "other",
    slot: Number.isFinite(Number(feature.slot)) ? Number(feature.slot) : null,
    ring: Number.isFinite(Number(feature.ring)) ? Number(feature.ring) : null,
    label: truncateLabel(feature.label ?? feature.type ?? "feature", 36)
  };
}

function featureMidAngle(feature, sequenceLength) {
  const parts = feature.parts?.length ? feature.parts : [feature];
  const largestPart = parts
    .slice()
    .sort((left, right) => (right.end - right.start) - (left.end - left.start))[0];
  return (((largestPart.start + largestPart.end) / 2 - 1) / sequenceLength) * 360;
}

function scaleLinearPosition(position, sequenceLength, left, width) {
  if (sequenceLength <= 1) {
    return left;
  }
  return left + ((position - 1) / (sequenceLength - 1)) * width;
}

function getLegendLayout(classes, styles, { maxWidth = 760 } = {}) {
  const visible = Object.keys(styles)
    .filter((className) => classes.has(className) && className !== "source")
    .map((className) => ({
      className,
      style: styles[className] ?? styles.other
    }));
  const items = [];
  let row = 0;
  let cursorX = 0;
  for (const item of visible) {
    const itemWidth = Math.max(118, Math.min(280, estimateTextWidth(item.style.label, 12) + 44));
    if (cursorX > 0 && cursorX + itemWidth > maxWidth) {
      row += 1;
      cursorX = 0;
    }
    items.push({
      ...item,
      x: cursorX,
      y: row * 24,
      width: itemWidth
    });
    cursorX += itemWidth;
  }
  return {
    items,
    rows: items.length === 0 ? 0 : row + 1
  };
}

function renderLegend(classes, styles, x, y, { maxWidth = 760 } = {}) {
  const layout = getLegendLayout(classes, styles, { maxWidth });
  if (layout.items.length === 0) {
    return "";
  }
  const parts = [`<g class="legend" transform="translate(${x} ${y})" aria-label="Legend">`];
  for (const item of layout.items) {
    parts.push(`<rect x="${item.x}" y="${item.y}" width="12" height="12" rx="2" fill="${item.style.fill}" stroke="${item.style.stroke}"></rect>`);
    parts.push(`<text x="${item.x + 18}" y="${item.y + 10}">${escapeXml(item.style.label)}</text>`);
  }
  parts.push("</g>");
  return parts.join("\n");
}

function assignLinearFeatureLanes(features) {
  const laneEnds = [];
  return features
    .slice()
    .sort((left, right) => left.start - right.start || right.end - left.end)
    .map((feature) => {
      if (feature.slot !== null) {
        laneEnds[feature.slot] = Math.max(laneEnds[feature.slot] ?? 0, feature.end);
        return { ...feature, lane: feature.slot };
      }
      let lane = laneEnds.findIndex((end) => feature.start > end);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = feature.end;
      return { ...feature, lane };
    });
}

function assignLinearLabelLanes(labels, leftLimit, rightLimit) {
  const laneIntervals = [];
  const minGap = 14;
  const maxNudge = 88;
  const maxLabelLanes = 12;
  return labels
    .slice()
    .sort((left, right) => left.x - right.x)
    .map((label) => {
      const halfWidth = Math.min(estimateTextWidth(label.label, 13), 220) / 2;
      const minCenter = leftLimit + halfWidth;
      const maxCenter = rightLimit - halfWidth;
      const anchoredTextX = Math.max(minCenter, Math.min(maxCenter, label.x));

      for (let lane = 0; lane < maxLabelLanes; lane += 1) {
        if (!laneIntervals[lane]) {
          laneIntervals[lane] = [];
        }
        const left = anchoredTextX - halfWidth;
        const right = anchoredTextX + halfWidth;
        const collides = laneIntervals[lane].some((interval) => left <= interval.right + minGap && right >= interval.left - minGap);
        if (!collides) {
          laneIntervals[lane].push({ left, right });
          laneIntervals[lane].sort((leftInterval, rightInterval) => leftInterval.left - rightInterval.left);
          return { ...label, lane, textX: anchoredTextX };
        }
      }

      for (let lane = 0; lane < maxLabelLanes; lane += 1) {
        if (!laneIntervals[lane]) {
          laneIntervals[lane] = [];
        }
        const textX = findLinearLabelPosition({
          anchorX: label.x,
          halfWidth,
          intervals: laneIntervals[lane],
          leftLimit,
          rightLimit,
          minGap,
          maxNudge
        });
        if (textX === null) continue;
        laneIntervals[lane].push({ left: textX - halfWidth, right: textX + halfWidth });
        laneIntervals[lane].sort((leftInterval, rightInterval) => leftInterval.left - rightInterval.left);
        return { ...label, lane, textX };
      }
      return { ...label, hidden: true };
    });
}

function findLinearLabelPosition({ anchorX, halfWidth, intervals, leftLimit, rightLimit, minGap, maxNudge }) {
  const minCenter = leftLimit + halfWidth;
  const maxCenter = rightLimit - halfWidth;
  const clampedAnchor = Math.max(minCenter, Math.min(maxCenter, anchorX));
  const candidates = [clampedAnchor];
  for (const interval of intervals) {
    candidates.push(interval.left - minGap - halfWidth, interval.right + minGap + halfWidth);
  }
  const sorted = Array.from(new Set(candidates.map((value) => Number(value.toFixed(3)))))
    .filter((value) => value >= minCenter && value <= maxCenter)
    .filter((value) => Math.abs(value - anchorX) <= maxNudge || value === clampedAnchor)
    .sort((left, right) => Math.abs(left - anchorX) - Math.abs(right - anchorX));
  for (const center of sorted) {
    const left = center - halfWidth;
    const right = center + halfWidth;
    const collides = intervals.some((interval) => left <= interval.right + minGap && right >= interval.left - minGap);
    if (!collides) {
      return center;
    }
  }
  const sweepStep = 8;
  for (let distance = sweepStep; distance <= maxNudge; distance += sweepStep) {
    for (const direction of [-1, 1]) {
      const center = clampedAnchor + direction * distance;
      if (center < minCenter || center > maxCenter) continue;
      const left = center - halfWidth;
      const right = center + halfWidth;
      const collides = intervals.some((interval) => left <= interval.right + minGap && right >= interval.left - minGap);
      if (!collides) {
        return center;
      }
    }
  }
  return null;
}

function shouldLabelLinearFeature(feature) {
  if (feature.className === "source") {
    return false;
  }
  if (feature.showLabel === false) {
    return false;
  }
  return feature.className !== "variant" || feature.showLabel === true;
}

function linearSegmentCount(sequenceLength, options = {}) {
  if (options.segmentLength) {
    return Math.max(1, Math.ceil(sequenceLength / Math.max(1, Number(options.segmentLength))));
  }
  if (sequenceLength <= 600) {
    return 1;
  }
  if (sequenceLength <= 7000) {
    return 3;
  }
  if (sequenceLength <= 12000) {
    return 4;
  }
  return 6;
}

function roundSegmentSpan(rawSpan) {
  const span = Math.max(1, Number(rawSpan) || 1);
  let step = 1;
  if (span >= 50000) {
    step = 5000;
  } else if (span >= 5000) {
    step = 1000;
  } else if (span >= 1000) {
    step = 100;
  } else if (span >= 250) {
    step = 50;
  } else if (span >= 50) {
    step = 10;
  }
  return Math.max(1, Math.ceil(span / step) * step);
}

function linearSegmentSpan(sequenceLength, count, options = {}) {
  if (options.segmentLength) {
    return Math.max(1, Number(options.segmentLength));
  }
  if (count <= 1) {
    return Math.max(1, sequenceLength);
  }
  return roundSegmentSpan(Math.ceil(sequenceLength / count));
}

function linearSegments(sequenceLength, options = {}) {
  const count = linearSegmentCount(sequenceLength, options);
  const span = linearSegmentSpan(sequenceLength, count, options);
  const segmentCount = Math.max(1, Math.ceil(sequenceLength / span));
  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * span + 1;
    return {
      start,
      end: Math.min(sequenceLength, start + span - 1),
      span
    };
  });
}

function niceTickStep(rawStep) {
  const value = Math.max(1, Number(rawStep) || 1);
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const choices = [1, 1.5, 2, 2.5, 5, 10];
  const picked = choices.find((choice) => normalized <= choice) ?? 10;
  return Math.max(1, Math.round(picked * magnitude));
}

function linearSegmentTicks(segment, targetTickCount) {
  const span = Math.max(1, Number(segment.span) || (segment.end - segment.start + 1));
  const tickStep = niceTickStep(span / Math.max(1, targetTickCount));
  const ticks = [];
  let position = Math.ceil(segment.start / tickStep) * tickStep;
  if (position <= segment.start) {
    position += tickStep;
  }
  while (position < segment.end) {
    ticks.push(position);
    position += tickStep;
  }
  return ticks;
}

function axisLabelBounds(x, label, anchor = "middle") {
  const width = estimateTextWidth(label, 12) + 8;
  if (anchor === "end") {
    return { left: x - width, right: x };
  }
  if (anchor === "start") {
    return { left: x, right: x + width };
  }
  return { left: x - width / 2, right: x + width / 2 };
}

function axisLabelOverlaps(bounds, placedBounds, gap = 8) {
  return placedBounds.some((placed) =>
    bounds.left < placed.right + gap && placed.left < bounds.right + gap
  );
}

function clippedFeatureForSegment(feature, segment) {
  const parts = (feature.parts?.length ? feature.parts : [feature])
    .map((part) => ({
      ...part,
      clippedStart: Math.max(part.start, segment.start),
      clippedEnd: Math.min(part.end, segment.end)
    }))
    .filter((part) => part.clippedStart <= part.clippedEnd);
  if (parts.length === 0) {
    return null;
  }
  return { ...feature, clippedParts: parts };
}

function renderLinearFeaturePart(feature, part, renderedSegment, segmentLength, left, width, y, height, style) {
  const x1 = scaleLinearPosition(part.clippedStart - renderedSegment.start + 1, segmentLength, left, width);
  const x2 = scaleLinearPosition(part.clippedEnd - renderedSegment.start + 1, segmentLength, left, width);
  if (feature.pointMarker === true) {
    const markerWidth = Number.isFinite(Number(feature.markerWidth)) ? Number(feature.markerWidth) : 6;
    const anchorX = (x1 + x2) / 2;
    const markerX = anchorX - markerWidth / 2;
    return `<rect class="feature feature-${feature.className}" data-point-marker="true" data-anchor-x="${anchorX.toFixed(2)}" x="${markerX.toFixed(2)}" y="${y}" width="${markerWidth.toFixed(2)}" height="${height}" rx="2" fill="${style.fill}" stroke="${style.stroke}"></rect>`;
  }
  const renderedWidth = Math.max(3, x2 - x1);
  const opacity = feature.className === "source" ? "0.35" : "1";
  const continuesBefore = part.clippedStart > part.start;
  const continuesAfter = part.clippedEnd < part.end;
  if (!continuesBefore && !continuesAfter) {
    return `<rect class="feature feature-${feature.className}" x="${x1.toFixed(2)}" y="${y}" width="${renderedWidth.toFixed(2)}" height="${height}" rx="2" fill="${style.fill}" stroke="${style.stroke}" opacity="${opacity}"></rect>`;
  }
  const right = x1 + renderedWidth;
  const top = y;
  const bottom = y + height;
  const parts = [
    `<rect class="feature feature-${feature.className}" data-open-boundary="true" x="${x1.toFixed(2)}" y="${y}" width="${renderedWidth.toFixed(2)}" height="${height}" rx="0" fill="${style.fill}" stroke="none" opacity="${opacity}"></rect>`,
    `<line class="feature-boundary feature-${feature.className}-boundary" x1="${x1.toFixed(2)}" y1="${top}" x2="${right.toFixed(2)}" y2="${top}" stroke="${style.stroke}"></line>`,
    `<line class="feature-boundary feature-${feature.className}-boundary" x1="${x1.toFixed(2)}" y1="${bottom}" x2="${right.toFixed(2)}" y2="${bottom}" stroke="${style.stroke}"></line>`
  ];
  if (!continuesBefore) {
    parts.push(`<line class="feature-boundary feature-${feature.className}-boundary" x1="${x1.toFixed(2)}" y1="${top}" x2="${x1.toFixed(2)}" y2="${bottom}" stroke="${style.stroke}"></line>`);
  }
  if (!continuesAfter) {
    parts.push(`<line class="feature-boundary feature-${feature.className}-boundary" x1="${right.toFixed(2)}" y1="${top}" x2="${right.toFixed(2)}" y2="${bottom}" stroke="${style.stroke}"></line>`);
  }
  return parts.join("\n");
}

function renderLinearRecord(record, rowTop, styles, classes, options = {}) {
  const left = 70;
  const right = 890;
  const width = right - left;
  const sequenceLength = Math.max(0, Number(record.length) || 0);
  const features = assignLinearFeatureLanes(
    (record.features ?? [])
      .filter((feature) => feature.start && feature.end)
      .map((feature) => normalizeFeature(feature, sequenceLength))
  );
  for (const feature of features) {
    classes.add(feature.className);
  }
  const segments = linearSegments(sequenceLength, options);
  const renderedSegments = [];
  let segmentOffset = 42;
  let totalHiddenLabels = 0;
  for (const segment of segments) {
    const segmentFeatures = features
      .map((feature) => clippedFeatureForSegment(feature, segment))
      .filter(Boolean);
    const inlineLabels = [];
    const maxFeatureLane = Math.max(0, ...segmentFeatures.map((feature) => feature.lane));
    const segmentHeightBase = 58 + (maxFeatureLane + 1) * 18;
    const maxSegmentLabels = Number.isFinite(Number(options.maxLinearLabelsPerSegment))
      ? Math.max(0, Number(options.maxLinearLabelsPerSegment))
      : 64;
    const sortedLabelFeatures = segmentFeatures
      .filter(shouldLabelLinearFeature)
      .sort((leftFeature, rightFeature) =>
        featureLabelPriority(leftFeature) - featureLabelPriority(rightFeature) ||
        largestPartLength(rightFeature) - largestPartLength(leftFeature)
      );
    totalHiddenLabels += Math.max(0, sortedLabelFeatures.length - maxSegmentLabels);
    const labelCandidates = sortedLabelFeatures
      .slice(0, maxSegmentLabels)
      .map((feature) => {
        const largestPart = feature.clippedParts
          .slice()
          .sort((leftPart, rightPart) => (rightPart.clippedEnd - rightPart.clippedStart) - (leftPart.clippedEnd - leftPart.clippedStart))[0];
        const segmentSpan = segment.span ?? (segment.end - segment.start + 1);
        const x1 = scaleLinearPosition(largestPart.clippedStart - segment.start + 1, segmentSpan, left, width);
        const x2 = scaleLinearPosition(largestPart.clippedEnd - segment.start + 1, segmentSpan, left, width);
        const markerWidth = feature.pointMarker === true
          ? Number(feature.markerWidth) || 6
          : x2 - x1;
        const label = truncateLabel(feature.label, 32);
        if (feature.labelPlacement !== "external" && x2 - x1 >= estimateTextWidth(label, 12) + 18) {
          inlineLabels.push({ ...feature, label, x: (x1 + x2) / 2, lane: feature.lane });
          return null;
        }
        return { ...feature, label, x: (x1 + x2) / 2, featureLane: feature.lane, markerWidth };
      })
      .filter(Boolean);
    const labels = assignLinearLabelLanes(labelCandidates, left, right);
    const maxLabelLane = Math.max(0, ...labels.map((label) => label.lane));
    const labelTop = segmentHeightBase + 20;
    const segmentHeight = labelTop + (maxLabelLane + 1) * 22 + 18;
    totalHiddenLabels += labels.filter((label) => label.hidden).length;
    renderedSegments.push({ segment, segmentFeatures, inlineLabels, labels, top: segmentOffset, height: segmentHeight, labelTop });
    segmentOffset += segmentHeight + 12;
  }
  const recordNotes = Array.isArray(record.notes) ? record.notes.filter(Boolean) : [];
  const noteCount = totalHiddenLabels > 0
    ? recordNotes.length + 1
    : recordNotes.length;
  const hasRecordNotes = noteCount > 0 || (options.forceLinearCircularNote && record.topology === "circular");
  const rowHeight = segmentOffset + (hasRecordNotes ? 18 + Math.max(1, noteCount) * 18 : -10);
  const parts = [`<g class="map-record" transform="translate(0 ${rowTop})">`];
  const unit = record.molecule === "protein" ? "aa" : "bp";
  const recordTitle = record.molecule === "protein"
    ? `${record.title} (${sequenceLength.toLocaleString()} ${unit})`
    : `${record.title} linear feature map (${sequenceLength.toLocaleString()} ${unit})`;
  parts.push(`<text class="record-title" x="${left}" y="22">${escapeXml(recordTitle)}</text>`);
  for (const rendered of renderedSegments) {
    const axisY = rendered.top + 22;
    const segmentLength = rendered.segment.end - rendered.segment.start + 1;
    const segmentSpan = rendered.segment.span ?? segmentLength;
    const segmentRight = scaleLinearPosition(segmentLength, segmentSpan, left, width);
    parts.push(`<line class="axis" x1="${left}" y1="${axisY}" x2="${segmentRight.toFixed(2)}" y2="${axisY}" data-segment-span="${segmentSpan}" data-segment-start="${rendered.segment.start}" data-segment-end="${rendered.segment.end}"></line>`);
    const startLabel = rendered.segment.start.toLocaleString();
    const endLabel = rendered.segment.end.toLocaleString();
    const axisLabelY = axisY - 10;
    const placedAxisLabelBounds = [axisLabelBounds(left, startLabel, "start")];
    parts.push(`<text class="axis-label" x="${left}" y="${axisLabelY}">${escapeXml(startLabel)}</text>`);
    const endBounds = axisLabelBounds(segmentRight, endLabel, "end");
    if (!axisLabelOverlaps(endBounds, placedAxisLabelBounds, 10)) {
      placedAxisLabelBounds.push(endBounds);
      parts.push(`<text class="axis-label" x="${segmentRight.toFixed(2)}" y="${axisLabelY}" text-anchor="end">${escapeXml(endLabel)}</text>`);
    }
    const tickCount = segmentSpan >= 1000 ? 5 : 4;
    for (const position of linearSegmentTicks(rendered.segment, tickCount)) {
      const offset = position - rendered.segment.start + 1;
      const x = scaleLinearPosition(offset, segmentSpan, left, width);
      parts.push(`<line class="axis-tick" x1="${x.toFixed(2)}" y1="${axisY - 5}" x2="${x.toFixed(2)}" y2="${axisY + 5}"></line>`);
      const tickLabel = position.toLocaleString();
      const tickBounds = axisLabelBounds(x, tickLabel, "middle");
      if (!axisLabelOverlaps(tickBounds, placedAxisLabelBounds)) {
        placedAxisLabelBounds.push(tickBounds);
        parts.push(`<text class="axis-label" x="${x.toFixed(2)}" y="${axisLabelY}" text-anchor="middle">${escapeXml(tickLabel)}</text>`);
      }
    }
    for (const feature of rendered.segmentFeatures) {
      const style = styles[feature.className] ?? styles.other;
      const y = axisY + 14 + feature.lane * 18;
      const height = feature.className === "source" ? 5 : 10;
      for (const part of feature.clippedParts) {
        parts.push(renderLinearFeaturePart(feature, part, rendered.segment, segmentSpan, left, width, y, height, style));
      }
    }
    for (const label of rendered.labels) {
      if (label.hidden) {
        continue;
      }
      const y = rendered.top + rendered.labelTop + label.lane * 21;
      const style = styles[label.className] ?? styles.other;
      const labelMarkerColor = style.stroke;
      const markerY = axisY + 14 + label.featureLane * 18 + 5;
      parts.push(`<line class="label-leader" x1="${label.x.toFixed(2)}" y1="${axisY}" x2="${label.x.toFixed(2)}" y2="${y - 11}"></line>`);
      if (label.markerWidth >= 4.2) {
        parts.push(`<circle class="label-anchor" cx="${label.x.toFixed(2)}" cy="${markerY}" r="2.1" fill="${labelMarkerColor}"></circle>`);
      }
      parts.push(`<text class="feature-label" x="${label.textX.toFixed(2)}" y="${y}" text-anchor="middle">${escapeXml(truncateLabel(label.label, 34))}</text>`);
    }
    for (const label of rendered.inlineLabels) {
      const y = axisY + 14 + label.lane * 18 + 8;
      const className = label.compactLabel ? "feature-label-inside feature-label-inside-compact" : "feature-label-inside";
      parts.push(`<text class="${className}" x="${label.x.toFixed(2)}" y="${y}" text-anchor="middle">${escapeXml(label.label)}</text>`);
    }
  }
  let noteY = rowHeight - 12 - Math.max(0, noteCount - 1) * 18;
  for (const note of recordNotes) {
    parts.push(`<text class="axis-note" x="${left}" y="${noteY}">${escapeXml(note)}</text>`);
    noteY += 18;
  }
  if (totalHiddenLabels > 0) {
    parts.push(`<text class="axis-note" x="${left}" y="${noteY}">${totalHiddenLabels} feature label(s) hidden; see feature table.</text>`);
    noteY += 18;
  }
  if (options.forceLinearCircularNote && record.topology === "circular") {
    parts.push(`<text class="axis-note" x="${left}" y="${rowHeight - 28}">Circular record shown as a linear coordinate overview.</text>`);
  }
  parts.push("</g>");
  return { svg: parts.join("\n"), height: rowHeight };
}

function labelAnchorForAngle(angle) {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized > 20 && normalized < 160) {
    return "start";
  }
  if (normalized > 200 && normalized < 340) {
    return "end";
  }
  return "middle";
}

function circularLabelZoneForAngle(angle) {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized <= 20 || normalized >= 340) {
    return "top";
  }
  if (normalized >= 160 && normalized <= 200) {
    return "bottom";
  }
  return normalized < 180 ? "right" : "left";
}

function spreadCircularLabelsByY(labels, minY, maxY, minSpacing) {
  const rows = labels
    .sort((left, right) => left.naturalY - right.naturalY)
    .map((label) => ({
      ...label,
      textY: Math.max(minY, Math.min(maxY, label.naturalY))
    }));
  for (let index = 1; index < rows.length; index += 1) {
    rows[index].textY = Math.max(rows[index].textY, rows[index - 1].textY + minSpacing);
  }
  for (let index = rows.length - 2; index >= 0; index -= 1) {
    if (rows[index + 1].textY > maxY) {
      rows[index + 1].textY = maxY;
    }
    rows[index].textY = Math.min(rows[index].textY, rows[index + 1].textY - minSpacing);
  }
  if (rows[0]?.textY < minY) {
    const shift = minY - rows[0].textY;
    for (const row of rows) {
      row.textY = Math.min(maxY, row.textY + shift);
    }
  }
  return rows;
}

function spreadCircularLabelsByX(labels, minX, maxX, minSpacing) {
  const rows = labels
    .sort((left, right) => left.naturalX - right.naturalX)
    .map((label) => {
      const width = estimateTextWidth(label.text, 13);
      const halfWidth = width / 2;
      return {
        ...label,
        width,
        textX: Math.max(minX + halfWidth, Math.min(maxX - halfWidth, label.naturalX))
      };
    });
  for (let index = 1; index < rows.length; index += 1) {
    const leftEdge = rows[index - 1].textX + rows[index - 1].width / 2 + minSpacing;
    rows[index].textX = Math.max(rows[index].textX, leftEdge + rows[index].width / 2);
  }
  for (let index = rows.length - 2; index >= 0; index -= 1) {
    if (rows[index + 1].textX + rows[index + 1].width / 2 > maxX) {
      rows[index + 1].textX = maxX - rows[index + 1].width / 2;
    }
    const rightEdge = rows[index + 1].textX - rows[index + 1].width / 2 - minSpacing;
    rows[index].textX = Math.min(rows[index].textX, rightEdge - rows[index].width / 2);
  }
  if (rows.length > 0 && rows[0].textX - rows[0].width / 2 < minX) {
    const shift = minX - (rows[0].textX - rows[0].width / 2);
    for (const row of rows) {
      row.textX = Math.min(maxX - row.width / 2, row.textX + shift);
    }
  }
  return rows;
}

function circularLabelRowYs(zone, count, preferredY) {
  const rowCount = Math.max(1, Math.min(3, Math.ceil(count / 2)));
  if (rowCount === 1) {
    return [preferredY];
  }
  if (zone === "top") {
    return rowCount === 2 ? [112, 138] : [102, 124, 146];
  }
  return rowCount === 2 ? [594, 620] : [582, 608, 634];
}

function spreadCircularLabelsByXRows(labels, zone, minX, maxX, minSpacing, preferredY) {
  const sorted = labels.slice().sort((left, right) => left.naturalX - right.naturalX);
  const rowYs = circularLabelRowYs(zone, sorted.length, preferredY);
  const rowBuckets = rowYs.map(() => []);
  sorted.forEach((label, index) => {
    rowBuckets[index % rowBuckets.length].push({
      ...label,
      textY: rowYs[index % rowYs.length]
    });
  });
  return rowBuckets.flatMap((row) => spreadCircularLabelsByX(row, minX, maxX, minSpacing));
}

function placeCircularLabels(labels, bounds) {
  const { minY, maxY, minX, maxX, topY, bottomY } = bounds;
  const placed = [];
  const minSpacing = 17;
  const maxRows = Math.floor((maxY - minY) / minSpacing) + 1;
  for (const side of ["left", "right"]) {
    const sideCandidates = labels.filter((label) => label.zone === side);
    const kept = sideCandidates.length > maxRows
      ? new Set(sideCandidates
        .slice()
        .sort((left, right) => (left.labelRank ?? 0) - (right.labelRank ?? 0) || left.naturalY - right.naturalY)
        .slice(0, maxRows))
      : null;
    const sideLabels = sideCandidates
      .filter((label) => !kept || kept.has(label))
      .map((label) => ({
        ...label,
        textX: side === "right" ? maxX - 180 : minX + 180
      }));
    placed.push(...spreadCircularLabelsByY(sideLabels, minY, maxY, minSpacing));
  }
  for (const zone of ["top", "bottom"]) {
    const zoneLabels = labels
      .filter((label) => label.zone === zone)
      .map((label) => ({
        ...label,
        textY: zone === "top" ? topY : bottomY
      }));
    placed.push(...spreadCircularLabelsByXRows(zoneLabels, zone, minX + 32, maxX - 32, 10, zone === "top" ? topY : bottomY));
  }
  return placed.sort((left, right) => left.angle - right.angle);
}

function renderCircularRecord(record, styles, classes) {
  const sequenceLength = Math.max(0, Number(record.length) || 0);
  const centerX = 480;
  const centerY = 330;
  const axisRadius = 110;
  const ringBase = 130;
  const features = (record.features ?? [])
    .filter((feature) => feature.start && feature.end)
    .map((feature) => normalizeFeature(feature, sequenceLength));
  const drawable = features.filter((feature) => feature.className !== "source");
  for (const feature of drawable) {
    classes.add(feature.className);
  }
  const parts = [];
  parts.push(`<text class="record-title" x="32" y="54">${escapeXml(record.title)} circular feature map (${sequenceLength.toLocaleString()} bp)</text>`);
  parts.push(`<text class="axis-note" x="32" y="74">Joined and complement locations are drawn as separate coordinate parts.</text>`);
  parts.push(`<circle class="circle-axis" cx="${centerX}" cy="${centerY}" r="${axisRadius}" fill="none"></circle>`);
  parts.push(`<line class="axis-tick" x1="${centerX}" y1="${centerY - axisRadius - 7}" x2="${centerX}" y2="${centerY - axisRadius + 7}"></line>`);
  parts.push(`<text class="axis-label" x="${centerX + 10}" y="${centerY - axisRadius - 10}">1</text>`);
  drawable.forEach((feature, index) => {
    const style = styles[feature.className] ?? styles.other;
    const radius = ringBase + (feature.ring ?? feature.slot ?? index % 3) * 12;
    for (const part of feature.parts) {
      const startAngle = ((part.start - 1) / sequenceLength) * 360;
      const endAngle = Math.min(359.9, Math.max(startAngle + 1, (part.end / sequenceLength) * 360));
      parts.push(`<path class="feature feature-${feature.className}" d="${describeArc(centerX, centerY, radius, startAngle, endAngle)}" fill="none" stroke="${style.stroke}" stroke-width="8" stroke-linecap="butt"></path>`);
    }
  });
  const labelLimit = 64;
  const labelableFeatures = drawable.filter((feature) => feature.className !== "variant").length;
  const labelMaxY = 626;
  const labelMinY = 104;
  const labelMinX = 32;
  const labelMaxX = 928;
  const rawLabels = drawable
    .filter((feature) => feature.className !== "variant")
    .sort((left, right) => {
      return featureLabelPriority(left) - featureLabelPriority(right) ||
        largestPartLength(right) - largestPartLength(left);
    })
    .slice(0, labelLimit)
    .map((feature, index) => {
    const angle = featureMidAngle(feature, sequenceLength);
    const radius = ringBase + (feature.ring ?? feature.slot ?? index % 3) * 12;
    const leaderStart = polarToCartesian(centerX, centerY, radius + 7, angle);
    const leaderEnd = polarToCartesian(centerX, centerY, radius + 19, angle);
    const textPoint = polarToCartesian(centerX, centerY, radius + 55, angle);
    const zone = circularLabelZoneForAngle(angle);
    const anchor = zone === "right" ? "start" : zone === "left" ? "end" : "middle";
    const text = truncateLabel(feature.label, 30);
    return {
      feature,
      angle,
      labelRank: index,
      leaderStart,
      leaderEnd,
      text,
      naturalX: textPoint.x,
      naturalY: textPoint.y,
      anchor,
      zone
    };
  });
  const labels = placeCircularLabels(rawLabels, {
    minY: labelMinY,
    maxY: labelMaxY,
    minX: labelMinX,
    maxX: labelMaxX,
    topY: 126,
    bottomY: 612
  });
  for (const label of labels) {
    parts.push(`<line class="label-leader" x1="${label.leaderStart.x.toFixed(2)}" y1="${label.leaderStart.y.toFixed(2)}" x2="${label.leaderEnd.x.toFixed(2)}" y2="${label.leaderEnd.y.toFixed(2)}"></line>`);
    if (label.zone === "top" || label.zone === "bottom") {
      const textEdgeY = label.zone === "top" ? label.textY + 6 : label.textY - 13;
      parts.push(`<line class="label-leader" x1="${label.leaderEnd.x.toFixed(2)}" y1="${label.leaderEnd.y.toFixed(2)}" x2="${label.textX.toFixed(2)}" y2="${textEdgeY.toFixed(2)}"></line>`);
    } else {
      const elbowX = label.anchor === "start" ? label.textX - 7 : label.textX + 7;
      parts.push(`<line class="label-leader" x1="${label.leaderEnd.x.toFixed(2)}" y1="${label.leaderEnd.y.toFixed(2)}" x2="${elbowX.toFixed(2)}" y2="${label.textY.toFixed(2)}"></line>`);
    }
    parts.push(`<text class="feature-label" data-label-zone="${label.zone}" x="${label.textX.toFixed(2)}" y="${label.textY.toFixed(2)}" text-anchor="${label.anchor}">${escapeXml(label.text)}</text>`);
  }
  const hiddenLabels = Math.max(0, labelableFeatures - labels.length);
  if (hiddenLabels > 0) {
    parts.push(`<text class="axis-note" x="32" y="650">${hiddenLabels} feature label(s) hidden; see feature table.</text>`);
  }
  return { svg: parts.join("\n"), height: hiddenLabels > 0 ? 720 : 670 };
}

export function renderSequenceMap({ title = "Feature map", records = [], styles = defaultFeatureStyles, layout = "auto" } = {}) {
  const drawableRecords = records.filter((record) => record.length > 0);
  if (drawableRecords.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 130" role="img" aria-label="No feature map available"><style>.title{font:600 18px system-ui,sans-serif;fill:#111827}.note{font:13px system-ui,sans-serif;fill:#475569}</style><text class="title" x="32" y="42">${escapeXml(title)}</text><text class="note" x="32" y="78">No sequence was available to draw.</text></svg>`;
  }
  const requestedLayout = layout === "linear" || layout === "circular" ? layout : "auto";
  const classes = new Set();
  let width = 840;
  let height = 0;
  let body = "";
  const shouldRenderCircular = (record) => record.molecule !== "protein" && (
    requestedLayout === "circular" ||
    (requestedLayout === "auto" && record.topology === "circular" && drawableRecords.length === 1)
  );
  if (drawableRecords.some(shouldRenderCircular)) {
    width = 960;
    let rowTop = 62;
    const parts = [];
    for (const record of drawableRecords) {
      if (shouldRenderCircular(record)) {
        const rendered = renderCircularRecord(record, styles, classes);
        parts.push(`<g transform="translate(0 ${rowTop})">`);
        parts.push(rendered.svg);
        parts.push("</g>");
        rowTop += rendered.height;
      } else {
        const rendered = renderLinearRecord(record, rowTop, styles, classes);
        parts.push(rendered.svg);
        rowTop += rendered.height;
      }
    }
    body = parts.join("\n");
    height = rowTop + 40;
  } else {
    width = 960;
    let rowTop = 62;
    const parts = [];
    for (const record of drawableRecords) {
      const rendered = renderLinearRecord(record, rowTop, styles, classes, { forceLinearCircularNote: drawableRecords.length > 1 });
      parts.push(rendered.svg);
      rowTop += rendered.height;
    }
    body = parts.join("\n");
    height = rowTop + 40;
  }
  const legendX = 32;
  const legendMaxWidth = width - legendX - 32;
  const legendRows = getLegendLayout(classes, styles, { maxWidth: legendMaxWidth }).rows;
  const legendTop = height - 24;
  const legend = renderLegend(classes, styles, legendX, legendTop, { maxWidth: legendMaxWidth });
  const viewHeight = legend ? legendTop + legendRows * 24 + 20 : height;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${viewHeight}" role="img" aria-label="${escapeXml(title)}" data-sequence-map-renderer="sms3">`,
    "<style>",
    "[data-sequence-map-renderer=\"sms3\"] .title{font:700 18px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    "[data-sequence-map-renderer=\"sms3\"] .record-title{font:600 15px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    "[data-sequence-map-renderer=\"sms3\"] .axis,[data-sequence-map-renderer=\"sms3\"] .circle-axis{stroke:#334155;stroke-width:1.5}",
    "[data-sequence-map-renderer=\"sms3\"] .axis-tick{stroke:#64748b;stroke-width:1}",
    "[data-sequence-map-renderer=\"sms3\"] .feature-boundary{stroke-width:1}",
    "[data-sequence-map-renderer=\"sms3\"] .axis-label,[data-sequence-map-renderer=\"sms3\"] .axis-note{font:12px system-ui,-apple-system,Segoe UI,sans-serif;fill:#475569;stroke:none;stroke-width:0;paint-order:normal}",
    "[data-sequence-map-renderer=\"sms3\"] .feature-label{font:14px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    "[data-sequence-map-renderer=\"sms3\"] .feature-label-inside{font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;fill:#ffffff;paint-order:stroke;stroke:#111827;stroke-width:2px;stroke-linejoin:round}",
    "[data-sequence-map-renderer=\"sms3\"] .feature-label-inside-compact{font-size:10.5px;stroke-width:1.6px}",
    "[data-sequence-map-renderer=\"sms3\"] .label-leader{stroke:#94a3b8;stroke-width:1}",
    "[data-sequence-map-renderer=\"sms3\"] .legend text{font:12px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    "</style>",
    `<text class="title" x="32" y="28">${escapeXml(title)}</text>`,
    body,
    legend,
    "</svg>"
  ].join("\n");
}
