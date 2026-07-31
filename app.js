// Mountain Path — application logic.
// All data stays in this browser (localStorage only) — no network calls.

import {
    BANDS, BAND_BY_NUM, CARDS, CARD_BY_ID, CLOSING_QUESTION, DAY_LABELS, DAY_PROMPTS,
    DEFAULT_SUGGESTIONS, MAX_HERO_QUOTES, PRONOUNS, QUOTE_TAGS,
} from "./data.js";
import { ICONS, QUOTE_ORNAMENT } from "./icons.js";
import {
    BASELINE_Y, MAX_VALUE, PEAK_Y, PRINT_BASELINE_Y, SNOW_THRESHOLD, TRACK_BOTTOM, TRACK_TOP,
    X_POSITIONS, catmullRomPath, sliderY, snowCapPath, summitIndex, terrainFill, valueToY, yToValue,
} from "./path-geometry.js";

const STORAGE_KEY = "mountainPathSessions";
const DRAFT_KEY = "mountainPathDraft";
const SCHEMA_VERSION = 1;
const A4_WIDTH_PX = 793.7; // 210mm at 96dpi

// Document pagination
const QUOTES_PER_PAGE = 4;
const HELPS_PER_PAGE = 9;
// Space left for "what would help" under the path figure, in mm. Rows are
// admitted until this is spent, so a few long notes crowd out a long list
// rather than spilling off the page.
const HELPS_BUDGET_MM = 58;
const ACTIONS_FIRST_PAGE = 3;
const ACTIONS_PER_PAGE = 4;

// Path figure geometry, in mm, matching the .doc-path-figure box (182 × 118mm).
const FIG_W = 182, FIG_H = 118, FIG_GAP = 2;
const COL_W = (FIG_W - FIG_GAP * 4) / 5;
const LINE_DROP = 4;   // how far the path line sits below the figure's base
const COL_BASE = 6;    // clearance that keeps column labels clear of the line

// How much each station climbs. A busy path uses a gentler rise so the tallest
// stack still fits inside the figure; the drawn line and the columns are always
// derived from the same value, so they cannot drift apart.
function riseStep(busiest) {
    if (busiest > 7) return 8;
    if (busiest > 5) return 10;
    if (busiest > 3) return 12;
    return 14;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const $ = (sel) => document.querySelector(sel);

const fmtDate = (iso) =>
    new Date(iso || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const isoToInputDate = (iso) => new Date(iso || Date.now()).toISOString().slice(0, 10);

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function blankSession() {
    return {
        schemaVersion: SCHEMA_VERSION,
        id: null,
        name: "",
        date: new Date().toISOString(),
        childName: "",
        pronouns: "they",
        className: "",
        qtviName: "",
        qtviContact: "",
        keyMessage: "",
        notes: "",
        pathMode: "cards",               // "cards" — sort statements · "day" — shape the school day
        compareEnabled: false,
        paths: [{ id: "a", label: "" }, { id: "b", label: "" }],
        customCards: [],
        placements: [],
        day: {
            labels: [...DAY_LABELS],
            values: Array(DAY_LABELS.length).fill(0),
            labelsVisible: true,
            closing: "",
        },
        quotes: [],
        actions: [],
        includePathPage: true,
        includeQuotesPage: true,
        includeActionPage: true,
        includeHelpsDetail: false,
    };
}

const pronounSet = () => PRONOUNS[session.pronouns] || PRONOUNS.they;

// Every card available to place: the built-in statements plus this session's own.
const allCards = () => [...CARDS, ...session.customCards];
const cardById = (id) => CARD_BY_ID[id] || session.customCards.find((c) => c.id === id);
const cardLabel = (id) => cardById(id)?.label ?? "";
const suggestionsFor = (id) => cardById(id)?.suggestions?.length ? cardById(id).suggestions : DEFAULT_SUGGESTIONS;

const pathById = (id) => session.paths.find((p) => p.id === id) || session.paths[0];
const placementsFor = (pathId, band) =>
    session.placements
        .filter((p) => p.pathId === pathId && (band == null || p.band === band))
        .sort((a, b) => a.order - b.order);
const hasPlacements = (pathId) => session.placements.some((p) => p.pathId === pathId);

// Paths that should appear in the report: A always, B only when comparison is on.
const activePaths = () =>
    session.paths.filter((p) => p.id === "a" || session.compareEnabled);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let session = blankSession();
let savedSessions = [];
let activePathId = "a";
let armedCardId = null;                  // card picked up, waiting for a station
let selectedPlacement = null;            // { cardId, pathId } open in the drawer
let draftQuoteTag = "";

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function normaliseSession(s) {
    if (!s || typeof s !== "object") return blankSession();
    const merged = { ...blankSession(), ...s, schemaVersion: SCHEMA_VERSION };
    // Guard the shapes the UI indexes into, in case a record was hand-edited.
    if (!Array.isArray(merged.paths) || merged.paths.length < 2) {
        merged.paths = [{ id: "a", label: merged.paths?.[0]?.label || "" }, { id: "b", label: "" }];
    }
    for (const key of ["customCards", "placements", "quotes", "actions"]) {
        if (!Array.isArray(merged[key])) merged[key] = [];
    }
    const day = merged.day && typeof merged.day === "object" ? merged.day : {};
    merged.day = {
        labels: Array.isArray(day.labels) && day.labels.length === DAY_LABELS.length
            ? day.labels : [...DAY_LABELS],
        values: Array.isArray(day.values) && day.values.length === DAY_LABELS.length
            ? day.values.map((v) => Math.max(0, Math.min(MAX_VALUE, Number(v) || 0)))
            : Array(DAY_LABELS.length).fill(0),
        labelsVisible: day.labelsVisible !== false,
        closing: typeof day.closing === "string" ? day.closing : "",
    };
    if (merged.pathMode !== "day") merged.pathMode = "cards";
    return merged;
}

function loadSavedSessions() {
    let stored;
    try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
        stored = [];
    }
    if (!Array.isArray(stored)) stored = [];
    const hadOld = stored.some((s) => !s || s.schemaVersion !== SCHEMA_VERSION);
    savedSessions = stored.map(normaliseSession);
    if (hadOld) persistSessions();
}

function persistSessions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSessions));
}

function saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(session));
}

function loadDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
        if (draft) session = normaliseSession(draft);
    } catch { /* corrupt draft — start fresh */ }
}

// ---------------------------------------------------------------------------
// Form binding
// ---------------------------------------------------------------------------

function bindForm() {
    document.querySelectorAll("[data-field]").forEach((input) => {
        input.addEventListener("input", () => {
            const f = input.dataset.field;
            if (f === "dateOnly") {
                if (input.value) session.date = new Date(`${input.value}T12:00:00`).toISOString();
            } else if (input.type === "checkbox") {
                session[f] = input.checked;
            } else {
                session[f] = input.value;
            }
            if (f === "compareEnabled") syncCompareUI();
            onSessionChanged();
        });
    });

    $("#pathLabelA").addEventListener("input", (e) => {
        pathById("a").label = e.target.value;
        renderPathTabs();
        onSessionChanged();
    });
    $("#pathLabelB").addEventListener("input", (e) => {
        pathById("b").label = e.target.value;
        renderPathTabs();
        onSessionChanged();
    });
}

function fillForm() {
    document.querySelectorAll("[data-field]").forEach((input) => {
        const f = input.dataset.field;
        if (f === "dateOnly") input.value = isoToInputDate(session.date);
        else if (input.type === "checkbox") input.checked = Boolean(session[f]);
        else input.value = session[f] ?? "";
    });
    $("#pathLabelA").value = pathById("a").label || "";
    $("#pathLabelB").value = pathById("b").label || "";
    $("#closingQuestion").value = session.day.closing || "";
    syncCompareUI();
}

// Comparison is opt-in: turning it off hides path B but keeps whatever is on it.
function syncCompareUI() {
    const on = Boolean(session.compareEnabled);
    $("#pathLabelB").hidden = !on;
    $("#pathLabelALabel").textContent = on ? "First subject or context" : "Which subject or context?";
    if (!on) activePathId = "a";
    renderPathTabs();
}

