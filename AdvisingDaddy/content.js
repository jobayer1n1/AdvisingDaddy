// content.js - Entry point that dynamically imports atomic scripts when needed
const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

// Flip to false once you've found what's slow.
const DEBUG_TIMING = true;
const T_START = performance.now();
const lap = (label, t0) => {
    if (DEBUG_TIMING) console.log(`AdvisingDaddy [timing] ${label}: ${(performance.now() - t0).toFixed(1)}ms`);
};

// Runs one task, logs how long it took, and never lets a failure escape —
// so a broken cosmetic feature can't stop automation (or vice versa).
async function runTask(label, fn) {
    const t0 = performance.now();
    try {
        await fn();
    } catch (err) {
        console.error(`AdvisingDaddy: ${label} failed:`, err);
    } finally {
        if (DEBUG_TIMING) {
            console.log(`AdvisingDaddy: ${label} took ${(performance.now() - t0).toFixed(1)}ms`);
        }
    }
}

/* ── module loading ─────────────────────────────────────────────
   Extension modules are slow to load while the portal is busy, so we
   start fetching them as early as possible (both in parallel) and
   only then wait for the DOM. Memoized: starting twice is harmless.
   Each promise resolves to the module, or null if it failed/was skipped. */
let advisingLoad = null;

function startAdvisingLoad() {
    if (advisingLoad) return advisingLoad;

    const loadModule = (path) =>
        import(ext.runtime.getURL(path)).then(
            (mod) => {
                lap(`${path} ready (since content script start)`, T_START);
                return mod;
            },
            (err) => {
                console.error(`AdvisingDaddy: failed to load ${path}:`, err);
                return null;
            }
        );

    const automation = loadModule("scripts/automation.js");

    // advising_table.js (and the files it imports) is only loaded if the
    // setting is ON.
    const table = ext.storage.local
        .get("injectMetadata")
        .then(({ injectMetadata }) =>
            injectMetadata ? loadModule("scripts/advising_table.js") : null
        )
        .catch((err) => {
            console.error("AdvisingDaddy: failed to read injectMetadata:", err);
            return null;
        });

    advisingLoad = { automation, table };
    return advisingLoad;
}

// If the URL already tells us this is the advising page, begin loading now,
// before the DOM is ready (works best with "run_at": "document_start").
if (window.location.href.includes("/advising")) {
    startAdvisingLoad();
}

async function init() {
    const isOfferedCoursesPage =
        window.location.href.includes("offered_courses") ||
        document.getElementById("offeredCourseTbl");

    const isAdvisingPage =
        window.location.href.includes("/advising") ||
        document.getElementById("courseList") ||
        document.getElementById("advSlip");

    if (isOfferedCoursesPage) {
        await runTask("offered courses page", async () => {
            const { addOfferedCourseSaveButton } = await import(
                ext.runtime.getURL("scripts/offered_courses.js")
            );
            addOfferedCourseSaveButton();
        });
    }

    if (isAdvisingPage) {
        const { automation, table } = startAdvisingLoad();

        // The "Fetch updates" button (in advising_table.js) announces when it
        // has patched the table; re-run the seat checks on the fresh data.
        // (The event name must match LIST_UPDATED_EVENT in advising_table.js.)
        document.addEventListener("advisingdaddy:list-updated", async () => {
            const mod = await automation;
            if (mod) await runTask("automation (after fetch)", () => mod.runAutomation());
        });

        // 1) Automation first: it's time-critical (seat checks / auto save),
        //    and the injection below blocks the main thread for a while.
        await runTask("automation", async () => {
            const mod = await automation;
            if (mod) await mod.runAutomation();
        });

        // 2) Cosmetic metadata injection afterwards.
        await runTask("inject metadata", async () => {
            const mod = await table;
            if (!mod) {
                console.log("AdvisingDaddy: metadata injection skipped (disabled or failed to load).");
                return;
            }
            await mod.injectSavedCourseMetadata();
        });
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
    init();
}