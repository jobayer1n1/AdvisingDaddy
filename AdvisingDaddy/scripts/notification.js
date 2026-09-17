// scripts/notification.js
// Non-blocking in-page floating toast / notification banner manager

const ext = typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : undefined);

const ICONS = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    danger: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
};

let containerReadyPromise = null;

/**
 * Ensures the notification banner styles and container are injected into the document.
 */
export async function ensureNotificationContainer() {
    const existingContainer = document.getElementById("advdaddyToastContainer");
    const existingStyles = document.getElementById("advdaddy-notification-styles");
    if (existingContainer && existingStyles) {
        return existingContainer;
    }

    if (!containerReadyPromise) {
        containerReadyPromise = (async () => {
            try {
                const templateUrl = ext ? ext.runtime.getURL("templates/notification_banner.html") : "templates/notification_banner.html";
                const response = await fetch(templateUrl);
                const html = await response.text();

                const tempDiv = document.createElement("div");
                tempDiv.innerHTML = html;

                // Inject elements into DOM
                const target = document.body || document.documentElement;
                while (tempDiv.firstChild) {
                    target.appendChild(tempDiv.firstChild);
                }
            } catch (err) {
                console.error("AdvisingDaddy: Failed to load notification banner template:", err);
                // Fallback basic container if fetch fails
                if (!document.getElementById("advdaddyToastContainer")) {
                    const fallback = document.createElement("div");
                    fallback.id = "advdaddyToastContainer";
                    fallback.className = "advdaddy-toast-container";
                    fallback.style.cssText = "position:fixed;top:24px;right:24px;z-index:2147483647;display:flex;flex-direction:column;gap:12px;max-width:380px;pointer-events:none;";
                    (document.body || document.documentElement).appendChild(fallback);
                }
            }
            return document.getElementById("advdaddyToastContainer");
        })();
    }

    return containerReadyPromise;
}

/**
 * Displays a non-blocking in-page toast notification.
 * @param {string|Object} options - Message string or options object { title, message, type, duration }
 * @returns {Promise<HTMLElement>} The toast element
 */
export async function showNotification(options) {
    let title = "AdvisingDaddy";
    let message = "";
    let type = "info";
    let duration = 4500;

    if (typeof options === "string") {
        message = options;
        if (options.toUpperCase().includes("SEAT AVAILABLE")) {
            title = "Seat Available!";
            type = "success";
            duration = 5000;
        } else if (options.toUpperCase().includes("NEW SECTION")) {
            title = "New Section Alert!";
            type = "warning";
            duration = 5000;
        }
    } else if (options && typeof options === "object") {
        if (options.title) title = options.title;
        if (options.message) message = options.message;
        if (options.type && ["info", "success", "warning", "danger"].includes(options.type)) {
            type = options.type;
        }
        if (typeof options.duration === "number" && options.duration > 0) {
            duration = options.duration;
        }
    }

    const container = await ensureNotificationContainer();
    if (!container) return null;

    let toast;
    const template = document.getElementById("advdaddyToastTemplate");
    if (template && template.content) {
        toast = template.content.cloneNode(true).firstElementChild;
    } else {
        toast = document.createElement("div");
        toast.className = "advdaddy-toast";
        toast.setAttribute("role", "alert");
        toast.innerHTML = `
            <div class="advdaddy-toast-hud">
                <div class="advdaddy-toast-badge">
                    <span class="advdaddy-toast-badge-text">SYSTEM ALERT</span>
                </div>
                <button type="button" class="advdaddy-toast-close" title="Dismiss notification" aria-label="Dismiss notification">✕</button>
            </div>
            <div class="advdaddy-toast-content">
                <div class="advdaddy-toast-icon"></div>
                <div class="advdaddy-toast-body">
                    <div class="advdaddy-toast-title"></div>
                    <div class="advdaddy-toast-message"></div>
                </div>
            </div>
            <div class="advdaddy-toast-track" title="Time remaining">
                <div class="advdaddy-toast-progress"></div>
            </div>
        `;
    }

    toast.classList.add(`advdaddy-toast--${type}`);

    // HUD Badge tag based on type
    const badgeMap = {
        success: "SUCCESS",
        warning: "NEW SECTION DETECTED",
        danger: "ACTION REQUIRED",
        info: "SYSTEM ALERT"
    };
    const badgeTextEl = toast.querySelector(".advdaddy-toast-badge-text");
    if (badgeTextEl) {
        badgeTextEl.textContent = (options && options.hudTag) || badgeMap[type] || "SYSTEM ALERT";
    }

    const iconEl = toast.querySelector(".advdaddy-toast-icon");
    if (iconEl) {
        iconEl.innerHTML = ICONS[type] || ICONS.info;
    }

    const titleEl = toast.querySelector(".advdaddy-toast-title");
    if (titleEl) titleEl.textContent = title;

    const msgEl = toast.querySelector(".advdaddy-toast-message");
    if (msgEl) msgEl.textContent = message;

    const closeBtn = toast.querySelector(".advdaddy-toast-close");
    const progressEl = toast.querySelector(".advdaddy-toast-progress");
    const trackEl = toast.querySelector(".advdaddy-toast-track");

    // Ensure track and progress bar are visibly framed
    if (trackEl) {
        trackEl.style.height = "4px";
        trackEl.style.width = "100%";
        trackEl.style.background = "rgba(255, 255, 255, 0.16)";
        trackEl.style.overflow = "hidden";
        trackEl.style.display = "block";
    }
    if (progressEl) {
        progressEl.style.height = "100%";
        progressEl.style.display = "block";
        progressEl.style.width = "100%";
    }

    let isDismissed = false;
    let dismissTimeout = null;
    let startTime = Date.now();
    let remainingTime = duration;

    function dismiss() {
        if (isDismissed) return;
        isDismissed = true;
        clearTimeout(dismissTimeout);

        toast.classList.remove("show");
        toast.classList.add("hide");

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    function startTimer() {
        if (progressEl) {
            progressEl.style.animation = `advdaddyDrain ${duration}ms linear forwards`;
            progressEl.style.animationPlayState = "running";
        }
        startTime = Date.now();
        remainingTime = duration;

        clearTimeout(dismissTimeout);
        dismissTimeout = setTimeout(dismiss, duration);
    }

    function pauseTimer() {
        clearTimeout(dismissTimeout);
        const elapsed = Date.now() - startTime;
        remainingTime = Math.max(0, remainingTime - elapsed);

        if (progressEl) {
            progressEl.style.animationPlayState = "paused";
        }
    }

    function resumeTimer() {
        if (isDismissed || remainingTime <= 0) return;
        startTime = Date.now();

        clearTimeout(dismissTimeout);
        dismissTimeout = setTimeout(dismiss, remainingTime);

        if (progressEl) {
            progressEl.style.animationPlayState = "running";
        }
    }

    if (closeBtn) {
        closeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            dismiss();
        });
    }

    // Pause on hover, resume on leave
    toast.addEventListener("mouseenter", pauseTimer);
    toast.addEventListener("mouseleave", resumeTimer);

    // Add to container (newest on top)
    container.prepend(toast);

    // Trigger entrance animation and start time left bar
    requestAnimationFrame(() => {
        toast.classList.add("show");
        startTimer();
    });

    return toast;
}

// Global attachment for convenience in page scripts or console debugging
if (typeof window !== "undefined") {
    window.showAdvDaddyNotification = showNotification;
}