// ---------------------------------------------------------------------------
// Path tool — card deck
// ---------------------------------------------------------------------------

function renderPathTabs() {
    const tabs = $("#pathTabs");
    if (!session.compareEnabled) {
        tabs.hidden = true;
        tabs.innerHTML = "";
        return;
    }
    tabs.hidden = false;
    tabs.innerHTML = session.paths.map((p, i) => {
        const label = p.label.trim() || (i === 0 ? "First path" : "Second path");
        const n = session.placements.filter((pl) => pl.pathId === p.id).length;
        return `<button type="button" class="path-tab" role="tab" data-path="${p.id}"
            aria-selected="${p.id === activePathId}">${esc(label)}${n ? ` · ${n}` : ""}</button>`;
    }).join("");

    tabs.querySelectorAll(".path-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
            activePathId = btn.dataset.path;
            armedCardId = null;
            selectedPlacement = null;
            renderPathTabs();
            renderCardDeck();
            renderPathCanvas();
            renderCardDrawer();
        });
    });
}

function renderCardDeck() {
    const deck = $("#cardDeck");
    const placed = new Set(placementsFor(activePathId).map((p) => p.cardId));
    const available = allCards().filter((c) => !placed.has(c.id));

    $("#deckRemaining").textContent = available.length
        ? `${available.length} left to place`
        : "";

    if (!available.length) {
        deck.innerHTML = `<p class="deck-empty">Every card is on the path. Add your own below if something is missing.</p>`;
        return;
    }

    deck.innerHTML = available.map((c) => `
        <button type="button" class="deck-card" draggable="true" data-card="${esc(c.id)}"
            aria-pressed="${c.id === armedCardId}">${esc(c.label)}</button>`).join("");

    deck.querySelectorAll(".deck-card").forEach((btn) => {
        btn.addEventListener("click", () => armCard(btn.dataset.card));
        btn.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", btn.dataset.card);
            e.dataTransfer.effectAllowed = "move";
            btn.classList.add("dragging");
        });
        btn.addEventListener("dragend", () => btn.classList.remove("dragging"));
    });
}

// Arming a card is the accessible primary flow: pick it up, then choose a station.
function armCard(cardId) {
    if (armedCardId === cardId) {
        armedCardId = null;
        renderCardDeck();
        renderPathCanvas();
        return;
    }
    armedCardId = cardId;
    if (window.matchMedia("(max-width: 640px)").matches) {
        openPlaceSheet(cardId);
        return;
    }
    renderCardDeck();
    renderPathCanvas();
}

// ---------------------------------------------------------------------------
// Path tool — the canvas
// ---------------------------------------------------------------------------

function renderPathCanvas() {
    const canvas = $("#pathCanvas");
    canvas.innerHTML = BANDS.map((b, i) => {
        const items = placementsFor(activePathId, b.band);
        const stack = items.length
            ? items.map((p) => `
                <div class="path-card${selectedPlacement?.cardId === p.cardId && selectedPlacement?.pathId === p.pathId ? " selected" : ""}"
                     draggable="true" data-card="${esc(p.cardId)}">
                    ${p.helps.trim() ? `<span class="path-card-helps" title="Has ideas about what would help"></span>` : ""}
                    <button type="button" class="path-card-label" data-open="${esc(p.cardId)}">${esc(cardLabel(p.cardId))}</button>
                    <button type="button" class="path-card-remove" data-remove="${esc(p.cardId)}"
                        aria-label="Take ${esc(cardLabel(p.cardId))} off the path">${ICONS.x}</button>
                </div>`).join("")
            : `<p class="band-empty">—</p>`;

        return `
        <div class="path-band" data-band="${b.band}"
             style="--rise:${i * 18}px;--band-color:${b.color};--band-tint:${b.tint}">
            <div class="path-band-stack">${stack}</div>
            <div class="path-band-foot"><span class="dot" style="background:${b.color}"></span>${esc(b.label)}</div>
        </div>`;
    }).join("");

    if (armedCardId) canvas.querySelectorAll(".path-band").forEach((el) => el.classList.add("armed"));

    canvas.querySelectorAll(".path-band").forEach((bandEl) => {
        const band = Number(bandEl.dataset.band);

        // While a card is being carried the whole station is a drop target,
        // including the space already occupied by other cards.
        bandEl.addEventListener("click", (e) => {
            if (e.target.closest("[data-remove]")) return;
            if (armedCardId) placeCard(armedCardId, activePathId, band);
        });

        bandEl.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            bandEl.classList.add("drop-over");
        });
        bandEl.addEventListener("dragleave", () => bandEl.classList.remove("drop-over"));
        bandEl.addEventListener("drop", (e) => {
            e.preventDefault();
            bandEl.classList.remove("drop-over");
            const cardId = e.dataTransfer.getData("text/plain");
            if (cardId) placeCard(cardId, activePathId, band);
        });
    });

    canvas.querySelectorAll(".path-card").forEach((el) => {
        el.addEventListener("dragstart", (e) => {
            e.dataTransfer.setData("text/plain", el.dataset.card);
            e.dataTransfer.effectAllowed = "move";
            el.classList.add("dragging");
        });
        el.addEventListener("dragend", () => el.classList.remove("dragging"));
    });

    canvas.querySelectorAll("[data-open]").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (armedCardId) return; // the band beneath will place the carried card
            openDrawer(btn.dataset.open);
        });
    });
    canvas.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => removeCard(btn.dataset.remove, activePathId));
    });
}

// One code path for every input method: tap-to-place, drag-and-drop, mobile sheet.
function placeCard(cardId, pathId, band) {
    const existing = session.placements.find((p) => p.cardId === cardId && p.pathId === pathId);
    if (existing) {
        existing.band = band;
        existing.order = Date.now();
    } else {
        session.placements.push({ cardId, pathId, band, order: Date.now(), helps: "" });
    }
    armedCardId = null;
    selectedPlacement = { cardId, pathId };
    renderCardDeck();
    renderPathCanvas();
    renderCardDrawer();
    renderPathTabs();
    onSessionChanged();
}

function removeCard(cardId, pathId) {
    session.placements = session.placements.filter((p) => !(p.cardId === cardId && p.pathId === pathId));
    if (selectedPlacement?.cardId === cardId && selectedPlacement?.pathId === pathId) selectedPlacement = null;
    renderCardDeck();
    renderPathCanvas();
    renderCardDrawer();
    renderPathTabs();
    onSessionChanged();
}

function openDrawer(cardId) {
    selectedPlacement = { cardId, pathId: activePathId };
    renderPathCanvas();
    renderCardDrawer();
    $("#cardDrawer").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function currentPlacement() {
    if (!selectedPlacement) return null;
    return session.placements.find(
        (p) => p.cardId === selectedPlacement.cardId && p.pathId === selectedPlacement.pathId) || null;
}

function renderCardDrawer() {
    const drawer = $("#cardDrawer");
    const placement = currentPlacement();
    if (!placement) {
        drawer.hidden = true;
        drawer.innerHTML = "";
        return;
    }

    const band = BAND_BY_NUM[placement.band];
    drawer.hidden = false;
    drawer.style.setProperty("--band-color", band.color);
    drawer.innerHTML = `
        <div class="drawer-head">
            <h3>${esc(cardLabel(placement.cardId))}</h3>
            <span class="drawer-band"><span class="dot" style="background:${band.color}"></span>${esc(band.label)}</span>
        </div>
        <div class="field">
            <label for="drawerHelps">What would help? <span class="hint">— in the student's words</span></label>
            <textarea id="drawerHelps" rows="3" placeholder="What do they think would make this easier?">${esc(placement.helps)}</textarea>
        </div>
        <div class="drawer-suggestions" role="group" aria-label="Ideas to start from">
            ${suggestionsFor(placement.cardId).map((s) =>
                `<button type="button" class="suggestion-chip" data-suggestion="${esc(s)}">${esc(s)}</button>`).join("")}
        </div>
        <div class="drawer-actions">
            <button type="button" class="btn btn-secondary" id="drawerToPlan"><span class="btn-icon">${ICONS.clipboard}</span>Add to action plan</button>
            <button type="button" class="btn btn-ghost" id="drawerClose">Close</button>
        </div>`;

    const textarea = $("#drawerHelps");
    textarea.addEventListener("input", () => {
        const p = currentPlacement();
        if (!p) return;
        p.helps = textarea.value;
        renderPathCanvas();
        onSessionChanged();
    });

    drawer.querySelectorAll(".suggestion-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            const p = currentPlacement();
            if (!p) return;
            const line = `• ${chip.dataset.suggestion}`;
            p.helps = p.helps.trim() ? `${p.helps.replace(/\s+$/, "")}\n${line}` : line;
            textarea.value = p.helps;
            textarea.focus();
            renderPathCanvas();
            onSessionChanged();
        });
    });

    $("#drawerToPlan").addEventListener("click", () => promoteToAction(currentPlacement()));
    $("#drawerClose").addEventListener("click", () => {
        selectedPlacement = null;
        renderPathCanvas();
        renderCardDrawer();
    });
}

