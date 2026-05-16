/**
 * ui_feedback.js — Shared Toast & Confirm Modal
 * Exposes window.showToast() and window.showConfirm() for all pages.
 * Include as a classic (non-module) <script> BEFORE other page scripts.
 */

(function () {
    'use strict';

    // ── Inject CSS ───────────────────────────────────────────────────────────
    const CSS = `
/* ── Toast Container ─────────────────────────────── */
#ui-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    z-index: 99999;
    pointer-events: none;
}
.ui-toast {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 280px;
    max-width: 400px;
    padding: 14px 16px;
    border-radius: 10px;
    background: #1e293b;
    color: #f1f5f9;
    font-size: 14px;
    line-height: 1.45;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 8px 28px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.15);
    pointer-events: all;
    animation: ui-toast-in 0.35s cubic-bezier(.21,1.02,.73,1) forwards;
    border-left: 4px solid #3b82f6;
}
.ui-toast.ui-toast-error   { border-left-color: #ef4444; }
.ui-toast.ui-toast-success { border-left-color: #22c55e; }
.ui-toast.ui-toast-warning { border-left-color: #f59e0b; }
.ui-toast.ui-toast-info    { border-left-color: #3b82f6; }
.ui-toast-icon  { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
.ui-toast-body  { flex: 1; min-width: 0; }
.ui-toast-title { font-weight: 600; margin-bottom: 2px; color: #f8fafc; }
.ui-toast-msg   { color: #94a3b8; word-break: break-word; }
.ui-toast-close {
    background: none; border: none; color: #64748b;
    cursor: pointer; font-size: 16px; padding: 0; flex-shrink: 0;
    align-self: flex-start; line-height: 1; transition: color .15s;
}
.ui-toast-close:hover { color: #f1f5f9; }
.ui-toast-out { animation: ui-toast-out 0.28s ease forwards !important; }

@keyframes ui-toast-in {
    from { opacity: 0; transform: translateX(48px) scale(.94); }
    to   { opacity: 1; transform: translateX(0)    scale(1);   }
}
@keyframes ui-toast-out {
    from { opacity: 1; transform: translateX(0)    scale(1);    max-height: 120px; margin-bottom: 0; }
    to   { opacity: 0; transform: translateX(48px) scale(.94); max-height: 0;     margin-bottom: -10px; padding: 0; }
}

/* ── Confirm Modal ───────────────────────────────── */
#ui-confirm-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center;
    z-index: 100000;
    animation: ui-overlay-in .18s ease;
}
@keyframes ui-overlay-in { from { opacity:0; } to { opacity:1; } }
#ui-confirm-box {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    padding: 28px 28px 24px;
    width: min(420px, calc(100vw - 40px));
    box-shadow: 0 24px 60px rgba(0,0,0,.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    animation: ui-box-in .22s cubic-bezier(.21,1.02,.73,1);
    color: #f1f5f9;
}
@keyframes ui-box-in {
    from { opacity:0; transform: scale(.92) translateY(12px); }
    to   { opacity:1; transform: scale(1)   translateY(0);     }
}
#ui-confirm-icon {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(245,158,11,.12);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; margin-bottom: 16px;
}
#ui-confirm-title {
    font-size: 17px; font-weight: 700; color: #f8fafc;
    margin: 0 0 8px;
}
#ui-confirm-msg {
    font-size: 14px; color: #94a3b8; line-height: 1.55;
    margin: 0 0 24px; white-space: pre-wrap; word-break: break-word;
}
.ui-confirm-actions {
    display: flex; gap: 10px; justify-content: flex-end;
}
.ui-confirm-btn {
    padding: 9px 20px; border-radius: 8px; font-size: 14px;
    font-weight: 600; cursor: pointer; border: none;
    transition: opacity .15s, transform .1s;
}
.ui-confirm-btn:hover { opacity: .87; }
.ui-confirm-btn:active { transform: translateY(1px); }
.ui-confirm-cancel {
    background: #334155; color: #cbd5e1;
}
.ui-confirm-ok {
    background: #ef4444; color: #fff;
}
`;

    function injectCSS() {
        if (document.getElementById('ui-feedback-styles')) return;
        const style = document.createElement('style');
        style.id = 'ui-feedback-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const TITLES = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

    function getToastContainer() {
        let c = document.getElementById('ui-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'ui-toast-container';
            document.body.appendChild(c);
        }
        return c;
    }

    /**
     * Show a toast notification.
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} [type='info']
     * @param {number} [duration=5000]  ms before auto-dismiss
     */
    function showToast(message, type, duration) {
        type = type || 'info';
        duration = duration !== undefined ? duration : 5000;

        injectCSS();
        const container = getToastContainer();

        const toast = document.createElement('div');
        toast.className = 'ui-toast ui-toast-' + type;
        toast.innerHTML =
            '<span class="ui-toast-icon">' + (ICONS[type] || 'ℹ️') + '</span>' +
            '<div class="ui-toast-body">' +
            '<div class="ui-toast-title">' + (TITLES[type] || 'Info') + '</div>' +
            '<div class="ui-toast-msg">' + message + '</div>' +
            '</div>' +
            '<button class="ui-toast-close" aria-label="Dismiss">✕</button>';

        function dismiss() {
            clearTimeout(timer);
            toast.classList.add('ui-toast-out');
            toast.addEventListener('animationend', function () { toast.remove(); }, { once: true });
        }

        toast.querySelector('.ui-toast-close').addEventListener('click', dismiss);
        container.appendChild(toast);
        var timer = setTimeout(dismiss, duration);
    }

    // ── Confirm Modal ─────────────────────────────────────────────────────────
    /**
     * Show a styled confirmation modal instead of window.confirm().
     * @param {string} message
     * @param {string} [title='Are you sure?']
     * @returns {Promise<boolean>}
     */
    function showConfirm(message, title) {
        title = title || 'Are you sure?';
        injectCSS();

        return new Promise(function (resolve) {
            // Remove any existing overlay
            var existing = document.getElementById('ui-confirm-overlay');
            if (existing) existing.remove();

            var overlay = document.createElement('div');
            overlay.id = 'ui-confirm-overlay';
            overlay.innerHTML =
                '<div id="ui-confirm-box">' +
                '<div id="ui-confirm-icon">⚠️</div>' +
                '<p id="ui-confirm-title">' + title + '</p>' +
                '<p id="ui-confirm-msg">' + message + '</p>' +
                '<div class="ui-confirm-actions">' +
                '<button class="ui-confirm-btn ui-confirm-cancel" id="ui-confirm-no">Cancel</button>' +
                '<button class="ui-confirm-btn ui-confirm-ok"     id="ui-confirm-yes">Confirm</button>' +
                '</div>' +
                '</div>';

            function cleanup(result) {
                overlay.style.animation = 'ui-overlay-in .15s ease reverse forwards';
                setTimeout(function () { overlay.remove(); }, 150);
                resolve(result);
            }

            overlay.querySelector('#ui-confirm-yes').addEventListener('click', function () { cleanup(true); });
            overlay.querySelector('#ui-confirm-no').addEventListener('click', function () { cleanup(false); });
            // Click outside box = cancel
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) cleanup(false);
            });

            document.body.appendChild(overlay);
            // Focus the cancel button by default (safer UX)
            overlay.querySelector('#ui-confirm-no').focus();
        });
    }

    // ── Expose on window ──────────────────────────────────────────────────────
    window.showToast = showToast;
    window.showConfirm = showConfirm;

})();
