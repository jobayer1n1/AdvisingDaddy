// templates/planner_render.js
// DOM rendering functions for the course table and plan panel.

import {
    formatTimeDisplay,
    getClashInfo,
    getCourseNameOptions,
    getSameDayFinalInfo
} from "./planner_utils.js";
import {
    plan,
    allCourses,
    savePlan,
    isInPlan,
    getPlannedCourseObjects,
    getDisplayData
} from "./planner_state.js";

function addSection(sectionList, section) {
    if (!sectionList.includes(section)) sectionList.push(section);
}

async function addCourseToPlan(courseName, section) {
    const normalizedName = (courseName || "").trim().toUpperCase();
    const normalizedSection = String(section || "").trim();
    if (!normalizedName || !normalizedSection || normalizedName.includes("/")) return;

    const existing = plan.find(p => p.name === normalizedName);
    if (existing) {
        addSection(existing.sections, normalizedSection);
    } else {
        plan.push({ name: normalizedName, sections: [normalizedSection] });
    }

    await savePlan();
    renderPlanPanel();
    renderRows();
}

async function chooseAlternateCourse(entryIdx, selectedName) {
    const entry = plan[entryIdx];
    const normalizedName = (selectedName || "").trim().toUpperCase();
    if (!entry || !normalizedName || normalizedName.includes("/")) return;

    const duplicateIdx = plan.findIndex((p, idx) => idx !== entryIdx && p.name === normalizedName);
    if (duplicateIdx !== -1) {
        entry.sections.forEach(section => addSection(plan[duplicateIdx].sections, section));
        plan.splice(entryIdx, 1);
    } else {
        entry.name = normalizedName;
    }

    await savePlan();
    renderPlanPanel();
    renderRows();
}

function renderCourseNameControl(entry, entryIdx) {
    const courseOptions = getCourseNameOptions(entry.name);

    if (courseOptions.length <= 1) {
        const nameBadge = document.createElement("span");
        nameBadge.className = "plan-course-badge";
        nameBadge.textContent = entry.name;
        return nameBadge;
    }

    const nameSelect = document.createElement("select");
    nameSelect.className = "plan-course-select";
    nameSelect.title = "Choose course";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose";
    placeholder.disabled = true;
    placeholder.selected = true;
    nameSelect.appendChild(placeholder);

    courseOptions.forEach(courseName => {
        const option = document.createElement("option");
        option.value = courseName;
        option.textContent = courseName;
        nameSelect.appendChild(option);
    });

    nameSelect.addEventListener("change", () => chooseAlternateCourse(entryIdx, nameSelect.value));
    return nameSelect;
}

function getPlanCellHtml(course, section, inPlan) {
    if (inPlan) {
        return '<td class="plan-cell"><span class="added-check" title="In queue">✓</span></td>';
    }

    const courseOptions = getCourseNameOptions(course);
    if (courseOptions.length > 1) {
        const optionsHtml = courseOptions
            .map(name => `<option value="${name}">${name}</option>`)
            .join("");
        return `
            <td class="plan-cell">
                <select class="add-course-select" data-section="${section}" title="Choose course to add">
                    <option value="" selected disabled>Choose</option>
                    ${optionsHtml}
                </select>
            </td>
        `;
    }

    return `<td class="plan-cell"><button class="add-btn" data-course="${course}" data-section="${section}" title="Add to queue">+</button></td>`;
}

