/**
 * upload_modal_ui.js  —  Shared Upload Modal Shell
 * ──────────────────────────────────────────────────
 * Provides the same dark-themed, drag-and-drop upload modal used on the
 * School Admins page across all School Admin portal pages.
 *
 * Usage:
 *   import { openUploadModal } from '../../scripts/upload_modal_ui.js';
 *
 *   openUploadModal({
 *     title:       'Bulk Upload Students',
 *     icon:        'fa-user-graduate',       // Font Awesome solid icon class
 *     accept:      '.xlsx,.xls,.csv',
 *     hintHtml:    '<strong>Required:</strong> <code>Full Name</code>, <code>Email</code> …',
 *     confirmLabel:'Upload Students',
 *     onFile:      async (file, helpers) => { ... },  // called once a file is chosen
 *     onConfirm:   async (file, helpers) => { ... },  // called when user clicks Upload
 *   });
 *
 * helpers exposed to callbacks:
 *   helpers.showPreview(rows, columns)  — renders a preview table
 *   helpers.setUploadEnabled(bool)      — enables/disables Upload button
 *   helpers.startProgress(total)        — shows progress bar
 *   helpers.tickProgress(done, label)   — advances progress bar
 *   helpers.finishProgress(noteHtml)    — sets bar to 100% + optional note
 *   helpers.showFooterDone()            — swaps footer to "Close" only
 *   helpers.close()                     — closes the modal
 */

