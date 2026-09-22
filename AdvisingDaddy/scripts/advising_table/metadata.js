// scripts/advising_table/metadata.js
// Main orchestrator: reads saved course metadata from storage and injects
// Faculty / Day / Time / Room columns into the advising table, then triggers
// the search bar and slip Faculty column.

import { formatDisplayTime } from "../time_utils.js";
import {
    COURSE_TABLE_ID,
    DEBUG_TIMING,
    lap,
    loadMetaMap,
    nextOrigIndex,
    boundTables,
    viewApi,
} from "./state.js";
import { textOf } from "./helpers.js";
import { applyAdvisingLayoutStyles } from "./styles.js";
import { injectSlipFaculty } from "./slip.js";
import { addCourseSearchBar } from "./search_bar.js";

/* ── metadata injection ───────────────────────────────────── */
export async function injectSavedCourseMetadata() {
    if (!document.getElementById(COURSE_TABLE_ID) && !document.getElementById("advSlip")) return;

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
            row.dataset.origIndex = String(nextOrigIndex());
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
    // `viewApi` is a live ES-module binding from state.js — it reflects whatever
    // addCourseSearchBar() stored via setViewApi() above.
    if (pending.length && viewApi) viewApi.refresh();
    lap("sort/filter refresh", t);

    if (DEBUG_TIMING) {
        t = performance.now();
        void table.offsetHeight; // forces the layout the browser would do anyway
        lap("forced layout after injection", t);
        lap("injectSavedCourseMetadata total (after storage read)", tTotal);
    }
}
