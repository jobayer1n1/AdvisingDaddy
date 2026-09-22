// scripts/automation.js
import { showNotification } from "./notification.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

export const SLIP_ID = "advSlip";
export const COURSE_TABLE_ID = "courseList";
export const cseLabPattern = /^CSE\d+L$/;

// Temporary timing logs — set to false once the slow step is found.
const DEBUG_TIMING = true;
const lap = (label, t0) => {
    if (DEBUG_TIMING) console.log(`AdvisingDaddy [timing] ${label}: ${(performance.now() - t0).toFixed(1)}ms`);
};

function getCourseNameOptions(courseName) {
    return (courseName || "")
        .toUpperCase()
        .split("/")
        .map(name => name.trim())
        .filter(Boolean);
}

function isCompositeCourseName(courseName) {
    return getCourseNameOptions(courseName).length > 1;
}

// textContent never forces a layout/reflow; innerText does (and is much
// slower on large tables). Whitespace is collapsed to mimic innerText.
function cellText(el) {
    return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
}

export function parseSeats(seatText) {
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

export const humanDelay = (min, max) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

export function getSaveButton() {
    const submitInputs = Array.from(document.querySelectorAll('input[type="submit"]'));
    return submitInputs.find(btn => {
        const value = (btn.value || "").trim().toLowerCase();
        const onClick = (btn.getAttribute("onclick") || "").toLowerCase();
        return value === "save" || onClick.includes("saveadvising");
    }) || null;
}

export function getRegisteredCourses() {
    const registered = new Set();
    const slipDiv = document.getElementById(SLIP_ID);
    if (!slipDiv) return registered;

    const rows = slipDiv.querySelectorAll("table.slip tr");

    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length > 2) {
            const courseText = cellText(tds[1]);
            if (courseText.includes(".")) {
                registered.add(courseText.toUpperCase());
            }
        }
    });
    return registered;
}

/* ── ONE pass over the course table ─────────────────────────────
   The original scanned every row three separate times (available map,
   section counts, sections-by-course), each with layout-forcing
   innerText reads. This builds all three in a single loop.          */
function scanCourseTable() {
    const available = {};
    const counts = {};
    const byCourse = {};

    const table = document.getElementById(COURSE_TABLE_ID);
    if (!table) return { available, counts, byCourse };

    const rows = table.querySelectorAll("tr");

    rows.forEach(row => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 1) return;

        const fullText = cellText(tds[0]);
        const idx = fullText.lastIndexOf(".");
        if (idx === -1) return;

        const courseName = fullText.substring(0, idx).trim().toUpperCase();
        const section = fullText.substring(idx + 1).trim();
        const names = getCourseNameOptions(courseName);

        // sections-by-course (original accepted rows with >= 1 td)
        names.forEach(name => {
            if (!byCourse[name]) byCourse[name] = [];
            byCourse[name].push(section);
        });

        if (tds.length < 2) return;

        // section counts (original: rows with >= 2 tds)
        names.forEach(name => {
            counts[name] = (counts[name] || 0) + 1;
        });

        // available seats map (only rows with a parsable "occ(total)")
        const seatData = parseSeats(cellText(tds[1]));
        if (seatData) {
            names.forEach(name => {
                if (!available[name]) available[name] = {};
                available[name][section] = {
                    element: tds[0],
                    occupied: seatData.occupied,
                    total: seatData.total
                };
            });
        }
    });

    Object.keys(byCourse).forEach(course => {
        byCourse[course] = [...new Set(byCourse[course])];
    });

    return { available, counts, byCourse };
}

// Kept as thin wrappers so any other module importing them keeps working.
export function getAvailableCourseMap() {
    return scanCourseTable().available;
}

export function getCurrentSectionCounts() {
    return scanCourseTable().counts;
}

export function getCurrentSectionsByCourse() {
    return scanCourseTable().byCourse;
}

/* ── re-entrancy guard ──────────────────────────────────────────
   runAutomation awaits random delays (up to ~2.4s total). If whatever
   calls it fires again during that window (observer, timer, portal
   refresh after a click), two runs can click the same section twice
   and press Save twice. Skip while a run is in flight.              */
let isRunning = false;

export async function runAutomation() {
    if (isRunning) return;
    isRunning = true;
    try {
        await runAutomationOnce();
    } finally {
        isRunning = false;
    }
}

