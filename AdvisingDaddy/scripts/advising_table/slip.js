// scripts/advising_table/slip.js
// Injects a "Faculty" column into the advising slip table and watches for
// portal re-renders that would need the column re-injected.

import { loadMetaMap } from "./state.js";
import { textOf } from "./helpers.js";

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
