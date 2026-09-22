// scripts/advising_table/state.js
// Shared mutable state and the browser-extension API reference.
// Every other sub-module imports from here instead of redeclaring.

import { OFFERED_COURSE_SAVE_KEY } from "../offered_courses.js";

export const ext =
    typeof browser !== "undefined"
        ? browser
        : typeof chrome !== "undefined"
        ? chrome
        : undefined;

export const COURSE_TABLE_ID = "courseList";

// ── debug timing ──────────────────────────────────────────────
// Set to false once the slow step is found.
export const DEBUG_TIMING = true;
export const lap = (label, t0) => {
    if (DEBUG_TIMING)
        console.log(
            `AdvisingDaddy [timing] ${label}: ${(performance.now() - t0).toFixed(1)}ms`
        );
};

// ── origCounter ───────────────────────────────────────────────
// Monotonic counter: every row gets its "original position" once, when it is
// first seen, so "Sort: default" can always restore portal order — even for
// rows the portal adds after the user has already sorted.
export let origCounter = 0;
export function nextOrigIndex() {
    return origCounter++;
}

// ── metaMap cache ──────────────────────────────────────────────
// Cached saved-metadata map. Re-reading storage + rebuilding the Map on every
// call is wasteful when this function is triggered repeatedly (observers,
// UpdatePanel refreshes, etc.).
let metaMapPromise = null;

if (ext && ext.storage && ext.storage.onChanged) {
    ext.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[OFFERED_COURSE_SAVE_KEY]) {
            metaMapPromise = null; // invalidate cache
        }
    });
}

export function loadMetaMap() {
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

// ── boundTables ────────────────────────────────────────────────
// Tables that already have the delegated click handler.
export const boundTables = new WeakSet();

// ── viewApi ────────────────────────────────────────────────────
// Set by addCourseSearchBar(); lets injectSavedCourseMetadata() re-apply the
// current sort/filter after new rows arrive.
export let viewApi = null;
export function setViewApi(api) {
    viewApi = api;
}
