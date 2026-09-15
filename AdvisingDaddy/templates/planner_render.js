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

// ── Shared styling (injected once) ──────────────────────────────────────────

function ensureStyles() {
    if (document.getElementById("plan-render-styles")) return;
    const style = document.createElement("style");
    style.id = "plan-render-styles";
    style.textContent = `
        .plan-item-draggable { cursor: grab; position: relative; }
        .plan-item-draggable.dragging { opacity: 0.45; cursor: grabbing; }
        .plan-item-draggable.drag-over-top { box-shadow: inset 0 2px 0 0 #4f8cff; }
        .plan-item-draggable.drag-over-bottom { box-shadow: inset 0 -2px 0 0 #4f8cff; }
        .plan-rank { opacity: 0.55; font-size: 11px; margin-right: 6px; font-variant-numeric: tabular-nums; }
        .plan-drag-handle { cursor: grab; opacity: 0.4; margin-right: 4px; user-select: none; }
        .section-chip { cursor: pointer; }
        .section-chip.dragging { opacity: 0.45; cursor: grabbing; }
        .section-chip.drag-over-left { box-shadow: inset 2px 0 0 0 #4f8cff; }
        .section-chip.drag-over-right { box-shadow: inset -2px 0 0 0 #4f8cff; }
        .section-chip:focus-visible {
            outline: 2px solid #4f8cff;
            outline-offset: 2px;
        }

        .icon-clash, .icon-final { cursor: pointer; }
        .icon-clash:focus-visible, .icon-final:focus-visible {
            outline: 2px solid #4f8cff;
            outline-offset: 2px;
        }
        .info-popover {
            position: absolute;
            z-index: 9999;
            display: none;
            max-width: 260px;
            background: #ffffff;
            color: #1f2430;
            border: 1px solid #e2e2e6;
            border-radius: 8px;
            padding: 10px 14px 10px 12px;
            font-size: 12.5px;
            line-height: 1.45;
            box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .info-popover-title {
            font-weight: 600;
            margin-bottom: 4px;
            padding-right: 12px;
        }
        .info-popover-list {
            margin: 0;
            padding-left: 16px;
        }
        .info-popover-list li { margin: 2px 0; }
        .info-popover-close {
            position: absolute;
            top: 4px;
            right: 6px;
            cursor: pointer;
            opacity: 0.5;
            font-size: 13px;
            line-height: 1;
            background: none;
            border: none;
            color: inherit;
            padding: 2px;
        }
        .info-popover-close:hover { opacity: 0.9; }
        .info-popover-arrow {
            position: absolute;
            top: -7px;
            width: 0;
            height: 0;
            border-left: 7px solid transparent;
            border-right: 7px solid transparent;
            border-bottom: 7px solid #ffffff;
            filter: drop-shadow(0 -1px 0 #e2e2e6);
        }
    `;
    document.head.appendChild(style);
}

// ── Generic click-to-show info popover ──────────────────────────────────────
// Used both for clash/same-day-final warnings and for section-chip details.

function ensureInfoPopover() {
    let popover = document.getElementById("plan-info-popover");
    if (popover) return popover;

    popover = document.createElement("div");
    popover.id = "plan-info-popover";
    popover.className = "info-popover";
    popover.setAttribute("role", "tooltip");
    document.body.appendChild(popover);

    document.addEventListener("click", (e) => {
        if (popover.style.display !== "block") return;
        if (popover.contains(e.target)) return;
        if (e.target.closest(".icon-clash, .icon-final, .section-chip")) return;
        hideInfoPopover();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") hideInfoPopover();
    });
    window.addEventListener("resize", hideInfoPopover);
    document.addEventListener("scroll", hideInfoPopover, true);

    return popover;
}

function hideInfoPopover() {
    const popover = document.getElementById("plan-info-popover");
    if (!popover) return;
    popover.style.display = "none";
    popover._anchor = null;
}

