// content.js

// --- Configuration & Helpers ---

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

/**
 * Counts how many sections are currently available per course
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

        const text = tds[0].innerText.trim(); // e.g. BIO103.1
        const idx = text.lastIndexOf(".");
        if (idx === -1) return;

        const course = text.substring(0, idx).toUpperCase();
        counts[course] = (counts[course] || 0) + 1;
    });

    return counts;
}


// --- Main Automation Logic ---

async function runAutomation() {
    const data = await chrome.storage.local.get("advisingPriorities");
    const priorities = data.advisingPriorities || []; // Format: [{name: "BIO103", sections: ["1","2"]}]
    const prioritySet = new Set(priorities.map(p => p.name));
    if (priorities.length === 0) return; // Nothing to do
    const registeredSet = new Set(getRegisteredCourses());
    const availableMap = getAvailableCourseMap();
    const completedCourses = []; // To update UI

    const {
        automationEnabled,
        alertOnNewSection,
        courseSectionCounts = {},
        autoSave
    } = await chrome.storage.local.get([
        "automationEnabled",
        "alertOnNewSection",
        "courseSectionCounts",
        "autoSave"
    ]);

    if (!automationEnabled) {
        console.log("Automation is DISABLED.");
        return;
    }

    const currentCounts = getCurrentSectionCounts();
    let updatedCounts = { ...courseSectionCounts };

    // 🔔 NEW SECTION ALERT LOGIC
    if (alertOnNewSection) {
        const new_section_available=[]
        for (const course in currentCounts) {
            if(!prioritySet.has(course)){
                continue;
            }
            // Initialize if missing
            if (!(course in courseSectionCounts)) {
                updatedCounts[course] = currentCounts[course];
                continue;
            }

            // Detect increase
            if (currentCounts[course] > courseSectionCounts[course]) {
                new_section_available.push(course)                
            }
        }
        if(new_section_available.length>0){
            let output = "NEW SECTION AVAILABLE: "
            new_section_available.forEach(each_course => {
                output+=each_course+" "
            });
            alert(`${output}`);
            console.log(`${output}`);
            updatedCounts[new_section_available] = currentCounts[new_section_available];
            await chrome.storage.local.set({
                courseSectionCounts: updatedCounts
            });
        }
        // Save initialized / unchanged counts
        await chrome.storage.local.set({
            courseSectionCounts: updatedCounts
        });
    }
    console.log("Automation is ENABLED. Starting selection...");

    let seat_output = `SEAT AVAILABLE: `
    // 1. Iterate Priorities
    for (const item of priorities) {
        const courseName = item.name.toUpperCase();
        let courseAdded = false;

        // 2a. Iterate Sections in Order
        for (const section of item.sections) {

            // 2b. If the target section is already in advSlip that means it's already added
            const fullCode = `${courseName}.${section}`;
            if (registeredSet.has(fullCode)) {
                console.log(`${fullCode} Found in advSlip. Skipping ${courseName}.`);
                courseAdded = true;
                break;
            }

            //Otherwise Check the offered course list tables 
            const target = availableMap[courseName]?.[section];

            if (!target) {
                console.log(`${fullCode} not found`)
                // Section not found in offer list, skip silently
                continue;
            }

            // 2c. Check Availability
            if (target.occupied < target.total) {
                // SEAT AVAILABLE
                if(autoSave){
                    console.log(`Adding ${courseName}.${section}...`);
                    await humanDelay(300, 1200)
                    target.element.click(); // Click action
                    courseAdded = true;
                    break; // Stop checking other sections for this course
                }
                else{
                    if(!cseLabPattern.test(`${courseName}`)){
                        seat_output += courseName +'.' +section+' '
                        console.log(`Seat Available for ${courseName}.${section}`)
                    }
                    
                }
                
            } else {
                // Section full, proceed to next section in priority
                console.log(`${fullCode} seat not available`)
            }
        }
        if (courseAdded) {
            completedCourses.push(courseName);
        }
    }

    have_seat_update = !(seat_output==='SEAT AVAILABLE: ')
    if(!autoSave&&have_seat_update)    alert(seat_output)

    // 3. Update Storage with Completed List (for Popup UI Checkmarks)
    await chrome.storage.local.set({ completedCourses: completedCourses });


    if(!autoSave||!have_seat_update){
        // setTimeout(() => {
        //     location.reload(); 
        // }, 500);
    }
    else{
        const submitBtn = document.getElementById(SUBMIT_BTN_ID);
        if (submitBtn) {
            console.log("Submitting...");
            await humanDelay(800, 2000);
            submitBtn.click();
            
            // Reload after click as per instructions
            // We use a micro-delay to ensure the click event registers before reload kills the script
            // setTimeout(() => {
            //     location.reload(); 
            // }, 500); 
        }
    }

}

runAutomation();

