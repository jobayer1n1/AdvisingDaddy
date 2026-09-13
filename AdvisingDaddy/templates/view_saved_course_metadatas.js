const ext = typeof browser !== "undefined" ? browser : chrome;

async function init() {
    const app = document.getElementById('app');
    const deleteMetaBtn = document.getElementById('deleteMetaBtn');

    if (deleteMetaBtn) {
        deleteMetaBtn.addEventListener('click', async () => {
            if (!confirm('Delete all saved course metadata? This cannot be undone.')) return;
            try {
                await ext.storage.local.remove(['offeredCourses', 'offeredCourseMeta']);
                await ext.storage.local.set({ injectMetadata: false });
            } catch (err) {
                console.error('Error removing metadata from storage:', err);
            }

            // Try closing current tab via tabs API
            try {
                if (ext.tabs && ext.tabs.getCurrent) {
                    const tab = await ext.tabs.getCurrent();
                    if (tab && tab.id) {
                        await ext.tabs.remove(tab.id);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Could not close tab via tabs API:', err);
            }

            // Fallback close
            window.close();

            // If still open, update UI to reflect deleted state
            deleteMetaBtn.style.display = 'none';
            app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
        });
    }

    const { offeredCourses, offeredCourseMeta } = await ext.storage.local.get(['offeredCourses', 'offeredCourseMeta']);

    if (!Array.isArray(offeredCourses) || offeredCourses.length === 0) {
        if (deleteMetaBtn) deleteMetaBtn.style.display = 'none';
        app.innerHTML = '<p class="no-data">No saved metadata found.<br>Save from the offered courses page first.</p>';
        return;
    }

    if (deleteMetaBtn) deleteMetaBtn.style.display = 'flex';

    const meta = offeredCourseMeta || {};
    const savedAt = meta.savedAt ? new Date(meta.savedAt).toLocaleString() : '—';

    app.innerHTML = `
        <div class="meta-bar">
            <div class="meta-chip">Courses <span>${offeredCourses.length}</span></div>
            <div class="meta-chip">Saved at <span>${savedAt}</span></div>
            <div class="meta-chip">Source <span>${meta.source || '—'}</span></div>
        </div>
        <div class="search-bar">
            <input id="searchInput" type="text" placeholder="Filter by course, faculty, room…">
            <span id="resultCount">${offeredCourses.length} entries</span>
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
                    </tr>
                </thead>
                <tbody id="tableBody"></tbody>
            </table>
            <p id="noResults">No matching entries.</p>
        </div>
    `;

    const tbody = document.getElementById('tableBody');
    const searchInput = document.getElementById('searchInput');
    const resultCount = document.getElementById('resultCount');
    const noResults = document.getElementById('noResults');

    function renderRows(data) {
        tbody.innerHTML = '';
        if (data.length === 0) {
            noResults.style.display = 'block';
            resultCount.textContent = '0 entries';
            return;
        }
        noResults.style.display = 'none';
        resultCount.textContent = `${data.length} entries`;
        data.forEach((c, i) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="muted">${c.serial || i + 1}</td>
                <td><strong>${c.course || '—'}</strong></td>
                <td><span class="badge">${c.section || '—'}</span></td>
                <td class="muted">${c.faculty || '—'}</td>
                <td class="muted">${c.day || '—'}</td>
                <td class="muted">${c.time || '—'}</td>
                <td class="muted">${c.room || '—'}</td>
                <td class="muted">${c.seatsAvailable || '—'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    renderRows(offeredCourses);

    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        if (!q) { renderRows(offeredCourses); return; }
        const filtered = offeredCourses.filter(c =>
            (c.course || '').toLowerCase().includes(q) ||
            (c.faculty || '').toLowerCase().includes(q) ||
            (c.room || '').toLowerCase().includes(q) ||
            (c.section || '').toLowerCase().includes(q) ||
            (c.day || '').toLowerCase().includes(q)
        );
        renderRows(filtered);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
