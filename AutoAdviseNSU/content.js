// content.js

// --- Configuration & Helpers ---

const SUBMIT_BTN_ID = "submit";
const SLIP_ID = "advSlip";
const COURSE_TABLE_ID = "courseList";

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
        // Skip header/footer rows based on structure provided
        const tds = row.querySelectorAll("td");
        // Structure: [SavedIcon, CourseName, Credit, Time, Fees, DeleteIcon]
        // CourseName is at index 1
        if (tds.length > 2) {
            const courseText = tds[1].innerText.trim();
            // Validate it looks like COURSE.SECTION
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

        // Extract Course Name and Section from 1st TD (e.g., "BIO103.1")
        const fullText = tds[0].innerText.trim(); 
        const splitIndex = fullText.lastIndexOf(".");
        
        if (splitIndex === -1) return;

        const courseName = fullText.substring(0, splitIndex).toUpperCase();
        const section = fullText.substring(splitIndex + 1);

        // Extract Seats from 2nd TD (e.g., "40(40)")
        const seatData = parseSeats(tds[1].innerText);

        if (!map[courseName]) map[courseName] = {};
        
        if (seatData) {
            map[courseName][section] = {
                element: tds[0], // We click the first TD to add
                occupied: seatData.occupied,
                total: seatData.total
            };
        }
    });
    return map;
}

// --- Main Automation Logic ---

async function runAutomation() {
    const settings = await chrome.storage.local.get("automationEnabled");
    if (!settings.automationEnabled) {
        console.log("Automation is currently DISABLED via Manager.");
        return; // Stop here
    }

    console.log("Automation is ENABLED. Starting selection...");

    const data = await chrome.storage.local.get("advisingPriorities");
    const priorities = data.advisingPriorities || []; // Format: [{name: "BIO103", sections: ["1","2"]}]

    if (priorities.length === 0) return; // Nothing to do

    const registeredSet = new Set(getRegisteredCourses());
    const availableMap = getAvailableCourseMap();
    const completedCourses = []; // To update UI

    // 2. Iterate Priorities
    for (const item of priorities) {
        const courseName = item.name.toUpperCase();
        let courseAdded = false;

        // 2a. If ANY section of this course is already registered → skip course
        let skipCourse = false;

        for (const section of item.sections) {
            const fullCode = `${courseName}.${section}`;
            if (registeredSet.has(fullCode)) {
                console.log(`${fullCode} already in advSlip. Skipping ${courseName}.`);
                skipCourse = true;
                break;
            }
        }

        if (skipCourse) {
            completedCourses.push(courseName);
            continue;
        }

        // 2b. Iterate Sections in Order
        for (const section of item.sections) {
            const target = availableMap[courseName]?.[section];

            if (!target) {
                // Section not found in offer list, skip silently
                continue;
            }

            // 2c. Check Availability
            if (target.occupied < target.total) {
                // SEAT AVAILABLE
                console.log(`Adding ${courseName}.${section}...`);
                target.element.click(); // Click action
                courseAdded = true;
                break; // Stop checking other sections for this course
            } else {
                // Section full, proceed to next section in priority
            }
        }

        if (courseAdded) {
            completedCourses.push(courseName);
        }
    }

    // 3. Update Storage with Completed List (for Popup UI Checkmarks)
    await chrome.storage.local.set({ completedCourses: completedCourses });

    // 4. Finalize
    const submitBtn = document.getElementById(SUBMIT_BTN_ID);
    if (submitBtn) {
        console.log("Submitting...");
        submitBtn.click();
        
        // Reload after click as per instructions
        // We use a micro-delay to ensure the click event registers before reload kills the script
        setTimeout(() => {
            location.reload(); 
        }, 500); 
    }
}

// Run immediately on load
runAutomation();