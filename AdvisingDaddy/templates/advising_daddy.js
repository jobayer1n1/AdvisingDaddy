// templates/advising_daddy.js
// Entry point for the saved course metadata viewer.

import { DEFAULT_LIMIT, filterCourses, sortCourses } from "./planner_utils.js";
import {
    ext,
    allCourses,
    currentSort,
    visibleLimit,
    setAllCourses,
    setCurrentSort,
    setGetDisplayData,
    setPlan,
    setVisibleLimit,
    savePlan
} from "./planner_state.js";
import { renderPlanPanel, renderRows } from "./planner_render.js";
import { showNotification } from "../scripts/notification.js";

const SUPPORTED_VERSIONS = ["1.2"];

function renderShell(meta) {
    const savedAt = meta.savedAt ? new Date(meta.savedAt).toLocaleString() : "—";

    return `
        <div class="meta-bar">
            <div class="meta-chip">Courses <span>${allCourses.length}</span></div>
            <div class="meta-chip">Saved at <span>${savedAt}</span></div>
            <div class="meta-chip">Source <span>${meta.source || "—"}</span></div>
        </div>
        <div class="main-layout">
            <div class="table-section">
                <div class="toolbar">
                    <div class="search-bar">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2.5"
                             stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input id="searchInput" type="text"
                               placeholder="Search.. Supports Course.Section, Day, Faculty, e.g. cse215 muo st">
                        <button id="clearSearch" class="clear-search" title="Clear search">×</button>
                        <span id="resultCount">${allCourses.length} entries</span>
                    </div>
                    <div class="sort-strip">
                        <span class="sort-label">Sort:</span>
                        <button class="sort-btn" data-sort="section">Section ↑</button>
                        <button class="sort-btn" data-sort="faculty">Faculty A–Z</button>
                        <button class="sort-btn" data-sort="day">Day</button>
                        <button class="sort-btn" data-sort="seats">Seats ↓</button>
                    </div>
                </div>
                <div class="table-wrap">
                    <table id="courseTable">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Course</th>
                                <th>Section</th>
                                <th>Faculty</th>
                                <th>Day</th>
                                <th>Time</th>
                                <th>Room</th>
                                <th>Seats</th>
                                <th>Queue</th>
                            </tr>
                        </thead>
                        <tbody id="tableBody"></tbody>
                    </table>
                    <p id="noResults">No matching entries.</p>
                </div>
                <div class="show-more-wrap">
                    <button id="showMoreBtn" class="show-more-btn" type="button">Show More</button>
                </div>
            </div>
            <aside class="plan-panel" id="planPanel">
                <div class="plan-header">
                    <span class="plan-title">
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
                             fill="none" stroke="currentColor" stroke-width="2"
                             stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        My Plan / Queue
                    </span>
                    <button id="clearPlanBtn" class="clear-plan-btn" title="Clear entire queue">Clear</button>
                </div>
                <div id="planList"></div>
                <p id="planEmpty" class="plan-empty">
                    No courses queued yet.<br>
                    Click <strong>+</strong> on any row to add.
                </p>
            </aside>
        </div>
    `;
}

function bindSearchControls() {
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearch");

    setGetDisplayData(() => {
        const q = searchInput.value.trim();
        const filtered = filterCourses(allCourses, q);
        const sorted = sortCourses(filtered, currentSort);
        return q ? sorted : sorted.slice(0, visibleLimit);
    });

    searchInput.addEventListener("input", () => {
        setVisibleLimit(DEFAULT_LIMIT);
        renderRows();
    });
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        setVisibleLimit(DEFAULT_LIMIT);
        renderRows();
    });
}

function bindSortControls() {
    document.querySelectorAll(".sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.sort;
            if (currentSort === mode) {
                setCurrentSort(null);
                btn.classList.remove("active");
            } else {
                setCurrentSort(mode);
                document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
            }
            setVisibleLimit(DEFAULT_LIMIT);
            renderRows();
        });
    });
}

function bindPlanControls() {
    const showMoreBtn = document.getElementById("showMoreBtn");
    if (showMoreBtn) {
        showMoreBtn.addEventListener("click", () => {
            setVisibleLimit(Math.min(visibleLimit + DEFAULT_LIMIT, allCourses.length));
            renderRows();
        });
    }

    document.getElementById("clearPlanBtn").addEventListener("click", async () => {
        if (!confirm("Clear the entire course queue? The extension popup will also be cleared.")) return;
        setPlan([]);
        await savePlan();
        renderPlanPanel();
        renderRows();
    });
}