// ---------------------------------------------------------------------------
// Day path — the student shapes the terrain of their own school day
// ---------------------------------------------------------------------------

const heroQuotes = () =>
    session.quotes.filter((q) => q.starred && Number.isInteger(q.dayIndex)).slice(0, MAX_HERO_QUOTES);

const walkerSvg = (x, y, scale = 1) => `
    <g transform="translate(${x}, ${y}) scale(${scale})">
        <ellipse cx="0.5" cy="-19.6" rx="5.2" ry="0.85" fill="#1f1a17"/>
        <path d="M -1.9,-19.7 Q -1.6,-22.6 1.2,-23 Q 4,-22.6 4.2,-19.7 Z" fill="#1f1a17"/>
        <circle cx="1.2" cy="-17" r="2.5" fill="#1f1a17"/>
        <rect x="-4" y="-14.5" width="3.4" height="7.5" rx="1" fill="#F5F3EF" stroke="#1f1a17" stroke-width="1.1"/>
        <line x1="-4" y1="-11.8" x2="-0.6" y2="-11.8" stroke="#1f1a17" stroke-width="0.55" opacity="0.55"/>
        <path d="M -0.6,-14.4 Q 0.5,-13.5 1.5,-13" stroke="#1f1a17" stroke-width="0.95" fill="none" stroke-linecap="round"/>
        <path d="M 1,-14.5 L 0.3,-7" stroke="#1f1a17" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M 1.3,-13 Q 2.7,-10.4 3.2,-7" stroke="#1f1a17" stroke-width="1.7" stroke-linecap="round" fill="none"/>
        <path d="M 0.3,-7 L -2.6,0" stroke="#1f1a17" stroke-width="2" stroke-linecap="round"/>
        <path d="M 0.3,-7 L 2.8,-3.6 L 3.6,0" stroke="#1f1a17" stroke-width="2" stroke-linecap="round" fill="none"/>
    </g>`;

