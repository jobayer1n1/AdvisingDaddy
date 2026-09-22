// scripts/advising_table.js
import { formatDisplayTime } from "./time_utils.js";
import { OFFERED_COURSE_SAVE_KEY } from "./offered_courses.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
export const COURSE_TABLE_ID = "courseList";

// Temporary timing logs — set to false once the slow step is found.
const DEBUG_TIMING = true;
const lap = (label, t0) => {
    if (DEBUG_TIMING) console.log(`AdvisingDaddy [timing] ${label}: ${(performance.now() - t0).toFixed(1)}ms`);
};

/* ── preferred day order for sorting ───────────────────────── */
const DAY_ORDER = ["A", "S", "M", "T", "W", "TH", "RA", "ST", "MW"];

/* ── module state ──────────────────────────────────────────── */
// Monotonic counter: every row gets its "original position" once, when it is
// first seen, so "Sort: default" can always restore portal order — even for
// rows the portal adds after the user has already sorted.
let origCounter = 0;

// Cached saved-metadata map. Re-reading storage + rebuilding the Map on every
// call is wasteful when this function is triggered repeatedly (observers,
// UpdatePanel refreshes, etc.).
let metaMapPromise = null;

// Set by addCourseSearchBar(); lets injectSavedCourseMetadata() re-apply the
// current sort/filter after new rows arrive.
let viewApi = null;

// Tables that already have the delegated click handler.
const boundTables = new WeakSet();

if (ext && ext.storage && ext.storage.onChanged) {
    ext.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[OFFERED_COURSE_SAVE_KEY]) {
            metaMapPromise = null; // invalidate cache
        }
    });
}

function loadMetaMap() {
    if (!metaMapPromise) {
        metaMapPromise = ext.storage.local
            .get(OFFERED_COURSE_SAVE_KEY)
            .then((data) => {
                const list = data[OFFERED_COURSE_SAVE_KEY];
                if (!Array.isArray(list) || list.length === 0) return null;

                const map = new Map();
                for (const item of list) {
                    if (!item || !item.course || !item.section) continue;
                    const key = `${String(item.course).trim().toUpperCase()}.${String(
                        item.section
                    ).trim()}`;
                    map.set(key, item);
                }
                return map;
            })
            .catch((err) => {
                metaMapPromise = null;
                console.error("advising_table: failed to load saved courses", err);
                return null;
            });
    }
    return metaMapPromise;
}

/* ── tiny helpers ──────────────────────────────────────────── */
function cleanValue(value) {
    const s = (value == null ? "" : String(value)).trim();
    return s === "-" ? "" : s;
}

// textContent does NOT force a layout/reflow (innerText does).
function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

