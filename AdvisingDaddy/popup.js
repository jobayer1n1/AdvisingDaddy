const ext = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
    const courseInput = document.getElementById('courseInput');
    const sectionInput = document.getElementById('sectionInput');
    const addBtn = document.getElementById('addBtn');
    const priorityList = document.getElementById('priorityList');
    const clearBtn = document.getElementById('clearStorage');
    const alertStatusToggle = document.getElementById("alertStatusToggle");
    const alertStatusText = document.getElementById("alertStatusText");
    const autoSaveToggle = document.getElementById("autoSaveToggle")
    const autoSaveText = document.getElementById("autoSaveText")
    const seatAlertToggle = document.getElementById("seatAlertToggle")
    const seatAlertText = document.getElementById("seatAlertText")
    const injectMetaToggle = document.getElementById("injectMetaToggle")
    const injectMetaText = document.getElementById("injectMetaText")
    const viewMetaBtn = document.getElementById("viewMetaBtn")

    // --- Toggle Logic ---

    function updateAlertStatusLabel(isEnabled) {
        alertStatusText.innerHTML = (isEnabled ? "New Section Alert Enabled" : "New Section Alert Disabled") +
            ' <span class="domain-tag">[queued]</span>';

        alertStatusText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
    }
    function updateAutoSaveLabel(isEnabled) {
        autoSaveText.innerHTML = (isEnabled ? "Auto Save Enabled" : "Auto Save Disabled") +
            ' <span class="domain-tag">[queued]</span>';

        autoSaveText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
    }
    function updateSeatAlertLabel(isEnabled) {
        seatAlertText.innerHTML = (isEnabled ? "Seat Alert Enabled" : "Seat Alert Disabled") +
            ' <span class="domain-tag">[queued]</span>';

        seatAlertText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
    }
    function updateInjectMetaLabel(isEnabled, hasMetadata) {
        if (!hasMetadata) {
            injectMetaText.innerHTML = 'Inject Metadata (No data saved) <span class="domain-tag">[all]</span>';
            injectMetaText.style.color = "#9aa3ad";
            injectMetaToggle.disabled = true;
            injectMetaToggle.checked = false;
            if (viewMetaBtn) viewMetaBtn.style.display = "none";
        } else {
            injectMetaText.innerHTML = (isEnabled ? "Inject Metadata Enabled" : "Inject Metadata Disabled") +
                ' <span class="domain-tag">[all]</span>';
            injectMetaText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
            injectMetaToggle.disabled = false;
            if (viewMetaBtn) viewMetaBtn.style.display = "inline-flex";
        }
    }

    // Load Toggle States
    const res = await ext.storage.local.get(
        ['alertOnNewSection', 'autoSave', 'seatAlert', 'injectMetadata', 'offeredCourses']
    );
    const alertEnabled = res.alertOnNewSection || false;
    const autoSaveEnabled = res.autoSave || false;
    const seatAlertEnabled = res.seatAlert || false;
    alertStatusToggle.checked = alertEnabled;
    autoSaveToggle.checked = autoSaveEnabled;
    seatAlertToggle.checked = seatAlertEnabled;
    updateAlertStatusLabel(alertEnabled);
    updateAutoSaveLabel(autoSaveEnabled);
    updateSeatAlertLabel(seatAlertEnabled);

    const hasMetadata = Array.isArray(res.offeredCourses) && res.offeredCourses.length > 0;
    const injectMetaEnabled = hasMetadata ? (res.injectMetadata || false) : false;
    injectMetaToggle.checked = injectMetaEnabled;
    updateInjectMetaLabel(injectMetaEnabled, hasMetadata);

    if (alertStatusToggle) {
        alertStatusToggle.addEventListener('change', () => {
            const isEnabled = alertStatusToggle.checked;
            ext.storage.local.set({
                alertOnNewSection: isEnabled
            });

            updateAlertStatusLabel(isEnabled);
        });
    }

    if (autoSaveToggle) {
        autoSaveToggle.addEventListener('change', () => {
            const isEnabled = autoSaveToggle.checked;

            ext.storage.local.set({
                autoSave: isEnabled
            });

            updateAutoSaveLabel(isEnabled);
        });
    }

    if (seatAlertToggle) {
        seatAlertToggle.addEventListener('change', () => {
            const isEnabled = seatAlertToggle.checked;
            ext.storage.local.set({ seatAlert: isEnabled });
            updateSeatAlertLabel(isEnabled);
        });
    }

    if (injectMetaToggle) {
        injectMetaToggle.addEventListener('change', () => {
            const isEnabled = injectMetaToggle.checked;
            ext.storage.local.set({ injectMetadata: isEnabled });
            updateInjectMetaLabel(isEnabled, true);
        });
    }

    if (viewMetaBtn) {
        viewMetaBtn.addEventListener('click', () => {
            ext.tabs.create({ url: ext.runtime.getURL('templates/view_saved_course_metadatas.html') });
        });
    }


    // --- Course List Logic ---

    renderList();

    addBtn.addEventListener('click', async () => {
        const course = courseInput.value.trim().toUpperCase();
        const sectionStr = sectionInput.value.trim();

        if (!course || !sectionStr) {
            alert("Please fill in both fields.");
            return;
        }

        const sections = sectionStr.split(',').map(s => s.trim()).filter(s => s !== "");
        const newEntry = { name: course, sections: sections };

        const data = await ext.storage.local.get("advisingPriorities");
        const currentList = data.advisingPriorities || [];
        
        // Update existing or add new
        const filteredList = currentList.filter(item => item.name !== course);
        filteredList.push(newEntry);

        await ext.storage.local.set({ advisingPriorities: filteredList });
        
        courseInput.value = '';
        sectionInput.value = '';
        renderList();
    });

    // Smart Clear: Clears only the courses, keeps your toggles/settings
    clearBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear your course list?")) {
            await ext.storage.local.set({ advisingPriorities: [], completedCourses: [] });
            renderList();
        }
    });

    async function renderList() {
        const data = await ext.storage.local.get(["advisingPriorities", "completedCourses"]);
        const list = data.advisingPriorities || [];
        const completed = data.completedCourses || [];

        priorityList.innerHTML = '';

        if (list.length === 0) {
            priorityList.innerHTML = '<div class="empty-state">None</div>';
            return;
        }

        list.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'course-row';
            row.setAttribute('data-name', item.name);

            const isDone = completed.includes(item.name);
            const courseInfo = document.createElement('div');
            courseInfo.className = 'course-info';

            const strong = document.createElement('strong');
            strong.textContent = item.name;
            courseInfo.appendChild(strong);

            courseInfo.appendChild(document.createTextNode(' '));

            const sections = document.createElement('span');
            sections.className = 'sections';
            sections.textContent = `(${item.sections.join(', ')})`;
            courseInfo.appendChild(sections);

            courseInfo.appendChild(document.createTextNode(' '));

            const status = document.createElement('span');
            status.className = isDone ? 'status-badge status-badge--done' : 'status-badge status-badge--pending';
            status.title = isDone ? 'Enrolled on advising slip' : 'Pending (not enrolled yet)';
            status.innerHTML = isDone
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
            courseInfo.appendChild(status);

            const actions = document.createElement('div');
            actions.className = 'course-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.setAttribute('data-name', item.name);
            editBtn.title = 'Edit Sections';
            editBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
            `;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-btn';
            removeBtn.setAttribute('data-name', item.name);
            removeBtn.title = 'Remove Course';
            removeBtn.textContent = '\u2716';

            actions.appendChild(editBtn);
            actions.appendChild(removeBtn);

            const editPanel = document.createElement('div');
            editPanel.className = 'edit-panel';
            editPanel.setAttribute('data-name', item.name);

            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.className = 'edit-sections-input';
            editInput.setAttribute('data-name', item.name);
            editInput.value = item.sections.join(',');
            editInput.placeholder = 'Sections (e.g., 1,2,3)';
            editPanel.appendChild(editInput);

            row.appendChild(courseInfo);
            row.appendChild(actions);
            row.appendChild(editPanel);
            priorityList.appendChild(row);
        });

        // Edit / Save listeners
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const targetBtn = e.currentTarget;
                const courseName = targetBtn.getAttribute('data-name');
                const row = targetBtn.closest('.course-row');
                const panel = row.querySelector('.edit-panel');
                const input = row.querySelector('.edit-sections-input');

                const isEditing = row.classList.contains('editing');
                if (!isEditing) {
                    row.classList.add('editing');
                    panel.style.display = 'block';
                    targetBtn.innerText = 'Save';
                    targetBtn.classList.add('save-mode');
                    input.focus();
                    const endPos = input.value.length;
                    input.setSelectionRange(endPos, endPos);
                    return;
                }

                const sectionStr = input.value.trim();
                if (!sectionStr) {
                    alert("Sections cannot be empty.");
                    input.focus();
                    return;
                }

                const sections = sectionStr
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s !== "");

                if (sections.length === 0) {
                    alert("Please provide at least one valid section.");
                    input.focus();
                    return;
                }

                const stored = await ext.storage.local.get("advisingPriorities");
                const current = stored.advisingPriorities || [];
                const updated = current.map(course =>
                    course.name === courseName
                        ? { ...course, sections }
                        : course
                );

                await ext.storage.local.set({ advisingPriorities: updated });
                renderList();
            });
        });

        // Delete listeners
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const nameToRemove = e.currentTarget.getAttribute('data-name');
                const shouldDelete = confirm(`Remove ${nameToRemove} from the queue?`);
                if (!shouldDelete) return;
                const newData = await ext.storage.local.get("advisingPriorities");
                const current = newData.advisingPriorities || [];
                const updated = current.filter(i => i.name !== nameToRemove);
                
                // Also remove from completed if it was there
                const completedData = await ext.storage.local.get("completedCourses");
                const updatedCompleted = (completedData.completedCourses || []).filter(n => n !== nameToRemove);

                await ext.storage.local.set({ 
                    advisingPriorities: updated, 
                    completedCourses: updatedCompleted 
                });
                renderList();
            });
        });
    }
});

