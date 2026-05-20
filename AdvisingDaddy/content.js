// content.js

// --- Configuration & Helpers ---
const ext = typeof browser !== "undefined" ? browser : chrome;

const SUBMIT_BTN_ID = "submit";
const SLIP_ID = "advSlip";
const COURSE_TABLE_ID = "courseList";
const cseLabPattern = /^CSE\d+L$/;

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


// --- Main Automation Logic ---

async function runAutomation() {
    const data = await ext.storage.local.get("advisingPriorities");
    const priorities = data.advisingPriorities || [];
    const prioritySet = new Set(priorities.map(p => p.name));
    const submitBtn = document.getElementById(SUBMIT_BTN_ID);
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

runAutomation();

