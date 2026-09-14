// templates/planner_state.js
// Mutable application state and chrome.storage helpers.
// Import this wherever state needs to be read or mutated.

import { getCourseNameOptions } from "./planner_utils.js";

export const ext = typeof browser !== "undefined" ? browser : chrome;

// ── Mutable state ─────────────────────────────────────────────────────────────

/** Mirrors chrome.storage.local "advisingPriorities": [{name, sections}] */
export let plan = [];

/** Full list of saved offered-course objects loaded from storage */
export let allCourses = [];

/** Currently active sort mode — set by the sort strip */
export let currentSort = null;

export let visibleLimit = 10;

/**
 * Lazily assigned in init() once the search input element exists.
 * Returns the filtered + sorted + (optionally) limited rows to display.
 * @type {() => object[]}
 */
export let getDisplayData = () => [];

// ── State mutators ────────────────────────────────────────────────────────────

/** Replace plan array reference (use when clearing entirely) */
export function setPlan(newPlan) { plan = newPlan; }

/** Replace allCourses (called once during init) */
export function setAllCourses(courses) { allCourses = courses; }

/** Update the active sort mode */
export function setCurrentSort(mode) { currentSort = mode; }

export function setVisibleLimit(limit) { visibleLimit = limit; }

/** Bind the getDisplayData function (called in init after DOM is ready) */
export function setGetDisplayData(fn) { getDisplayData = fn; }

// ── Storage helpers ───────────────────────────────────────────────────────────

/** Persist the current plan to chrome.storage.local */
export async function savePlan() {
    await ext.storage.local.set({ advisingPriorities: plan });
}

function courseMatchesPlanName(courseName, planName) {
    const normalizedPlanName = (planName || "").toUpperCase();
    return getCourseNameOptions(courseName).includes(normalizedPlanName);
}

/** True if the given course+section is already queued in the plan */
export function isInPlan(courseName, section) {
    const normalizedCourseName = (courseName || "").toUpperCase();
    const entry = plan.find(p => p.name === normalizedCourseName || courseMatchesPlanName(courseName, p.name));
    return entry ? entry.sections.includes(String(section)) : false;
}

/**
 * Expand the plan into full course objects by cross-referencing allCourses.
 * Used by clash and same-day-final detection.
 * @returns {object[]}
 */
export function getPlannedCourseObjects() {
    const result = [];
    for (const entry of plan) {
        for (const sec of entry.sections) {
            const found = allCourses.find(c =>
                ((c.course || "").toUpperCase() === entry.name || courseMatchesPlanName(c.course, entry.name)) &&
                c.section === sec
            );
            if (found) result.push({ ...found, course: entry.name });
        }
    }
    return result;
}
