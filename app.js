// Mountain Path — application logic.
// All data stays in this browser (localStorage only) — no network calls.

import { BANDS, BAND_BY_NUM, CARDS, CARD_BY_ID, DEFAULT_SUGGESTIONS, PRONOUNS, QUOTE_TAGS } from "./data.js";
import { ICONS, QUOTE_ORNAMENT } from "./icons.js";

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
        compareEnabled: false,
        paths: [{ id: "a", label: "" }, { id: "b", label: "" }],
        customCards: [],
        placements: [],
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

    list.innerHTML = session.quotes.map((q) => {
        const tag = QUOTE_TAGS[q.tag] || QUOTE_TAGS[""];
        return `
        <div class="quote-item" data-quote="${esc(q.id)}" style="border-left-color:${tag.color}">
            <div class="quote-item-body">
                <textarea class="quote-item-text" rows="2" data-edit="text" aria-label="Quote text">${esc(q.text)}</textarea>
                <div class="quote-item-meta">
                    <span class="dot" style="background:${tag.color}"></span>${esc(tag.label)}
                    <input type="text" class="quote-item-context" data-edit="context"
                        value="${esc(q.context)}" placeholder="When or where…" aria-label="Quote context">
                </div>
            </div>
            <button type="button" class="icon-btn danger" data-delete="${esc(q.id)}"
                title="Delete quote" aria-label="Delete this quote">${ICONS.trash}</button>
        </div>`;
    }).join("");

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
            onSessionChanged();
        });
    });
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
    const paths = activePaths().filter((p, i) => i === 0 || hasPlacements(p.id));
    const html =
        (session.includePathPage ? paths.map((p) => renderPathPage(p, paths.length)).join("") : "") +
        (session.includePathPage ? renderHelpsPages() : "") +
        (session.includeQuotesPage ? renderQuotesPages() : "") +
        (session.includeActionPage ? renderActionPages() : "");

    $("#print-document").innerHTML = html;
    $("#previewPages").innerHTML = html;
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
    const placed = placementsFor(activePathId).length;
    $("#pathCount").textContent = placed ? `${placed} placed` : "none placed yet";
    $("#quotesCount").textContent = session.quotes.length ? `${session.quotes.length} captured` : "none yet";
    $("#actionsCount").textContent = session.actions.length ? `${session.actions.length} planned` : "none yet";

    $("#railCountPath").textContent = session.placements.length || "";
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
    renderAllTools();
    renderSavedSessions();
    onSessionChanged();
    setupPreviewScaling();
    setupActions();
}

init();
