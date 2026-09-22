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
    const checkUpdateBtn = document.getElementById("checkUpdateBtn")
    const localVersionBadge = document.getElementById("localVersionBadge")
    const updatePanel = document.getElementById("updatePanel")
    const updatePanelText = document.getElementById("updatePanelText")
    const updatePanelLink = document.getElementById("updatePanelLink")
    const closeUpdatePanelBtn = document.getElementById("closeUpdatePanelBtn")

    // Set static local version badge
    const manifest = ext.runtime.getManifest();
    const localVersion = manifest.version;
    if (localVersionBadge) {
        localVersionBadge.textContent = `v${localVersion}`;
    }

    if (closeUpdatePanelBtn) {
        closeUpdatePanelBtn.addEventListener('click', () => {
            updatePanel.className = 'update-panel update-panel--hidden';
        });
    }

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
        } else {
            injectMetaText.innerHTML = (isEnabled ? "Inject Metadata Enabled" : "Inject Metadata Disabled") +
                ' <span class="domain-tag">[all]</span>';
            injectMetaText.style.color = isEnabled ? "#91C6BC" : "#ffffffff";
            injectMetaToggle.disabled = false;
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
            ext.tabs.create({ url: ext.runtime.getURL('templates/advising_daddy.html') });
        });
    }

    // --- Update Check Logic ---

    const GITHUB_RELEASES_API = 'https://api.github.com/repos/jobayer1n1/AdvisingDaddy/releases/latest';
    const GITHUB_RELEASES_PAGE = 'https://github.com/jobayer1n1/AdvisingDaddy/releases';

    /**
     * Normalises a version string by stripping a leading 'v' and trimming whitespace.
     * e.g. "v1.3" -> "1.3", "1.3" -> "1.3"
     */
    function normaliseVersion(v) {
        return (v || '').replace(/^v/i, '').trim();
    }

    /**
     * Compares two semver-like version strings.
     * Returns true if `remote` is strictly newer than `local`.
     */
    function isNewerVersion(local, remote) {
        const localParts = normaliseVersion(local).split('.').map(Number);
        const remoteParts = normaliseVersion(remote).split('.').map(Number);
        const maxLen = Math.max(localParts.length, remoteParts.length);
        for (let i = 0; i < maxLen; i++) {
            const l = localParts[i] || 0;
            const r = remoteParts[i] || 0;
            if (r > l) return true;
            if (r < l) return false;
        }
        return false;
    }

    async function checkForUpdate() {
        updatePanel.className = 'update-panel';
        updatePanelText.textContent = 'Checking...';
        updatePanelLink.style.display = 'none';

        try {
            const response = await fetch(GITHUB_RELEASES_API, {
                headers: { 'Accept': 'application/vnd.github+json' }
            });

            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }

            const data = await response.json();
            const latestTag = data.tag_name || '';
            const releaseUrl = data.html_url || GITHUB_RELEASES_PAGE;

            if (isNewerVersion(localVersion, latestTag)) {
                updatePanel.className = 'update-panel update-panel--new';
                updatePanelText.textContent = 'New Version Found:';
                updatePanelLink.textContent = normaliseVersion(latestTag);
                updatePanelLink.href = releaseUrl;
                updatePanelLink.className = 'update-panel-link';
                updatePanelLink.style.display = 'inline-block';
            } else {
                updatePanel.className = 'update-panel update-panel--ok';
                updatePanelText.textContent = `Up to Date: v${normaliseVersion(localVersion)}`;
                updatePanelLink.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg> GitHub`;
                updatePanelLink.href = 'https://github.com/jobayer1n1/AdvisingDaddy';
                updatePanelLink.className = 'update-panel-link update-panel-link--github';
                updatePanelLink.style.display = 'inline-flex';
                updatePanelLink.style.alignItems = 'center';
                updatePanelLink.style.gap = '4px';
            }
        } catch (err) {
            updatePanel.className = 'update-panel update-panel--error';
            updatePanelText.textContent = 'Check failed';
            updatePanelLink.style.display = 'none';
            console.error('[AdvisingDaddy] Update check failed:', err);
        }
    }

    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', () => {
            checkForUpdate();
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

        if (course.includes('/')) {
            alert("Please add only one course at a time. Choose either side of the slash-separated course name.");
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

