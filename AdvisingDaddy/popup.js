const ext = typeof browser !== "undefined" ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
    const courseInput = document.getElementById('courseInput');
    const sectionInput = document.getElementById('sectionInput');
    const addBtn = document.getElementById('addBtn');
    const priorityList = document.getElementById('priorityList');
    const clearBtn = document.getElementById('clearStorage');
    const masterToggle = document.getElementById('masterToggle');
    const statusLabel = document.getElementById('statusLabel');
    const alertStatusToggle = document.getElementById("alertStatusToggle");
    const alertStatusText = document.getElementById("alertStatusText");
    const autoSaveToggle = document.getElementById("autoSaveToggle")
    const autoSaveText = document.getElementById("autoSaveText")
    // --- Toggle Logic ---

    function updateLabel(isEnabled) {
        statusLabel.innerText = isEnabled ? "Addon Service Enabled" : "Addon Service Disabled";
        statusLabel.style.color = isEnabled ? "#91C6BC" : "#dc3545";
    }
    function updateAlertStatusLabel(isEnabled) {
        alertStatusText.innerText = isEnabled
            ? "New Section Alert Enabled"
            : "New Section Alert Disabled";

        alertStatusText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
    }
    function updateAutoSaveLabel(isEnabled) {
        autoSaveText.innerText = isEnabled
            ? "Auto Save Enabled"
            : "Auto Save Disabled";

        autoSaveText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
    }

    // Load Toggle States
    const res = await ext.storage.local.get(
        ['ControllerEnabled', 'alertOnNewSection', 'autoSave']
    );
    masterToggle.checked = res.ControllerEnabled || false;
    const alertEnabled = res.alertOnNewSection || false;
    const autoSaveEnabled = res.autoSave || false;
    alertStatusToggle.checked = alertEnabled;
    autoSaveToggle.checked = autoSaveEnabled;
    updateAlertStatusLabel(alertEnabled);
    updateLabel(masterToggle.checked);
    updateAutoSaveLabel(autoSaveEnabled);



    masterToggle.addEventListener('change', () => {
        const isEnabled = masterToggle.checked;
        ext.storage.local.set({ ControllerEnabled: isEnabled });
        updateLabel(isEnabled);
    });

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
            status.className = isDone ? 'check' : 'pending';
            status.textContent = isDone ? '\u2705' : '\u23f3';
            courseInfo.appendChild(status);

            const actions = document.createElement('div');
            actions.className = 'course-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.setAttribute('data-name', item.name);
            editBtn.title = 'Edit Sections';

            const editIcon = document.createElement('span');
            editIcon.className = 'edit-icon';
            editIcon.textContent = '\u270e';
            editBtn.appendChild(editIcon);

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