// Break a quote over at most two lines so the bubble stays legible in print.
function wrapBubble(text, perLine = 24, maxLines = 2) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = "";
    for (const w of words) {
        if (!line) line = w;
        else if ((line + " " + w).length <= perLine) line += ` ${w}`;
        else { lines.push(line); line = w; if (lines.length === maxLines) break; }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) {
        lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:]$/, "")}…`;
    }
    return lines;
}

function heroBubbles(points, fs) {
    const bySection = {};
    for (const q of heroQuotes()) {
        (bySection[q.dayIndex] ||= []).push(q);
    }
    const lineH = fs * 1.15;
    const halfW = fs * 6.8;
    let out = "";
    for (const [idxStr, group] of Object.entries(bySection)) {
        const idx = Number(idxStr);
        if (idx < 0 || idx >= X_POSITIONS.length) continue;
        const terrainY = points[idx][1];
        group.forEach((q, stackPos) => {
            const lines = wrapBubble(q.text);
            const h = lineH * lines.length + fs * 0.9;
            const bY = Math.max(4, terrainY - h - fs * 1.6 - stackPos * (h + fs));
            const bX = Math.max(halfW + 12, Math.min(1000 - halfW - 12, X_POSITIONS[idx]));
            const text = lines
                .map((l, i) => `<tspan x="${bX}" dy="${i === 0 ? 0 : lineH}">${esc(l)}</tspan>`)
                .join("");
            out += `
            <g>
                <rect x="${bX - halfW}" y="${bY}" width="${halfW * 2}" height="${h}" rx="${fs * 0.4}"
                      fill="#F5F3EF" stroke="#2BBFBF" stroke-width="0.9" opacity="0.97"/>
                <polygon points="${bX - fs * 0.4},${bY + h} ${bX + fs * 0.4},${bY + h} ${bX},${bY + h + fs * 0.65}"
                         fill="#F5F3EF" stroke="#2BBFBF" stroke-width="0.9" stroke-linejoin="round"/>
                <text x="${bX}" y="${bY + fs * 1.25}" text-anchor="middle" fill="#5a5048"
                      style="font-family:var(--font-cormorant);font-size:${fs}px;font-style:italic">${text}</text>
            </g>`;
        });
    }
    return out;
}

// One drawing, two uses: the screen adds sliders and editable labels, the page
// prints the same terrain without them.
function dayPathSvg({ interactive }) {
    const { values, labels, labelsVisible } = session.day;

    // Print drops to a lower baseline so the range fills a portrait page. Every
    // y is mapped through the same transform, pinned at the peak, so the drawn
    // shape is identical — only taller.
    const baseline = interactive ? BASELINE_Y : PRINT_BASELINE_Y;
    const k = (baseline - PEAK_Y) / (BASELINE_Y - PEAK_Y);
    const mapY = (y) => PEAK_Y + (y - PEAK_Y) * k;

    const points = values.map((v, i) => [X_POSITIONS[i], mapY(valueToY(v))]);
    const contourD = catmullRomPath(points);
    const peak = summitIndex(values);
    const labelFs = interactive ? 9.5 : 15;
    const labelY = interactive ? 322 : baseline + 10;
    const height = interactive ? 360 : baseline + 42;

    const snow = values
        .map((v, i) => v >= SNOW_THRESHOLD
            ? `<path d="${snowCapPath(points, i, v, k)}" fill="#F5F3EF" stroke="#1f1a17" stroke-width="0.55" stroke-linejoin="round"/>`
            : "")
        .join("");

    const sliders = interactive ? `
        ${X_POSITIONS.map((x) => `<line x1="${x}" y1="${TRACK_TOP}" x2="${x}" y2="${TRACK_BOTTOM}" stroke="#1f1a17" stroke-width="0.6" opacity="0.18"/>`).join("")}
        ${X_POSITIONS.map((x, i) => i === 0
            ? `<rect x="${x - 4}" y="308" width="8" height="8" rx="1.5" fill="#F5F3EF" stroke="#1f1a17" stroke-width="1"/>`
            : `<circle class="day-handle" data-handle="${i}" tabindex="0" role="slider"
                   aria-label="${esc(labels[i] || `Point ${i + 1}`)}" aria-valuemin="0" aria-valuemax="${MAX_VALUE}"
                   aria-valuenow="${values[i]}" cx="${x}" cy="${sliderY(values[i])}" r="6"
                   fill="#2BBFBF" stroke="#1f1a17" stroke-width="0.8"/>`).join("")}
        <g transform="translate(60, 308)" opacity="0.55">
            <rect x="0" y="2.4" width="5.4" height="4.6" rx="0.7" fill="none" stroke="#1f1a17" stroke-width="0.7"/>
            <path d="M 1 2.4 V 1.3 a 1.7 1.7 0 0 1 3.4 0 V 2.4" fill="none" stroke="#1f1a17" stroke-width="0.7"/>
        </g>` : "";

    const labelRow = !labelsVisible ? "" : interactive
        ? X_POSITIONS.map((x, i) => `
            <foreignObject x="${x - 50}" y="${labelY}" width="100" height="24">
                <button type="button" class="day-label-btn" data-label="${i}" xmlns="http://www.w3.org/1999/xhtml">${esc(labels[i] || "—")}</button>
            </foreignObject>`).join("")
        // Print uses <text>: foreignObject is not reliably rasterised by print engines.
        : X_POSITIONS.map((x, i) => `
            <text x="${x}" y="${labelY + labelFs}" text-anchor="middle" fill="#5a5048"
                  style="font-family:var(--font-sans);font-size:${labelFs}px;letter-spacing:0.1em;text-transform:uppercase">${esc(labels[i] || "")}</text>`).join("");

    return `
    <svg viewBox="0 0 1000 ${height}" xmlns="http://www.w3.org/2000/svg" ${interactive ? "" : 'aria-hidden="true"'}>
        <defs>
            <!-- Teal rather than enVIro's ink: this sits on a white report page
                 next to the card-path figure, and the two should read as kin. -->
            <linearGradient id="mp-terrain-@NS@" x1="0" y1="${PEAK_Y}" x2="0" y2="${baseline}" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#2BBFBF" stop-opacity="0.42"/>
                <stop offset="45%" stop-color="#2BBFBF" stop-opacity="0.26"/>
                <stop offset="100%" stop-color="#2BBFBF" stop-opacity="0.12"/>
            </linearGradient>
            <radialGradient id="mp-halo-@NS@" cx="0.5" cy="0.5" r="0.55">
                <stop offset="0%" stop-color="#2BBFBF" stop-opacity="0.16"/>
                <stop offset="65%" stop-color="#2BBFBF" stop-opacity="0.03"/>
                <stop offset="100%" stop-color="#2BBFBF" stop-opacity="0"/>
            </radialGradient>
        </defs>

        <line x1="20" y1="${mapY(120)}" x2="980" y2="${mapY(120)}" stroke="#1f1a17" stroke-width="0.4" opacity="0.08"/>
        <line x1="20" y1="${mapY(180)}" x2="980" y2="${mapY(180)}" stroke="#1f1a17" stroke-width="0.4" opacity="0.08"/>

        ${peak >= 0 ? `<ellipse cx="${X_POSITIONS[peak]}" cy="${points[peak][1]}" rx="125" ry="${110 * k}" fill="url(#mp-halo-@NS@)"/>` : ""}

        <line x1="20" y1="${baseline}" x2="980" y2="${baseline}" stroke="#1f1a17" stroke-width="0.6" stroke-dasharray="2 4" opacity="0.22"/>

        <path d="${terrainFill(contourD, points, baseline)}" fill="url(#mp-terrain-@NS@)"/>
        <path d="${contourD}" fill="none" stroke="#1f1a17" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/>
        ${snow}
        ${peak >= 0 ? `<circle cx="${X_POSITIONS[peak]}" cy="${points[peak][1]}" r="${2.4 * k}" fill="#2BBFBF"/>` : ""}

        ${walkerSvg(interactive ? 40 : 26, baseline, interactive ? 1 : 1.9)}
        ${sliders}
        ${labelRow}

        ${interactive ? `
        <text x="14" y="244" text-anchor="end" fill="#8a8077"
              style="font-family:var(--font-sans);font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase">Low</text>
        <text x="14" y="124" text-anchor="end" fill="#8a8077"
              style="font-family:var(--font-sans);font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase">High</text>` : ""}

        ${heroBubbles(points, interactive ? 9.5 : 15)}
    </svg>`;
}

function setDayValue(index, value) {
    if (index === 0) return; // home, before the day begins, stays at the baseline
    const v = Math.max(0, Math.min(MAX_VALUE, value));
    if (session.day.values[index] === v) return;
    session.day.values[index] = v;
    renderDayCanvas();
    onSessionChanged();
}

function renderDayCanvas() {
    const canvas = $("#dayCanvas");
    canvas.innerHTML = dayPathSvg({ interactive: true }).replaceAll("@NS@", "screen");
    const svg = canvas.querySelector("svg");

    $("#dayLabelsToggle").textContent = session.day.labelsVisible ? "Hide labels" : "Show labels";

    const valueFromClientY = (clientY) => {
        const rect = svg.getBoundingClientRect();
        return yToValue(((clientY - rect.top) / rect.height) * 360);
    };

    canvas.querySelectorAll(".day-handle").forEach((handle) => {
        const index = Number(handle.dataset.handle);

        const startDrag = (e) => {
            e.preventDefault();
            const move = (ev) => {
                const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
                setDayValue(index, valueFromClientY(y));
            };
            const end = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", end);
                window.removeEventListener("touchmove", move);
                window.removeEventListener("touchend", end);
            };
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", end);
            window.addEventListener("touchmove", move, { passive: false });
            window.addEventListener("touchend", end);
        };

        handle.addEventListener("mousedown", startDrag);
        handle.addEventListener("touchstart", startDrag, { passive: false });

        // Arrow keys give the same control without a pointer.
        handle.addEventListener("keydown", (e) => {
            const current = session.day.values[index];
            const step = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
            if (step) { e.preventDefault(); setDayValue(index, current + step); focusHandle(index); }
            else if (e.key === "Home") { e.preventDefault(); setDayValue(index, 0); focusHandle(index); }
            else if (e.key === "End") { e.preventDefault(); setDayValue(index, MAX_VALUE); focusHandle(index); }
        });
    });

    canvas.querySelectorAll("[data-label]").forEach((btn) => {
        btn.addEventListener("click", () => editDayLabel(Number(btn.dataset.label)));
    });
}

function focusHandle(index) {
    $(`.day-handle[data-handle="${index}"]`)?.focus();
}

function editDayLabel(index) {
    const holder = $(`[data-label="${index}"]`)?.parentElement;
    if (!holder) return;
    holder.innerHTML = `<input class="day-label-input" type="text" maxlength="18"
        value="${esc(session.day.labels[index])}" xmlns="http://www.w3.org/1999/xhtml">`;
    const input = holder.querySelector("input");
    input.focus();
    input.select();

    const commit = () => {
        session.day.labels[index] = input.value.trim();
        renderDayCanvas();
        renderQuotes();
        onSessionChanged();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); input.blur(); }
    });
}

function renderPrompts() {
    $("#promptList").innerHTML = DAY_PROMPTS.map((p) => `
        <div class="prompt-item">
            <div class="prompt-heading">${esc(p.heading)}</div>
            <div class="prompt-text">“${esc(p.text)}”</div>
        </div>`).join("");
}

function setPathMode(mode) {
    session.pathMode = mode;
    syncPathMode();
    onSessionChanged();
}

function syncPathMode() {
    const day = session.pathMode === "day";
    document.querySelectorAll(".mode-option").forEach((btn) => {
        btn.setAttribute("aria-pressed", String(btn.dataset.mode === session.pathMode));
    });
    $("#dayTool").hidden = !day;
    $("#cardsTool").hidden = day;
    $("#pathIntro").textContent = day
        ? "Walk through the school day together. Drag each point to show how that part of the day feels — flat where it's easy, steep where it's hard."
        : "Place each card where the student says it belongs — from the gentle start of the path to the steepest climb. Tap a card, then tap a station; or drag it across.";
    if (day) renderDayCanvas();
    renderQuotes();
}

function setupDayTool() {
    document.querySelectorAll(".mode-option").forEach((btn) => {
        btn.addEventListener("click", () => setPathMode(btn.dataset.mode));
    });

    $("#dayLabelsToggle").addEventListener("click", () => {
        session.day.labelsVisible = !session.day.labelsVisible;
        renderDayCanvas();
        onSessionChanged();
    });

    $("#dayReset").addEventListener("click", () => {
        if (!confirm("Flatten the path back to the start? The labels and quotes are kept.")) return;
        session.day.values = Array(DAY_LABELS.length).fill(0);
        renderDayCanvas();
        onSessionChanged();
        toast("Path reset");
    });

    $("#closingLabel").innerHTML =
        `Their closing answer <span class="hint">— “${esc(CLOSING_QUESTION)}”</span>`;

    $("#closingQuestion").addEventListener("input", (e) => {
        session.day.closing = e.target.value;
        onSessionChanged();
    });
}

// ---------------------------------------------------------------------------
// Mobile placement sheet
// ---------------------------------------------------------------------------

function openPlaceSheet(cardId) {
    const sheet = $("#placeSheet");
    $("#placeSheetCard").textContent = cardLabel(cardId);
    $("#placeSheetOptions").innerHTML = BANDS.map((b) => `
        <button type="button" class="place-sheet-option" data-band="${b.band}" style="--band-color:${b.color}">
            <span class="dot" style="background:${b.color}"></span>${esc(b.label)}
        </button>`).join("");

    $("#placeSheetOptions").querySelectorAll(".place-sheet-option").forEach((btn) => {
        btn.addEventListener("click", () => {
            placeCard(cardId, activePathId, Number(btn.dataset.band));
            sheet.close();
        });
    });
    sheet.showModal();
}

function setupPlaceSheet() {
    const sheet = $("#placeSheet");
    $("#placeSheetCancel").addEventListener("click", () => {
        armedCardId = null;
        sheet.close();
        renderCardDeck();
    });
    sheet.addEventListener("close", () => {
        armedCardId = null;
        renderCardDeck();
        renderPathCanvas();
    });
}

// ---------------------------------------------------------------------------
// Custom cards
// ---------------------------------------------------------------------------

function setupCustomCard() {
    $("#customCardForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = $("#customCardInput");
        const label = input.value.trim();
        if (!label) return;
        const card = { id: `custom-${uid()}`, label, suggestions: [] };
        session.customCards.push(card);
        input.value = "";
        renderCardDeck();
        onSessionChanged();
        toast("Card added — place it on the path");
    });
}

// ---------------------------------------------------------------------------
// Quotes tool
// ---------------------------------------------------------------------------

function setupQuoteComposer() {
    const form = $("#quoteForm");
    const tagButtons = form.querySelectorAll(".tag-pill");

    tagButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            draftQuoteTag = btn.dataset.tag;
            tagButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tag === draftQuoteTag)));
        });
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = $("#quoteText").value.trim();
        if (!text) return;
        session.quotes.unshift({
            id: uid(),
            text,
            context: $("#quoteContext").value.trim(),
            tag: draftQuoteTag,
            starred: false,
            dayIndex: null,
        });
        $("#quoteText").value = "";
        $("#quoteContext").value = "";
        renderQuotes();
        onSessionChanged();
        toast("Quote added");
    });
}

function renderQuotes() {
    const list = $("#quoteList");
    if (!session.quotes.length) {
        list.innerHTML = `<p class="quote-empty">No quotes yet. Even one sentence in the student's own words changes how a report reads.</p>`;
        return;
    }

    const dayMode = session.pathMode === "day";
    const starredCount = session.quotes.filter((q) => q.starred).length;

    list.innerHTML = session.quotes.map((q) => {
        const tag = QUOTE_TAGS[q.tag] || QUOTE_TAGS[""];
        const pointOptions = session.day.labels
            .map((l, i) => `<option value="${i}" ${q.dayIndex === i ? "selected" : ""}>${esc(l || `Point ${i + 1}`)}</option>`)
            .join("");
        return `
        <div class="quote-item" data-quote="${esc(q.id)}" style="border-left-color:${tag.color}">
            <div class="quote-item-body">
                <textarea class="quote-item-text" rows="2" data-edit="text" aria-label="Quote text">${esc(q.text)}</textarea>
                <div class="quote-item-meta">
                    <span class="dot" style="background:${tag.color}"></span>${esc(tag.label)}
                    <input type="text" class="quote-item-context" data-edit="context"
                        value="${esc(q.context)}" placeholder="When or where…" aria-label="Quote context">
                    ${dayMode ? `
                    <select class="quote-point" data-point aria-label="Point in the day this quote belongs to">
                        <option value="">Not on the path</option>
                        ${pointOptions}
                    </select>` : ""}
                </div>
            </div>
            <div class="quote-item-tools">
                ${dayMode ? `
                <button type="button" class="star-btn" data-star="${esc(q.id)}" aria-pressed="${Boolean(q.starred)}"
                    title="${q.starred ? "Unpin from the path" : "Pin to the path"}"
                    aria-label="${q.starred ? "Unpin this quote from the path" : "Pin this quote to the path"}">${ICONS.star}</button>` : ""}
                <button type="button" class="icon-btn danger" data-delete="${esc(q.id)}"
                    title="Delete quote" aria-label="Delete this quote">${ICONS.trash}</button>
            </div>
        </div>`;
    }).join("");

    list.querySelectorAll("[data-star]").forEach((btn) => {
        btn.addEventListener("click", () => toggleStar(btn.dataset.star, starredCount));
    });
    list.querySelectorAll("[data-point]").forEach((sel) => {
        sel.addEventListener("change", () => {
            const q = session.quotes.find((x) => x.id === sel.closest(".quote-item").dataset.quote);
            q.dayIndex = sel.value === "" ? null : Number(sel.value);
            if (q.dayIndex === null) q.starred = false;
            renderQuotes();
            renderDayCanvas();
            onSessionChanged();
        });
    });

    list.querySelectorAll(".quote-item").forEach((el) => {
        const q = session.quotes.find((x) => x.id === el.dataset.quote);
        el.querySelectorAll("[data-edit]").forEach((input) => {
            input.addEventListener("input", () => {
                q[input.dataset.edit] = input.value;
                onSessionChanged();
            });
        });
    });
    list.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", () => {
            session.quotes = session.quotes.filter((q) => q.id !== btn.dataset.delete);
            renderQuotes();
            if (session.pathMode === "day") renderDayCanvas();
            onSessionChanged();
        });
    });
}

