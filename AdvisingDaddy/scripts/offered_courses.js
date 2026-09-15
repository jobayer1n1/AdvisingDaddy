// scripts/offered_courses.js
import { parseDayFromTime, parseTimeRange } from "./time_utils.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

export const OFFERED_COURSE_TABLE_SELECTOR = "#offeredCourseTbl tbody tr";
export const OFFERED_COURSE_SAVE_KEY = "offeredCourses";
export const OFFERED_COURSE_META_KEY = "offeredCourseMeta";

/**
 * If a course cell contains a slash-separated pair (e.g. "CSE325/CSE425"),
 * split it into one row per course code. Everything else on the row
 * (section, faculty, room, day, time, seats) is duplicated.
 *
 * @param {object} row - a parsed course row
 * @returns {object[]} - one row per course code
 */
export function expandCourseRow(row) {
    if (!row || !row.course) return [];

    const parts = row.course
        .split("/")
        .map((p) => p.trim())
        .filter(Boolean);

    // Common case: single course code, nothing to split.
    if (parts.length <= 1) return [row];

    return parts.map((course) => ({ ...row, course }));
}

export function parseRowsFromElements(rows) {
    return rows
        .map((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            if (cells.length < 7) return null;

            const serial = (cells[0]?.innerText || "").trim();
            const course = (cells[1]?.innerText || "").trim();
            const section = (cells[2]?.innerText || "").trim();
            const faculty = (cells[3]?.innerText || "").trim();
            const rawTime = (cells[4]?.innerText || "").trim();
            const room = (cells[5]?.innerText || "").trim();
            const seatsAvailable = (cells[6]?.innerText || "").trim();
            const day = parseDayFromTime(rawTime);
            const time = parseTimeRange(rawTime);

            if (!course || !section) return null;

            return {
                serial,
                course,
                section,
                faculty,
                room,
                day,
                time,
                seatsAvailable
            };
        })
        .filter(Boolean)
        .flatMap(expandCourseRow);
}

export function extractFromDataTableApi() {
    return new Promise((resolve) => {
        const requestId = "aa_dt_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const timer = setTimeout(() => {
            window.removeEventListener("ADVISING_DADDY_DATATABLE_RESPONSE", handler);
            resolve(null);
        }, 1500);

        function handler(e) {
            if (e.detail && e.detail.requestId === requestId) {
                clearTimeout(timer);
                window.removeEventListener("ADVISING_DADDY_DATATABLE_RESPONSE", handler);
                resolve(e.detail.data);
            }
        }
        window.addEventListener("ADVISING_DADDY_DATATABLE_RESPONSE", handler);

        try {
            const script = document.createElement("script");
            script.src = ext.runtime.getURL("scripts/offered_bridge.js");
            script.dataset.requestId = requestId;
            script.onload = () => script.remove();
            script.onerror = () => {
                clearTimeout(timer);
                window.removeEventListener("ADVISING_DADDY_DATATABLE_RESPONSE", handler);
                script.remove();
                resolve(null);
            };
            (document.head || document.documentElement).appendChild(script);
        } catch (err) {
            clearTimeout(timer);
            window.removeEventListener("ADVISING_DADDY_DATATABLE_RESPONSE", handler);
            resolve(null);
        }
    });
}

export async function extractFromFetchedHtml() {
    try {
        if (!window.location.protocol.startsWith("http")) return null;
        const response = await fetch(window.location.href, { cache: "no-store" });
        if (!response.ok) return null;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const rows = Array.from(doc.querySelectorAll("#offeredCourseTbl tbody tr"));
        if (!rows.length) return null;
        return parseRowsFromElements(rows);
    } catch (e) {
        console.warn("Could not fetch page HTML for extraction:", e);
        return null;
    }
}

/**
 * Map a raw DataTables row (which carries `rawTime`) into a normalized
 * course object. Does NOT expand slash-separated codes — callers apply
 * `expandCourseRow` after filtering.
 */
function mapDtRow(r) {
    return {
        serial: r.serial,
        course: r.course,
        section: r.section,
        faculty: r.faculty,
        room: r.room,
        day: parseDayFromTime(r.rawTime),
        time: parseTimeRange(r.rawTime),
        seatsAvailable: r.seatsAvailable
    };
}

export async function extractAllOfferedCourseRows() {
    // 1. Try DataTables in-page API
    const dtRows = await extractFromDataTableApi();
    if (Array.isArray(dtRows) && dtRows.length > 50) {
        return dtRows
            .map(mapDtRow)
            .filter((c) => c.course && c.section)
            .flatMap(expandCourseRow);
    }

    // 2. Try fetching raw HTML (same-origin, unpaginated)
    const fetchedRows = await extractFromFetchedHtml();
    if (Array.isArray(fetchedRows) && fetchedRows.length > 50) {
        return fetchedRows; // already expanded inside parseRowsFromElements
    }

    // If DataTables had data (even if <= 50, e.g. on test HTML)
    if (Array.isArray(dtRows) && dtRows.length > 0) {
        return dtRows
            .map(mapDtRow)
            .filter((c) => c.course && c.section)
            .flatMap(expandCourseRow);
    }

    // 3. Fallback to DOM elements (already expanded inside parseRowsFromElements)
    const domRows = Array.from(document.querySelectorAll(OFFERED_COURSE_TABLE_SELECTOR));
    return parseRowsFromElements(domRows);
}

