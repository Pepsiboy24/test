/**
 * core/perf.js — Shared performance utilities
 *
 * RULES (do not change):
 *  - Import with absolute path: /core/perf.js
 *  - Never calls supabase.auth.getUser() — uses window.currentUser / auth-ready
 */

/**
 * Returns window.currentUser immediately if authGuard has already fired,
 * or waits for the 'auth-ready' event if it hasn't.
 * Replaces every direct supabase.auth.getUser() call in page scripts.
 */
export function waitForUser() {
    if (window.currentUser) return Promise.resolve(window.currentUser);
    return new Promise(resolve => {
        window.addEventListener('auth-ready', e => resolve(e.detail), { once: true });
    });
}

/**
 * Debounce — prevents a function from firing more than once per `wait` ms.
 * Use for search inputs, filter dropdowns, resize handlers.
 */
export function debounce(fn, wait = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Lazy-load a CDN script tag on demand.
 * Resolves immediately if the script is already loaded.
 * @param {string} src    CDN URL
 * @param {string} check  A global variable name that proves the script loaded (e.g. 'XLSX')
 */
export function lazyScript(src, check) {
    if (window[check]) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            // Already injected but maybe not finished — wait for load
            existing.addEventListener('load', resolve);
            existing.addEventListener('error', reject);
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(s);
    });
}

/**
 * sessionStorage cache with JSON serialisation.
 * @param {string} key
 * @param {Function} fetcher  async function that returns the value when cache misses
 * @param {number} ttlMs      max age in ms (default 10 min)
 */
export async function cached(key, fetcher, ttlMs = 10 * 60 * 1000) {
    try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
            const { value, expires } = JSON.parse(raw);
            if (Date.now() < expires) return value;
        }
    } catch (_) { /* corrupt cache — fall through */ }

    const value = await fetcher();
    try {
        sessionStorage.setItem(key, JSON.stringify({ value, expires: Date.now() + ttlMs }));
    } catch (_) { /* storage full — ignore */ }
    return value;
}

/**
 * Build a table body from rows using a DocumentFragment to avoid layout thrashing.
 * @param {HTMLElement} tbody
 * @param {string[]}    rowHTMLArray   Array of <tr>…</tr> HTML strings
 */
export function renderToFragment(tbody, rowHTMLArray) {
    const frag = document.createDocumentFragment();
    const tmp  = document.createElement('tbody');
    tmp.innerHTML = rowHTMLArray.join('');
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    tbody.innerHTML = '';
    tbody.appendChild(frag);
}
