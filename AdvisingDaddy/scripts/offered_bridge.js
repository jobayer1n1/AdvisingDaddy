// scripts/offered_bridge.js
// In-page bridge to safely extract unpaginated courses from DataTables in page context without CSP inline-script violations
(function() {
    const currentScript = document.currentScript || document.querySelector("script[data-request-id]");
    const requestId = currentScript ? currentScript.dataset.requestId : null;

    function respond(data) {
        window.dispatchEvent(new CustomEvent("ADVISING_DADDY_DATATABLE_RESPONSE", {
            detail: { requestId: requestId, data: data }
        }));
    }

    try {
        const $tbl = window.jQuery ? window.jQuery('#offeredCourseTbl') : null;
        if ($tbl && $tbl.length && window.jQuery.fn && window.jQuery.fn.DataTable && window.jQuery.fn.DataTable.isDataTable($tbl)) {
            const dt = $tbl.DataTable();
            const allRows = [];
            const dataArray = dt.rows().data();

            function strip(html) {
                if (html == null) return '';
                if (typeof html !== 'string') return String(html).trim();
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                return (tmp.textContent || tmp.innerText || '').trim();
            }

            for (let i = 0; i < dataArray.length; i++) {
                const row = dataArray[i];
                if (!row) continue;
                if (Array.isArray(row) && row.length >= 7) {
                    allRows.push({
                        serial: strip(row[0]),
                        course: strip(row[1]),
                        section: strip(row[2]),
                        faculty: strip(row[3]),
                        rawTime: strip(row[4]),
                        room: strip(row[5]),
                        seatsAvailable: strip(row[6])
                    });
                }
            }

            if (allRows.length > 0) {
                respond(allRows);
                return;
            }
        }
    } catch (e) {
        console.error('AdvisingDaddy DataTables extraction error:', e);
    }

    respond(null);
})();
