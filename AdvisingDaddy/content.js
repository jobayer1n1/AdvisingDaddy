// content.js

// --- Configuration & Helpers ---
const ext = typeof browser !== "undefined" ? browser : chrome;

const SLIP_ID = "advSlip";
const COURSE_TABLE_ID = "courseList";
const cseLabPattern = /^CSE\d+L$/;
const OFFERED_COURSE_TABLE_SELECTOR = "#offeredCourseTbl tbody tr";
const OFFERED_COURSE_SAVE_KEY = "offeredCourses";
const OFFERED_COURSE_META_KEY = "offeredCourseMeta";

/**
 * Parses "40(40)" into { occupied: 40, total: 40 }
 */
function parseSeats(seatText) {
    const regex = /^(\d+)\((\d+)\)$/;
    const match = seatText.trim().match(regex);
    if (match) {
        return {
            occupied: parseInt(match[1], 10),
            total: parseInt(match[2], 10)
        };
    }
    return null;
}

const humanDelay = (min, max) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

/**
 * Finds the advising "Save" button in a way that is resilient to duplicate/changing IDs.
 */
function getSaveButton() {
    const submitInputs = Array.from(document.querySelectorAll('input[type="submit"]'));
    return submitInputs.find(btn => {
        const value = (btn.value || "").trim().toLowerCase();
        const onClick = (btn.getAttribute("onclick") || "").toLowerCase();
        return value === "save" || onClick.includes("saveadvising");
    }) || null;
}


/**
 * Parses the #advSlip table to find currently registered courses.
 * Returns a Set of strings: "COURSE.SECTION" (e.g., "BIO103.1")
 */
function getRegisteredCourses() {
    const registered = new Set();
    const slipDiv = document.getElementById(SLIP_ID);
    if (!slipDiv) return registered;

    // Target the table inside the slip div
    const rows = slipDiv.querySelectorAll("table.slip tr");

    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length > 2) {
            const courseText = tds[1].innerText.trim();
            if (courseText.includes(".")) {
                registered.add(courseText.toUpperCase());
            }
        }
    });
    return registered;
}

/**
 * Parses the #courseList table into a navigable map.
 * Returns: { "BIO103": { "1": { element: HTMLNode, occupied: 40, total: 40 } } }
 */
function getAvailableCourseMap() {
    const map = {};
    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return map;

    const rows = table.querySelectorAll("tr");

    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;

        const fullText = tds[0].innerText.trim();
        const splitIndex = fullText.lastIndexOf(".");

        if (splitIndex === -1) return;

        const courseName = fullText.substring(0, splitIndex).toUpperCase();
        const section = fullText.substring(splitIndex + 1);

        const seatData = parseSeats(tds[1].innerText);

        if (!map[courseName]) map[courseName] = {};

        if (seatData) {
            map[courseName][section] = {
                element: tds[0],
                occupied: seatData.occupied,
                total: seatData.total
            };
        }
    });
    return map;
}

/**
 * Counts how many sections are currently available per course.
 * Returns: { BIO103: 3, CSE311: 2 }
 */
function getCurrentSectionCounts() {
    const counts = {};
    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return counts;

    const rows = table.querySelectorAll("tr");

    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return;

        const text = tds[0].innerText.trim();
        const idx = text.lastIndexOf(".");
        if (idx === -1) return;

        const course = text.substring(0, idx).toUpperCase();
        counts[course] = (counts[course] || 0) + 1;
    });

    return counts;
}

/**
 * Captures currently visible sections per course.
 * Returns: { BIO103: ["1","2"], CSE332: ["9","10"] }
 */
function getCurrentSectionsByCourse() {
    const byCourse = {};
    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return byCourse;

    const rows = table.querySelectorAll("tr");
    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 1) return;

        const text = tds[0].innerText.trim();
        const idx = text.lastIndexOf(".");
        if (idx === -1) return;

        const course = text.substring(0, idx).toUpperCase();
        const section = text.substring(idx + 1);

        if (!byCourse[course]) byCourse[course] = [];
        byCourse[course].push(section);
    });

    Object.keys(byCourse).forEach(course => {
        byCourse[course] = [...new Set(byCourse[course])];
    });

    return byCourse;
}

function parseDayFromTime(timeText) {
    const value = (timeText || "").trim();
    const match = value.match(/^([A-Za-z]+)\s+/);
    return match ? match[1].toUpperCase() : "";
}

function to24HourTimeString(timeString) {
    const str = (timeString || "").trim();
    const directMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (directMatch) {
        const pad = (num) => String(num).padStart(2, "0");
        return `${pad(directMatch[1])}:${pad(directMatch[2])}:${pad(directMatch[3] ? directMatch[3] : 0)}`;
    }

    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    const period = match[4].toUpperCase();

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function parseTimeRange(timeText) {
    const value = (timeText || "").trim();
    const withoutDay = value.replace(/^[A-Za-z]+\s+/, "").trim();
    const match = withoutDay.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)$/i);
    if (!match) return [];

    let startStr = match[1].trim();
    const endStr = match[2].trim();

    if (!/AM|PM/i.test(startStr) && /AM|PM/i.test(endStr)) {
        const endPeriod = /AM|PM/i.exec(endStr)?.[0] || "AM";
        startStr += ` ${endPeriod}`;
    }

    const start = to24HourTimeString(startStr);
    const end = to24HourTimeString(endStr);
    if (!start || !end) return [];
    return [start, end];
}

