document.addEventListener('DOMContentLoaded', async () => {
    const courseInput = document.getElementById('courseInput');
    const sectionInput = document.getElementById('sectionInput');
    const addBtn = document.getElementById('addBtn');
    const priorityList = document.getElementById('priorityList');
    const clearBtn = document.getElementById('clearStorage');
    const masterToggle = document.getElementById('masterToggle');
    const statusLabel = document.getElementById('statusLabel');
    const autoReloadToggle = document.getElementById('autoReloadToggle'); // Ensure this ID exists in HTML
    // const darkToggle = document.getElementById("darkToggle");

    // // Load saved theme
    // chrome.storage.local.get("darkMode", (data) => {
    //     if (data.darkMode) {
    //         document.body.classList.add("dark");
    //         darkToggle.checked = true;
    //     }
    // });

    // // Toggle theme
    // darkToggle.addEventListener("change", () => {
    //     const isDark = darkToggle.checked;

    //     document.body.classList.toggle("dark", isDark);

    //     chrome.storage.local.set({ darkMode: isDark });
    // });


    // --- Toggle Logic ---

    function updateLabel(isEnabled) {
        statusLabel.innerText = isEnabled ? "Automation Enabled" : "Automation Disabled";
        statusLabel.style.color = isEnabled ? "#28a745" : "#dc3545";
    }

    // Load Toggle States
    chrome.storage.local.get(['automationEnabled', 'autoReloadEnabled'], (res) => {
        masterToggle.checked = res.automationEnabled || false;
        if (autoReloadToggle) autoReloadToggle.checked = res.autoReloadEnabled || false;
        updateLabel(masterToggle.checked);
    });

    masterToggle.addEventListener('change', () => {
        const isEnabled = masterToggle.checked;
        chrome.storage.local.set({ automationEnabled: isEnabled });
        updateLabel(isEnabled);
    });

    if (autoReloadToggle) {
        autoReloadToggle.addEventListener('change', () => {
            chrome.storage.local.set({ autoReloadEnabled: autoReloadToggle.checked });
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

        const data = await chrome.storage.local.get("advisingPriorities");
        const currentList = data.advisingPriorities || [];
        
        // Update existing or add new
        const filteredList = currentList.filter(item => item.name !== course);
        filteredList.push(newEntry);

        await chrome.storage.local.set({ advisingPriorities: filteredList });
        
        courseInput.value = '';
        sectionInput.value = '';
        renderList();
    });

    // Smart Clear: Clears only the courses, keeps your toggles/settings
    clearBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to clear your course list?")) {
            await chrome.storage.local.set({ advisingPriorities: [], completedCourses: [] });
            renderList();
        }
    });

    async function renderList() {
        const data = await chrome.storage.local.get(["advisingPriorities", "completedCourses"]);
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

            const isDone = completed.includes(item.name);
            const statusIcon = isDone ? '<span class="check">&#9989;</span>' : '<span class="pending">&#9203;</span>';

            row.innerHTML = `
                <div class="course-info">
                    <strong>${item.name}</strong> 
                    <span class="sections">(${item.sections.join(', ')})</span>
                    ${statusIcon}
                </div>
                <button class="remove-btn" data-name="${item.name}">&#10006;</button> 
            `;
            priorityList.appendChild(row);
        });

        // Delete listeners
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const nameToRemove = e.target.getAttribute('data-name');
                const newData = await chrome.storage.local.get("advisingPriorities");
                const current = newData.advisingPriorities || [];
                const updated = current.filter(i => i.name !== nameToRemove);
                
                // Also remove from completed if it was there
                const completedData = await chrome.storage.local.get("completedCourses");
                const updatedCompleted = (completedData.completedCourses || []).filter(n => n !== nameToRemove);

                await chrome.storage.local.set({ 
                    advisingPriorities: updated, 
                    completedCourses: updatedCompleted 
                });
                renderList();
            });
        });
    }
});