// Only three quotes can sit on the path at once — beyond that the drawing stops
// being readable, so we ask for one to come off rather than silently dropping it.
function toggleStar(id, starredCount) {
    const q = session.quotes.find((x) => x.id === id);
    if (!q) return;
    if (!q.starred) {
        if (starredCount >= MAX_HERO_QUOTES) {
            toast(`Only ${MAX_HERO_QUOTES} quotes fit on the path — unpin one first`);
            return;
        }
        if (!Number.isInteger(q.dayIndex)) {
            toast("Choose which part of the day this quote belongs to first");
            return;
        }
    }
    q.starred = !q.starred;
    renderQuotes();
    renderDayCanvas();
    onSessionChanged();
}

// ---------------------------------------------------------------------------
// Action plan tool
// ---------------------------------------------------------------------------

function promoteToAction(placement) {
    if (!placement) return;
    const label = cardLabel(placement.cardId);
    const already = session.actions.find((a) => a.cardId === placement.cardId);
    if (already) {
        already.challenge = label;
        already.studentIdea = placement.helps;
        toast("Action plan updated");
    } else {
        session.actions.push({
            id: uid(),
            cardId: placement.cardId,
            band: placement.band,
            challenge: label,
            studentIdea: placement.helps,
            who: "", what: "", when: "",
        });
        toast("Added to the action plan");
    }
    renderActions();
    onSessionChanged();
    flashPanel("#toolActions");
}

function addBlankAction() {
    session.actions.push({
        id: uid(), cardId: null, band: null,
        challenge: "", studentIdea: "", who: "", what: "", when: "",
    });
    renderActions();
    onSessionChanged();
}

