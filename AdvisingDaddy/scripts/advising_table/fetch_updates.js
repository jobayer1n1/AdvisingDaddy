// scripts/advising_table/fetch_updates.js
// Incremental "Fetch updates": fetches the current page, diffs live vs fresh
// rows, and patches only what changed — no full page reload needed.
//
// NOTE: injectSavedCourseMetadata (metadata.js) is imported dynamically at
// call-time to avoid a parse-time circular dependency:
//   fetch_updates → metadata → search_bar → fetch_updates

import { COURSE_TABLE_ID, lap } from "./state.js";
import { textOf } from "./helpers.js";

// content.js listens for this to re-run automation on the fresh data.
export const LIST_UPDATED_EVENT = "advisingdaddy:list-updated";

/* ── how to ask the portal for the list ─────────────────────────
   Default: GET the current page and read #courseList out of the HTML.
   If the list is loaded by a separate request (DevTools → Network, while the
   page loads or while you type in the portal search), put that URL / method /
   body here. A response that is only <tr> rows (no <table>) is fine too.    */
const COURSE_LIST_REQUEST = {
    url: null,       // null = this page's URL
    method: "GET",
    body: null,      // e.g. new URLSearchParams({...}).toString() for POST
    headers: {},     // e.g. { "Content-Type": "application/x-www-form-urlencoded" }
};

// Refuse to apply a response that has fewer than this fraction of the current
// rows — it's almost certainly a login page, an error page or a partial list,
// and applying it would wrongly delete rows.
const MIN_ROWS_FRACTION = 0.5;

export function rowKey(cell) {
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
    // Dynamic import breaks the circular dependency:
    //   fetch_updates → (dynamic) metadata → search_bar → fetch_updates
    t = performance.now();
    const { injectSavedCourseMetadata } = await import("./metadata.js");
    await injectSavedCourseMetadata();

    // viewApi.refresh() for changed-only (no new rows) is called inside
    // injectSavedCourseMetadata via its own pending-check, so nothing extra needed.
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
