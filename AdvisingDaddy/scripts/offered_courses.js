// scripts/offered_courses.js
import { parseDayFromTime, parseTimeRange } from "./time_utils.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

export const OFFERED_COURSE_TABLE_SELECTOR = "#offeredCourseTbl tbody tr";
export const OFFERED_COURSE_SAVE_KEY = "offeredCourses";
export const OFFERED_COURSE_META_KEY = "offeredCourseMeta";

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
        .filter(Boolean);
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

export async function extractAllOfferedCourseRows() {
    // 1. Try DataTables in-page API
    const dtRows = await extractFromDataTableApi();
    if (Array.isArray(dtRows) && dtRows.length > 50) {
        return dtRows.map(r => ({
            serial: r.serial,
            course: r.course,
            section: r.section,
            faculty: r.faculty,
            room: r.room,
            day: parseDayFromTime(r.rawTime),
            time: parseTimeRange(r.rawTime),
            seatsAvailable: r.seatsAvailable
        })).filter(c => c.course && c.section);
    }

    // 2. Try fetching raw HTML (same-origin, unpaginated)
    const fetchedRows = await extractFromFetchedHtml();
    if (Array.isArray(fetchedRows) && fetchedRows.length > 50) {
        return fetchedRows;
    }

    // If DataTables had data (even if <= 50, e.g. on test HTML)
    if (Array.isArray(dtRows) && dtRows.length > 0) {
        return dtRows.map(r => ({
            serial: r.serial,
            course: r.course,
            section: r.section,
            faculty: r.faculty,
            room: r.room,
            day: parseDayFromTime(r.rawTime),
            time: parseTimeRange(r.rawTime),
            seatsAvailable: r.seatsAvailable
        })).filter(c => c.course && c.section);
    }

    // 3. Fallback to DOM elements
    const domRows = Array.from(document.querySelectorAll(OFFERED_COURSE_TABLE_SELECTOR));
    return parseRowsFromElements(domRows);
}

export function addOfferedCourseSaveButton() {
    const isOfferedPage = window.location.href.includes("offered_courses") || document.getElementById("offeredCourseTbl");
    if (!isOfferedPage) return;

    const filterContainer = document.querySelector(".dataTables_filter") || document.querySelector(".table-wrap");
    if (!filterContainer || document.getElementById("offeredCourseSaveButton")) return;

    const saveBtn = document.createElement("button");
    saveBtn.id = "offeredCourseSaveButton";
    saveBtn.type = "button";
    saveBtn.title = "Save Course List";
    saveBtn.setAttribute("aria-label", "Save Course List");
    saveBtn.innerHTML = "<span aria-hidden=\"true\"></span>AdvisingDaddy- Save Course Metadata";
    saveBtn.style.marginRight = "10px";
    saveBtn.style.marginBottom = "10px";
    saveBtn.style.padding = "6px 12px";
    saveBtn.style.border = "1px solid #003e7e";
    saveBtn.style.borderRadius = "6px";
    saveBtn.style.background = "#003e7e";
    saveBtn.style.color = "#ffffff";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "13px";
    saveBtn.style.fontWeight = "600";
    saveBtn.style.transition = "background-color 0.2s";

    saveBtn.addEventListener("click", async () => {
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = "AdvisingDaddy- Saving...";
        saveBtn.disabled = true;

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

            saveBtn.innerHTML = `AdvisingDaddy- Saved (${rows.length} courses)`;
            setTimeout(() => {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }, 2500);
        } catch (err) {
            console.error("Failed to save offered courses:", err);
            saveBtn.innerHTML = "AdvisingDaddy- Save Failed";
            setTimeout(() => {
                saveBtn.innerHTML = originalHtml;
                saveBtn.disabled = false;
            }, 2000);
        }
    });

    filterContainer.prepend(saveBtn);
}
