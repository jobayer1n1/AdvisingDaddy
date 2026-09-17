// templates/planner_utils.js
// Pure utility functions — no DOM, no state, no browser API dependencies.

/** NSU non-lab fixed class start times (24-h HH:MM:SS) */
export const NSU_SLOTS = [
    "08:00:00", "09:40:00", "11:20:00", "13:00:00",
    "14:40:00", "16:20:00", "18:00:00", "19:40:00"
];

/**
 * Canonical day sort order.
 * Single-letter days follow the NSU week (Sat → Fri), then the
 * two-day recurring patterns RA / ST / MW.
 */
export const DAY_ORDER_LIST = ["A", "S", "M", "T", "W", "R", "F", "RA", "ST", "MW"];
export const DAY_ORDER = DAY_ORDER_LIST.reduce((acc, day, idx) => {
    acc[day] = idx;
    return acc;
}, {});

/** Allowed canonical single-day codes in NSU */
export const VALID_DAYS = ["A", "S", "M", "T", "W", "R", "F"];

/**
 * Splits a day string into an array of canonical single days: A, S, M, T, W, R, F.
 * Combinations of two (e.g. "MW", "ST", "RA") are split into individual days.
 * @param {string} dayStr e.g. "MW" -> ["M", "W"], "W" -> ["W"]
 * @returns {string[]}
 */
export function splitDays(dayStr) {
    if (!dayStr) return [];
    let normalized = String(dayStr).toUpperCase().trim();
    normalized = normalized.replace(/TH/g, "R");

    const days = [];
    for (const ch of normalized) {
        if (VALID_DAYS.includes(ch) && !days.includes(ch)) {
            days.push(ch);
        }
    }
    return days;
}

/**
 * True if two day strings share at least one common day.
 * E.g. "MW" and "W" share "W", "MW" and "MW" share "M" & "W", "MW" and "ST" share none.
 * @param {string} dayA
 * @param {string} dayB
 * @returns {boolean}
 */
export function daysOverlap(dayA, dayB) {
    const a = splitDays(dayA);
    const b = splitDays(dayB);
    if (a.length === 0 || b.length === 0) return false;
    return a.some(day => b.includes(day));
}

/** How many rows to show when no search query is active */
export const DEFAULT_LIMIT = 10;

// ── Small safe-string helper ─────────────────────────────────────────────────

/** Coerce any value (string, number, null, undefined) to a lowercase string */
function s(val) {
    return String(val ?? "").toLowerCase();
}

// ── Course type ───────────────────────────────────────────────────────────────