function showInfoPopover(anchorEl, title, items) {
    const popover = ensureInfoPopover();

    if (popover._anchor === anchorEl && popover.style.display === "block") {
        hideInfoPopover();
        return;
    }
    popover._anchor = anchorEl;
    popover.innerHTML = "";

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "info-popover-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        hideInfoPopover();
    });
    popover.appendChild(closeBtn);

    const titleEl = document.createElement("div");
    titleEl.className = "info-popover-title";
    titleEl.textContent = title;
    popover.appendChild(titleEl);

    const list = document.createElement("ul");
    list.className = "info-popover-list";
    items.forEach(text => {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
    });
    popover.appendChild(list);

    const arrow = document.createElement("div");
    arrow.className = "info-popover-arrow";
    popover.appendChild(arrow);

    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.style.display = "block";

    const rect = anchorEl.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();

    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY + 10;

    const maxLeft = window.scrollX + document.documentElement.clientWidth - popRect.width - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    // Point the arrow at the anchor's horizontal center, clamped so it
    // never slides past the popover's rounded corners.
    const anchorCenterX = rect.left + rect.width / 2 + window.scrollX;
    const arrowLeft = Math.max(12, Math.min(anchorCenterX - left, popRect.width - 12));
    arrow.style.left = `${arrowLeft}px`;
}

function bindClickPopover(el, getTitleAndItems) {
    if (!el) return;
    const trigger = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const { title, items } = getTitleAndItems();
        showInfoPopover(el, title, items);
    };
    el.addEventListener("click", trigger);
    el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") trigger(e);
    });
}

/**
 * Turn ["CSE425.3", ...] warning labels into "CSE425.3 facultyName (Day Time)"
 * by cross-referencing the full course objects behind each planned section.
 */
function formatWarningItems(labels, plannedObjects) {
    return labels.map(label => {
        const match = plannedObjects.find(p => `${p.course}.${p.section}` === label);
        if (!match) return label;
        const faculty = match.faculty || "-";
        const day = match.day || "-";
        const time = formatTimeDisplay(match.time);
        return `${label} ${faculty} (${day} ${time})`;
    });
}

/** Find the full course object behind a plan entry's course name + section */
function findCourseSection(courseName, section) {
    const options = getCourseNameOptions(courseName);
    return allCourses.find(c =>
        options.includes((c.course || "").toUpperCase()) && String(c.section) === String(section)
    );
}

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

// ── Section chip: click for details ─────────────────────────────────────────

function bindChipClick(chip, courseName, section) {
    chip.tabIndex = 0;
    chip.setAttribute("role", "button");
    chip.setAttribute("aria-haspopup", "true");
    chip.title = "Click for section details";

    bindClickPopover(chip, () => {
        const match = findCourseSection(courseName, section);
        const title = `${courseName}.${section}`;
        const items = match
            ? [
                `Faculty: ${match.faculty || "-"}`,
                `Day: ${match.day || "-"}`,
                `Time: ${formatTimeDisplay(match.time)}`,
                `Room: ${match.room || "-"}`,
                `Seats available: ${match.seatsAvailable ?? "-"}`
            ]
            : ["No details found for this section."];
        return { title, items };
    });
}

// ── Drag-and-drop: section chips (horizontal, left = highest priority) ─────

function bindChipDrag(chip, entryIdx, secIdx) {
    chip.draggable = true;
    chip.title = (chip.title ? chip.title + " — " : "") + "Drag left/right to reorder priority";

    chip.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-plan-section", String(secIdx));
        chip.classList.add("dragging");
    });

    chip.addEventListener("dragend", (e) => {
        e.stopPropagation();
        chip.classList.remove("dragging");
    });

    chip.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("application/x-plan-section")) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const rect = chip.getBoundingClientRect();
        const before = (e.clientX - rect.left) < rect.width / 2;
        chip.classList.toggle("drag-over-left", before);
        chip.classList.toggle("drag-over-right", !before);
    });

    chip.addEventListener("dragleave", (e) => {
        e.stopPropagation();
        chip.classList.remove("drag-over-left", "drag-over-right");
    });

    chip.addEventListener("drop", async (e) => {
        if (!e.dataTransfer.types.includes("application/x-plan-section")) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = chip.getBoundingClientRect();
        const before = (e.clientX - rect.left) < rect.width / 2;
        chip.classList.remove("drag-over-left", "drag-over-right");

        const fromIdx = Number(e.dataTransfer.getData("application/x-plan-section"));
        if (Number.isNaN(fromIdx)) return;

        const sections = plan[entryIdx].sections;
        let toIdx = secIdx + (before ? 0 : 1);
        if (fromIdx === toIdx || fromIdx + 1 === toIdx) return;

        const [moved] = sections.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx -= 1;
        sections.splice(toIdx, 0, moved);

        await savePlan();
        renderPlanPanel();
        renderRows();
    });
}

