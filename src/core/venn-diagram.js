import "../vendor/d3/d3.min.js";
import { escapeXml } from "./plot-renderer.js";

export const VENN_DIAGRAM_MAX_LISTS = 3;

const COLORS = ["#2563eb", "#f59e0b", "#10b981"];

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  const absolute = Math.abs(number);
  if (absolute >= 1_000_000) return `${(number / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (absolute >= 10_000) return `${Math.round(number / 1_000)}k`;
  if (absolute >= 1_000) return `${(number / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(number);
}

function getD3() {
  return globalThis.d3 ?? null;
}

function membershipKey(membership) {
  return membership.map((present) => present ? "1" : "0").join("");
}

function membershipLabel(membership, setLabels) {
  const included = membership
    .map((present, index) => present ? setLabels[index] : "")
    .filter(Boolean);
  return included.length === 1 ? `${included[0]} only` : included.join("+");
}

function exactIntersections(intersections, setLabels, setCount) {
  return intersections
    .filter((row) => (row.membership ?? []).some(Boolean))
    .map((row) => ({
      membership: (row.membership ?? []).slice(0, setCount).map(Boolean),
      label: membershipLabel((row.membership ?? []).slice(0, setCount).map(Boolean), setLabels),
      count: row.item_count ?? 0,
      listCount: row.list_count ?? 0
    }))
    .filter((row) => row.label && row.membership.length === setCount)
    .sort((left, right) => right.count - left.count || right.listCount - left.listCount || left.label.localeCompare(right.label));
}

function intersectionCountMap(intersections, setCount) {
  const byKey = new Map();
  for (const row of intersections) {
    const membership = (row.membership ?? []).slice(0, setCount).map(Boolean);
    if (membership.length === setCount) {
      byKey.set(membershipKey(membership), row.item_count ?? 0);
    }
  }
  return byKey;
}

function colorScale() {
  const scale = getD3()?.scaleOrdinal?.(COLORS);
  return (index) => scale ? scale(index) : COLORS[index % COLORS.length];
}

function layoutForSetCount(setCount, setLabels, setSizes) {
  const colorFor = colorScale();
  if (setCount === 2) {
    return {
      width: 760,
      height: 430,
    circles: [
      { label: setLabels[0], size: setSizes[0] ?? 0, x: 292, y: 226, r: 142, color: colorFor(0) },
      { label: setLabels[1], size: setSizes[1] ?? 0, x: 430, y: 226, r: 142, color: colorFor(1) }
    ],
    regions: [
      { membership: [true, false], x: 244, y: 232 },
      { membership: [true, true], x: 361, y: 232 },
        { membership: [false, true], x: 478, y: 232 }
      ]
    };
  }
  return {
    width: 820,
    height: 530,
    circles: [
      { label: setLabels[0], size: setSizes[0] ?? 0, x: 375, y: 214, r: 142, color: colorFor(0) },
      { label: setLabels[1], size: setSizes[1] ?? 0, x: 300, y: 326, r: 142, color: colorFor(1) },
      { label: setLabels[2], size: setSizes[2] ?? 0, x: 450, y: 326, r: 142, color: colorFor(2) }
    ],
    regions: [
      { membership: [true, false, false], x: 375, y: 152 },
      { membership: [false, true, false], x: 262, y: 358 },
      { membership: [false, false, true], x: 488, y: 358 },
      { membership: [true, true, false], x: 288, y: 266 },
      { membership: [true, false, true], x: 462, y: 266 },
      { membership: [false, true, true], x: 375, y: 378 },
      { membership: [true, true, true], x: 375, y: 314 }
    ]
  };
}

function makeRegionLabel(region, setLabels, countMap) {
  const key = membershipKey(region.membership);
  const count = countMap.get(key) ?? 0;
  const label = membershipLabel(region.membership, setLabels);
  return `<g class="region-label" data-membership="${key}"><text class="region-name" x="${region.x}" y="${region.y - 8}" text-anchor="middle">${escapeXml(label)}</text><text class="region-count" x="${region.x}" y="${region.y + 14}" text-anchor="middle">${escapeXml(formatCompactNumber(count))}</text></g>`;
}

export function makeVennDiagramSvg({
  title = "Venn diagram",
  setLabels = [],
  setSizes = [],
  intersections = []
} = {}) {
  const requestedCount = setLabels.length;
  if (requestedCount > VENN_DIAGRAM_MAX_LISTS) {
    const width = 760;
    const height = 260;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}" data-plot-foundation="d3-venn-svg" data-plot-renderer="sms3-d3" data-venn-status="too-many-lists"><style>.title{font:700 19px system-ui,sans-serif;fill:#111827}.message{font:13px system-ui,sans-serif;fill:#334155}.hint{font:12px system-ui,sans-serif;fill:#64748b}</style><text class="title" x="32" y="40">${escapeXml(title)}</text><text class="message" x="32" y="84">Venn diagrams are limited to ${VENN_DIAGRAM_MAX_LISTS} lists in SMS3.</text><text class="hint" x="32" y="112">Use the UpSet Plot for ${requestedCount} lists; it shows exact intersections without forcing them into misleading circles.</text></svg>`;
  }
  if (requestedCount < 2) {
    const width = 760;
    const height = 220;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}" data-plot-foundation="d3-venn-svg" data-plot-renderer="sms3-d3" data-venn-status="too-few-lists"><style>.title{font:700 19px system-ui,sans-serif;fill:#111827}.message{font:13px system-ui,sans-serif;fill:#334155}</style><text class="title" x="32" y="40">${escapeXml(title)}</text><text class="message" x="32" y="84">Provide 2 or 3 lists to draw a Venn diagram.</text></svg>`;
  }
  const shownCount = requestedCount;
  const shownLabels = setLabels.slice(0, shownCount);
  const shownSizes = setSizes.slice(0, shownCount).map((value) => Math.max(0, Number(value) || 0));
  const layout = layoutForSetCount(shownCount, shownLabels, shownSizes);
  const { width, height, circles } = layout;
  const countMap = intersectionCountMap(intersections, shownCount);
  const exactRows = exactIntersections(intersections, shownLabels, shownCount);
  const circleSvg = circles.map((node) =>
    `<circle cx="${node.x.toFixed(1)}" cy="${node.y.toFixed(1)}" r="${node.r.toFixed(1)}" fill="${node.color}" fill-opacity="0.26" stroke="${node.color}" stroke-width="2.2"><title>${escapeXml(`${node.label}: ${node.size} distinct items`)}</title></circle>`
  ).join("");
  const countSvg = layout.regions.map((region) => makeRegionLabel(region, shownLabels, countMap)).join("");
  const rightX = shownCount === 2 ? 600 : 640;
  const setTotalsSvg = circles.map((node, index) => {
    const y = 116 + index * 22;
    return `<g><rect x="${rightX}" y="${y - 11}" width="10" height="10" rx="2" fill="${node.color}" fill-opacity="0.72"></rect><text class="intersection-label" x="${rightX + 18}" y="${y}">${escapeXml(node.label)}</text><text class="intersection-count" x="${width - 34}" y="${y}" text-anchor="end">${escapeXml(formatCompactNumber(node.size))}</text></g>`;
  }).join("");
  const exactY = 130 + circles.length * 22;
  const exactSvg = exactRows.map((row, index) => {
    const y = exactY + 34 + index * 22;
    return `<g><text class="intersection-label" x="${rightX}" y="${y}">${escapeXml(row.label)}</text><text class="intersection-count" x="${width - 34}" y="${y}" text-anchor="end">${escapeXml(formatCompactNumber(row.count))}</text></g>`;
  }).join("");
  const note = "Region counts are exact; circle areas are schematic.";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(title)}" data-plot-foundation="d3-venn-svg" data-plot-renderer="sms3-d3" data-venn-set-count="${shownCount}"><style>.title{font:700 19px system-ui,sans-serif;fill:#111827}.subtitle,.note{font:12px system-ui,sans-serif;fill:#475569}.region-name{font:650 10px system-ui,sans-serif;fill:#334155;paint-order:stroke;stroke:#f8fafc;stroke-width:1.4px;stroke-opacity:.82;stroke-linejoin:round}.region-count{font:800 18px system-ui,sans-serif;fill:#111827;paint-order:stroke;stroke:#f8fafc;stroke-width:2px;stroke-opacity:.78;stroke-linejoin:round}.side-title{font:700 13px system-ui,sans-serif;fill:#111827}.intersection-label{font:12px system-ui,sans-serif;fill:#334155}.intersection-count{font:700 12px system-ui,sans-serif;fill:#111827}</style><text class="title" x="32" y="34">${escapeXml(title)}</text><text class="subtitle" x="32" y="55">Exact overlap counts for ${shownCount} list${shownCount === 1 ? "" : "s"}</text>${circleSvg}${countSvg}<text class="side-title" x="${rightX}" y="82">Set totals</text><line x1="${rightX}" y1="94" x2="${width - 34}" y2="94" stroke="#cbd5e1"></line>${setTotalsSvg}<text class="side-title" x="${rightX}" y="${exactY}">Exact regions</text><line x1="${rightX}" y1="${exactY + 12}" x2="${width - 34}" y2="${exactY + 12}" stroke="#cbd5e1"></line>${exactSvg}<text class="note" x="32" y="${height - 26}">${escapeXml(note)}</text></svg>`;
}
