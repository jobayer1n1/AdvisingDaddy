// templates/planner_utils.js
// Pure utility functions — no DOM, no state, no browser API dependencies.

/** NSU non-lab fixed class start times (24-h HH:MM:SS) */
export const NSU_SLOTS = [
    "08:00:00", "09:40:00", "11:20:00", "13:00:00",
    "14:40:00", "16:20:00", "18:00:00", "19:40:00"
];

/** Canonical day sort order for RA / ST / MW */
export const DAY_ORDER = { RA: 0, ST: 1, MW: 2 };

/** How many rows to show when no search query is active */
export const DEFAULT_LIMIT = 10;

// ── Course type ───────────────────────────────────────────────────────────────

/** Lab courses end with the letter L (e.g. CSE332L) */
export function isLabCourse(courseName) {
    return /L$/i.test((courseName || "").trim());
}

export function getCourseNameOptions(courseName) {
    return (courseName || "")
        .toUpperCase()
        .split("/")
        .map(name => name.trim())
        .filter(Boolean);
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/** Returns the slot index (0–7) of a start time, or -1 if not a standard slot */
export function getSlotIndex(startTime) {
    return NSU_SLOTS.indexOf(startTime || "");
}

/**
 * True if time range [sA, eA] overlaps [sB, eB].
 * Strings compare correctly for "HH:MM:SS" format.
 */
export function timesOverlap(timeA, timeB) {
    if (!Array.isArray(timeA) || timeA.length < 2) return false;
    if (!Array.isArray(timeB) || timeB.length < 2) return false;
    return timeA[0] < timeB[1] && timeB[0] < timeA[1];
}

/** Convert a 24-h "HH:MM:SS" token to "hh:mm AM/PM" */
function toAmPm(t) {
    if (!t) return "";
    const [h, m] = t.split(":");
    let hr = parseInt(h, 10);
    const period = hr >= 12 ? "PM" : "AM";
    if (hr === 0) hr = 12;
    else if (hr > 12) hr -= 12;
    return `${String(hr).padStart(2, "0")}:${m} ${period}`;
}

/** Format a [start, end] time array to human-readable "hh:mm AM – hh:mm PM" */
export function formatTimeDisplay(timeArr) {
    if (!Array.isArray(timeArr) || timeArr.length < 2) return "—";
    return `${toAmPm(timeArr[0])} – ${toAmPm(timeArr[1])}`;
}

// ── Search ────────────────────────────────────────────────────────────────────

/**
 * Parse search query into { course, section }.
 *   "cse331.1" → { course: "cse331", section: "1" }
 *   "cse331"   → { course: "cse331", section: null }
 */
export function parseQuery(q) {
    const trimmed = (q || "").trim().toLowerCase();
    const dotIdx = trimmed.indexOf(".");
    if (dotIdx !== -1) {
        return {
            course: trimmed.slice(0, dotIdx),
            section: trimmed.slice(dotIdx + 1)
        };
    }
    return { course: trimmed, section: null };
}

/**
 * Filter a course array by a search query string.
 * Dot notation (cse331.1) filters on both course AND section.
 * Single token filters across all fields.
 */
export function filterCourses(data, q) {
    const tokens = (q || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return data;

    return data.filter(c => tokens.every(token => {
        const { course, section } = parseQuery(token);
        if (section !== null) {
            return (c.course || "").toLowerCase().includes(course) &&
                (c.section || "").toLowerCase().includes(section);
        }
        return (c.course || "").toLowerCase().includes(course) ||
            (c.faculty || "").toLowerCase().includes(course) ||
            (c.room || "").toLowerCase().includes(course) ||
            (c.section || "").toLowerCase().includes(course) ||
            (c.day || "").toLowerCase().includes(course);
    }));
}

// ── Sort ──────────────────────────────────────────────────────────────────────

/**
 * Sort a course array by one of four modes.
 * Always returns a new array; the input is not mutated.
 * @param {"section"|"faculty"|"day"|"seats"|null} mode
 */
export function sortCourses(data, mode) {
    if (!mode) return data;
    const copy = [...data];
    if (mode === "section") {
        copy.sort((a, b) => parseInt(a.section || 0) - parseInt(b.section || 0));
    } else if (mode === "faculty") {
        copy.sort((a, b) => (a.faculty || "").localeCompare(b.faculty || ""));
    } else if (mode === "day") {
        copy.sort((a, b) => {
            const da = DAY_ORDER[a.day] ?? 99;
            const db = DAY_ORDER[b.day] ?? 99;
            return da - db;
        });
    } else if (mode === "seats") {
        copy.sort((a, b) => parseInt(b.seatsAvailable || 0) - parseInt(a.seatsAvailable || 0));
    }
    return copy;
}

// ── Clash / Same-day-final detection ─────────────────────────────────────────

/**
 * Returns labels of planned sections that time-clash with the given row.
 * @param {object} row - Course row being checked
 * @param {object[]} plannedObjects - Full course objects of all planned sections
 * @returns {string[]} e.g. ["CSE331.1", "CSE327.2"]
 */
export function getClashInfo(row, plannedObjects) {
    const clashes = [];
    for (const p of plannedObjects) {
        if (p.course === row.course && p.section === row.section) continue;
        if (p.day && row.day && p.day === row.day && timesOverlap(row.time, p.time)) {
            clashes.push(`${p.course}.${p.section}`);
        }
    }
    return clashes;
}

/**
 * Returns labels of planned (non-lab) sections that share a same-day final
 * with the given (non-lab) row. Two courses have a same-day final when they
 * are on the same day and their NSU slot indices differ by an odd number.
 * Lab courses (name ending in L) are excluded from both sides.
 * @param {object} row - Course row being checked
 * @param {object[]} plannedObjects - Full course objects of all planned sections
 * @returns {string[]}
 */
export function getSameDayFinalInfo(row, plannedObjects) {
    if (isLabCourse(row.course)) return [];
    const rowStart = Array.isArray(row.time) ? row.time[0] : null;
    const rowIdx = getSlotIndex(rowStart);
    if (rowIdx === -1) return [];

    const warnings = [];
    for (const p of plannedObjects) {
        if (isLabCourse(p.course)) continue;
        if (p.course === row.course && p.section === row.section) continue;
        if (!p.day || !row.day || p.day !== row.day) continue;
        const pStart = Array.isArray(p.time) ? p.time[0] : null;
        const pIdx = getSlotIndex(pStart);
        if (pIdx === -1) continue;
        if (Math.abs(rowIdx - pIdx) % 2 === 1) {
            warnings.push(`${p.course}.${p.section}`);
        }
    }
    return warnings;
}