/** Lab courses end with the letter L (e.g. CSE332L, or CSE332L/EEE332L) */
export function isLabCourse(courseName) {
    const options = getCourseNameOptions(courseName);
    if (options.length > 0) {
        return options.some(name => /L$/i.test(name.trim()));
    }
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
 * Parse a single search token into { course, section }.
 *   "cse331.1" → { course: "cse331", section: "1" }
 *   "cse331"   → { course: "cse331", section: null }
 *   "tnf"      → { course: "tnf",    section: null }
 *   "mw"       → { course: "mw",     section: null }
 * A token is only treated as "course.section" when it contains a dot;
 * otherwise it's a free token matched against every field (OR).
 */
export function parseQuery(q) {
    const trimmed = s(q).trim();
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
 * Filter a course array by a free-form, order-independent search query.
 *
 * The query is split on whitespace into tokens, evaluated independently,
 * and ANDed together — so token order never matters:
 *   "cse332"              → course
 *   "cse332.6"             → course AND section
 *   "tnf"                  → faculty (or any field) match
 *   "cse332.6 tnf"          → course+section AND faculty
 *   "cse332.6 mw"           → course+section AND day
 *   "cse332.6 mw tnf"       → course+section AND day AND faculty
 *   "tnf mw cse332.6"       → same as above, any order
 *
 * A token containing a dot is always parsed as course.section (AND of the
 * two). A plain token matches if it appears in ANY of course / section /
 * faculty / day / room (OR), so free tokens like faculty initials or a day
 * code can be dropped in anywhere in the query.
 */
export function filterCourses(data, q) {
    const tokens = s(q).trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return data;

    return data.filter(c => tokens.every(token => {
        const { course, section } = parseQuery(token);

        if (section !== null) {
            // "course.section" style token — both parts must match.
            const courseOk = course === "" || s(c.course).includes(course);
            const sectionOk = section === "" || s(c.section).includes(section);
            return courseOk && sectionOk;
        }

        // Free token — match against any searchable field.
        return s(c.course).includes(course) ||
            s(c.faculty).includes(course) ||
            s(c.room).includes(course) ||
            s(c.section).includes(course) ||
            s(c.day).includes(course);
    }));
}

// ── Sort ──────────────────────────────────────────────────────────────────────

/** Numeric-aware compare, falling back to string compare for non-numeric sections */
function compareSection(a, b) {
    const sa = String(a ?? "");
    const sb = String(b ?? "");
    const na = parseFloat(sa);
    const nb = parseFloat(sb);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return sa.localeCompare(sb);
}

/**
 * Sort a course array by one of four modes.
 * Always returns a new array; the input is not mutated.
 * @param {"section"|"faculty"|"day"|"seats"|null} mode
 */
export function sortCourses(data, mode) {
    if (!mode) return data;
    const copy = [...data];

    if (mode === "section") {
        copy.sort((a, b) => compareSection(a.section, b.section));
    } else if (mode === "faculty") {
        copy.sort((a, b) => s(a.faculty).localeCompare(s(b.faculty)));
    } else if (mode === "day") {
        copy.sort((a, b) => {
            const getRank = (dayStr) => {
                const upper = s(dayStr).toUpperCase().trim();
                if (DAY_ORDER[upper] !== undefined) return DAY_ORDER[upper];
                const days = splitDays(upper);
                if (days.length > 0) {
                    const firstRank = DAY_ORDER[days[0]] ?? 50;
                    const secondRank = days.length > 1 ? (DAY_ORDER[days[1]] ?? 50) : 0;
                    return 100 + firstRank * 10 + secondRank;
                }
                return Infinity;
            };
            return getRank(a.day) - getRank(b.day);
        });
    } else if (mode === "seats") {
        copy.sort((a, b) => (parseInt(b.seatsAvailable, 10) || 0) - (parseInt(a.seatsAvailable, 10) || 0));
    }
    return copy;
}

// ── Clash / Same-day-final detection ─────────────────────────────────────────

/**
 * Returns labels of planned sections that time-clash with the given row.
 * A time clash occurs when two sections share at least one class day
 * (e.g. "MW" has classes on Monday & Wednesday, clashing with Wednesday "W" at the same time)
 * and their class times overlap.
 * @param {object} row - Course row being checked
 * @param {object[]} plannedObjects - Full course objects of all planned sections
 * @returns {string[]} e.g. ["CSE331.1", "CSE327.2"]
 */
export function getClashInfo(row, plannedObjects) {
    const clashes = [];
    for (const p of plannedObjects) {
        if (p.course === row.course && p.section === row.section) continue;
        if (p.day && row.day && daysOverlap(row.day, p.day) && timesOverlap(row.time, p.time)) {
            clashes.push(`${p.course}.${p.section}`);
        }
    }
    return clashes;
}


/**
 * Returns labels of planned (non-lab) sections that share a same-day final
 * with the given (non-lab) row.
 *
 * A same-day final warning is raised when ALL of the following are true:
 *   1. Both the row and the planned course are non-lab.
 *   2. The two courses share at least one common class day
 *      (works for any combination: MW, ST, RA, M, W, S, T, R, A …).
 *   3. Their NSU slot indices differ by an odd number.
 *
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
        if (!p.day || !row.day || !daysOverlap(row.day, p.day)) continue;
        const pStart = Array.isArray(p.time) ? p.time[0] : null;
        const pIdx = getSlotIndex(pStart);
        if (pIdx === -1) continue;
        // Even non-zero slot distance → same exam day in NSU's schedule
        const dist = Math.abs(rowIdx - pIdx);
        if (dist > 0 && dist % 2 === 0) {
            warnings.push(`${p.course}.${p.section}`);
        }
    }
    return warnings;
}