export function openUploadModal(options = {}) {
    const {
        title = 'Bulk Upload',
        icon = 'fa-file-excel',
        accept = '.xlsx,.xls,.csv',
        hintHtml = '',
        templateFn = null,   // optional function that triggers a template download
        confirmLabel = 'Upload',
        onFile = null,
        onConfirm = null,
    } = options;

    // ── Build HTML ───────────────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.id = '__uploadModalWrapper';
    wrapper.innerHTML = `
    <div id="__uploadModal" style="
        position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;z-index:10000;
        animation:__umIn .18s ease;">
      <div style="
          background:#1e293b;border:1px solid #334155;border-radius:16px;
          width:min(700px,calc(100vw - 32px));max-height:88vh;display:flex;flex-direction:column;
          box-shadow:0 24px 60px rgba(0,0,0,.5);
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          color:#f1f5f9;overflow:hidden;">

        <!-- Header -->
        <div style="padding:24px 28px 16px;border-bottom:1px solid #334155;flex-shrink:0;">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700;color:#f8fafc;">
                <i class="fa-solid ${icon}" style="color:#22c55e;margin-right:8px;"></i>${title}
              </h2>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
                Upload a file to add multiple records at once
              </p>
            </div>
            <button id="__umClose" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;padding:4px;flex-shrink:0;" title="Close">✕</button>
          </div>

          ${hintHtml ? `
          <div style="margin-top:14px;padding:10px 14px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8;border-left:3px solid #3b82f6;line-height:1.7;">
            ${hintHtml}
            ${templateFn ? `&nbsp;<button id="__umTemplate" style="background:none;border:1px solid #334155;color:#93c5fd;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">⬇ Download template</button>` : ''}
          </div>` : ''}
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px 28px;" id="__umBody">

          <!-- Drop zone -->
          <div id="__umDropZone" style="
              border:2px dashed #334155;border-radius:12px;padding:48px 24px;
              text-align:center;cursor:pointer;transition:border-color .2s,background .2s;
              background:#0f172a;">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size:40px;color:#3b82f6;margin-bottom:12px;display:block;"></i>
            <p style="font-size:15px;font-weight:600;color:#e2e8f0;margin:0 0 6px;">Drag &amp; drop your file here</p>
            <p style="font-size:13px;color:#64748b;margin:0 0 18px;">Supports: ${accept.replace(/\./g, '').replace(/,/g, ' · ').toUpperCase()}</p>
            <label style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;
                border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">
              Browse File
              <input type="file" id="__umFileInput" accept="${accept}" style="display:none;">
            </label>
          </div>

          <!-- Preview (hidden until file parsed) -->
          <div id="__umPreview" style="display:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span id="__umPreviewTitle" style="font-size:14px;font-weight:600;color:#e2e8f0;"></span>
              <button id="__umClear" style="background:none;border:1px solid #475569;color:#94a3b8;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;">✕ Clear</button>
            </div>
            <div style="overflow-x:auto;border-radius:10px;border:1px solid #334155;">
              <table id="__umPreviewTable" style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead id="__umPreviewHead" style="background:#0f172a;"></thead>
                <tbody id="__umPreviewBody"></tbody>
              </table>
            </div>
          </div>

          <!-- Progress (hidden until upload starts) -->
          <div id="__umProgress" style="display:none;margin-top:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span id="__umProgressLabel" style="font-size:13px;color:#94a3b8;">Uploading…</span>
              <span id="__umProgressPct" style="font-size:13px;color:#94a3b8;">0%</span>
            </div>
            <div style="height:8px;background:#1e3a5f;border-radius:4px;overflow:hidden;">
              <div id="__umProgressBar" style="height:100%;width:0%;background:#3b82f6;transition:width .3s;border-radius:4px;"></div>
            </div>
            <div id="__umProgressNote" style="margin-top:8px;font-size:12px;color:#64748b;"></div>
          </div>
        </div>

        <!-- Footer -->
        <div id="__umFooter" style="padding:16px 28px;border-top:1px solid #334155;display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;">
          <button id="__umCancel" style="padding:9px 20px;border-radius:8px;border:1px solid #475569;background:transparent;color:#cbd5e1;cursor:pointer;font-size:14px;font-weight:600;">Cancel</button>
          <button id="__umConfirm" disabled style="padding:9px 24px;border-radius:8px;border:none;background:#3b82f6;color:#fff;cursor:not-allowed;font-size:14px;font-weight:600;opacity:.5;display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-cloud-arrow-up"></i> ${confirmLabel}
          </button>
        </div>
      </div>
    </div>
    <style>
      @keyframes __umIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
      #__umDropZone.dragover { border-color:#3b82f6 !important; background:#172554 !important; }
    </style>`;

    document.body.appendChild(wrapper);

    // ── Element refs ─────────────────────────────────────────────────────────
    const closeBtn = document.getElementById('__umClose');
    const cancelBtn = document.getElementById('__umCancel');
    const confirmBtn = document.getElementById('__umConfirm');
    const dropZone = document.getElementById('__umDropZone');
    const fileInput = document.getElementById('__umFileInput');
    const clearBtn = document.getElementById('__umClear');
    const templateBtn = document.getElementById('__umTemplate');
    const previewDiv = document.getElementById('__umPreview');
    const progressDiv = document.getElementById('__umProgress');

    let currentFile = null;

    // ── Helpers object exposed to callbacks ──────────────────────────────────
    const helpers = {
        close() { wrapper.remove(); },

        setUploadEnabled(enabled) {
            confirmBtn.disabled = !enabled;
            confirmBtn.style.opacity = enabled ? '1' : '.5';
            confirmBtn.style.cursor = enabled ? 'pointer' : 'not-allowed';
        },

        showPreview(rows, columns) {
            // columns = [{ key, label, render? }]
            const thCell = s => `<th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;white-space:nowrap;">${s}</th>`;
            const tdCell = (s, err) => `<td style="padding:9px 14px;color:${err ? '#fca5a5' : '#e2e8f0'};">${s ?? '<em style="color:#475569">—</em>'}</td>`;

            document.getElementById('__umPreviewHead').innerHTML =
                `<tr>${[{ label: '#' }, ...columns].map(c => thCell(c.label)).join('')}</tr>`;

            document.getElementById('__umPreviewBody').innerHTML = rows.map((row, i) => {
                const hasError = row.__errors && row.__errors.length > 0;
                const statusTd = `<td style="padding:9px 14px;font-size:12px;color:${hasError ? '#ef4444' : '#22c55e'};">${hasError ? '⚠ ' + row.__errors.join('; ') : '✓ Ready'}</td>`;
                const cells = columns.map(c => {
                    const val = c.render ? c.render(row) : row[c.key];
                    return tdCell(val, hasError && c.required && !val);
                });
                return `<tr style="background:${hasError ? 'rgba(239,68,68,.06)' : 'transparent'};border-bottom:1px solid #1e293b;">
                    <td style="padding:9px 14px;color:#64748b;">${i + 1}</td>
                    ${cells.join('')}${statusTd}
                </tr>`;
            }).join('');

            const valid = rows.filter(r => !r.__errors || r.__errors.length === 0).length;
            document.getElementById('__umPreviewTitle').textContent =
                `${rows.length} row${rows.length !== 1 ? 's' : ''} found — ${valid} valid, ${rows.length - valid} with issues`;

            document.getElementById('__umDropZone').style.display = 'none';
            previewDiv.style.display = 'block';
        },

        startProgress(total) {
            previewDiv.style.display = 'none';
            document.getElementById('__umFooter').style.display = 'none';
            progressDiv.style.display = 'block';
            document.getElementById('__umProgressBar').style.width = '0%';
            document.getElementById('__umProgressPct').textContent = '0%';
            document.getElementById('__umProgressLabel').textContent = `Uploading 0 of ${total}…`;
        },

        tickProgress(done, total, label = '') {
            const pct = Math.round((done / total) * 100);
            document.getElementById('__umProgressBar').style.width = pct + '%';
            document.getElementById('__umProgressPct').textContent = pct + '%';
            document.getElementById('__umProgressLabel').textContent = label || `Uploading ${done} of ${total}`;
        },

        finishProgress(noteHtml = '') {
            document.getElementById('__umProgressBar').style.width = '100%';
            document.getElementById('__umProgressPct').textContent = '100%';
            document.getElementById('__umProgressLabel').textContent = 'Done!';
            if (noteHtml) {
                document.getElementById('__umProgressNote').innerHTML = noteHtml;
            }
        },

        showFooterDone() {
            document.getElementById('__umFooter').style.display = 'flex';
            confirmBtn.style.display = 'none';
            cancelBtn.textContent = 'Close';
        },
    };

    // ── Internal helpers ─────────────────────────────────────────────────────
    function resetToDropZone() {
        currentFile = null;
        fileInput.value = '';
        dropZone.style.display = 'block';
        previewDiv.style.display = 'none';
        progressDiv.style.display = 'none';
        helpers.setUploadEnabled(false);
    }

    async function handleFile(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const allowed = accept.split(',').map(a => a.trim().replace('.', ''));
        if (!allowed.includes(ext)) {
            if (typeof showToast === 'function') showToast(`Unsupported file type. Use: ${accept}`, 'warning');
            return;
        }
        currentFile = file;
        if (onFile) {
            try { await onFile(file, helpers); }
            catch (e) {
                console.error('[UploadModal] onFile error:', e);
                if (typeof showToast === 'function') showToast('Failed to read file: ' + e.message, 'error');
            }
        }
    }

    // ── Events ───────────────────────────────────────────────────────────────
    closeBtn.addEventListener('click', () => helpers.close());
    cancelBtn.addEventListener('click', () => helpers.close());

    if (templateBtn && templateFn) templateBtn.addEventListener('click', templateFn);

    clearBtn?.addEventListener('click', resetToDropZone);

    fileInput.addEventListener('change', e => handleFile(e.target.files[0]));

    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    dropZone.addEventListener('click', () => fileInput.click());

    confirmBtn.addEventListener('click', async () => {
        if (!currentFile || confirmBtn.disabled) return;
        if (onConfirm) {
            try { await onConfirm(currentFile, helpers); }
            catch (e) {
                console.error('[UploadModal] onConfirm error:', e);
                if (typeof showToast === 'function') showToast('Upload error: ' + e.message, 'error');
            }
        }
    });
}