function renderActions() {
    const list = $("#actionList");
    if (!session.actions.length) {
        list.innerHTML = `<p class="action-empty">No actions yet. Open a card on the path and choose <strong>Add to action plan</strong>, or add one here.</p>`;
        return;
    }

    list.innerHTML = session.actions.map((a, i) => {
        const band = a.band ? BAND_BY_NUM[a.band] : null;
        return `
        <div class="action-item" data-action="${esc(a.id)}">
            <div class="action-item-head">
                <span class="action-num">${i + 1}</span>
                ${band ? `<span class="dot" style="background:${band.color}" title="${esc(band.label)}"></span>` : ""}
                <input type="text" class="action-challenge" data-edit="challenge" value="${esc(a.challenge)}"
                    placeholder="What's the challenge?" aria-label="Challenge">
                <button type="button" class="icon-btn danger" data-delete="${esc(a.id)}"
                    title="Delete action" aria-label="Delete this action">${ICONS.trash}</button>
            </div>
            <div class="field action-idea">
                <label for="idea-${esc(a.id)}">Their idea <span class="hint">— what the student thinks would help</span></label>
                <textarea id="idea-${esc(a.id)}" rows="2" data-edit="studentIdea"
                    placeholder="In their words…">${esc(a.studentIdea)}</textarea>
            </div>
            <div class="action-grid">
                <div class="field">
                    <label for="who-${esc(a.id)}">${ICONS.users}Who will help</label>
                    <input type="text" id="who-${esc(a.id)}" data-edit="who" value="${esc(a.who)}" placeholder="Leave blank to fill in later">
                </div>
                <div class="field">
                    <label for="what-${esc(a.id)}">${ICONS.target}What will we try</label>
                    <input type="text" id="what-${esc(a.id)}" data-edit="what" value="${esc(a.what)}" placeholder="Leave blank to fill in later">
                </div>
                <div class="field">
                    <label for="when-${esc(a.id)}">${ICONS.calendar}When will we review</label>
                    <input type="text" id="when-${esc(a.id)}" data-edit="when" value="${esc(a.when)}" placeholder="Leave blank to fill in later">
                </div>
            </div>
        </div>`;
    }).join("");

    list.querySelectorAll(".action-item").forEach((el) => {
        const a = session.actions.find((x) => x.id === el.dataset.action);
        el.querySelectorAll("[data-edit]").forEach((input) => {
            input.addEventListener("input", () => {
                a[input.dataset.edit] = input.value;
                onSessionChanged();
            });
        });
    });
    list.querySelectorAll("[data-delete]").forEach((btn) => {
        btn.addEventListener("click", () => {
            session.actions = session.actions.filter((a) => a.id !== btn.dataset.delete);
            renderActions();
            onSessionChanged();
        });
    });
}

// ---------------------------------------------------------------------------
// Document rendering (preview + print share the same HTML)
// ---------------------------------------------------------------------------

const initialsHtml = (cls) => {
    const text = session.childName.trim() || "?";
    const small = text.length > 3 ? " small-text" : "";
    return `<div class="${cls}${small}">${esc(text)}</div>`;
};

const forName = () => session.childName.trim() || "this student";

function docBand(title, subtitleParts) {
    return `
        <header class="doc-band">
            ${initialsHtml("doc-initials")}
            <div class="doc-band-title">
                <h1>${esc(title)}</h1>
                <p>${esc(subtitleParts.filter(Boolean).join("  ·  "))}</p>
            </div>
            <div class="doc-band-brand">Mountain<br>Path</div>
        </header>`;
}

function docFooter() {
    const qtvi = [session.qtviName.trim(), session.qtviContact.trim()].filter(Boolean);
    return `
        <footer class="doc-footer">
            <span>${qtvi.length ? `Prepared with ${esc(forName())} by <strong>${esc(qtvi[0])}</strong>${qtvi[1] ? ` &middot; ${esc(qtvi[1])}` : ""}` : ""}</span>
            <span class="doc-footer-brand">Mountain Path</span>
        </footer>`;
}

// The rising path line: a smooth curve through the five station points, with a
// soft mountain fill beneath it. Drawn in mm so it lines up with the columns.
function pathSlopeSvg(rise) {
    const pts = BANDS.map((b, i) => ({
        x: i * (COL_W + FIG_GAP) + COL_W / 2,
        y: FIG_H - i * rise - LINE_DROP,
    }));

    let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dx = (b.x - a.x) / 2;
        line += ` C ${(a.x + dx).toFixed(1)} ${a.y.toFixed(1)}, ${(b.x - dx).toFixed(1)} ${b.y.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }

    const first = pts[0], last = pts[pts.length - 1];
    const fill = `M 0 ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}`
        + line.slice(line.indexOf(" C"))
        + ` L ${FIG_W} ${last.y.toFixed(1)} L ${FIG_W} ${FIG_H} L 0 ${FIG_H} Z`;

    const stations = pts.map((p, i) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.5" fill="#fff" stroke="${BANDS[i].color}" stroke-width="0.7"/>`).join("");

    return `
    <svg class="path-slope" viewBox="0 0 ${FIG_W} ${FIG_H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="${fill}" fill="#e8f8f8"/>
        <path d="M 0 ${first.y.toFixed(1)} L ${first.x.toFixed(1)} ${first.y.toFixed(1)}${line.slice(line.indexOf(" C"))} L ${FIG_W} ${last.y.toFixed(1)}"
              fill="none" stroke="#2BBFBF" stroke-width="0.6" stroke-linecap="round"/>
        ${stations}
    </svg>`;
}

function renderPathFigure(pathId) {
    const counts = BANDS.map((b) => placementsFor(pathId, b.band).length);
    const busiest = Math.max(0, ...counts);
    const density = busiest > 7 ? " denser" : busiest > 4 ? " dense" : "";
    const rise = riseStep(busiest);

    const cols = BANDS.map((b, i) => {
        const items = placementsFor(pathId, b.band);
        return `
        <div class="doc-path-col" style="--rise:${i * rise + COL_BASE}mm;--band-color:${b.color}">
            ${items.map((p) => `<div class="doc-path-card">${esc(cardLabel(p.cardId))}</div>`).join("")}
            <div class="doc-path-col-foot">
                ${esc(b.label)}
                <span class="doc-path-col-count">${items.length || "—"}</span>
            </div>
        </div>`;
    }).join("");

    return `
    <div class="doc-path-figure${density}">
        ${pathSlopeSvg(rise)}
        <div class="doc-path-cols">${cols}</div>
    </div>`;
}

// Cards the student had ideas about, steepest first — the heart of "what helps".
function helpRows(pathId) {
    return [...placementsFor(pathId)]
        .filter((p) => p.helps.trim())
        .sort((a, b) => b.band - a.band || a.order - b.order);
}

// Rough printed height of one help row, in mm: a bold name line plus however
// many lines the note wraps to at ~88 characters per line.
function helpRowHeightMm(p) {
    const noteLines = p.helps.trim().split("\n")
        .reduce((n, line) => n + Math.max(1, Math.ceil(line.length / 88)), 0);
    return 5.2 + noteLines * 4.7 + 2.6;
}

function fitHelpRows(rows) {
    const fitted = [];
    let used = 0;
    for (const row of rows) {
        const h = helpRowHeightMm(row);
        if (fitted.length && used + h > HELPS_BUDGET_MM) break;
        fitted.push(row);
        used += h;
    }
    return fitted;
}

function helpRowHtml(p) {
    const band = BAND_BY_NUM[p.band];
    return `
        <div class="doc-help-row">
            <span class="doc-help-dot" style="--band-color:${band.color}"></span>
            <span>
                <span class="doc-help-name">${esc(cardLabel(p.cardId))}</span>
                <span class="doc-help-text">${esc(p.helps.trim())}</span>
            </span>
        </div>`;
}

function renderDayPage() {
    const subtitle = [
        `For ${forName()}`,
        session.className.trim(),
        fmtDate(session.date),
    ];
    const closing = session.day.closing.trim();
    const touched = session.day.values.some((v) => v > 0);

    return `
    <article class="page page-path${closing ? "" : " no-helps"}">
        ${docBand("My Day, My Path", subtitle)}
        <div class="doc-body">
            ${session.keyMessage.trim() ? `
            <div class="key-message">
                <span class="km-label">In my own words</span>
                “${esc(session.keyMessage.trim())}”
            </div>` : ""}
            ${touched
                ? `<div class="doc-day-figure">
                       ${dayPathSvg({ interactive: false })}
                       <p class="doc-day-caption">Flat where the day feels easy · steep where it feels hard</p>
                   </div>`
                : `<div class="doc-empty-hint">Shape the school day together and the path will appear here — flat where the day feels easy, steep where it feels hard.</div>`}
            ${closing ? `
            <div class="doc-closing">
                <span class="doc-closing-label">One thing I would change</span>
                <span class="doc-closing-q">${esc(CLOSING_QUESTION)}</span>
                <p class="doc-closing-a">“${esc(closing)}”</p>
            </div>` : ""}
        </div>
        ${docFooter()}
    </article>`;
}

