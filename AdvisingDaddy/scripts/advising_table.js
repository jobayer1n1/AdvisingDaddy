// scripts/advising_table.js
import { formatDisplayTime } from "./time_utils.js";
import { OFFERED_COURSE_SAVE_KEY } from "./offered_courses.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
export const COURSE_TABLE_ID = "courseList";

/* ── preferred day order for sorting ───────────────────────── */
const DAY_ORDER = ["A", "S", "M", "T", "W", "TH", "RA", "ST", "MW"];

/* ── tiny helpers ──────────────────────────────────────────── */
function cleanValue(value) {
    const s = (value == null ? "" : String(value)).trim();
    return s === "-" ? "" : s;
}

function compareCourse(a, b) {
    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: "base",
    });
}

function sectionOf(courseKey) {
    const c = String(courseKey || "");
    const i = c.lastIndexOf(".");
    return i === -1 ? "" : c.slice(i + 1).trim();
}

function seatsOf(seatsText) {
    const m = String(seatsText || "").match(/\d+/);
    return m ? parseInt(m[0], 10) : -1;
}

function dayRank(day) {
    const d = String(day || "").toUpperCase().trim();
    const i = DAY_ORDER.indexOf(d);
    return i === -1 ? DAY_ORDER.length : i;
}

/* ── styles ────────────────────────────────────────────────── */
export function applyAdvisingLayoutStyles() {
    if (document.getElementById("advising-injected-styles")) return;
    const style = document.createElement("style");
    style.id = "advising-injected-styles";
    style.textContent = `
        #mainBody {
            width: min(1240px, 98vw) !important;
        }
        #advisingframe {
            width: 100% !important;
        }
        #advisingframe .right {
            width: 540px !important;
        }
        #coursesbox {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #coursemiddlebar {
            width: 100% !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #advCourseSearchContainer {
            padding: 8px 10px 6px 10px;
            background: #ffffff;
            border-bottom: 1px solid #d0d7de;
            display: flex;
            flex-direction: column;
            gap: 3px;
            box-sizing: border-box;
            width: 100%;
        }
        #advCourseSearchInput {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 6px 28px 6px 30px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-family: inherit !important;
            outline: none !important;
            transition: border-color 0.2s, box-shadow 0.2s !important;
            background: #fdfdfd !important;
            color: #24292f !important;
        }
        #advCourseSearchInput:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.15) !important;
            background: #ffffff !important;
        }
        #advCourseSearchClear {
            position: absolute !important;
            right: 8px !important;
            background: none !important;
            border: none !important;
            color: #8c959f !important;
            font-size: 13px !important;
            cursor: pointer !important;
            display: none;
            padding: 2px 6px !important;
            line-height: 1 !important;
        }
        #advCourseSearchClear:hover {
            color: #24292f !important;
        }
        #advCourseSearchFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            min-height: 18px;
        }
        #advCourseSearchCount {
            font-size: 11px;
            color: #57606a;
            padding-left: 2px;
            display: none;
        }
        #advCourseSortSelect {
            font-size: 11px !important;
            font-family: inherit !important;
            padding: 2px 4px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 4px !important;
            background: #fdfdfd !important;
            color: #24292f !important;
            cursor: pointer !important;
            outline: none !important;
        }
        #advCourseSortSelect:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 2px rgba(0, 62, 126, 0.15) !important;
        }
        #coursemiddlebar .body, #offeredCourses {
            width: calc(100% - 10px) !important;
            height: 460px !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            margin: 5px 5px !important;
        }
        #courseList {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
        }
        #courseList thead th {
            position: sticky;
            top: 0;
            background: #003e7e;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 4px;
            text-align: center;
            z-index: 5;
            border-bottom: 2px solid #00254c;
            white-space: nowrap;
        }
        #courseList th, #courseList td {
            box-sizing: border-box !important;
            vertical-align: middle !important;
        }
        #courseList th:first-child,
        #courseList tbody td:first-child {
            width: 85px !important;
            min-width: 85px !important;
            max-width: 85px !important;
            text-align: left !important;
            padding: 4px 2px 4px 6px !important;
            font-weight: bold !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(2),
        #courseList tbody td:nth-child(2) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
            text-align: center !important;
            padding: 4px 4px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(3),
        #courseList tbody td:nth-child(3) {
            width: 55px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(4),
        #courseList tbody td:nth-child(4) {
            width: 40px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(5),
        #courseList tbody td:nth-child(5) {
            width: 155px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(6),
        #courseList tbody td:nth-child(6) {
            width: 65px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList tbody td {
            font-size: 12px !important;
            border-bottom: 1px solid #e1e4e8 !important;
            cursor: pointer;
        }
        .injected-meta-cell {
            cursor: pointer;
        }
        #courseList tbody tr[data-search-hidden="true"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

/* ── search bar + sort dropdown ────────────────────────────── */
export function addCourseSearchBar() {
    if (document.getElementById("advCourseSearchContainer")) return;

    const offeredCoursesDiv = document.getElementById("offeredCourses");
    if (!offeredCoursesDiv || !offeredCoursesDiv.parentNode) return;

    const searchContainer = document.createElement("div");
    searchContainer.id = "advCourseSearchContainer";
    searchContainer.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span style="position: absolute; left: 10px; font-size: 13px; color: #656d76; pointer-events: none;">🔍</span>
            <input type="text" id="advCourseSearchInput" placeholder="Search course / faculty / day (e.g. eng103.6 MW dummy)" />
            <button id="advCourseSearchClear" type="button" title="Clear search">✕</button>
        </div>
        <div id="advCourseSearchFooter">
            <div id="advCourseSearchCount"></div>
            <select id="advCourseSortSelect" title="Sort results">
                <option value="">Sort: default</option>
                <option value="section">Section (asc)</option>
                <option value="day">Day (A → MW)</option>
                <option value="seats">Seats (desc)</option>
                <option value="faculty">Faculty (A–Z)</option>
            </select>
        </div>
    `;

    offeredCoursesDiv.parentNode.insertBefore(searchContainer, offeredCoursesDiv);

    const input = searchContainer.querySelector("#advCourseSearchInput");
    const clearBtn = searchContainer.querySelector("#advCourseSearchClear");
    const countDiv = searchContainer.querySelector("#advCourseSearchCount");
    const sortSelect = searchContainer.querySelector("#advCourseSortSelect");

    /* ── field extraction ──────────────────────────────────── */
    function getRowFields(row) {
        const tds = row.querySelectorAll("td");
        const injected = row.getAttribute("data-injected-meta") === "true";

        if (injected) {
            return {
                course: cleanValue(row.dataset.course),
                seats: cleanValue(row.dataset.seats),
                faculty: cleanValue(row.dataset.faculty),
                day: cleanValue(row.dataset.day),
                hasCells: tds.length > 0,
            };
        }

        return {
            course: cleanValue(tds[0] ? tds[0].innerText : ""),
            seats: cleanValue(tds[1] ? tds[1].innerText : ""),
            faculty: "",
            day: "",
            hasCells: tds.length > 0,
        };
    }

    /* ── matching ──────────────────────────────────────────── */
    function rowMatches(fields, tokens) {
        if (!tokens.length) return true;

        const course = fields.course.toUpperCase();
        const faculty = fields.faculty.toUpperCase();
        const day = fields.day.toUpperCase();
        const dayParts = day.split(/[\s,/]+/);

        return tokens.every((tok) => {
            if (course.includes(tok)) return true;
            if (faculty && faculty.includes(tok)) return true;
            if (day && (day === tok || dayParts.includes(tok))) return true;
            return false;
        });
    }

    /* ── sorting ───────────────────────────────────────────── */
    function compareRows(a, b, sortKey, fieldsMap) {
        const fa = fieldsMap.get(a) || getRowFields(a);
        const fb = fieldsMap.get(b) || getRowFields(b);

        switch (sortKey) {
            case "section": {
                const c = compareCourse(
                    sectionOf(fa.course),
                    sectionOf(fb.course)
                );
                return c || compareCourse(fa.course, fb.course);
            }

            case "day": {
                const c = dayRank(fa.day) - dayRank(fb.day);
                return c || compareCourse(fa.course, fb.course);
            }

            case "seats": {
                // descending – higher number of seats first
                const c = seatsOf(fb.seats) - seatsOf(fa.seats);
                return c || compareCourse(fa.course, fb.course);
            }

            case "faculty": {
                const af = cleanValue(fa.faculty);
                const bf = cleanValue(fb.faculty);
                if (!af && bf) return 1;
                if (af && !bf) return -1;
                const c = compareCourse(af, bf);
                return c || compareCourse(fa.course, fb.course);
            }

            default:
                return 0;
        }
    }

    function origIndex(row) {
        const v = parseInt(row.dataset.origIndex, 10);
        return Number.isNaN(v) ? 0 : v;
    }

    /* ── main search + sort routine ────────────────────────── */
    function performSearch() {
        const table = document.getElementById(COURSE_TABLE_ID);
        if (!table) return;

        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const query = (input.value || "").trim();
        const tokens = query
            .toUpperCase()
            .split(/\s+/)
            .filter(Boolean);

        const rows = Array.from(tbody.querySelectorAll("tr"));

        // remember the natural order once, so "Sort: default" can restore it
        rows.forEach((row, i) => {
            if (row.dataset.origIndex === undefined) {
                row.dataset.origIndex = String(i);
            }
        });

        const fieldsMap = new Map();
        rows.forEach((row) => fieldsMap.set(row, getRowFields(row)));

        const visible = [];
        const hidden = [];

        rows.forEach((row) => {
            const f = fieldsMap.get(row);
            if (rowMatches(f, tokens)) {
                visible.push(row);
            } else {
                hidden.push(row);
            }
        });

        const sortKey = sortSelect ? sortSelect.value : "";

        if (sortKey) {
            visible.sort((a, b) => compareRows(a, b, sortKey, fieldsMap));
        } else {
            visible.sort((a, b) => origIndex(a) - origIndex(b));
        }

        hidden.sort((a, b) => origIndex(a) - origIndex(b));

        // apply visibility
        visible.forEach((row) => {
            row.style.display = "";
            row.removeAttribute("data-search-hidden");
        });

        hidden.forEach((row) => {
            row.style.display = "none";
            row.setAttribute("data-search-hidden", "true");
        });

        // re‑order the DOM so sorting is reflected visually
        [...visible, ...hidden].forEach((row) => tbody.appendChild(row));

        // update the count badge
        if (query) {
            clearBtn.style.display = "block";
            countDiv.style.display = "block";
            countDiv.textContent = `${visible.length} course${
                visible.length === 1 ? "" : "s"
            } found`;
        } else {
            clearBtn.style.display = "none";
            countDiv.style.display = "none";
            countDiv.textContent = "";
        }
    }

    /* ── wiring ────────────────────────────────────────────── */
    input.addEventListener("input", performSearch);

    clearBtn.addEventListener("click", () => {
        input.value = "";
        performSearch();
        input.focus();
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            input.value = "";
            performSearch();
        }
    });

    if (sortSelect) {
        sortSelect.addEventListener("change", performSearch);
    }
}