// ── Drag-and-drop: plan items (vertical, top = highest priority) ───────────

function bindItemDrag(item, entryIdx) {
    item.draggable = true;
    item.classList.add("plan-item-draggable");

    item.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-plan-item", String(entryIdx));
        item.classList.add("dragging");
    });

    item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
    });

    item.addEventListener("dragover", (e) => {
        if (!e.dataTransfer.types.includes("application/x-plan-item")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = item.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        item.classList.toggle("drag-over-top", before);
        item.classList.toggle("drag-over-bottom", !before);
    });

    item.addEventListener("dragleave", () => {
        item.classList.remove("drag-over-top", "drag-over-bottom");
    });

    item.addEventListener("drop", async (e) => {
        if (!e.dataTransfer.types.includes("application/x-plan-item")) return;
        e.preventDefault();
        const rect = item.getBoundingClientRect();
        const before = (e.clientY - rect.top) < rect.height / 2;
        item.classList.remove("drag-over-top", "drag-over-bottom");

        const fromIdx = Number(e.dataTransfer.getData("application/x-plan-item"));
        if (Number.isNaN(fromIdx)) return;

        let toIdx = entryIdx + (before ? 0 : 1);
        if (fromIdx === toIdx || fromIdx + 1 === toIdx) return;

        const [moved] = plan.splice(fromIdx, 1);
        if (fromIdx < toIdx) toIdx -= 1;
        plan.splice(toIdx, 0, moved);

        await savePlan();
        renderPlanPanel();
        renderRows();
    });
}

export function renderPlanPanel() {
    const planList = document.getElementById("planList");
    const planEmpty = document.getElementById("planEmpty");
    if (!planList) return;

    ensureStyles();

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
        bindItemDrag(item, entryIdx);

        const topRow = document.createElement("div");
        topRow.className = "plan-item-top";

        const rank = document.createElement("span");
        rank.className = "plan-rank";
        rank.textContent = `${entryIdx + 1}.`;
        rank.title = "Priority rank — drag the row to reorder";
        topRow.appendChild(rank);

        const handle = document.createElement("span");
        handle.className = "plan-drag-handle";
        handle.textContent = "⋮⋮";
        handle.title = "Drag to reorder priority";
        topRow.appendChild(handle);

        topRow.appendChild(renderCourseNameControl(entry, entryIdx));

        const chipsWrapper = document.createElement("div");
        chipsWrapper.className = "plan-section-chips";

        entry.sections.forEach((sec, secIdx) => {
            const chip = document.createElement("span");
            chip.className = "section-chip";
            chip.appendChild(document.createTextNode(sec));
            bindChipClick(chip, entry.name, sec);
            bindChipDrag(chip, entryIdx, secIdx);

            const chipRemove = document.createElement("button");
            chipRemove.className = "chip-remove";
            chipRemove.title = "Remove section";
            chipRemove.textContent = "x";
            chipRemove.addEventListener("click", async (e) => {
                e.stopPropagation();
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

    ensureStyles();

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
            iconHtml += `<span class="icon-clash" tabindex="0" role="button" aria-haspopup="true" title="Time clash — click for details">!</span>`;
        }
        if (sameDayFinals.length > 0) {
            iconHtml += `<span class="icon-final" tabindex="0" role="button" aria-haspopup="true" title="Same-day final — click for details">F</span>`;
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

        bindClickPopover(tr.querySelector(".icon-clash"), () => ({
            title: "Time clash with",
            items: formatWarningItems(clashes, plannedObjects)
        }));
        bindClickPopover(tr.querySelector(".icon-final"), () => ({
            title: "Same-day final with",
            items: formatWarningItems(sameDayFinals, plannedObjects)
        }));
    });

    tbody.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", () => addCourseToPlan(btn.dataset.course, btn.dataset.section));
    });

    tbody.querySelectorAll(".add-course-select").forEach(select => {
        select.addEventListener("change", () => addCourseToPlan(select.value, select.dataset.section));
    });
}