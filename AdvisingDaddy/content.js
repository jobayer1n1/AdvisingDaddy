// content.js - Entry point that dynamically imports atomic scripts when needed
const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

async function init() {
    const isOfferedCoursesPage =
        window.location.href.includes("offered_courses") ||
        document.getElementById("offeredCourseTbl");

    const isAdvisingPage =
        window.location.href.includes("/advising") ||
        document.getElementById("courseList") ||
        document.getElementById("advSlip");

    if (isOfferedCoursesPage) {
        try {
            const { addOfferedCourseSaveButton } = await import(
                ext.runtime.getURL("scripts/offered_courses.js")
            );
            addOfferedCourseSaveButton();
        } catch (err) {
            console.error("Failed to load offered courses module:", err);
        }
    }

    if (isAdvisingPage) {
        try {
            const { injectSavedCourseMetadata } = await import(
                ext.runtime.getURL("scripts/advising_table.js")
            );
            const { runAutomation } = await import(
                ext.runtime.getURL("scripts/automation.js")
            );

            const { injectMetadata } = await ext.storage.local.get("injectMetadata");
            if (injectMetadata) {
                await injectSavedCourseMetadata();
            } else {
                console.log("AdvisingDaddy: Inject Course Metadata is disabled.");
            }
            await runAutomation();
        } catch (err) {
            console.error("Failed to load advising modules:", err);
        }
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}