function renderPathPage(path, total) {
    const placed = placementsFor(path.id);
    const label = path.label.trim();
    const other = session.compareEnabled
        ? session.paths.find((p) => p.id !== path.id)?.label.trim()
        : "";

    const subtitle = [
        `For ${forName()}`,
        label,
        total > 1 && other ? `Compared with ${other}` : "",
        session.className.trim(),
        fmtDate(session.date),
    ];

    const rows = helpRows(path.id);
    const shown = session.includeHelpsDetail ? [] : fitHelpRows(rows);
    const hidden = rows.length - shown.length;
    const helpsSection = shown.length ? `
        <section>
            <h2 class="doc-section-title">What would help</h2>
            <div class="doc-helps">${shown.map(helpRowHtml).join("")}</div>
            ${hidden > 0 ? `<p class="doc-helps-more">and ${hidden} more — tick “Full &ldquo;what would help&rdquo; list” to print them all.</p>` : ""}
        </section>` : "";

    return `
    <article class="page page-path${helpsSection ? "" : " no-helps"}">
        ${docBand("My Mountain Path", subtitle)}
        <div class="doc-body">
            ${session.keyMessage.trim() ? `
            <div class="key-message">
                <span class="km-label">In my own words</span>
                “${esc(session.keyMessage.trim())}”
            </div>` : ""}
            ${placed.length
                ? renderPathFigure(path.id)
                : `<div class="doc-empty-hint">Place cards along the path and they will appear here, climbing from what feels comfortable to what feels like a real climb.</div>`}
            ${helpsSection}
        </div>
        ${docFooter()}
    </article>`;
}