function compareCourse(a, b) {
    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

function sectionOf(courseKey) {
    const c = String(courseKey || "");
    const i = c.lastIndexOf(".");
    return i === -1 ? "" : c.slice(i + 1).trim();
}

// Portal format is "occupied(total)", e.g. "5(40)" -> 35 open seats.
// (The old version returned the FIRST number, i.e. occupied seats, so
// "Seats (desc)" actually listed the fullest sections first.)
function seatsOf(seatsText) {
    const m = String(seatsText || "").trim().match(/^(\d+)\s*\((\d+)\)$/);
    return m ? Math.max(0, parseInt(m[2], 10) - parseInt(m[1], 10)) : -1;
}

function dayRank(day) {
    const d = String(day || "").toUpperCase().trim();
    const i = DAY_ORDER.indexOf(d);
    return i === -1 ? DAY_ORDER.length : i;
}

/* ── styles ────────────────────────────────────────────────── */
export function applyAdvisingLayoutStyles() {
    if (document.getElementById("advising-injected-styles")) return;
    const style = document.createElement("style");
    style.id = "advising-injected-styles";
    style.textContent = `
        #mainBody {
            width: min(1240px, 98vw) !important;
        }
        #advisingframe {
            width: 100% !important;
        }
        #advisingframe .right {
            width: 540px !important;
        }
        #coursesbox {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #coursemiddlebar {
            width: 100% !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #advCourseSearchContainer {
            padding: 8px 10px 6px 10px;
            background: #ffffff;
            border-bottom: 1px solid #d0d7de;
            display: flex;
            flex-direction: column;
            gap: 3px;
            box-sizing: border-box;
            width: 100%;
        }
        #advCourseSearchInput {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 6px 28px 6px 30px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-family: inherit !important;
            outline: none !important;
            transition: border-color 0.2s, box-shadow 0.2s !important;
            background: #fdfdfd !important;
            color: #24292f !important;
        }
        #advCourseSearchInput:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.15) !important;
            background: #ffffff !important;
        }
        #advCourseSearchClear {
            position: absolute !important;
            right: 8px !important;
            background: none !important;
            border: none !important;
            color: #8c959f !important;
            font-size: 13px !important;
            cursor: pointer !important;
            display: none;
            padding: 2px 6px !important;
            line-height: 1 !important;
        }
        #advCourseSearchClear:hover {
            color: #24292f !important;
        }
        #advCourseSearchFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            min-height: 18px;
        }
        #advCourseSearchCount {
            font-size: 11px;
            color: #57606a;
            padding-left: 2px;
            display: none;
        }
        #advCourseSortSelect {
            font-size: 11px !important;
            font-family: inherit !important;
            padding: 2px 4px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 4px !important;
            background: #fdfdfd !important;
            color: #24292f !important;
            cursor: pointer !important;
            outline: none !important;
        }
        #advCourseSortSelect:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 2px rgba(0, 62, 126, 0.15) !important;
        }
        #coursemiddlebar .body, #offeredCourses {
            width: calc(100% - 10px) !important;
            height: 460px !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            margin: 5px 5px !important;
        }
        #courseList {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
        }
        #courseList thead th {
            position: sticky;
            top: 0;
            background: #003e7e;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 4px;
            text-align: center;
            z-index: 5;
            border-bottom: 2px solid #00254c;
            white-space: nowrap;
        }
        #courseList th, #courseList td {
            box-sizing: border-box !important;
            vertical-align: middle !important;
        }
        #courseList th:first-child,
        #courseList tbody td:first-child {
            width: 85px !important;
            min-width: 85px !important;
            max-width: 85px !important;
            text-align: left !important;
            padding: 4px 2px 4px 6px !important;
            font-weight: bold !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(2),
        #courseList tbody td:nth-child(2) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
            text-align: center !important;
            padding: 4px 4px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(3),
        #courseList tbody td:nth-child(3) {
            width: 55px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(4),
        #courseList tbody td:nth-child(4) {
            width: 40px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(5),
        #courseList tbody td:nth-child(5) {
            width: 155px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(6),
        #courseList tbody td:nth-child(6) {
            width: 65px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList tbody td {
            font-size: 12px !important;
            border-bottom: 1px solid #e1e4e8 !important;
        }
        /* Only sections you can add (portal class cstat0) look clickable.
           Full sections (cstat1) keep whatever cursor the portal gives them,
           so our injected cells match the portal instead of promising a click
           that does nothing. */
        #courseList tbody tr.cstat0 td {
            cursor: pointer;
        }
        #advCourseSearchInfo {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        #advCourseSearchFooter #advCourseSearchClear {
            position: static !important;
            padding: 0 !important;
            font-size: 11px !important;
        }
        #advCourseSearchFooter #advCourseSortSelect {
            margin-left: auto;
        }
        #advCourseSearchInfo {
            flex-wrap: wrap;
        }
        #advCourseFetchBtn {
            font-size: 11px !important;
            font-family: inherit !important;
            padding: 2px 8px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 4px !important;
            background: #fdfdfd !important;
            color: #24292f !important;
            cursor: pointer !important;
        }
        #advCourseFetchBtn:hover:not(:disabled) {
            border-color: #003e7e !important;
            color: #003e7e !important;
        }
        #advCourseFetchBtn:disabled {
            opacity: 0.6;
            cursor: default !important;
        }
        #advCourseFetchStatus {
            font-size: 11px;
            color: #57606a;
        }
        #advCourseFetchStatus[role="button"] {
            cursor: pointer;
            text-decoration: underline dotted;
            text-underline-offset: 2px;
        }
        #advCourseFetchStatus[role="button"]:hover {
            text-decoration-style: solid;
        }
        #advCourseSearchContainer {
            position: relative;
        }
        #advCourseFetchDetails {
            position: absolute;
            top: calc(100% - 1px);
            left: 10px;
            right: 10px;
            z-index: 30;
            max-height: 320px;
            overflow: auto;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #c0c6cf;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(31, 35, 40, 0.18);
            padding: 8px 10px;
            font-size: 12px;
            color: #24292f;
        }
        #advCourseFetchDetails[hidden] {
            display: none;
        }
        #advCourseFetchDetails .adv-fd-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }
        #advCourseFetchDetails .adv-fd-time {
            color: #57606a;
            font-size: 11px;
        }
        #advCourseFetchDetails .adv-fd-close {
            margin-left: auto;
            border: none;
            background: none;
            color: #57606a;
            font-size: 13px;
            cursor: pointer;
        }
        #advCourseFetchDetails .adv-fd-summary {
            font-weight: 600;
            margin-bottom: 4px;
        }
        #advCourseFetchDetails .adv-fd-error {
            color: #cf222e;
            word-break: break-word;
        }
        #advCourseFetchDetails h4 {
            margin: 8px 0 3px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: #57606a;
        }
        #advCourseFetchDetails table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;   /* same column positions in every section */
        }
        #advCourseFetchDetails td:nth-child(1) { width: 110px; }
        #advCourseFetchDetails td:nth-child(2) { width: 150px; }
        #advCourseFetchDetails td {
            padding: 2px 8px 2px 0;
            border-bottom: 1px solid #eaeef2;
            vertical-align: top;
        }
        #advCourseFetchDetails td.k {
            font-weight: 600;
            overflow-wrap: anywhere;
        }
        #advCourseFetchDetails .adv-chip {
            display: inline-block;
            padding: 0 6px;
            margin: 0 4px 2px 0;
            border-radius: 999px;
            background: #eef1f4;
            font-size: 11px;
        }
        #advCourseFetchDetails .adv-chip.full { background: #ffebe9; color: #a40e26; }
        #advCourseFetchDetails .adv-chip.open { background: #dafbe1; color: #116329; }
        #advCourseFetchDetails .adv-chip.new  { background: #ddf4ff; color: #0550ae; }
        #advCourseFetchStatus.changed {
            color: #003e7e;
            font-weight: 600;
        }
        #advCourseFetchStatus.error {
            color: #cf222e;
            font-weight: 600;
            cursor: help;
        }
        @keyframes advFlash {
            from { background-color: #fff3b0; }
            to   { background-color: transparent; }
        }
        #courseList td.adv-changed {
            animation: advFlash 3s ease-out;
        }
        #courseList tbody tr[data-search-hidden="true"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

/* ── search bar + sort dropdown ────────────────────────────── */

// The portal already has its own search box (<input id="searchText">). Instead
// of showing a second one, we TAKE THAT ONE OVER: the portal's own search
// handlers are silenced and typing in it filters the list with OUR matching.
// If the portal box isn't on the page we fall back to injecting our own input.
const PORTAL_INPUT_ID = "searchText";
const PORTAL_INPUT_SIZE = 24; // portal ships it as size="10"; set to 0 to leave the width alone
const SEARCH_PLACEHOLDER = "Search course / faculty / day (e.g. eng103.6 MW dummy)";
const CLAIMED_EVENTS = ["keydown", "keypress", "keyup", "input", "change"];

// Filtering waits until typing has paused for this long. Each pass re-lays-out a
// ~4000-row table (measured in Chromium: ~10-50 ms per pass while narrowing,
// ~200 ms when many rows come back, e.g. clearing the box or backspacing), so
// filtering on every keystroke is wasted work. Enter searches immediately;
// Escape and the Clear button never wait.
const SEARCH_DEBOUNCE_MS = 700;

let claimHandler = null;               // window-level capture listener (only one at a time)
const decoratedInputs = new WeakSet(); // portal inputs we've already restyled

export function addCourseSearchBar() {
    if (document.getElementById("advCourseSearchContainer")) return;

    const offeredCoursesDiv = document.getElementById("offeredCourses");
    if (!offeredCoursesDiv || !offeredCoursesDiv.parentNode) return;

    const portalMode = Boolean(document.getElementById(PORTAL_INPUT_ID));

    const ownInputRow = `
        <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span style="position: absolute; left: 10px; font-size: 13px; color: #656d76; pointer-events: none;">🔍</span>
            <input type="text" id="advCourseSearchInput" placeholder="${SEARCH_PLACEHOLDER}" />
            <button id="advCourseSearchClear" type="button" title="Clear search">✕</button>
        </div>`;
    const inlineClear = `<button id="advCourseSearchClear" type="button" title="Clear search">✕ Clear</button>`;

    const searchContainer = document.createElement("div");
    searchContainer.id = "advCourseSearchContainer";
    searchContainer.innerHTML = `
        ${portalMode ? "" : ownInputRow}
        <div id="advCourseSearchFooter">
            <div id="advCourseSearchInfo">
                <button id="advCourseFetchBtn" type="button" title="Fetch the latest seat counts and update only the cells that changed">↻ Fetch updates</button>
                <span id="advCourseFetchStatus"></span>
                <div id="advCourseSearchCount"></div>
                ${portalMode ? inlineClear : ""}
            </div>
            <select id="advCourseSortSelect" title="Sort results">
                <option value="">Sort: default</option>
                <option value="section">Section (asc)</option>
                <option value="day">Day (A → MW)</option>
                <option value="seats">Open seats (most first)</option>
                <option value="faculty">Faculty (A–Z)</option>
            </select>
        </div>
        <div id="advCourseFetchDetails" hidden></div>
    `;

    offeredCoursesDiv.parentNode.insertBefore(searchContainer, offeredCoursesDiv);

    const ownInput = searchContainer.querySelector("#advCourseSearchInput"); // null in portal mode
    const clearBtn = searchContainer.querySelector("#advCourseSearchClear");
    const countDiv = searchContainer.querySelector("#advCourseSearchCount");
    const sortSelect = searchContainer.querySelector("#advCourseSortSelect");
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
        for (const row of rows) {
            if (row.dataset.origIndex === undefined) {
                row.dataset.origIndex = String(origCounter++);
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
        ensureOrigIndexes(rows);

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
        ensureOrigIndexes(rows);

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
            renderUpdateDetails(detailsPanel, lastUpdate, hideDetails); // built only when opened
            detailsPanel.hidden = false;
            fetchStatus.setAttribute("aria-expanded", "true");
        };
        const toggleDetails = () => {
            if (!lastUpdate) return;
            if (detailsPanel.hidden) showDetails();
            else hideDetails();
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

        fetchBtn.addEventListener("click", async () => {
            if (fetching) return;
            fetching = true;
            fetchBtn.disabled = true;
            fetchBtn.textContent = "↻ Fetching…";
            lastUpdate = null;
            hideDetails();
            setStatus("");
            try {
                const result = await fetchCourseUpdates();
                const total = result.total;
                lastUpdate = { kind: "changes", at: Date.now(), result };
                if (total) {
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
                fetchBtn.textContent = "↻ Fetch updates";
            }
        });
    }

    if (sortSelect) {
        // Sorting never changes which rows match, so no filter pass needed.
        sortSelect.addEventListener("change", applySortOrder);
    }

    // Exposed so the injector can re-apply the user's current sort + filter
    // after the portal re-renders rows (otherwise new rows appear unsorted
    // and unfiltered while the dropdown/search box still show the old state).
    viewApi = {
        refresh() {
            decoratePortalInput();
            if (sortSelect && sortSelect.value) applySortOrder();
            applyFilterOnly();
        },
    };
}

/* ── advSlip: add a "Faculty" column between Credit and Time ────
   The slip mixes single cells and colspans (fee rows, total row, blank
   separators), so instead of inserting a <td> blindly we treat the table as
   a grid and insert a column after grid column 2 ("Credit"):
     - a cell that ENDS at that column      -> a new cell is added after it
     - a cell that SPANS over that boundary -> its colspan grows by 1
   Every row therefore still adds up to the same number of columns.          */
const SLIP_ID = "advSlip";
const SLIP_CREDIT_COL = 2;      // 0-based grid column of "Credit"
const SLIP_FACULTY_WIDTH = 60;  // px; taken from the Time column so the table doesn't grow

let slipObservers = [];
let watchedSlip = null;

function insertSlipColumn(row, makeCell) {
    let col = 0;
    for (const cell of Array.from(row.cells)) {
        const span = cell.colSpan || 1;
        const end = col + span - 1;
        if (end >= SLIP_CREDIT_COL) {
            if (end === SLIP_CREDIT_COL) cell.after(makeCell(cell));
            else cell.colSpan = span + 1;
            return;
        }
        col += span;
    }
}

export function injectSlipFaculty(metaMap) {
    const slip = document.getElementById(SLIP_ID);
    if (!slip || !metaMap) return 0;

    let rowsChanged = 0;
    for (const row of slip.querySelectorAll("table.slip tr")) {
        // Per-row marker: a row the portal re-renders is new and unmarked, so
        // it gets handled; rows we already did are never touched twice.
        if (row.dataset.advFaculty === "1") continue;
        row.dataset.advFaculty = "1";

        const label = textOf(row.cells[1]);
        const isTitleRow = textOf(row.cells[2]).toLowerCase() === "credit";
        const isCourseRow = row.cells.length >= 6 && /^\S+\.\S+$/.test(label);

        if (isTitleRow) {
            insertSlipColumn(row, (creditCell) => {
                const th = creditCell.cloneNode(false);
                th.textContent = "Faculty";
                th.style.whiteSpace = "nowrap";
                return th;
            });
        } else if (isCourseRow) {
            const meta = metaMap.get(label.toUpperCase());
            const faculty = (meta && meta.faculty) || "-";

            // keep the overall width: give the new column's width to Time
            const timeCell = row.cells[3];
            const timeWidth = parseInt(timeCell.getAttribute("width"), 10);
            if (timeWidth > SLIP_FACULTY_WIDTH + 100) {
                timeCell.setAttribute("width", String(timeWidth - SLIP_FACULTY_WIDTH));
            }

            insertSlipColumn(row, (creditCell) => {
                const td = creditCell.cloneNode(false); // inherits class="slipcol"
                td.setAttribute("width", String(SLIP_FACULTY_WIDTH));
                td.textContent = faculty;
                td.title = `Faculty: ${faculty}`;
                td.style.whiteSpace = "nowrap";
                return td;
            });
        } else {
            // fee rows, total row, blank separators: keep the grid aligned
            insertSlipColumn(row, () => document.createElement("td"));
        }
        rowsChanged++;
    }

    watchSlip();
    return rowsChanged;
}

// The portal re-renders the slip itself when you add/remove a course (and
// after Auto Save). Watch for that and add the column again. Cheap: the slip
// is ~20 rows, and a pass over already-done rows makes zero DOM writes, so our
// own edits can't set off a loop.
function watchSlip() {
    const slip = document.getElementById(SLIP_ID);
    if (!slip || slip === watchedSlip) return;

    slipObservers.forEach((o) => o.disconnect());
    slipObservers = [];
    watchedSlip = slip;

    const reinject = () => {
        loadMetaMap().then((map) => {
            if (map) injectSlipFaculty(map); // also re-attaches if #advSlip itself was replaced
        });
    };

    const inner = new MutationObserver(reinject);
    inner.observe(slip, { childList: true, subtree: true });
    slipObservers.push(inner);

    if (slip.parentNode) {
        const outer = new MutationObserver(reinject);
        outer.observe(slip.parentNode, { childList: true });
        slipObservers.push(outer);
    }
}

/* ── the "N changes" details panel ─────────────────────────────
   Clicking the total beside the Fetch button shows everything about the last
   fetch. Built lazily (only when opened) and only from text nodes — the text
   comes from the portal, so it never goes through innerHTML.               */
let detailsDocHandlers = null;   // document-level close handlers (one set at a time)

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

/* ── incremental refresh ("Fetch updates") ─────────────────────
   Instead of reloading the page (and re-rendering ~4000 rows), fetch the
   fresh list, parse it into an INERT document (no layout, no painting),
   compare it with the live table and touch only what changed.

   How to ask the portal for the list. Default: GET the current page and read
   #courseList out of the HTML. If the list is loaded by a separate request
   (DevTools → Network, while the page loads or while you type in the portal
   search), put that URL / method / body here. A response that is only <tr>
   rows (no <table>) is fine too.                                          */
const COURSE_LIST_REQUEST = {
    url: null,       // null = this page's URL
    method: "GET",
    body: null,      // e.g. new URLSearchParams({...}).toString() for POST
    headers: {},     // e.g. { "Content-Type": "application/x-www-form-urlencoded" }
};

// content.js listens for this to re-run automation on the fresh data.
export const LIST_UPDATED_EVENT = "advisingdaddy:list-updated";

// Refuse to apply a response that has fewer than this fraction of the current
// rows — it's almost certainly a login page, an error page or a partial list,
// and applying it would wrongly delete rows.
const MIN_ROWS_FRACTION = 0.5;

function rowKey(cell) {
    const text = textOf(cell);
    const i = text.lastIndexOf(".");
    if (i === -1) return null;
    return `${text.substring(0, i).trim().toUpperCase()}.${text.substring(i + 1).trim()}`;
}

async function fetchCourseListDocument() {
    const req = COURSE_LIST_REQUEST;
    const res = await fetch(req.url || window.location.href, {
        method: req.method || "GET",
        body: req.body || undefined,
        headers: req.headers || {},
        credentials: "same-origin",
        cache: "no-store",
    });
    if (!res.ok) throw new Error(`server answered ${res.status}`);

    const text = await res.text();
    const html = /<table[\s>]/i.test(text)
        ? text
        : `<table id="${COURSE_TABLE_ID}"><tbody>${text}</tbody></table>`;
    return new DOMParser().parseFromString(html, "text/html");
}

// Seat text is "occupied(capacity)", e.g. "5(40)". Both numbers are compared
// separately, so a capacity change (5(40) -> 5(45)) is caught and reported
// just like an occupied change (5(40) -> 6(40)). Text that doesn't parse
// (e.g. "Closed") still counts as a change, just without the per-number detail.
function parseSeatText(text) {
    const m = String(text || "").trim().match(/^(\d+)\s*\(\s*(\d+)\s*\)$/);
    return m ? { occupied: parseInt(m[1], 10), capacity: parseInt(m[2], 10) } : null;
}

function describeSeatChange(from, to) {
    const a = parseSeatText(from);
    const b = parseSeatText(to);
    if (!a || !b) return { occupied: null, capacity: null, becameFull: false, reopened: false };

    // Same rule automation.js uses: a seat is available while occupied < capacity.
    const wasFull = a.occupied >= a.capacity;
    const isFull = b.occupied >= b.capacity;
    return {
        occupied: a.occupied !== b.occupied ? [a.occupied, b.occupied] : null,
        capacity: a.capacity !== b.capacity ? [a.capacity, b.capacity] : null,
        becameFull: !wasFull && isFull,
        reopened: wasFull && !isFull,
    };
}

// The injector strips these two from the portal's own cells on purpose
// (layout), so a re-rendered cell must not get them back.
const LAYOUT_ATTRS_WE_STRIP = ["width", "align"];

// Make a ROW's attributes match the fetched row's (id, cstatN class), leaving
// alone anything that only exists on the live row: our data-* markers, and the
// inline `style` the portal's own script writes when you add a course
// (addNewCourses highlights the row's background) - the server never sends it,
// so treating it as "stale" would wipe the highlight.
function syncRowAttributes(liveRow, freshRow) {
    for (const attr of Array.from(freshRow.attributes)) {
        if (attr.name === "style") continue;
        if (liveRow.getAttribute(attr.name) !== attr.value) liveRow.setAttribute(attr.name, attr.value);
    }
    for (const attr of Array.from(liveRow.attributes)) {
        if (freshRow.hasAttribute(attr.name) || attr.name === "style" || attr.name.startsWith("data-")) continue;
        liveRow.removeAttribute(attr.name);
    }
}

// Re-render a row as the portal's server drew it: the row (id + cstatN class)
// and the portal's own cells (course + seats, with their onclick). Our injected
// cells and data-* markers stay. Nothing here is hard-coded to particular class
// names or status values: whatever the server sends is what the row becomes.
function rerenderRow(live, fresh) {
    syncRowAttributes(live, fresh);

    for (let i = 0; i < 2; i++) {
        const liveCell = live.cells[i];
        const freshCell = fresh.cells[i];
        if (!liveCell || !freshCell) continue;

        // These cells carry inline onclick="addNewCourses(..., status)". Never
        // change that attribute IN PLACE from an extension: Chrome keeps the old
        // handler and adds a second one, so a single click runs the portal's
        // function twice - once with the old arguments, once with the new
        // (reproduced in a real browser). A brand-new element has no old handler,
        // so the cell is replaced instead of edited.
        const replacement = document.importNode(freshCell, true);
        LAYOUT_ATTRS_WE_STRIP.forEach((name) => replacement.removeAttribute(name));
        if (liveCell.hasAttribute("style")) {
            replacement.setAttribute("style", liveCell.getAttribute("style")); // portal-managed
        }
        liveCell.replaceWith(replacement);
    }
}

export async function fetchCourseUpdates() {
    let t = performance.now();
    const doc = await fetchCourseListDocument();
    lap("fetch + parse", t);

    const freshTable = doc.getElementById(COURSE_TABLE_ID);
    const freshRows = freshTable
        ? Array.from(freshTable.querySelectorAll("tbody tr")).filter((r) => r.cells.length >= 2)
        : [];

    const table = document.getElementById(COURSE_TABLE_ID);
    const tbody = table && table.querySelector("tbody");
    if (!tbody) throw new Error("course list is not on this page");

    const liveRows = Array.from(tbody.rows).filter((r) => r.cells.length >= 2);

    if (freshRows.length === 0) {
        throw new Error("response has no course rows (session expired, or the list comes from a different request)");
    }
    if (freshRows.length < liveRows.length * MIN_ROWS_FRACTION) {
        throw new Error(`response has only ${freshRows.length} rows vs ${liveRows.length} on the page — not applying`);
    }

    /* READ / DIFF — no DOM writes yet. Row cells only: course + seats. */
    t = performance.now();
    const liveByKey = new Map();
    for (const row of liveRows) {
        const key = rowKey(row.cells[0]);
        if (key) liveByKey.set(key, row);
    }

    const seen = new Set();
    const changes = [];
    const newRows = [];
    for (const fresh of freshRows) {
        const key = rowKey(fresh.cells[0]);
        if (!key) continue;
        seen.add(key);

        const live = liveByKey.get(key);
        if (!live) {
            newRows.push(fresh);
            continue;
        }
        const from = textOf(live.cells[1]);
        const to = textOf(fresh.cells[1]);
        if (from === to) continue;
        changes.push({ key, from, to, live, fresh, ...describeSeatChange(from, to) });
    }

    const removedRows = [];
    for (const [key, row] of liveByKey) {
        if (!seen.has(key)) removedRows.push(row);
    }
    lap(`diff (${liveRows.length} live vs ${freshRows.length} fetched)`, t);

    /* WRITE — only the rows/cells that actually differ. */
    t = performance.now();
    for (const { live, fresh } of changes) {
        // Any seat or capacity change: redraw the row exactly as the portal's
        // server drew it. That refreshes the row's class (cstat0 = seats
        // available, cstat1 = full, ...) AND the arguments inside the cells'
        // onclick="addNewCourses(..., capacity, occupied, flag)", which the
        // portal (and Auto Save) use when the course is clicked.
        rerenderRow(live, fresh);

        const cell = live.cells[1];
        live.dataset.seats = textOf(cell);
        cell.classList.add("adv-changed");
        cell.addEventListener("animationend", () => cell.classList.remove("adv-changed"), { once: true });
    }

    if (newRows.length) {
        const frag = document.createDocumentFragment();
        for (const row of newRows) frag.appendChild(document.importNode(row, true));
        tbody.appendChild(frag);
    }
    removedRows.forEach((row) => row.remove());
    lap(`patch (${changes.length} changed, ${newRows.length} new, ${removedRows.length} removed)`, t);

    // Adds metadata cells to any row that doesn't have them yet (the new rows,
    // or rows the portal re-rendered on its own) and re-applies sort/filter.
    t = performance.now();
    await injectSavedCourseMetadata();
    if (changes.length && !newRows.length && viewApi) viewApi.refresh();
    lap("inject new rows + refresh view", t);

    return {
        changed: changes.length,
        added: newRows.length,
        removed: removedRows.length,
        total: changes.length + newRows.length + removedRows.length,
        occupiedChanged: changes.filter((c) => c.occupied).length,
        capacityChanged: changes.filter((c) => c.capacity).length,
        becameFull: changes.filter((c) => c.becameFull).length,
        reopened: changes.filter((c) => c.reopened).length,
        changes: changes.map(({ key, from, to, occupied, capacity, becameFull, reopened }) => ({ key, from, to, occupied, capacity, becameFull, reopened })),
        newSections: newRows.map((row) => ({ key: rowKey(row.cells[0]), seats: textOf(row.cells[1]) })),
        removedSections: removedRows.map((row) => rowKey(row.cells[0])),
    };
}

/* ── metadata injection ───────────────────────────────────── */
export async function injectSavedCourseMetadata() {
    if (!document.getElementById(COURSE_TABLE_ID) && !document.getElementById(SLIP_ID)) return;

    // Check for saved metadata FIRST before touching the portal DOM.
    // (Cached — storage is only re-read after it actually changes.)
    let t = performance.now();
    const metaMap = await loadMetaMap();
    lap(`storage read (${metaMap ? metaMap.size : 0} saved sections)`, t);
    if (!metaMap) return;
    const tTotal = performance.now();

    // The slip is tiny, so do it first: the Faculty column shows up
    // immediately instead of waiting for the big table below.
    try {
        t = performance.now();
        injectSlipFaculty(metaMap);
        lap("slip faculty column", t);
    } catch (err) {
        console.error("AdvisingDaddy: slip faculty column failed:", err);
    }

    // Re-query: the portal may have swapped the table while we awaited.
    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return;

    t = performance.now();
    applyAdvisingLayoutStyles();
    addCourseSearchBar();
    lap("styles + search bar", t);

    t = performance.now();
    let thead = table.querySelector("thead");
    if (!thead) {
        thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th style="width: 85px; text-align: left; padding-left: 6px;">Course</th>
                <th style="width: 60px; text-align: center;">Seats</th>
                <th style="width: 55px; text-align: center;">Faculty</th>
                <th style="width: 40px; text-align: center;">Day</th>
                <th style="width: 155px; text-align: center;">Time</th>
                <th style="width: 65px; text-align: center;">Room</th>
            </tr>
        `;
        table.insertBefore(thead, table.firstChild);
    }

    // One delegated click handler instead of 4 listeners per row.
    if (!boundTables.has(table)) {
        boundTables.add(table);
        table.addEventListener("click", (e) => {
            const cell = e.target && e.target.closest
                ? e.target.closest(".injected-meta-cell")
                : null;
            if (!cell || !cell.parentElement) return;
            const first = cell.parentElement.querySelector("td");
            if (first) first.click();
        });
    }

    lap("thead + click handler", t);

    t = performance.now();
    const rows = Array.from(table.querySelectorAll("tbody tr"));

    /* PHASE 1 — READ everything first (no DOM writes in this loop). */
    const pending = [];
    for (const row of rows) {
        if (row.getAttribute("data-injected-meta") === "true") continue;

        const tds = row.querySelectorAll("td");
        if (tds.length < 2) continue;

        const fullText = textOf(tds[0]);
        const splitIndex = fullText.lastIndexOf(".");
        if (splitIndex === -1) continue;

        const courseName = fullText.substring(0, splitIndex).toUpperCase();
        const section = fullText.substring(splitIndex + 1).trim();

        pending.push({
            row,
            tds,
            key: `${courseName}.${section}`,
            seats: textOf(tds[1]),
        });
    }

    lap(`phase 1 read (${rows.length} rows, ${pending.length} to inject)`, t);

    t = performance.now();
    let fmtMs = 0;
    /* PHASE 2 — WRITE everything (no reads that depend on layout, so the
       browser lays out the table once at the end instead of once per row). */
    for (const row of rows) {
        if (row.dataset.origIndex === undefined) {
            row.dataset.origIndex = String(origCounter++);
        }
    }

    for (const { row, tds, key, seats } of pending) {
        // Remove legacy inline width and align attributes that cause unnecessary gap
        tds[0].removeAttribute("width");
        tds[1].removeAttribute("width");
        tds[1].removeAttribute("align");

        // Remove 3rd td (abouticon) if present so table has exactly 6 columns
        if (tds.length >= 3) tds[2].remove();

        const meta = metaMap.get(key);
        const faculty = (meta && meta.faculty) || "-";
        const day = (meta && meta.day) || "-";
        const tf = performance.now();
        const timeStr = formatDisplayTime(meta && meta.time);
        fmtMs += performance.now() - tf;
        const room = (meta && meta.room) || "-";

        const frag = document.createDocumentFragment();
        [
            [faculty, `Faculty: ${faculty}`],
            [day, `Day: ${day}`],
            [timeStr, `Time: ${timeStr}`],
            [room, `Room: ${room}`],
        ].forEach(([text, title]) => {
            const cell = document.createElement("td");
            cell.className = "injected-meta-cell";
            cell.textContent = text;
            cell.title = title;
            frag.appendChild(cell);
        });
        row.appendChild(frag);

        // stash searchable / sortable values on the row itself
        row.dataset.course = key;
        row.dataset.seats = seats;
        row.dataset.faculty = faculty;
        row.dataset.day = day;

        row.setAttribute("data-injected-meta", "true");
    }

    // New rows arrived → honour whatever sort/search the user already set.
    lap(`phase 2 write (formatDisplayTime alone: ${fmtMs.toFixed(1)}ms)`, t);

    t = performance.now();
    if (pending.length && viewApi) viewApi.refresh();
    lap("sort/filter refresh", t);

    if (DEBUG_TIMING) {
        t = performance.now();
        void table.offsetHeight; // forces the layout the browser would do anyway
        lap("forced layout after injection", t);
        lap("injectSavedCourseMetadata total (after storage read)", tTotal);
    }
}