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
  const start = Math.max(1, Math.min(sequenceLength, Number(feature.start)));
  const end = Math.max(start, Math.min(sequenceLength, Number(feature.end)));
  const rawParts = Array.isArray(feature.parts) && feature.parts.length > 0
    ? feature.parts
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

function renderLegend(classes, styles, x, y, { columns = 4 } = {}) {
  const visible = Object.keys(styles).filter((className) => classes.has(className) && className !== "source");
  if (visible.length === 0) {
    return "";
  }
  const parts = [`<g class="legend" transform="translate(${x} ${y})" aria-label="Legend">`];
  visible.forEach((className, index) => {
    const style = styles[className] ?? styles.other;
    const itemX = (index % columns) * 126;
    const itemY = Math.floor(index / columns) * 20;
    parts.push(`<rect x="${itemX}" y="${itemY}" width="12" height="12" rx="2" fill="${style.fill}" stroke="${style.stroke}"></rect>`);
    parts.push(`<text x="${itemX + 18}" y="${itemY + 10}">${escapeXml(style.label)}</text>`);
  });
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
  const laneEnds = [];
  return labels
    .slice()
    .sort((left, right) => left.x - right.x)
    .map((label) => {
      const halfWidth = Math.min(estimateTextWidth(label.label, 13), 220) / 2;
      const textX = Math.max(leftLimit + halfWidth, Math.min(rightLimit - halfWidth, label.x));
      const left = textX - halfWidth;
      const right = textX + halfWidth;
      let lane = laneEnds.findIndex((end) => left > end + 14);
      if (lane < 0 && laneEnds.length < 10) {
        lane = laneEnds.length;
        laneEnds.push(leftLimit);
      }
      if (lane < 0) {
        return { ...label, hidden: true };
      }
      laneEnds[lane] = right;
      return { ...label, lane, textX };
    });
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

function linearSegments(sequenceLength, options = {}) {
  const count = linearSegmentCount(sequenceLength, options);
  const size = Math.ceil(sequenceLength / count);
  return Array.from({ length: count }, (_, index) => {
    const start = index * size + 1;
    return {
      start,
      end: Math.min(sequenceLength, start + size - 1)
    };
  });
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
    const labelCandidates = segmentFeatures
      .filter((feature) => feature.className !== "source")
      .filter((feature) => feature.className !== "variant")
      .sort((leftFeature, rightFeature) =>
        featureLabelPriority(leftFeature) - featureLabelPriority(rightFeature) ||
        largestPartLength(rightFeature) - largestPartLength(leftFeature)
      )
      .slice(0, 64)
      .map((feature) => {
        const largestPart = feature.clippedParts
          .slice()
          .sort((leftPart, rightPart) => (rightPart.clippedEnd - rightPart.clippedStart) - (leftPart.clippedEnd - leftPart.clippedStart))[0];
        const x1 = scaleLinearPosition(largestPart.clippedStart - segment.start + 1, segment.end - segment.start + 1, left, width);
        const x2 = scaleLinearPosition(largestPart.clippedEnd - segment.start + 1, segment.end - segment.start + 1, left, width);
        const label = truncateLabel(feature.label, 32);
        if (x2 - x1 >= estimateTextWidth(label, 12) + 18) {
          inlineLabels.push({ ...feature, label, x: (x1 + x2) / 2, lane: feature.lane });
          return null;
        }
        return { ...feature, label, x: (x1 + x2) / 2 };
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
  const rowHeight = segmentOffset + 30;
  const parts = [`<g class="map-record" transform="translate(0 ${rowTop})">`];
  parts.push(`<text class="record-title" x="${left}" y="22">${escapeXml(record.title)} (${sequenceLength.toLocaleString()} ${record.molecule === "protein" ? "aa" : "bp"})</text>`);
  for (const rendered of renderedSegments) {
    const axisY = rendered.top + 22;
    const segmentLength = rendered.segment.end - rendered.segment.start + 1;
    parts.push(`<line class="axis" x1="${left}" y1="${axisY}" x2="${right}" y2="${axisY}"></line>`);
    parts.push(`<text class="axis-label" x="${left}" y="${axisY - 10}">${escapeXml(rendered.segment.start.toLocaleString())}</text>`);
    parts.push(`<text class="axis-label" x="${right}" y="${axisY - 10}" text-anchor="end">${escapeXml(rendered.segment.end.toLocaleString())}</text>`);
    const tickCount = segmentLength >= 1000 ? 5 : 4;
    for (let index = 1; index < tickCount; index += 1) {
      const offset = Math.round(1 + (index / tickCount) * Math.max(0, segmentLength - 1));
      const position = rendered.segment.start + offset - 1;
      const x = scaleLinearPosition(offset, segmentLength, left, width);
      parts.push(`<line class="axis-tick" x1="${x.toFixed(2)}" y1="${axisY - 5}" x2="${x.toFixed(2)}" y2="${axisY + 5}"></line>`);
      parts.push(`<text class="axis-label" x="${x.toFixed(2)}" y="${axisY - 10}" text-anchor="middle">${escapeXml(position.toLocaleString())}</text>`);
    }
    for (const feature of rendered.segmentFeatures) {
      const style = styles[feature.className] ?? styles.other;
      const y = axisY + 14 + feature.lane * 18;
      const height = feature.className === "source" ? 5 : 10;
      for (const part of feature.clippedParts) {
        const x1 = scaleLinearPosition(part.clippedStart - rendered.segment.start + 1, segmentLength, left, width);
        const x2 = scaleLinearPosition(part.clippedEnd - rendered.segment.start + 1, segmentLength, left, width);
        parts.push(`<rect class="feature feature-${feature.className}" x="${x1.toFixed(2)}" y="${y}" width="${Math.max(3, x2 - x1).toFixed(2)}" height="${height}" rx="2" fill="${style.fill}" stroke="${style.stroke}" opacity="${feature.className === "source" ? "0.35" : "1"}"></rect>`);
      }
    }
    for (const label of rendered.labels) {
      if (label.hidden) {
        continue;
      }
      const y = rendered.top + rendered.labelTop + label.lane * 21;
      parts.push(`<line class="label-leader" x1="${label.x.toFixed(2)}" y1="${axisY + 10}" x2="${label.x.toFixed(2)}" y2="${y - 11}"></line>`);
      parts.push(`<text class="feature-label" x="${label.textX.toFixed(2)}" y="${y}" text-anchor="middle">${escapeXml(truncateLabel(label.label, 34))}</text>`);
    }
    for (const label of rendered.inlineLabels) {
      const y = axisY + 14 + label.lane * 18 + 8;
      parts.push(`<text class="feature-label-inside" x="${label.x.toFixed(2)}" y="${y}" text-anchor="middle">${escapeXml(label.label)}</text>`);
    }
  }
  if (totalHiddenLabels > 0) {
    parts.push(`<text class="axis-note" x="${left}" y="${rowHeight - 12}">${totalHiddenLabels} feature label(s) hidden; see feature table.</text>`);
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

function placeCircularLabels(labels, centerX, minY, maxY) {
  const placed = [];
  const minSpacing = 17;
  for (const side of ["left", "right"]) {
    const sideLabels = labels
      .filter((label) => label.side === side)
      .sort((left, right) => left.naturalY - right.naturalY);
    const rows = sideLabels.map((label) => ({
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
    placed.push(...rows);
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
    const textPoint = polarToCartesian(centerX, centerY, radius + 30, angle);
    const side = textPoint.x >= centerX ? "right" : "left";
    const anchor = side === "right" ? "start" : "end";
    return {
      feature,
      angle,
      leaderStart,
      leaderEnd,
      textX: side === "right" ? 700 : 260,
      naturalY: textPoint.y,
      anchor,
      side
    };
  });
  const labels = placeCircularLabels(rawLabels, centerX, 96, 560);
  for (const label of labels) {
    parts.push(`<line class="label-leader" x1="${label.leaderStart.x.toFixed(2)}" y1="${label.leaderStart.y.toFixed(2)}" x2="${label.leaderEnd.x.toFixed(2)}" y2="${label.leaderEnd.y.toFixed(2)}"></line>`);
    const elbowX = label.anchor === "start" ? label.textX - 7 : label.textX + 7;
    parts.push(`<line class="label-leader" x1="${label.leaderEnd.x.toFixed(2)}" y1="${label.leaderEnd.y.toFixed(2)}" x2="${elbowX.toFixed(2)}" y2="${label.textY.toFixed(2)}"></line>`);
    parts.push(`<text class="feature-label" x="${label.textX.toFixed(2)}" y="${label.textY.toFixed(2)}" text-anchor="${label.anchor}">${escapeXml(truncateLabel(label.feature.label, 30))}</text>`);
  }
  const labelableFeatures = drawable.filter((feature) => feature.className !== "variant").length;
  const hiddenLabels = Math.max(0, labelableFeatures - labels.length);
  if (hiddenLabels > 0) {
    parts.push(`<text class="axis-note" x="32" y="592">${hiddenLabels} feature label(s) hidden; see feature table.</text>`);
  }
  return { svg: parts.join("\n"), height: 670 };
}

export function renderSequenceMap({ title = "Feature map", records = [], styles = defaultFeatureStyles } = {}) {
  const drawableRecords = records.filter((record) => record.length > 0);
  if (drawableRecords.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 130" role="img" aria-label="No feature map available"><style>.title{font:600 18px system-ui,sans-serif;fill:#111827}.note{font:13px system-ui,sans-serif;fill:#475569}</style><text class="title" x="32" y="42">${escapeXml(title)}</text><text class="note" x="32" y="78">No sequence was available to draw.</text></svg>`;
  }
  const classes = new Set();
  let width = 840;
  let height = 0;
  let body = "";
  if (drawableRecords.length === 1 && drawableRecords[0].topology === "circular" && drawableRecords[0].molecule !== "protein") {
    width = 960;
    const rendered = renderCircularRecord(drawableRecords[0], styles, classes);
    body = rendered.svg;
    height = rendered.height;
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
  const legendColumns = width <= 640 ? 3 : 4;
  const legendRows = Math.ceil(Object.keys(styles).filter((className) => classes.has(className) && className !== "source").length / legendColumns);
  const legend = renderLegend(classes, styles, 32, height - 44, { columns: legendColumns });
  const viewHeight = height + (legend ? Math.max(8, (legendRows - 1) * 20 + 8) : 0);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${viewHeight}" role="img" aria-label="${escapeXml(title)}">`,
    "<style>",
    ".title{font:700 18px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    ".record-title{font:600 15px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    ".axis,.circle-axis{stroke:#334155;stroke-width:1.5}",
    ".axis-tick{stroke:#64748b;stroke-width:1}",
    ".axis-label,.axis-note{font:13px system-ui,-apple-system,Segoe UI,sans-serif;fill:#475569}",
    ".feature-label{font:14px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    ".feature-label-inside{font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;fill:#ffffff;paint-order:stroke;stroke:#111827;stroke-width:2px;stroke-linejoin:round}",
    ".label-leader{stroke:#94a3b8;stroke-width:1}",
    ".legend text{font:12px system-ui,-apple-system,Segoe UI,sans-serif;fill:#111827}",
    "</style>",
    `<text class="title" x="32" y="28">${escapeXml(title)}</text>`,
    body,
    legend,
    "</svg>"
  ].join("\n");
}