async function runAutomationOnce() {
    let t = performance.now();
    const data = await ext.storage.local.get("advisingPriorities");
    lap("storage.get advisingPriorities", t);
    const priorities = data.advisingPriorities || [];
    if (priorities.length === 0) return;

    const registeredSet = getRegisteredCourses();

    // Update completedCourses status so popup UI always reflects current registered courses on the slip
    const completedCourses = [];
    for (const item of priorities) {
        const cName = (item.name || "").trim().toUpperCase();
        if (isCompositeCourseName(cName)) continue;
        const isRegistered = (item.sections || []).some(s => registeredSet.has(`${cName}.${String(s).trim()}`));
        if (isRegistered) {
            completedCourses.push(item.name);
        }
    }
    t = performance.now();
    await ext.storage.local.set({ completedCourses });
    lap("storage.set completedCourses", t);

    // Load active automations
    t = performance.now();
    const {
        alertOnNewSection,
        courseSectionCounts = {},
        courseSectionSnapshots = {},
        autoSave,
        seatAlert
    } = await ext.storage.local.get([
        "alertOnNewSection",
        "courseSectionCounts",
        "courseSectionSnapshots",
        "autoSave",
        "seatAlert"
    ]);
    lap("storage.get settings", t);

    const isAutoSave = Boolean(autoSave);
    const isSeatAlert = Boolean(seatAlert);
    const isNewSectionAlert = Boolean(alertOnNewSection);

    // If all queue automations are disabled, do not run any selection loops or print selection logs
    if (!isAutoSave && !isSeatAlert && !isNewSectionAlert) {
        console.log("AdvisingDaddy: All queue automations (Auto Save, Seat Alert, New Section Alert) are disabled.");
        return;
    }

    const prioritySet = new Set(
        priorities
            .map(p => (p.name || "").trim().toUpperCase())
            .filter(name => !isCompositeCourseName(name))
    );

    // Single scan of the course table, shared by everything below.
    t = performance.now();
    const {
        available: availableMap,
        counts: currentCounts,
        byCourse: currentSectionsByCourse
    } = scanCourseTable();
    lap("scanCourseTable", t);

    // NEW SECTION ALERT LOGIC
    if (isNewSectionAlert) {
        const updatedCounts = { ...courseSectionCounts };
        const updatedSnapshots = { ...courseSectionSnapshots };
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
            showNotification({
                title: "New Section Alert!",
                message: newSectionCodes.join(", "),
                type: "warning",
                duration: 5000
            });
            console.log(output);
        }

        await ext.storage.local.set({
            courseSectionCounts: updatedCounts,
            courseSectionSnapshots: updatedSnapshots
        });
    }

    // Only run seat checks and selection if Auto Save or Seat Alert is enabled
    if (!isAutoSave && !isSeatAlert) {
        return;
    }

    const submitBtn = getSaveButton();

    if (isAutoSave) {
        console.log("AdvisingDaddy: Auto Save is ENABLED. Starting automated course selection...");
    } else {
        console.log("AdvisingDaddy: Seat Alert is ENABLED. Checking seat availability...");
    }

    const seatAvailableMatches = [];
    let autoSaveSelectionMade = false;

    for (const item of priorities) {
        const courseName = (item.name || "").trim().toUpperCase();
        if (isCompositeCourseName(courseName)) {
            console.log(`${courseName} has multiple course options. Choose one in Advising Daddy before registering.`);
            continue;
        }

        for (const section of item.sections) {
            const sTrimmed = String(section).trim();
            const fullCode = `${courseName}.${sTrimmed}`;

            if (registeredSet.has(fullCode)) {
                if (isAutoSave) {
                    console.log(`${fullCode} Found in advSlip. Skipping ${courseName}.`);
                } else {
                    console.log(`${fullCode} Found in advSlip. Stopping checks for ${courseName}.`);
                }
                break;
            }

            const target = availableMap[courseName]?.[sTrimmed] ||
                (!isNaN(parseInt(sTrimmed, 10)) ? availableMap[courseName]?.[String(parseInt(sTrimmed, 10))] : null);

            if (!target) {
                console.log(`${fullCode} not found`);
                continue;
            }

            if (target.occupied < target.total) {
                if (isAutoSave) {
                    console.log(`Seat Available for ${courseName}.${sTrimmed}`);
                    console.log(`Adding ${courseName}.${sTrimmed}...`);
                    await humanDelay(300, 1200);
                    target.element.click();
                    autoSaveSelectionMade = true;
                    break;
                } else {
                    if (!cseLabPattern.test(courseName)) {
                        seatAvailableMatches.push(`${courseName}.${sTrimmed}`);
                        console.log(`Seat Available for ${courseName}.${sTrimmed}`);
                    }
                }
            } else {
                console.log(`${fullCode} seat not available`);
            }
        }
    }

    const haveSeatUpdate = seatAvailableMatches.length > 0;
    if (isSeatAlert && haveSeatUpdate) {
        showNotification({
            title: "Seat Available!",
            message: seatAvailableMatches.join(", "),
            type: "success",
            duration: 5000
        });
        console.log(`SEAT AVAILABLE: ${seatAvailableMatches.join(", ")}`);
    }

    if (isAutoSave && autoSaveSelectionMade) {
        if (submitBtn) {
            console.log("Submitting advised courses...");
            await humanDelay(600, 1200);
            submitBtn.click();
        } else {
            console.log("No submit Button found");
        }
    }
}