// scripts/advising_table/helpers.js
// Pure utility functions — no DOM side-effects, no imports from other
// advising_table sub-modules. Safe to import from anywhere.

/* ── preferred day order for sorting ───────────────────────── */
export const DAY_ORDER = ["A", "S", "M", "T", "W", "TH", "RA", "ST", "MW"];

/* ── tiny helpers ──────────────────────────────────────────── */
export function cleanValue(value) {
    const s = (value == null ? "" : String(value)).trim();
    return s === "-" ? "" : s;
}

// textContent does NOT force a layout/reflow (innerText does).
export function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

export function compareCourse(a, b) {
    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

export function sectionOf(courseKey) {
    const c = String(courseKey || "");
    const i = c.lastIndexOf(".");
    return i === -1 ? "" : c.slice(i + 1).trim();
}

// Portal format is "occupied(total)", e.g. "5(40)" -> 35 open seats.
// (The old version returned the FIRST number, i.e. occupied seats, so
// "Seats (desc)" actually listed the fullest sections first.)
export function seatsOf(seatsText) {
    const m = String(seatsText || "").trim().match(/^(\d+)\s*\((\d+)\)$/);
    return m ? Math.max(0, parseInt(m[2], 10) - parseInt(m[1], 10)) : -1;
}

export function dayRank(day) {
    const d = String(day || "").toUpperCase().trim();
    const i = DAY_ORDER.indexOf(d);
    return i === -1 ? DAY_ORDER.length : i;
}

export function dispatchRenderProgress(progress, text = "") {
    document.dispatchEvent(
        new CustomEvent("advisingdaddy:render-progress", {
            detail: { progress, text },
        })
    );
}

