// scripts/automation.js
import { showNotification } from "./notification.js";

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

export const SLIP_ID = "advSlip";
export const COURSE_TABLE_ID = "courseList";
export const cseLabPattern = /^CSE\d+L$/;

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
            const courseText = tds[1].innerText.trim();
            if (courseText.includes(".")) {
                registered.add(courseText.toUpperCase());
            }
        }
    });
    return registered;
}

export function getAvailableCourseMap() {
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

        const courseName = fullText.substring(0, splitIndex).trim().toUpperCase();
        const section = fullText.substring(splitIndex + 1).trim();

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

export function getCurrentSectionCounts() {
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

        const course = text.substring(0, idx).trim().toUpperCase();
        counts[course] = (counts[course] || 0) + 1;
    });

    return counts;
}

export function getCurrentSectionsByCourse() {
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

        const course = text.substring(0, idx).trim().toUpperCase();
        const section = text.substring(idx + 1).trim();

        if (!byCourse[course]) byCourse[course] = [];
        byCourse[course].push(section);
    });

    Object.keys(byCourse).forEach(course => {
        byCourse[course] = [...new Set(byCourse[course])];
    });

    return byCourse;
}

export async function runAutomation() {
    const data = await ext.storage.local.get("advisingPriorities");
    const priorities = data.advisingPriorities || [];
    if (priorities.length === 0) return;

    const registeredSet = new Set(getRegisteredCourses());

    // Update completedCourses status so popup UI always reflects current registered courses on the slip
    const completedCourses = [];
    for (const item of priorities) {
        const cName = (item.name || "").trim().toUpperCase();
        const isRegistered = (item.sections || []).some(s => registeredSet.has(`${cName}.${String(s).trim()}`));
        if (isRegistered) {
            completedCourses.push(item.name);
        }
    }
    await ext.storage.local.set({ completedCourses });

    // Load active automations
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

    const isAutoSave = Boolean(autoSave);
    const isSeatAlert = Boolean(seatAlert);
    const isNewSectionAlert = Boolean(alertOnNewSection);

    // If all queue automations are disabled, do not run any selection loops or print selection logs
    if (!isAutoSave && !isSeatAlert && !isNewSectionAlert) {
        console.log("AdvisingDaddy: All queue automations (Auto Save, Seat Alert, New Section Alert) are disabled.");
        return;
    }

    const prioritySet = new Set(priorities.map(p => (p.name || "").trim().toUpperCase()));

    // NEW SECTION ALERT LOGIC
    if (isNewSectionAlert) {
        const currentCounts = getCurrentSectionCounts();
        const currentSectionsByCourse = getCurrentSectionsByCourse();
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

    const availableMap = getAvailableCourseMap();
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
