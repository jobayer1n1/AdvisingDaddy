// scripts/advising_table/search_bar.js
// Injects the search/sort toolbar, the "Fetch updates" button, the changes
// details panel, and the auto-fetch popover into the advising page.

import { ext, COURSE_TABLE_ID, setViewApi, nextOrigIndex } from "./state.js";
import { cleanValue, textOf, compareCourse, sectionOf, seatsOf, dayRank } from "./helpers.js";
import { fetchCourseUpdates, LIST_UPDATED_EVENT } from "./fetch_updates.js";

/* ── search bar config ────────────────────────────────────────── */

// The portal already has its own search box (<input id="searchText">). Instead
// of showing a second one, we TAKE THAT ONE OVER: the portal's own search
// handlers are silenced and typing in it filters the list with OUR matching.
// If the portal box isn't on the page we fall back to injecting our own input.
const PORTAL_INPUT_ID = "searchText";
const PORTAL_INPUT_SIZE = 24; // portal ships it as size="10"; set to 0 to leave the width alone
const SEARCH_PLACEHOLDER = "Search course / faculty / day (e.g. eng103.6 MW dummy)";
const CLAIMED_EVENTS = ["keydown", "keypress", "keyup", "input", "change"];

/* ── icons + settings key for the fetch toolbar ─────────────── */
const SVG_REFRESH = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
const SVG_GEAR = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`;

// Persisted auto-fetch interval range (seconds) + on/off flag.
const AUTO_FETCH_STORAGE_KEY = "advAutoFetchRange";

// Filtering waits until typing has paused for this long. Each pass re-lays-out a
// ~4000-row table (measured in Chromium: ~10-50 ms per pass while narrowing,
// ~200 ms when many rows come back, e.g. clearing the box or backspacing), so
// filtering on every keystroke is wasted work. Enter searches immediately;
// Escape and the Clear button never wait.
const SEARCH_DEBOUNCE_MS = 700;

// Document-level close handlers for the auto-fetch popover (one set at a time).
let autoDocHandlers = null;
// Document-level close handlers for the details panel (one set at a time).
let detailsDocHandlers = null;

let claimHandler = null;               // window-level capture listener (only one at a time)
const decoratedInputs = new WeakSet(); // portal inputs we've already restyled

/* ── "N changes" details panel helpers ─────────────────────────
   Clicking the total beside the Fetch button shows everything about the last
   fetch. Built lazily (only when opened) and only from text nodes — the text
   comes from the portal, so it never goes through innerHTML.               */

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function domEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}

function summarizeUpdate(r) {
    const parts = [];
    if (r.changed) {
        const breakdown = r.occupiedChanged || r.capacityChanged
            ? ` (occupied: ${r.occupiedChanged}, capacity: ${r.capacityChanged})`
            : "";
        parts.push(plural(r.changed, "seat change") + breakdown);
    }
    if (r.added) parts.push(plural(r.added, "new section"));
    if (r.removed) parts.push(plural(r.removed, "removed section"));
    return parts.join(", ");
}

function detailsSection(title, rows) {
    const section = domEl("div", "adv-fd-section");
    section.appendChild(domEl("h4", "", title));
    const table = domEl("table");
    for (const row of rows) {
        const tr = domEl("tr");
        tr.appendChild(domEl("td", "k", row.key));
        tr.appendChild(domEl("td", "", row.seats));
        const chips = domEl("td");
        row.chips.forEach(([text, kind]) => chips.appendChild(domEl("span", "adv-chip" + (kind ? " " + kind : ""), text)));
        tr.appendChild(chips);
        table.appendChild(tr);
    }
    section.appendChild(table);
    return section;
}

// update = { kind: "changes" | "error", at, result?, message? }
function renderUpdateDetails(panel, update, onClose) {
    panel.textContent = "";

    const head = domEl("div", "adv-fd-head");
    head.appendChild(domEl("b", "", update.kind === "error" ? "Fetch failed" : "Last fetch"));
    head.appendChild(domEl("span", "adv-fd-time", new Date(update.at).toLocaleTimeString()));
    const close = domEl("button", "adv-fd-close", "✕");
    close.type = "button";
    close.title = "Close";
    close.addEventListener("click", onClose);
    head.appendChild(close);
    panel.appendChild(head);

    if (update.kind === "error") {
        panel.appendChild(domEl("div", "adv-fd-error", update.message));
        return;
    }

    const r = update.result;
    panel.appendChild(domEl("div", "adv-fd-summary", `${plural(r.total, "change")}: ${summarizeUpdate(r)}`));

    if (r.changes.length) {
        panel.appendChild(detailsSection(`Seat changes (${r.changes.length})`, r.changes.map((c) => {
            const chips = [];
            if (c.occupied) chips.push([`occupied ${c.occupied[0]}→${c.occupied[1]}`, ""]);
            if (c.capacity) chips.push([`capacity ${c.capacity[0]}→${c.capacity[1]}`, ""]);
            if (c.becameFull) chips.push(["now full", "full"]);
            if (c.reopened) chips.push(["seats available again", "open"]);
            return { key: c.key, seats: `${c.from} → ${c.to}`, chips };
        })));
    }
    if (r.newSections.length) {
        panel.appendChild(detailsSection(`New sections (${r.newSections.length})`,
            r.newSections.map((n) => ({ key: n.key, seats: n.seats, chips: [["new", "new"]] }))));
    }
    if (r.removedSections.length) {
        panel.appendChild(detailsSection(`Removed sections (${r.removedSections.length})`,
            r.removedSections.map((key) => ({ key, seats: "", chips: [["removed", "full"]] }))));
    }
}

/* ── main export ────────────────────────────────────────────── */
export function addCourseSearchBar() {
    if (document.getElementById("advCourseSearchContainer")) return;

    const offeredCoursesDiv = document.getElementById("offeredCourses");
    if (!offeredCoursesDiv || !offeredCoursesDiv.parentNode) return;

    const portalMode = Boolean(document.getElementById(PORTAL_INPUT_ID));

    // The sort select HTML is shared between portal and non-portal mode.
    const sortSelectHtml = `
        <select id="advCourseSortSelect" title="Sort results">
            <option value="">Sort: default</option>
            <option value="section">Section (asc)</option>
            <option value="day">Day (A → MW)</option>
            <option value="seats">Open seats (most first)</option>
            <option value="faculty">Faculty (A–Z)</option>
        </select>`;

    // Non-portal: own search input + sort select share one row.
    const ownInputRow = `
        <div id="advSearchRow">
            <div style="position: relative; flex: 1; display: flex; align-items: center;">
                <span style="position: absolute; left: 10px; font-size: 13px; color: #656d76; pointer-events: none;">🔍</span>
                <input type="text" id="advCourseSearchInput" placeholder="${SEARCH_PLACEHOLDER}" />
                <button id="advCourseSearchClear" type="button" title="Clear search">✕</button>
            </div>
            ${sortSelectHtml}
        </div>`;

    // Portal mode: inline clear goes in the footer; sort select is injected into #searchDiv.
    const inlineClear = `<button id="advCourseSearchClear" type="button" title="Clear search">✕ Clear</button>`;

    const searchContainer = document.createElement("div");
    searchContainer.id = "advCourseSearchContainer";
    searchContainer.innerHTML = `
        ${portalMode ? "" : ownInputRow}
        <div id="advCourseSearchFooter">
            <div id="advCourseSearchInfo">
                <div id="advAutoFetchWrap">
                    <button id="advAutoFetchBtn" type="button" aria-haspopup="true" aria-expanded="false" title="Auto-fetch settings">${SVG_GEAR}</button>
                    <span id="advAutoFetchCountdown" hidden aria-live="polite"></span>
                </div>
                <button id="advCourseFetchBtn" type="button" title="Fetch the latest seat counts and update only the cells that changed"><span class="adv-btn-icon">${SVG_REFRESH}</span><span>Fetch updates</span></button>
                <span id="advCourseFetchStatus"></span>
                <div id="advCourseSearchCount"></div>
                ${portalMode ? inlineClear : ""}
            </div>
        </div>
        <div id="advAutoFetchPanel" hidden>
            <div class="adv-af-head">
                <span class="adv-af-title">Auto fetch</span>
                <label class="adv-af-switch" title="Turn auto fetch on or off">
                    <input type="checkbox" id="advAutoFetchToggle">
                    <span class="adv-af-track"></span>
                </label>
                <button type="button" id="advAutoFetchClose" class="adv-af-close" title="Close">✕</button>
            </div>
            <div class="adv-af-row">
                <label for="advAutoFetchMin">Min</label>
                <input type="range" id="advAutoFetchMin" min="1" max="60" step="1" value="3">
                <span class="adv-af-val" id="advAutoFetchMinVal">3s</span>
            </div>
            <div class="adv-af-row">
                <label for="advAutoFetchMax">Max</label>
                <input type="range" id="advAutoFetchMax" min="1" max="60" step="1" value="5">
                <span class="adv-af-val" id="advAutoFetchMaxVal">5s</span>
            </div>
            <div class="adv-af-hint">A random delay is picked between min and max so requests look like normal browsing.</div>
        </div>
        <div id="advCourseFetchDetails" hidden></div>
    `;

    offeredCoursesDiv.parentNode.insertBefore(searchContainer, offeredCoursesDiv);

    // In portal mode: inject the sort select into #searchDiv so it sits to the
    // right of the portal's own #searchText input. We create it from the shared
    // sortSelectHtml string and append it there (hidden inputs stay untouched).
    if (portalMode) {
        const searchDiv = document.getElementById("searchDiv");
        if (searchDiv && !searchDiv.querySelector("#advCourseSortSelect")) {
            const tmp = document.createElement("span"); // throwaway wrapper
            tmp.innerHTML = sortSelectHtml;
            searchDiv.appendChild(tmp.firstElementChild);
        }
    }

    const ownInput = searchContainer.querySelector("#advCourseSearchInput"); // null in portal mode
    const clearBtn = searchContainer.querySelector("#advCourseSearchClear");
    const countDiv = searchContainer.querySelector("#advCourseSearchCount");
    // In portal mode the sort select lives inside #searchDiv, not searchContainer.
    const sortSelect = document.getElementById("advCourseSortSelect") ||
        searchContainer.querySelector("#advCourseSortSelect");
    const fetchBtn = searchContainer.querySelector("#advCourseFetchBtn");
    const fetchStatus = searchContainer.querySelector("#advCourseFetchStatus");

    // Looked up by id each time, so it keeps working if the portal re-renders
    // the search box (UpdatePanel) and swaps the element.
    const getInput = () =>
        portalMode ? document.getElementById(PORTAL_INPUT_ID) : ownInput;

    /* ── portal input: restyle it as our search box ─────────── */
    function decoratePortalInput() {
        if (!portalMode) return;
        const el = getInput();
        if (!el || decoratedInputs.has(el)) return;
        decoratedInputs.add(el);

        el.placeholder = SEARCH_PLACEHOLDER;
        el.title = SEARCH_PLACEHOLDER;
        el.setAttribute("autocomplete", "off");
        el.spellcheck = false;
        if (PORTAL_INPUT_SIZE > 0) el.size = PORTAL_INPUT_SIZE;
    }

    /* ── field extraction (no layout-forcing reads) ─────────── */
    function getRowFields(row) {
        const injected = row.getAttribute("data-injected-meta") === "true";

        if (injected) {
            return {
                course: cleanValue(row.dataset.course),
                seats: cleanValue(row.dataset.seats),
                faculty: cleanValue(row.dataset.faculty),
                day: cleanValue(row.dataset.day),
            };
        }

        const tds = row.querySelectorAll("td");
        return {
            course: cleanValue(textOf(tds[0])),
            seats: cleanValue(textOf(tds[1])),
            faculty: "",
            day: "",
        };
    }

    /* ── matching ──────────────────────────────────────────── */
    function rowMatches(fields, tokens) {
        if (!tokens.length) return true;

        const course = fields.course.toUpperCase();
        const faculty = fields.faculty.toUpperCase();
        const day = fields.day.toUpperCase();
        const dayParts = day.split(/[\s,/]+/);

        return tokens.every((tok) => {
            if (course.includes(tok)) return true;
            if (faculty && faculty.includes(tok)) return true;
            if (day && (day === tok || dayParts.includes(tok))) return true;
            return false;
        });
    }

    /* ── sorting ───────────────────────────────────────────── */
    function compareRows(a, b, sortKey, fieldsMap) {
        const fa = fieldsMap.get(a);
        const fb = fieldsMap.get(b);

        switch (sortKey) {
            case "section": {
                const c = compareCourse(
                    sectionOf(fa.course),
                    sectionOf(fb.course)
                );
                return c || compareCourse(fa.course, fb.course);
            }

            case "day": {
                const c = dayRank(fa.day) - dayRank(fb.day);
                return c || compareCourse(fa.course, fb.course);
            }

            case "seats": {
                // descending – higher number of seats first
                const c = seatsOf(fb.seats) - seatsOf(fa.seats);
                return c || compareCourse(fa.course, fb.course);
            }

            case "faculty": {
                const af = cleanValue(fa.faculty);
                const bf = cleanValue(fb.faculty);
                if (!af && bf) return 1;
                if (af && !bf) return -1;
                const c = compareCourse(af, bf);
                return c || compareCourse(fa.course, fb.course);
            }

            default:
                return 0;
        }
    }

    function origIndex(row) {
        const v = parseInt(row.dataset.origIndex, 10);
        return Number.isNaN(v) ? 0 : v;
    }

    // Safety net for rows the injector skipped. Uses the shared counter so
    // late arrivals always land AFTER earlier rows in "default" order.
    function ensureOrigIndexes(rows) {
        // Import nextOrigIndex dynamically to avoid a circular import at module parse time.
        // By the time this function is called, state.js is already evaluated.
        const stateModule = /** @type {any} */ (
            // eslint-disable-next-line no-undef
            typeof __advStateModule !== "undefined" ? __advStateModule : null
        );
        for (const row of rows) {
            if (row.dataset.origIndex === undefined) {
                // Access origCounter through a lazy import that won't be circular.
                row.dataset.origIndex = String(_getOrigIndex());
            }
        }
    }

    /* ── filtering only: toggles ONE attribute per row, never touches
       DOM order and never writes inline styles (the CSS rule for
       [data-search-hidden] does the hiding). Only writes when state
       actually changes, so it produces the minimum possible mutations. */
    function applyFilterOnly() {
        const table = document.getElementById(COURSE_TABLE_ID);
        if (!table) return;

        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr"));
        _ensureOrigIndexes(rows);

        const inputEl = getInput();
        const query = ((inputEl && inputEl.value) || "").trim();
        const tokens = query.toUpperCase().split(/\s+/).filter(Boolean);

        let visibleCount = 0;

        for (const row of rows) {
            const matches = rowMatches(getRowFields(row), tokens);
            const isHidden = row.hasAttribute("data-search-hidden");

            if (matches) {
                visibleCount++;
                if (isHidden) row.removeAttribute("data-search-hidden");
            } else if (!isHidden) {
                row.setAttribute("data-search-hidden", "true");
            }
        }

        if (query) {
            clearBtn.style.display = "block";
            countDiv.style.display = "block";
            countDiv.textContent = `${visibleCount} course${
                visibleCount === 1 ? "" : "s"
            } found`;
        } else {
            clearBtn.style.display = "none";
            countDiv.style.display = "none";
            countDiv.textContent = "";
        }
    }

    /* ── sorting only: reorders DOM nodes. Called when the dropdown
       changes, and after new rows are injected. One fragment append,
       skipped entirely if the order is already correct.               */
    function applySortOrder() {
        const table = document.getElementById(COURSE_TABLE_ID);
        if (!table) return;

        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr"));
        _ensureOrigIndexes(rows);

        const sortKey = sortSelect ? sortSelect.value : "";

        const fieldsMap = new Map();
        if (sortKey) rows.forEach((row) => fieldsMap.set(row, getRowFields(row)));

        const ordered = rows.slice().sort((a, b) =>
            sortKey
                ? compareRows(a, b, sortKey, fieldsMap) || origIndex(a) - origIndex(b)
                : origIndex(a) - origIndex(b)
        );

        const changed = ordered.some((row, i) => tbody.children[i] !== row);
        if (!changed) return;

        const frag = document.createDocumentFragment();
        ordered.forEach((row) => frag.appendChild(row));
        tbody.appendChild(frag);
    }

    /* ── debounce helper for the search input ─────────────────────── */
    function debounce(fn, wait) {
        let t = null;
        const debounced = (...args) => {
            if (t) clearTimeout(t);
            t = setTimeout(() => { t = null; fn(...args); }, wait);
        };
        debounced.cancel = () => {
            if (t) clearTimeout(t);
            t = null;
        };
        return debounced;
    }

    const debouncedFilter = debounce(applyFilterOnly, SEARCH_DEBOUNCE_MS);

    // Search right now (Enter): skips the wait, and drops any pending one.
    function searchNow() {
        debouncedFilter.cancel();
        applyFilterOnly();
    }

    function clearSearch() {
        const el = getInput();
        if (el) el.value = "";
        searchNow();
        if (el) el.focus();
    }

    /* ── wiring ────────────────────────────────────────────── */
    if (portalMode) {
        decoratePortalInput();

        // Take over the portal's search box. This listener sits on `window`
        // in the CAPTURE phase, so it runs before anything the portal has
        // attached to the input, to its ancestors (delegated handlers), or
        // inline (onkeyup="..."). stopImmediatePropagation() means none of
        // those ever see the event, so the portal's own search never runs.
        if (claimHandler) {
            CLAIMED_EVENTS.forEach((t) => window.removeEventListener(t, claimHandler, true));
        }
        claimHandler = (e) => {
            const target = e.target;
            if (!target || target.id !== PORTAL_INPUT_ID) return;

            e.stopImmediatePropagation();

            if (e.type === "keydown" || e.type === "keypress") {
                if (e.key === "Enter") {
                    e.preventDefault(); // would submit the form / trigger a postback
                    if (e.type === "keydown") searchNow();
                }
                if (e.type === "keydown" && e.key === "Escape") {
                    e.preventDefault();
                    target.value = "";
                    searchNow();
                }
                return;
            }

            if (e.type === "input") debouncedFilter();
        };
        CLAIMED_EVENTS.forEach((t) => window.addEventListener(t, claimHandler, true));
    } else {
        ownInput.addEventListener("input", debouncedFilter);
        ownInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                searchNow();
            } else if (e.key === "Escape") {
                ownInput.value = "";
                searchNow();
            }
        });
    }

    clearBtn.addEventListener("click", clearSearch);

    // Set inside the blocks below; declared here so they can call each other.
    let runFetch = null;
    let closeDetailsPanel = () => {};
    let closeAutoFetchPanel = () => {};

    if (fetchBtn) {
        const detailsPanel = searchContainer.querySelector("#advCourseFetchDetails");
        let lastUpdate = null;      // what the panel shows: { kind, at, result | message }
        let fetching = false;

        const hideDetails = () => {
            detailsPanel.hidden = true;
            detailsPanel.textContent = ""; // nothing lingers in the page while closed
            fetchStatus.setAttribute("aria-expanded", "false");
        };
        const showDetails = () => {
            closeAutoFetchPanel();
            renderUpdateDetails(detailsPanel, lastUpdate, hideDetails); // built only when opened
            detailsPanel.hidden = false;
            fetchStatus.setAttribute("aria-expanded", "true");
        };
        const toggleDetails = () => {
            if (!lastUpdate) return;
            if (detailsPanel.hidden) showDetails();
            else hideDetails();
        };
        closeDetailsPanel = hideDetails;

        const setFetchBtnLabel = (label, spinning = false) => {
            fetchBtn.innerHTML =
                `<span class="adv-btn-icon${spinning ? " adv-spin" : ""}">${SVG_REFRESH}</span><span>${label}</span>`;
        };

        // The total (or the error warning) is a button when there is something to show.
        const setStatus = (text, cls = "", title = "", clickable = false) => {
            fetchStatus.textContent = text;
            fetchStatus.className = cls;
            fetchStatus.title = title;
            if (clickable) {
                fetchStatus.setAttribute("role", "button");
                fetchStatus.setAttribute("tabindex", "0");
                fetchStatus.setAttribute("aria-expanded", "false");
            } else {
                fetchStatus.removeAttribute("role");
                fetchStatus.removeAttribute("tabindex");
                fetchStatus.removeAttribute("aria-expanded");
            }
        };

        fetchStatus.addEventListener("click", toggleDetails);
        fetchStatus.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleDetails();
            }
        });

        // Close on outside click / Escape. Replace the previous set if the
        // portal re-created our container, so handlers never pile up.
        if (detailsDocHandlers) {
            document.removeEventListener("click", detailsDocHandlers.click);
            document.removeEventListener("keydown", detailsDocHandlers.key);
        }
        detailsDocHandlers = {
            click: (e) => {
                if (!detailsPanel.hidden && !detailsPanel.contains(e.target) && !fetchStatus.contains(e.target)) hideDetails();
            },
            key: (e) => {
                if (e.key === "Escape" && !detailsPanel.hidden) hideDetails();
            },
        };
        document.addEventListener("click", detailsDocHandlers.click);
        document.addEventListener("keydown", detailsDocHandlers.key);

        runFetch = async ({ auto = false } = {}) => {
            if (fetching) return;
            fetching = true;
            fetchBtn.disabled = true;
            setFetchBtnLabel("Fetching…", true);
            if (!auto) {
                lastUpdate = null;
                hideDetails();
                setStatus("");
            }
            try {
                const result = await fetchCourseUpdates();
                const total = result.total;
                if (total) {
                    lastUpdate = { kind: "changes", at: Date.now(), result };
                    setStatus(`${total} change${total === 1 ? "" : "s"}`, "changed", "Click for details", true);
                } else {
                    lastUpdate = null; // nothing to show
                    setStatus("No changes", "", `Checked at ${new Date().toLocaleTimeString()}`);
                }
                // content.js listens for this and re-runs the seat checks.
                document.dispatchEvent(new CustomEvent(LIST_UPDATED_EVENT, { detail: result }));
            } catch (err) {
                console.error(`AdvisingDaddy: fetch failed — ${err.message}`, err);
                lastUpdate = { kind: "error", at: Date.now(), message: err.message };
                setStatus("⚠ Fetch failed", "error", err.message, true); // reason on hover; click for the panel
            } finally {
                fetching = false;
                fetchBtn.disabled = false;
                setFetchBtnLabel("Fetch updates");
            }
            // keep an already-open panel in sync with what just happened
            if (!detailsPanel.hidden) {
                if (lastUpdate) showDetails();
                else hideDetails();
            }
        };

        fetchBtn.addEventListener("click", () => { runFetch({ auto: false }); });
    }

    /* ── auto-fetch settings (gear) ────────────────────────── */
    const autoWrap = searchContainer.querySelector("#advAutoFetchWrap");
    const autoBtn = searchContainer.querySelector("#advAutoFetchBtn");
    const autoCountdown = searchContainer.querySelector("#advAutoFetchCountdown");
    const autoPanel = searchContainer.querySelector("#advAutoFetchPanel");
    const autoClose = searchContainer.querySelector("#advAutoFetchClose");
    const autoToggle = searchContainer.querySelector("#advAutoFetchToggle");
    const autoMin = searchContainer.querySelector("#advAutoFetchMin");
    const autoMax = searchContainer.querySelector("#advAutoFetchMax");
    const autoMinVal = searchContainer.querySelector("#advAutoFetchMinVal");
    const autoMaxVal = searchContainer.querySelector("#advAutoFetchMaxVal");

    if (autoBtn && autoPanel) {
        const AUTO_LO = 1;
        const AUTO_HI = 60;
        const clampInt = (v, dflt) => {
            const n = parseInt(v, 10);
            return Number.isNaN(n) ? dflt : Math.min(AUTO_HI, Math.max(AUTO_LO, n));
        };

        let autoSettings = { min: 3, max: 5, enabled: true };
        let autoTimer = null;
        let saveTimer = null;

        const rangeText = () =>
            autoSettings.min === autoSettings.max
                ? `${autoSettings.min}s`
                : `${autoSettings.min}–${autoSettings.max}s`;

        function paintRange(input) {
            const lo = Number(input.min) || AUTO_LO;
            const hi = Number(input.max) || AUTO_HI;
            const pct = ((Number(input.value) - lo) / (hi - lo)) * 100;
            input.style.background =
                `linear-gradient(to right, #003e7e 0%, #003e7e ${pct}%, #e1e4e8 ${pct}%, #e1e4e8 100%)`;
        }

        function syncAutoUI() {
            autoMin.value = String(autoSettings.min);
            autoMax.value = String(autoSettings.max);
            autoMinVal.textContent = `${autoSettings.min}s`;
            autoMaxVal.textContent = `${autoSettings.max}s`;
            autoToggle.checked = autoSettings.enabled;

            const text = rangeText();
            autoBtn.classList.toggle("active", autoSettings.enabled);
            autoBtn.title = autoSettings.enabled
                ? `Auto fetch every ${text} — click to change`
                : "Auto fetch is off — click to change";

            // Hide countdown when disabled; scheduleAutoFetch will show it when running.
            if (!autoSettings.enabled && autoCountdown) {
                autoCountdown.hidden = true;
                autoCountdown.textContent = "";
            }

            paintRange(autoMin);
            paintRange(autoMax);
        }

        function saveAutoSettings() {
            if (saveTimer) clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                saveTimer = null;
                if (ext && ext.storage && ext.storage.local) {
                    ext.storage.local.set({ [AUTO_FETCH_STORAGE_KEY]: { ...autoSettings } });
                }
            }, 300);
        }

        // Random delay inside [min, max] on every cycle — no fixed cadence.
        // A 200 ms interval keeps the visible countdown smooth without any
        // layout cost (it writes only textContent of a hidden <span>).
        let countdownInterval = null;

        function stopCountdown() {
            if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
            if (autoCountdown) { autoCountdown.hidden = true; autoCountdown.textContent = ""; }
        }

        function startCountdown(delayMs) {
            if (!autoCountdown) return;
            stopCountdown();
            const endAt = Date.now() + delayMs;
            const tick = () => {
                const remaining = Math.max(0, endAt - Date.now());
                autoCountdown.textContent = `${Math.ceil(remaining / 1000)}s`;
                autoCountdown.hidden = false;
                if (remaining <= 0) stopCountdown();
            };
            tick(); // immediate first paint
            countdownInterval = setInterval(tick, 200);
        }

        function scheduleAutoFetch() {
            if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
            stopCountdown();
            if (!autoSettings.enabled || !runFetch) return;

            const lo = Math.min(autoSettings.min, autoSettings.max);
            const hi = Math.max(autoSettings.min, autoSettings.max);
            const delay = Math.round((lo + Math.random() * (hi - lo)) * 1000);

            startCountdown(delay);

            autoTimer = setTimeout(async () => {
                autoTimer = null;
                stopCountdown();
                try {
                    await runFetch({ auto: true });
                } catch (err) {
                    console.error("AdvisingDaddy: auto fetch failed", err);
                }
                scheduleAutoFetch();
            }, delay);
        }

        function openAutoPanel() {
            closeDetailsPanel();
            autoPanel.hidden = false;
            autoBtn.setAttribute("aria-expanded", "true");
        }
        function hideAutoPanel() {
            autoPanel.hidden = true;
            autoBtn.setAttribute("aria-expanded", "false");
        }
        closeAutoFetchPanel = hideAutoPanel;

        autoBtn.addEventListener("click", () => {
            if (autoPanel.hidden) openAutoPanel();
            else hideAutoPanel();
        });
        if (autoClose) autoClose.addEventListener("click", hideAutoPanel);

        function onRangeInput(which) {
            let lo = parseInt(autoMin.value, 10);
            let hi = parseInt(autoMax.value, 10);
            if (which === "min" && lo > hi) hi = lo;
            if (which === "max" && hi < lo) lo = hi;
            autoSettings.min = clampInt(lo, 3);
            autoSettings.max = clampInt(hi, 5);
            syncAutoUI();
            scheduleAutoFetch();
            saveAutoSettings();
        }
        autoMin.addEventListener("input", () => onRangeInput("min"));
        autoMax.addEventListener("input", () => onRangeInput("max"));

        autoToggle.addEventListener("change", () => {
            autoSettings.enabled = autoToggle.checked;
            syncAutoUI();
            scheduleAutoFetch();
            saveAutoSettings();
        });

        // Close on outside click / Escape.
        if (autoDocHandlers) {
            document.removeEventListener("click", autoDocHandlers.click);
            document.removeEventListener("keydown", autoDocHandlers.key);
        }
        autoDocHandlers = {
            click: (e) => {
                if (!autoPanel.hidden && !autoPanel.contains(e.target) && !autoWrap.contains(e.target)) hideAutoPanel();
            },
            key: (e) => {
                if (e.key === "Escape" && !autoPanel.hidden) hideAutoPanel();
            },
        };
        document.addEventListener("click", autoDocHandlers.click);
        document.addEventListener("keydown", autoDocHandlers.key);

        // Restore saved range, then start the loop.
        const bootAutoFetch = () => { syncAutoUI(); scheduleAutoFetch(); };
        if (ext && ext.storage && ext.storage.local && ext.storage.local.get) {
            ext.storage.local
                .get(AUTO_FETCH_STORAGE_KEY)
                .then((data) => {
                    const saved = data && data[AUTO_FETCH_STORAGE_KEY];
                    if (saved && typeof saved === "object") {
                        autoSettings = {
                            min: clampInt(saved.min, 3),
                            max: clampInt(saved.max, 5),
                            enabled: saved.enabled !== false,
                        };
                        if (autoSettings.min > autoSettings.max) {
                            const t = autoSettings.min;
                            autoSettings.min = autoSettings.max;
                            autoSettings.max = t;
                        }
                    }
                    bootAutoFetch();
                })
                .catch(() => bootAutoFetch());
        } else {
            bootAutoFetch();
        }
    }

    if (sortSelect) {
        // Sorting never changes which rows match, so no filter pass needed.
        sortSelect.addEventListener("change", applySortOrder);
    }

    // Exposed so the injector can re-apply the user's current sort + filter
    // after the portal re-renders rows (otherwise new rows appear unsorted
    // and unfiltered while the dropdown/search box still show the old state).
    setViewApi({
        refresh() {
            decoratePortalInput();
            if (sortSelect && sortSelect.value) applySortOrder();
            applyFilterOnly();
        },
    });
}

/* ── origIndex helper ───────────────────────────────────────── */
// state.js is not part of any circular import chain, so nextOrigIndex can be
// imported statically and called directly.
/** @param {HTMLTableRowElement[]} rows */
function _ensureOrigIndexes(rows) {
    for (const row of rows) {
        if (row.dataset.origIndex === undefined) {
            row.dataset.origIndex = String(nextOrigIndex());
        }
    }
}