export function renderPlanPanel() {
    const planList = document.getElementById("planList");
    const planEmpty = document.getElementById("planEmpty");
    if (!planList) return;

    if (plan.length === 0) {
        planList.innerHTML = "";
        if (planEmpty) planEmpty.style.display = "block";
        return;
    }

    if (planEmpty) planEmpty.style.display = "none";
    planList.innerHTML = "";

    plan.forEach((entry, entryIdx) => {
        const item = document.createElement("div");
        item.className = "plan-item";

        const topRow = document.createElement("div");
        topRow.className = "plan-item-top";
        topRow.appendChild(renderCourseNameControl(entry, entryIdx));

        const chipsWrapper = document.createElement("div");
        chipsWrapper.className = "plan-section-chips";

        entry.sections.forEach((sec, secIdx) => {
            const chip = document.createElement("span");
            chip.className = "section-chip";
            chip.appendChild(document.createTextNode(sec));

            const chipRemove = document.createElement("button");
            chipRemove.className = "chip-remove";
            chipRemove.title = "Remove section";
            chipRemove.textContent = "x";
            chipRemove.addEventListener("click", async () => {
                plan[entryIdx].sections.splice(secIdx, 1);
                if (plan[entryIdx].sections.length === 0) {
                    plan.splice(entryIdx, 1);
                }
                await savePlan();
                renderPlanPanel();
                renderRows();
            });

            chip.appendChild(chipRemove);
            chipsWrapper.appendChild(chip);
        });

        topRow.appendChild(chipsWrapper);

        const removeBtn = document.createElement("button");
        removeBtn.className = "plan-remove-btn";
        removeBtn.title = "Remove from queue";
        removeBtn.textContent = "x";
        removeBtn.addEventListener("click", async () => {
            plan.splice(entryIdx, 1);
            await savePlan();
            renderPlanPanel();
            renderRows();
        });

        topRow.appendChild(removeBtn);
        item.appendChild(topRow);
        planList.appendChild(item);
    });
}

export function renderRows(data = getDisplayData()) {
    const tbody = document.getElementById("tableBody");
    const noResults = document.getElementById("noResults");
    const resultCount = document.getElementById("resultCount");
    if (!tbody) return;

    tbody.innerHTML = "";
    if (noResults) noResults.style.display = data.length === 0 ? "block" : "none";

    const searchInput = document.getElementById("searchInput");
    const hasQuery = searchInput && searchInput.value.trim().length > 0;

    if (resultCount) {
        resultCount.textContent = hasQuery
            ? `${data.length} result${data.length !== 1 ? "s" : ""}`
            : `Showing ${data.length} of ${allCourses.length} - search to filter`;
    }

    const showMoreBtn = document.getElementById("showMoreBtn");
    if (showMoreBtn) {
        showMoreBtn.style.display = !hasQuery && data.length < allCourses.length ? "inline-flex" : "none";
    }

    const plannedObjects = getPlannedCourseObjects();

    data.forEach((c, i) => {
        const inPlan = isInPlan(c.course, c.section);
        const clashes = inPlan ? [] : getClashInfo(c, plannedObjects);
        const sameDayFinals = inPlan ? [] : getSameDayFinalInfo(c, plannedObjects);

        const tr = document.createElement("tr");
        if (inPlan) tr.classList.add("in-plan");

        let iconHtml = "";
        if (clashes.length > 0) {
            iconHtml += `<span class="icon-clash" title="Time clash with: ${clashes.join(", ")}">!</span>`;
        }
        if (sameDayFinals.length > 0) {
            iconHtml += `<span class="icon-final" title="Same-day final with: ${sameDayFinals.join(", ")}">F</span>`;
        }

        tr.innerHTML = `
            <td class="muted">${c.serial || i + 1}</td>
            <td><strong>${c.course || "-"}</strong>${iconHtml}</td>
            <td><span class="badge">${c.section || "-"}</span></td>
            <td class="muted">${c.faculty || "-"}</td>
            <td class="muted">${c.day || "-"}</td>
            <td class="muted">${formatTimeDisplay(c.time)}</td>
            <td class="muted">${c.room || "-"}</td>
            <td class="muted">${c.seatsAvailable || "-"}</td>
            ${getPlanCellHtml(c.course, c.section, inPlan)}
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", () => addCourseToPlan(btn.dataset.course, btn.dataset.section));
    });

    tbody.querySelectorAll(".add-course-select").forEach(select => {
        select.addEventListener("change", () => addCourseToPlan(select.value, select.dataset.section));
    });
}