/* ── metadata injection ───────────────────────────────────── */
export async function injectSavedCourseMetadata() {
    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return;

    applyAdvisingLayoutStyles();
    addCourseSearchBar();

    const data = await ext.storage.local.get(OFFERED_COURSE_SAVE_KEY);
    const offeredCourses = data[OFFERED_COURSE_SAVE_KEY];
    if (!Array.isArray(offeredCourses) || offeredCourses.length === 0) return;

    const courseMetaMap = new Map();
    for (const item of offeredCourses) {
        if (!item || !item.course || !item.section) continue;
        const key = `${String(item.course).trim().toUpperCase()}.${String(
            item.section
        ).trim()}`;
        courseMetaMap.set(key, item);
    }

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

    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
        if (row.getAttribute("data-injected-meta") === "true") return;

        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;

        // Remove legacy inline width and align attributes that cause unnecessary gap
        tds[0].removeAttribute("width");
        tds[1].removeAttribute("width");
        tds[1].removeAttribute("align");

        const fullText = tds[0].innerText.trim();
        const splitIndex = fullText.lastIndexOf(".");
        if (splitIndex === -1) return;

        const courseName = fullText.substring(0, splitIndex).toUpperCase();
        const section = fullText.substring(splitIndex + 1).trim();
        const key = `${courseName}.${section}`;
        const meta = courseMetaMap.get(key);

        // Remove 3rd td (abouticon) if present so table has exactly 6 columns
        if (tds.length >= 3) {
            tds[2].remove();
        }

        const faculty = meta?.faculty || "-";
        const day = meta?.day || "-";
        const timeStr = formatDisplayTime(meta?.time);
        const room = meta?.room || "-";

        const cellsData = [
            { text: faculty, title: `Faculty: ${faculty}` },
            { text: day, title: `Day: ${day}` },
            { text: timeStr, title: `Time: ${timeStr}` },
            { text: room, title: `Room: ${room}` },
        ];

        cellsData.forEach((info) => {
            const cell = document.createElement("td");
            cell.className = "injected-meta-cell";
            cell.textContent = info.text;
            cell.title = info.title;
            cell.addEventListener("click", () => {
                tds[0].click();
            });
            row.appendChild(cell);
        });

        // stash searchable / sortable values on the row itself
        row.dataset.course = key;
        row.dataset.seats = (tds[1]?.innerText || "").trim();
        row.dataset.faculty = faculty;
        row.dataset.day = day;

        row.setAttribute("data-injected-meta", "true");
    });
}