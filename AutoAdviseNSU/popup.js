document.addEventListener('DOMContentLoaded', async () => {
    const courseInput = document.getElementById('courseInput');
    const sectionInput = document.getElementById('sectionInput');
    const addBtn = document.getElementById('addBtn');
    const priorityList = document.getElementById('priorityList');
    const clearBtn = document.getElementById('clearStorage');
    const masterToggle = document.getElementById('masterToggle');
    const statusLabel = document.getElementById('statusLabel');

    // Function to update the label text
    function updateLabel(isEnabled) {
        statusLabel.innerText = isEnabled ? "Automation Enabled" : "Automation Disabled";
        statusLabel.style.color = isEnabled ? "#28a745" : "#dc3545"; // Optional: Green for on, Red for off
    }

    // 1. Load saved state and set initial label
    chrome.storage.local.get(['automationEnabled'], (res) => {
        const isEnabled = res.automationEnabled || false;
        masterToggle.checked = isEnabled;
        updateLabel(isEnabled);
    });

    // 2. Listen for changes to update label and storage
    masterToggle.addEventListener('change', () => {
        const isEnabled = masterToggle.checked;
        chrome.storage.local.set({ automationEnabled: isEnabled });
        updateLabel(isEnabled);
    });
    // Load data on start
    renderList();

    // Add Preference Handler
    addBtn.addEventListener('click', async () => {
        const course = courseInput.value.trim().toUpperCase();
        const sectionStr = sectionInput.value.trim();

        if (!course || !sectionStr) {
            alert("Please fill in both fields.");
            return;
        }

        // Parse sections: split by comma, trim spaces
        const sections = sectionStr.split(',').map(s => s.trim()).filter(s => s !== "");

        const newEntry = { name: course, sections: sections };

        // Save to storage
        const data = await chrome.storage.local.get("advisingPriorities");
        const currentList = data.advisingPriorities || [];
        
        // Remove existing entry for same course if exists (update)
        const filteredList = currentList.filter(item => item.name !== course);
        filteredList.push(newEntry);

        await chrome.storage.local.set({ advisingPriorities: filteredList });
        
        // Clear inputs and redraw
        courseInput.value = '';
        sectionInput.value = '';
        renderList();
    });

    // Clear All Data
    clearBtn.addEventListener('click', async () => {
        await chrome.storage.local.clear();
        renderList();
    });

    // Render Logic
    async function renderList() {
        const data = await chrome.storage.local.get(["advisingPriorities", "completedCourses"]);
        const list = data.advisingPriorities || [];
        const completed = data.completedCourses || [];

        priorityList.innerHTML = '';

        if (list.length === 0) {
            priorityList.innerHTML = '<div class="empty-state">None</div>';
            return;
        }

        list.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'course-row';

            // Check if course is successfully added (based on content script feedback)
            // Replace the icon lines in your renderList function with these:
            const isDone = completed.includes(item.name);

            // Using HTML Entities (&#9989; is Checkmark, &#9203; is Hourglass)
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

        // Add delete listeners
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const nameToRemove = e.target.getAttribute('data-name');
                const newData = await chrome.storage.local.get("advisingPriorities");
                const current = newData.advisingPriorities || [];
                const updated = current.filter(i => i.name !== nameToRemove);
                await chrome.storage.local.set({ advisingPriorities: updated });
                renderList();
            });
        });
    }
});