function extractOfferedCourseRows() {
    const rows = Array.from(document.querySelectorAll(OFFERED_COURSE_TABLE_SELECTOR));
    if (!rows.length) return [];

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

function addOfferedCourseSaveButton() {
    if (!window.location.href.includes("offered_courses")) return;

    const filterContainer = document.querySelector(".dataTables_filter");
    if (!filterContainer || document.getElementById("offeredCourseSaveButton")) return;

    const saveBtn = document.createElement("button");
    saveBtn.id = "offeredCourseSaveButton";
    saveBtn.type = "button";
    saveBtn.title = "Save Course List";
    saveBtn.setAttribute("aria-label", "Save Course List");
    saveBtn.innerHTML = "<span aria-hidden=\"true\">💾</span>";
    saveBtn.style.marginRight = "10px";
    saveBtn.style.padding = "6px 10px";
    saveBtn.style.border = "1px solid #d0d7de";
    saveBtn.style.borderRadius = "6px";
    saveBtn.style.background = "#ffffff";
    saveBtn.style.color = "#1f2328";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "14px";
    saveBtn.style.fontWeight = "600";

    saveBtn.addEventListener("click", async () => {
        const rows = extractOfferedCourseRows();
        const payload = {
            source: "north-south-university-offered-courses",
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

        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = "✓ Saved";
        saveBtn.disabled = true;
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }, 1200);
    });

    filterContainer.prepend(saveBtn);
}


// --- Main Automation Logic ---

async function runAutomation() {
    const data = await ext.storage.local.get("advisingPriorities");
    const priorities = data.advisingPriorities || [];
    const prioritySet = new Set(priorities.map(p => p.name));
    const submitBtn = getSaveButton();
    if (priorities.length === 0) return;

    const registeredSet = new Set(getRegisteredCourses());
    const availableMap = getAvailableCourseMap();
    const completedCourses = [];

    const {
        ControllerEnabled,
        alertOnNewSection,
        courseSectionCounts = {},
        courseSectionSnapshots = {},
        autoSave
    } = await ext.storage.local.get([
        "ControllerEnabled",
        "alertOnNewSection",
        "courseSectionCounts",
        "courseSectionSnapshots",
        "autoSave"
    ]);

    if (!ControllerEnabled) {
        console.log("Automation is DISABLED.");
        return;
    }

    const currentCounts = getCurrentSectionCounts();
    const currentSectionsByCourse = getCurrentSectionsByCourse();
    const updatedCounts = { ...courseSectionCounts };
    const updatedSnapshots = { ...courseSectionSnapshots };

    // NEW SECTION ALERT LOGIC
    if (alertOnNewSection) {
        const hasBaseline = Object.keys(courseSectionSnapshots || {}).length > 0;
        const newSectionCodes = [];

        for (const course in currentSectionsByCourse) {
            if (!prioritySet.has(course)) {
                continue;
            }

            const previousCount = courseSectionCounts[course];
            const currentCount = currentCounts[course] || 0;
            const currentSections = currentSectionsByCourse[course] || [];
            const previousSections = Array.isArray(courseSectionSnapshots[course])
                ? courseSectionSnapshots[course]
                : [];

            if (typeof previousCount === "number" && currentCount > previousCount) {
                const previousSet = new Set(previousSections);
                currentSections.forEach(section => {
                    if (!previousSet.has(section)) {
                        newSectionCodes.push(`${course}.${section}`);
                    }
                });
            }

            updatedCounts[course] = currentCount;
            updatedSnapshots[course] = currentSections;
        }

        if (hasBaseline && newSectionCodes.length > 0) {
            const output = `New Section Alert: ${newSectionCodes.join(", ")}`;
            alert(output);
            console.log(output);
        }

        await ext.storage.local.set({
            courseSectionCounts: updatedCounts,
            courseSectionSnapshots: updatedSnapshots
        });
    }

    console.log("Automation is ENABLED. Starting selection...");

    const seatAvailableMatches = [];
    let autoSaveSelectionMade = false;

    for (const item of priorities) {
        const courseName = item.name.toUpperCase();
        let courseAdded = false;
        const isAutoSaveEnabled = Boolean(autoSave);

        for (const section of item.sections) {
            const fullCode = `${courseName}.${section}`;
            if (registeredSet.has(fullCode)) {
                if (isAutoSaveEnabled) {
                    console.log(`${fullCode} Found in advSlip. Skipping ${courseName}.`);
                    courseAdded = true;
                } else {
                    console.log(`${fullCode} Found in advSlip. Stopping checks for ${courseName}.`);
                }
                break;
            }

            const target = availableMap[courseName]?.[section];

            if (!target) {
                console.log(`${fullCode} not found`);
                continue;
            }

            if (target.occupied < target.total) {
                if (isAutoSaveEnabled) {
                    console.log(`Seat Available for ${courseName}.${section}`);
                    console.log(`Adding ${courseName}.${section}...`);
                    await humanDelay(300, 1200);
                    target.element.click();
                    autoSaveSelectionMade = true;
                    courseAdded = true;
                    break;
                } else {
                    if (!cseLabPattern.test(`${courseName}`)) {
                        seatAvailableMatches.push(`${courseName}.${section}`);
                        console.log(`Seat Available for ${courseName}.${section}`);
                    }
                }
            } else {
                console.log(`${fullCode} seat not available`);
            }
        }

        if (courseAdded) {
            completedCourses.push(courseName);
        }
    }

    const haveSeatUpdate = seatAvailableMatches.length > 0;
    if (!autoSave && haveSeatUpdate) {
        alert(`SEAT AVAILABLE: ${seatAvailableMatches.join(", ")}`);
    }

    await ext.storage.local.set({ completedCourses: completedCourses });

    if (!autoSave || !autoSaveSelectionMade) {
        // no-op
    } else {
        if (submitBtn) {
            console.log("Submitting...");
            submitBtn.click();
        } else {
            console.log("No submit Button found");
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        addOfferedCourseSaveButton();
        runAutomation();
    }, { once: true });
} else {
    addOfferedCourseSaveButton();
    runAutomation();
}

