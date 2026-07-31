// Mountain Path — geometry for the day path.
// The curve, snow caps and terrain fill are ported from the enVIro build so the
// two tools draw the same mountain; only the rendering layer differs.

export const X_POSITIONS = [50, 150, 250, 350, 450, 550, 650, 750, 850, 950];
export const BASELINE_Y = 240;
export const PEAK_Y = 60;
export const Y_SPAN = BASELINE_Y - PEAK_Y;

// On screen the drawing shares its box with the sliders, so it is wide and
// shallow. In print there are no sliders and the page is portrait, so the same
// terrain is drawn against a lower baseline — taller mountains, same shape.
export const PRINT_BASELINE_Y = 580;
export const SNOW_THRESHOLD = 7;
export const MAX_VALUE = 10;

// Slider track, used on screen only.
export const TRACK_TOP = 254;
export const TRACK_BOTTOM = 312;

export const valueToY = (v) => BASELINE_Y - (v / MAX_VALUE) * Y_SPAN;
export const sliderY = (v) => TRACK_BOTTOM - (v / MAX_VALUE) * (TRACK_BOTTOM - TRACK_TOP);

export const yToValue = (y) => {
    const v = ((TRACK_BOTTOM - y) / (TRACK_BOTTOM - TRACK_TOP)) * MAX_VALUE;
    return Math.max(0, Math.min(MAX_VALUE, Math.round(v)));
};

export function catmullRomPath(points) {
    if (points.length < 2) return "";
    const p = [points[0], ...points, points[points.length - 1]];
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < p.length - 2; i++) {
        const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0]} ${p2[1].toFixed(2)}`;
    }
    return d;
}

export function catmullRomAt(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return [
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t +
               (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
               (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t +
               (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
               (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    ];
}

function sampleContourAroundPeak(points, peakIndex, halfWidth, samples) {
    const result = [];
    const targetX = points[peakIndex][0];
    const xMin = targetX - halfWidth, xMax = targetX + halfWidth;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        for (let s = 0; s <= 24; s++) {
            const pt = catmullRomAt(p0, p1, p2, p3, s / 24);
            if (pt[0] >= xMin && pt[0] <= xMax) result.push(pt);
        }
    }
    const seen = new Set();
    const unique = result
        .filter((p) => {
            const key = p[0].toFixed(2);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => a[0] - b[0]);
    if (unique.length <= samples) return unique;
    const step = unique.length / samples;
    const out = [];
    for (let i = 0; i < samples; i++) out.push(unique[Math.floor(i * step)]);
    out.push(unique[unique.length - 1]);
    return out;
}

// A ragged cap sitting on the summit — the underside alternates depth so it
// reads as snow rather than a smooth band.
export function snowCapPath(points, peakIndex, value, depthScale = 1) {
    const scale = 0.7 + (value - SNOW_THRESHOLD) * 0.12;
    const contour = sampleContourAroundPeak(points, peakIndex, 18 * scale, 10);
    if (contour.length < 3) return "";
    const depth = 6 * scale * depthScale;

    let d = `M ${contour[0][0].toFixed(2)} ${contour[0][1].toFixed(2)}`;
    for (let i = 1; i < contour.length; i++) {
        d += ` L ${contour[i][0].toFixed(2)} ${contour[i][1].toFixed(2)}`;
    }
    for (let i = contour.length - 1; i >= 0; i--) {
        const pt = contour[i];
        const variance = (i % 2 === 0 ? 0.7 : 1.0) * depth;
        d += ` L ${pt[0].toFixed(2)} ${(pt[1] + variance).toFixed(2)}`;
    }
    return `${d} Z`;
}

export function terrainFill(contourD, points, baseline = BASELINE_Y) {
    const cIndex = contourD.indexOf(" C");
    if (cIndex === -1) return "";
    const first = points[0], last = points[points.length - 1];
    return `M 20 ${baseline} L ${first[0]} ${first[1].toFixed(2)} ${contourD.slice(cIndex)}`
        + ` L 980 ${last[1].toFixed(2)} L 980 ${baseline} Z`;
}

export const summitIndex = (values) => {
    let maxIdx = 0;
    for (let i = 1; i < values.length; i++) if (values[i] > values[maxIdx]) maxIdx = i;
    return values[maxIdx] >= SNOW_THRESHOLD ? maxIdx : -1;
};
