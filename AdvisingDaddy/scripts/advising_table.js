// scripts/advising_table.js
import { formatDisplayTime } from "./time_utils.js";
import { OFFERED_COURSE_SAVE_KEY } from "./offered_courses.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);
export const COURSE_TABLE_ID = "courseList";

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
        #advCourseSearchCount {
            font-size: 11px;
            color: #57606a;
            padding-left: 2px;
            display: none;
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
    `;
    document.head.appendChild(style);
}

export function addCourseSearchBar() {
    if (document.getElementById("advCourseSearchContainer")) return;

    const offeredCoursesDiv = document.getElementById("offeredCourses");
    if (!offeredCoursesDiv || !offeredCoursesDiv.parentNode) return;

    const searchContainer = document.createElement("div");
    searchContainer.id = "advCourseSearchContainer";
    searchContainer.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; width: 100%;">
            <span style="position: absolute; left: 10px; font-size: 13px; color: #656d76; pointer-events: none;">🔍</span>
            <input type="text" id="advCourseSearchInput" placeholder="Search by course or faculty (e.g. CSE323, AAA)..." />
            <button id="advCourseSearchClear" type="button" title="Clear search">✕</button>
        </div>
        <div id="advCourseSearchCount"></div>
    `;

    offeredCoursesDiv.parentNode.insertBefore(searchContainer, offeredCoursesDiv);

    const input = searchContainer.querySelector("#advCourseSearchInput");
    const clearBtn = searchContainer.querySelector("#advCourseSearchClear");
    const countDiv = searchContainer.querySelector("#advCourseSearchCount");

    function performSearch() {
        const query = (input.value || "").trim().toUpperCase();
        const table = document.getElementById(COURSE_TABLE_ID);
        if (!table) return;

        const rows = table.querySelectorAll("tbody tr");
        let matches = 0;

        rows.forEach(row => {
            const tds = row.querySelectorAll("td");
            if (!tds.length) return;
            const courseText = (tds[0]?.innerText || "").trim().toUpperCase();
            const facultyText = (tds[2]?.innerText || "").trim().toUpperCase();

            if (!query || courseText.includes(query) || facultyText.includes(query)) {
                row.style.display = "";
                matches++;
            } else {
                row.style.display = "none";
            }
        });

        if (query) {
            clearBtn.style.display = "block";
            countDiv.style.display = "block";
            countDiv.textContent = `${matches} course${matches === 1 ? "" : "s"} found`;
        } else {
            clearBtn.style.display = "none";
            countDiv.style.display = "none";
            countDiv.textContent = "";
        }
    }

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
}

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
        const key = `${String(item.course).trim().toUpperCase()}.${String(item.section).trim()}`;
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
    rows.forEach(row => {
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
            { text: room, title: `Room: ${room}` }
        ];

        cellsData.forEach(info => {
            const cell = document.createElement("td");
            cell.className = "injected-meta-cell";
            cell.textContent = info.text;
            cell.title = info.title;
            cell.addEventListener("click", () => {
                tds[0].click();
            });
            row.appendChild(cell);
        });

        row.setAttribute("data-injected-meta", "true");
    });
}