export function addOfferedCourseSaveButton() {
    const isOfferedPage = window.location.href.includes("offered_courses") || document.getElementById("offeredCourseTbl");
    if (!isOfferedPage) return;

    const filterContainer = document.querySelector(".dataTables_filter") || document.querySelector(".table-wrap");
    if (!filterContainer || document.getElementById("offeredCourseSaveButton")) return;

    // Inject scoped styles once
    if (!document.getElementById("advisingDaddySaveBtnStyles")) {
        const style = document.createElement("style");
        style.id = "advisingDaddySaveBtnStyles";
        style.textContent = `
            #offeredCourseSaveButton {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin: 0 10px 10px 0;
                padding: 7px 14px;
                border: 1px solid #003e7e;
                border-radius: 6px;
                background: #003e7e;
                color: #ffffff;
                font-size: 13px;
                font-weight: 600;
                line-height: 1;
                cursor: pointer;
                overflow: hidden;
                transition:
                    background-color 0.18s ease,
                    border-color 0.18s ease,
                    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
                    box-shadow 0.18s ease;
                will-change: transform;
            }
            #offeredCourseSaveButton:hover:not(:disabled) {
                background: #00529e;
                border-color: #00529e;
                transform: translateY(-1px);
                box-shadow: 0 4px 10px rgba(0, 62, 126, 0.25);
            }
            #offeredCourseSaveButton:active:not(:disabled) {
                transform: translateY(0) scale(0.97);
                box-shadow: 0 2px 5px rgba(0, 62, 126, 0.2);
            }
            #offeredCourseSaveButton:focus-visible {
                outline: 2px solid #4c9aff;
                outline-offset: 2px;
            }
            #offeredCourseSaveButton:disabled {
                cursor: default;
            }
            #offeredCourseSaveButton.is-success {
                background: #147a3a;
                border-color: #147a3a;
                animation: adPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            #offeredCourseSaveButton.is-error {
                background: #b3261e;
                border-color: #b3261e;
                animation: adShake 0.4s ease;
            }
            #offeredCourseSaveButton .ad-label {
                display: inline-block;
                transition: opacity 0.15s ease, transform 0.15s ease;
            }
            #offeredCourseSaveButton.is-loading .ad-label {
                opacity: 0.85;
            }
            #offeredCourseSaveButton .ad-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 14px;
                height: 14px;
                flex: 0 0 14px;
            }
            #offeredCourseSaveButton .ad-icon svg {
                width: 100%;
                height: 100%;
                display: block;
            }
            #offeredCourseSaveButton .ad-spinner {
                width: 14px;
                height: 14px;
                border-radius: 50%;
                border: 2px solid rgba(255, 255, 255, 0.35);
                border-top-color: #ffffff;
                animation: adSpin 0.7s linear infinite;
            }
            @keyframes adSpin {
                to { transform: rotate(360deg); }
            }
            @keyframes adPop {
                0%   { transform: scale(0.96); }
                60%  { transform: scale(1.04); }
                100% { transform: scale(1); }
            }
            @keyframes adShake {
                0%, 100% { transform: translateX(0); }
                20%      { transform: translateX(-4px); }
                40%      { transform: translateX(4px); }
                60%      { transform: translateX(-3px); }
                80%      { transform: translateX(3px); }
            }
            @media (prefers-reduced-motion: reduce) {
                #offeredCourseSaveButton,
                #offeredCourseSaveButton .ad-label,
                #offeredCourseSaveButton .ad-spinner {
                    transition: none !important;
                    animation: none !important;
                }
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    const saveBtn = document.createElement("button");
    saveBtn.id = "offeredCourseSaveButton";
    saveBtn.type = "button";
    saveBtn.title = "Save Course List";
    saveBtn.setAttribute("aria-label", "Save Course List");
    saveBtn.setAttribute("aria-live", "polite");

    const ICONS = {
        save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
        check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    };

    const setState = (state, label) => {
        saveBtn.classList.remove("is-loading", "is-success", "is-error");
        if (state === "loading") {
            saveBtn.classList.add("is-loading");
            saveBtn.innerHTML = `<span class="ad-icon"><span class="ad-spinner"></span></span><span class="ad-label">${label}</span>`;
        } else {
            const icon = state === "success" ? ICONS.check : state === "error" ? ICONS.error : ICONS.save;
            if (state === "success") saveBtn.classList.add("is-success");
            if (state === "error") saveBtn.classList.add("is-error");
            saveBtn.innerHTML = `<span class="ad-icon">${icon}</span><span class="ad-label">${label}</span>`;
        }
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    setState("idle", "Save Course Metadata");

    saveBtn.addEventListener("click", async () => {
        saveBtn.disabled = true;
        setState("loading", "Saving...");

        try {
            const rows = await extractAllOfferedCourseRows();
            const payload = {
                source: window.location.href,
                savedAt: new Date().toISOString(),
                courseCount: rows.length,
                courses: rows
            };

            await ext.storage.local.set({
                [OFFERED_COURSE_SAVE_KEY]: rows,
                [OFFERED_COURSE_META_KEY]: {
                    source: payload.source,
                    savedAt: payload.savedAt,
                    courseCount: payload.courseCount
                }
            });

            // Brief pause so the spinner reads as intentional, not a flash.
            await sleep(250);
            setState("success", `Saved (${rows.length})`);
            await sleep(2200);
            setState("idle", "Save Course Metadata");
            saveBtn.disabled = false;
        } catch (err) {
            console.error("Failed to save offered courses:", err);
            await sleep(150);
            setState("error", "Save Failed");
            await sleep(1800);
            setState("idle", "Save Course Metadata");
            saveBtn.disabled = false;
        }
    });

    filterContainer.prepend(saveBtn);
}