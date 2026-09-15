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

function bindDeleteMetadata(deleteMetaBtn, app) {
    if (!deleteMetaBtn) return;

    deleteMetaBtn.addEventListener("click", async () => {
        if (!confirm("Delete all saved course metadata? This cannot be undone.")) return;
        try {
            await ext.storage.local.remove(["offeredCourses", "offeredCourseMeta"]);
            await ext.storage.local.set({ injectMetadata: false });
        } catch (err) {
            console.error("Error removing metadata from storage:", err);
        }
        try {
            if (ext.tabs && ext.tabs.getCurrent) {
                const tab = await ext.tabs.getCurrent();
                if (tab && tab.id) {
                    await ext.tabs.remove(tab.id);
                    return;
                }
            }
        } catch (err) {
            console.warn("Could not close tab via tabs API:", err);
        }
        window.close();
        deleteMetaBtn.style.display = "none";
        app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
    });
}

async function init() {
    const app = document.getElementById("app");
    const deleteMetaBtn = document.getElementById("deleteMetaBtn");

    bindDeleteMetadata(deleteMetaBtn, app);

    const stored = await ext.storage.local.get([
        "offeredCourses", "offeredCourseMeta", "advisingPriorities"
    ]);

    setAllCourses(Array.isArray(stored.offeredCourses) ? stored.offeredCourses : []);
    setPlan(Array.isArray(stored.advisingPriorities) ? stored.advisingPriorities : []);

    if (allCourses.length === 0) {
        if (deleteMetaBtn) deleteMetaBtn.style.display = "none";
        app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
        return;
    }

    if (deleteMetaBtn) deleteMetaBtn.style.display = "flex";

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