function renderHelpsPages() {
    if (!session.includeHelpsDetail) return "";
    const rows = activePaths().flatMap((p) =>
        helpRows(p.id).map((r) => ({ ...r, pathLabel: p.label.trim() })));
    if (!rows.length) return "";

    const pages = [];
    for (let i = 0; i < rows.length; i += HELPS_PER_PAGE) pages.push(rows.slice(i, i + HELPS_PER_PAGE));

    return pages.map((chunk, i) => `
    <article class="page page-helps">
        ${docBand("What Would Help", [
            `${forName()}'s own ideas`,
            pages.length > 1 ? `Page ${i + 1} of ${pages.length}` : "",
        ])}
        <div class="doc-body">
            <div class="doc-helps">${chunk.map(helpRowHtml).join("")}</div>
        </div>
        ${docFooter()}
    </article>`).join("");
}

function renderQuotesPages() {
    if (!session.quotes.length) return "";

    // A single quote earns the whole page — it reads as a statement.
    if (session.quotes.length === 1) {
        const q = session.quotes[0];
        const tag = QUOTE_TAGS[q.tag] || QUOTE_TAGS[""];
        return `
        <article class="page page-quotes">
            ${docBand("In My Own Words", [`${forName()}`, fmtDate(session.date)])}
            <div class="doc-body">
                <div class="doc-quotes solo">
                    <blockquote class="doc-quote">
                        <span class="doc-quote-ornament">${QUOTE_ORNAMENT}</span>
                        <p class="doc-quote-text">${esc(q.text)}</p>
                        <p class="doc-quote-meta">
                            <span class="doc-quote-tagdot" style="background:${tag.color}"></span>
                            ${esc([q.context.trim(), tag.label].filter(Boolean).join("  ·  "))}
                        </p>
                    </blockquote>
                </div>
            </div>
            ${docFooter()}
        </article>`;
    }

    const pages = [];
    for (let i = 0; i < session.quotes.length; i += QUOTES_PER_PAGE) {
        pages.push(session.quotes.slice(i, i + QUOTES_PER_PAGE));
    }

    return pages.map((chunk, pageIdx) => `
    <article class="page page-quotes">
        ${docBand("In My Own Words", [
            `${forName()}`,
            pages.length > 1 ? `Page ${pageIdx + 1} of ${pages.length}` : "",
            fmtDate(session.date),
        ])}
        <div class="doc-body">
            <div class="doc-quotes">
                ${chunk.map((q, i) => {
                    const tag = QUOTE_TAGS[q.tag] || QUOTE_TAGS[""];
                    return `
                    <blockquote class="doc-quote${i % 2 ? " offset" : ""}" style="border-left-color:${tag.color}">
                        <span class="doc-quote-ornament">${QUOTE_ORNAMENT}</span>
                        <p class="doc-quote-text">${esc(q.text)}</p>
                        <p class="doc-quote-meta">
                            <span class="doc-quote-tagdot" style="background:${tag.color}"></span>
                            ${esc([q.context.trim(), tag.label].filter(Boolean).join("  ·  "))}
                        </p>
                    </blockquote>`;
                }).join("")}
            </div>
        </div>
        ${docFooter()}
    </article>`).join("");
}

function renderActionPages() {
    if (!session.actions.length) return "";

    const pages = [session.actions.slice(0, ACTIONS_FIRST_PAGE)];
    for (let i = ACTIONS_FIRST_PAGE; i < session.actions.length; i += ACTIONS_PER_PAGE) {
        pages.push(session.actions.slice(i, i + ACTIONS_PER_PAGE));
    }

    const cell = (label, value) => `
        <div class="doc-action-cell">
            <div class="doc-action-cell-label">${esc(label)}</div>
            <div class="doc-action-cell-value">${value.trim() ? esc(value) : `<span class="doc-blank-line"></span>`}</div>
        </div>`;

    return pages.map((chunk, pageIdx) => {
        const offset = pageIdx === 0 ? 0 : ACTIONS_FIRST_PAGE + (pageIdx - 1) * ACTIONS_PER_PAGE;
        return `
    <article class="page page-actions">
        ${docBand("Our Action Plan", [
            `Agreed with ${forName()}`,
            pages.length > 1 ? `Page ${pageIdx + 1} of ${pages.length}` : "",
            fmtDate(session.date),
        ])}
        <div class="doc-body">
            ${pageIdx === 0 ? `
            <div class="doc-action-intro">
                <p>These actions come from what <strong>${esc(forName())}</strong> told us — the challenges are ${esc(pronounSet().possessive)} own, and so are the ideas. Please review them together on the date agreed.</p>
            </div>` : ""}
            <div class="doc-actions">
                ${chunk.map((a, i) => {
                    const band = a.band ? BAND_BY_NUM[a.band] : null;
                    return `
                    <div class="doc-action">
                        <div class="doc-action-head">
                            <span class="doc-action-num">${offset + i + 1}</span>
                            ${band ? `<span class="doc-action-banddot" style="background:${band.color}"></span>` : ""}
                            <span class="doc-action-challenge">${esc(a.challenge.trim() || "—")}</span>
                        </div>
                        ${a.studentIdea.trim() ? `
                        <p class="doc-action-idea">
                            <span class="doc-action-idea-label">${esc(forName())}'s idea</span>
                            ${esc(a.studentIdea.trim())}
                        </p>` : ""}
                        <div class="doc-action-grid">
                            ${cell("Who will help", a.who)}
                            ${cell("What will we try", a.what)}
                            ${cell("When will we review", a.when)}
                        </div>
                    </div>`;
                }).join("")}
            </div>
            ${pageIdx === pages.length - 1 ? `
            <div class="doc-action-sign">
                <span>Agreed by <span class="doc-sign-line"></span></span>
                <span>Review date <span class="doc-sign-line"></span></span>
            </div>` : ""}
        </div>
        ${docFooter()}
    </article>`;
    }).join("");
}

function renderDocument() {
    const dayMode = session.pathMode === "day";
    const paths = activePaths().filter((p, i) => i === 0 || hasPlacements(p.id));
    const pathPages = dayMode
        ? renderDayPage()
        : paths.map((p) => renderPathPage(p, paths.length)).join("");

    const html =
        (session.includePathPage ? pathPages : "") +
        (session.includePathPage && !dayMode ? renderHelpsPages() : "") +
        (session.includeQuotesPage ? renderQuotesPages() : "") +
        (session.includeActionPage ? renderActionPages() : "");

    // The same markup lands in two places, so any SVG id inside it would be
    // duplicated. That matters: a gradient defined in a display:none subtree is
    // never built as a paint server, so whichever copy is hidden would silently
    // steal the reference and the terrain would print unfilled. Each copy gets
    // its own namespace instead.
    $("#print-document").innerHTML = html.replaceAll("@NS@", "print");
    $("#previewPages").innerHTML = html.replaceAll("@NS@", "preview");
}

// ---------------------------------------------------------------------------
// Preview scaling
// ---------------------------------------------------------------------------

function setupPreviewScaling() {
    const viewport = $(".preview-viewport");
    const pages = $("#previewPages");
    const rescale = () => {
        const available = viewport.clientWidth - 32; // viewport padding
        if (available > 0) pages.style.zoom = Math.min(available / A4_WIDTH_PX, 1);
    };
    new ResizeObserver(rescale).observe(viewport);
    rescale();
}

// ---------------------------------------------------------------------------
// Saved sessions UI
// ---------------------------------------------------------------------------

function renderSavedSessions() {
    const container = $("#savedSessions");
    if (!savedSessions.length) {
        container.innerHTML = `<p class="saved-empty">No saved sessions yet. Build a path and select <strong>Save session</strong> to keep it on this device.</p>`;
        return;
    }
    container.innerHTML = `<div class="saved-list">${savedSessions
        .map((s) => `
            <div class="saved-item">
                <span class="saved-initials">${esc((s.childName || "?").slice(0, 4))}</span>
                <div class="saved-details">
                    <div class="saved-name">${esc(s.name)}</div>
                    <div class="saved-meta">${s.placements.length} cards &middot; ${s.quotes.length} quotes &middot; ${s.actions.length} actions &middot; ${fmtDate(s.date)}</div>
                </div>
                <div class="saved-actions">
                    <button type="button" class="icon-btn" data-action="load" data-id="${s.id}" title="Load session" aria-label="Load ${esc(s.name)}">${ICONS.folder}</button>
                    <button type="button" class="icon-btn" data-action="duplicate" data-id="${s.id}" title="Duplicate session" aria-label="Duplicate ${esc(s.name)}">${ICONS.copy}</button>
                    <button type="button" class="icon-btn danger" data-action="delete" data-id="${s.id}" title="Delete session" aria-label="Delete ${esc(s.name)}">${ICONS.trash}</button>
                </div>
            </div>`)
        .join("")}</div>`;

    container.querySelectorAll(".icon-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = Number(btn.dataset.id);
            const action = btn.dataset.action;
            if (action === "load") loadSessionById(id);
            else if (action === "duplicate") duplicateSession(id);
            else if (action === "delete") deleteSession(id);
        });
    });
}

function renderAllTools() {
    fillForm();
    syncPathMode();
    renderPathTabs();
    renderCardDeck();
    renderPathCanvas();
    renderCardDrawer();
    renderQuotes();
    renderActions();
}

function loadSessionById(id) {
    const s = savedSessions.find((x) => x.id === id);
    if (!s) return;
    session = structuredClone(s);
    activePathId = "a";
    armedCardId = null;
    selectedPlacement = null;
    renderAllTools();
    onSessionChanged();
    toast(`Loaded "${s.name}"`);
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function duplicateSession(id) {
    const s = savedSessions.find((x) => x.id === id);
    if (!s) return;
    const copy = structuredClone(s);
    copy.id = Date.now();
    copy.name = `${s.name} (copy)`;
    copy.date = new Date().toISOString();
    savedSessions.push(copy);
    persistSessions();
    renderSavedSessions();
    toast(`Duplicated "${s.name}"`);
}

function deleteSession(id) {
    const s = savedSessions.find((x) => x.id === id);
    if (!s) return;
    if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return;
    savedSessions = savedSessions.filter((x) => x.id !== id);
    persistSessions();
    renderSavedSessions();
    toast(`Deleted "${s.name}"`);
}

// ---------------------------------------------------------------------------
// Actions: save dialog, print, clear, toast
// ---------------------------------------------------------------------------

function setupActions() {
    const dialog = $("#saveDialog");
    const nameInput = $("#sessionSaveName");

    $("#saveBtn").addEventListener("click", () => {
        nameInput.value = session.name || (session.childName ? `${session.childName} — ${fmtDate(Date.now())}` : "");
        dialog.showModal();
        nameInput.select();
    });

    $("#saveDialogCancel").addEventListener("click", () => dialog.close());

    dialog.querySelector("form").addEventListener("submit", (e) => {
        const name = nameInput.value.trim();
        if (!name) {
            e.preventDefault();
            nameInput.focus();
            return;
        }
        session.name = name;
        const existing = savedSessions.findIndex((s) => s.name === name);
        const record = structuredClone(session);
        if (existing >= 0) {
            record.id = savedSessions[existing].id;
            savedSessions[existing] = record;
            toast(`Updated "${name}"`);
        } else {
            record.id = Date.now();
            savedSessions.push(record);
            toast(`Saved "${name}"`);
        }
        session.id = record.id;
        persistSessions();
        renderSavedSessions();
        saveDraft();
    });

    $("#printBtn").addEventListener("click", () => window.print());

    $("#clearBtn").addEventListener("click", () => {
        if (!confirm("Start again with a blank session? Saved sessions are kept.")) return;
        session = blankSession();
        activePathId = "a";
        armedCardId = null;
        selectedPlacement = null;
        renderAllTools();
        onSessionChanged();
        toast("Started a new session");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("#addActionBtn").addEventListener("click", addBlankAction);

    // Escape puts down a card that is waiting for a station.
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && armedCardId) {
            armedCardId = null;
            renderCardDeck();
            renderPathCanvas();
        }
    });
}

let toastTimer;
function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

function flashPanel(sel) {
    const el = $(sel);
    if (!el) return;
    el.classList.remove("flash");
    void el.offsetWidth; // restart the animation
    el.classList.add("flash");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function updateCounts() {
    if (session.pathMode === "day") {
        const shaped = session.day.values.filter((v) => v > 0).length;
        $("#pathCount").textContent = shaped ? `${shaped} of the day shaped` : "not started yet";
    } else {
        const placed = placementsFor(activePathId).length;
        $("#pathCount").textContent = placed ? `${placed} placed` : "none placed yet";
    }
    $("#quotesCount").textContent = session.quotes.length ? `${session.quotes.length} captured` : "none yet";
    $("#actionsCount").textContent = session.actions.length ? `${session.actions.length} planned` : "none yet";

    $("#railCountPath").textContent = session.pathMode === "day"
        ? (session.day.values.filter((v) => v > 0).length || "")
        : (session.placements.length || "");
    $("#railCountQuotes").textContent = session.quotes.length || "";
    $("#railCountActions").textContent = session.actions.length || "";
}

function onSessionChanged() {
    updateCounts();
    renderDocument();
    saveDraft();
}

function injectStaticIcons() {
    $("#brandMark").innerHTML = ICONS.mountain;
    $(".privacy-icon").innerHTML = ICONS.lock;
    document.querySelectorAll("[data-icon]").forEach((el) => {
        el.innerHTML = ICONS[el.dataset.icon] || "";
    });
}

function init() {
    loadSavedSessions();
    loadDraft();
    injectStaticIcons();
    bindForm();
    setupCustomCard();
    setupQuoteComposer();
    setupPlaceSheet();
    setupDayTool();
    renderPrompts();
    renderAllTools();
    renderSavedSessions();
    onSessionChanged();
    setupPreviewScaling();
    setupActions();
}

init();