function downloadAsJson(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function bindManageData(app) {
    const dropdown = document.getElementById("manageDataDropdown");
    const btn = document.getElementById("manageDataBtn");
    const menu = document.getElementById("manageDataMenu");
    
    if (!dropdown || !btn || !menu) return;

    // Toggle menu
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.classList.toggle("show");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target)) {
            menu.classList.remove("show");
        }
    });

    // --- Offered Course List ---
    document.getElementById("downloadCoursesBtn").addEventListener("click", async () => {
        menu.classList.remove("show");
        const stored = await ext.storage.local.get(["offeredCourses", "offeredCourseMeta"]);
        if (stored.offeredCourses) {
            const manifest = ext.runtime.getManifest();
            const exportData = {
                metadata: {
                    ...(stored.offeredCourseMeta || {}),
                    version: manifest.version || "1.2"
                },
                courses: stored.offeredCourses
            };
            downloadAsJson(exportData, "nsu_offered_courses.json");
        } else {
            alert("No offered courses found to export.");
        }
    });

    const importCoursesBtn = document.getElementById("importCoursesBtn");
    const importCoursesInput = document.getElementById("importCoursesInput");
    if (importCoursesBtn && importCoursesInput) {
        importCoursesBtn.addEventListener("click", () => {
            menu.classList.remove("show");
            importCoursesInput.click();
        });

        importCoursesInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const version = (data.metadata && data.metadata.version) || "unknown";
                    if (!SUPPORTED_VERSIONS.includes(version)) {
                        showNotification({ title: 'Import Failed', message: `Unsupported version: ${version}. Expected one of: ${SUPPORTED_VERSIONS.join(', ')}`, type: 'danger' });
                        return;
                    }
                    if (!data.courses || !Array.isArray(data.courses)) {
                        showNotification({ title: 'Import Failed', message: 'Invalid data format: missing courses array.', type: 'danger' });
                        return;
                    }
                    
                    await ext.storage.local.set({ 
                        offeredCourses: data.courses,
                        offeredCourseMeta: data.metadata 
                    });
                    showNotification({ title: 'Import Successful', message: 'Offered courses loaded successfully.', type: 'success' });
                    
                    // Reload data
                    setAllCourses(data.courses);
                    document.getElementById("manageDataDropdown").style.display = "block";
                    app.innerHTML = renderShell(data.metadata || {});
                    bindSearchControls();
                    bindSortControls();
                    bindPlanControls();
                    renderPlanPanel();
                    renderRows();
                } catch (err) {
                    showNotification({ title: 'Import Failed', message: 'Failed to parse JSON file.', type: 'danger' });
                }
                importCoursesInput.value = ""; // reset
            };
            reader.readAsText(file);
        });
    }

    document.getElementById("deleteCoursesBtn").addEventListener("click", async () => {
        menu.classList.remove("show");
        if (!confirm("Clear all saved offered courses metadata? Your plan will not be affected.")) return;
        try {
            await ext.storage.local.remove(["offeredCourses", "offeredCourseMeta"]);
            await ext.storage.local.set({ injectMetadata: false });
            setAllCourses([]);
            app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
        } catch (err) {
            console.error("Error removing course metadata from storage:", err);
        }
    });

    // --- My Plan ---
    document.getElementById("downloadPlanBtn").addEventListener("click", async () => {
        menu.classList.remove("show");
        const stored = await ext.storage.local.get(["advisingPriorities"]);
        if (stored.advisingPriorities) {
            const manifest = ext.runtime.getManifest();
            const exportData = {
                metadata: {
                    version: manifest.version || "1.2",
                    exportedAt: new Date().toISOString()
                },
                plan: stored.advisingPriorities
            };
            downloadAsJson(exportData, "my_advising_plan.json");
        } else {
            alert("No plan found to export.");
        }
    });

    const importPlanBtn = document.getElementById("importPlanBtn");
    const importPlanInput = document.getElementById("importPlanInput");
    if (importPlanBtn && importPlanInput) {
        importPlanBtn.addEventListener("click", () => {
            menu.classList.remove("show");
            importPlanInput.click();
        });

        importPlanInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    const version = (data.metadata && data.metadata.version) || "unknown";
                    if (!SUPPORTED_VERSIONS.includes(version)) {
                        showNotification({ title: 'Import Failed', message: `Unsupported version: ${version}. Expected one of: ${SUPPORTED_VERSIONS.join(', ')}`, type: 'danger' });
                        return;
                    }
                    if (!data.plan || !Array.isArray(data.plan)) {
                        showNotification({ title: 'Import Failed', message: 'Invalid data format: missing plan array.', type: 'danger' });
                        return;
                    }
                    
                    setPlan(data.plan);
                    await savePlan();
                    showNotification({ title: 'Import Successful', message: 'Plan loaded successfully.', type: 'success' });
                    
                    renderPlanPanel();
                    renderRows();
                } catch (err) {
                    showNotification({ title: 'Import Failed', message: 'Failed to parse JSON file.', type: 'danger' });
                }
                importPlanInput.value = ""; // reset
            };
            reader.readAsText(file);
        });
    }

    document.getElementById("deletePlanBtn").addEventListener("click", async () => {
        menu.classList.remove("show");
        if (!confirm("Clear your entire course plan? Offered courses will not be affected.")) return;
        setPlan([]);
        await savePlan();
        renderPlanPanel();
        renderRows();
    });

    // --- All Data ---
    document.getElementById("deleteAllBtn").addEventListener("click", async () => {
        menu.classList.remove("show");
        if (!confirm("Delete ALL saved course metadata AND your plan? This cannot be undone.")) return;
        try {
            await ext.storage.local.remove(["offeredCourses", "offeredCourseMeta", "advisingPriorities"]);
            await ext.storage.local.set({ injectMetadata: false });
        } catch (err) {
            console.error("Error removing all data from storage:", err);
        }
        
        dropdown.style.display = "none";
        app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
    });
}

async function init() {
    const app = document.getElementById("app");
    const manageDataDropdown = document.getElementById("manageDataDropdown");

    bindManageData(app);

    const stored = await ext.storage.local.get([
        "offeredCourses", "offeredCourseMeta", "advisingPriorities"
    ]);

    setAllCourses(Array.isArray(stored.offeredCourses) ? stored.offeredCourses : []);
    setPlan(Array.isArray(stored.advisingPriorities) ? stored.advisingPriorities : []);

    if (allCourses.length === 0) {
        if (manageDataDropdown) manageDataDropdown.style.display = "none";
        app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
        return;
    }

    if (manageDataDropdown) manageDataDropdown.style.display = "block";

    app.innerHTML = renderShell(stored.offeredCourseMeta || {});

    bindSearchControls();
    bindSortControls();
    bindPlanControls();

    renderPlanPanel();
    renderRows();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}