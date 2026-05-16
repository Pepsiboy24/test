/**
 * schooladmins_excel_upload.js
 * Bulk upload school admins from an Excel/CSV file.
 *
 * Required columns (case-insensitive):
 *   full_name | email | phone_number (optional) | role (optional, defaults to "School Admin")
 *
 * Flow: open modal → pick file → preview parsed rows → confirm → loop signUp + DB insert
 * Exposes:  window.openAdminExcelUpload()
 */
import { supabaseClient } from './supabase_client.js';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const VALID_ROLES = ['School Admin', 'Super Admin', 'Editor'];
const DEFAULT_ROLE = 'School Admin';
const DEFAULT_PASSWORD = '123456';

// ── Modal HTML ──────────────────────────────────────────────────────────────
function buildModalHTML() {
    return `
    <div id="adminExcelModal" style="
        position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);
        display:flex;align-items:center;justify-content:center;z-index:10000;
        animation:aeModalIn .18s ease;">
      <div style="
          background:#1e293b;border:1px solid #334155;border-radius:16px;
          width:min(700px,calc(100vw - 32px));max-height:85vh;display:flex;flex-direction:column;
          box-shadow:0 24px 60px rgba(0,0,0,.5);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
          color:#f1f5f9;overflow:hidden;">

        <!-- Header -->
        <div style="padding:24px 28px 16px;border-bottom:1px solid #334155;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h2 style="margin:0;font-size:18px;font-weight:700;color:#f8fafc;">
                <i class="fa-solid fa-file-excel" style="color:#22c55e;margin-right:8px;"></i>
                Bulk Upload School Admins
              </h2>
              <p style="margin:4px 0 0;font-size:13px;color:#64748b;">
                Upload an Excel or CSV file to add multiple admins at once
              </p>
            </div>
            <button id="aeCloseBtn" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:20px;padding:4px;" title="Close">✕</button>
          </div>

          <!-- Template download hint -->
          <div style="margin-top:14px;padding:10px 14px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8;border-left:3px solid #3b82f6;">
            <strong style="color:#93c5fd;">Required columns:</strong>
            <code style="color:#a5f3fc;margin-left:6px;">full_name</code> &amp;
            <code style="color:#a5f3fc;">email</code> &nbsp;·&nbsp;
            <strong style="color:#93c5fd;">Optional:</strong>
            <code style="color:#a5f3fc;">phone_number</code> ,
            <code style="color:#a5f3fc;">role</code>
            (School Admin / Super Admin / Editor — defaults to "School Admin").
            All admins are created with password <code style="color:#fcd34d;">123456</code>.
            &nbsp;<button id="aeDownloadTemplate" style="background:none;border:1px solid #334155;color:#93c5fd;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;">⬇ Download template</button>
          </div>
        </div>

        <!-- Body -->
        <div style="flex:1;overflow-y:auto;padding:20px 28px;" id="aeBody">

          <!-- Drop zone (shown before file is picked) -->
          <div id="aeDropZone" style="
              border:2px dashed #334155;border-radius:12px;padding:48px 24px;
              text-align:center;cursor:pointer;transition:border-color .2s,background .2s;
              background:#0f172a;">
            <i class="fa-solid fa-cloud-arrow-up" style="font-size:40px;color:#3b82f6;margin-bottom:12px;display:block;"></i>
            <p style="font-size:15px;font-weight:600;color:#e2e8f0;margin:0 0 6px;">Drag &amp; drop your file here</p>
            <p style="font-size:13px;color:#64748b;margin:0 0 18px;">Supports .xlsx, .xls, .csv</p>
            <label style="
                display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;
                border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">
              Browse File
              <input type="file" id="aeFileInput" accept=".xlsx,.xls,.csv" style="display:none;">
            </label>
          </div>

          <!-- Preview table (hidden until file parsed) -->
          <div id="aePreview" style="display:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <span id="aePreviewTitle" style="font-size:14px;font-weight:600;color:#e2e8f0;"></span>
              <button id="aeClearFile" style="background:none;border:1px solid #475569;color:#94a3b8;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:12px;">✕ Clear</button>
            </div>
            <div style="overflow-x:auto;border-radius:10px;border:1px solid #334155;">
              <table id="aePreviewTable" style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#0f172a;">
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">#</th>
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">Full Name</th>
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">Email</th>
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">Phone</th>
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">Role</th>
                    <th style="padding:10px 14px;text-align:left;color:#64748b;font-weight:600;border-bottom:1px solid #334155;">Status</th>
                  </tr>
                </thead>
                <tbody id="aePreviewBody"></tbody>
              </table>
            </div>
          </div>

          <!-- Progress bar (hidden until upload starts) -->
          <div id="aeProgress" style="display:none;margin-top:20px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
              <span id="aeProgressLabel" style="font-size:13px;color:#94a3b8;">Uploading…</span>
              <span id="aeProgressPct" style="font-size:13px;color:#94a3b8;">0%</span>
            </div>
            <div style="height:8px;background:#1e3a5f;border-radius:4px;overflow:hidden;">
              <div id="aeProgressBar" style="height:100%;width:0%;background:#3b82f6;transition:width .3s;border-radius:4px;"></div>
            </div>
            <div id="aeProgressNote" style="margin-top:8px;font-size:12px;color:#64748b;"></div>
          </div>
        </div>

        <!-- Footer -->
        <div id="aeFooter" style="padding:16px 28px;border-top:1px solid #334155;display:flex;justify-content:flex-end;gap:10px;">
          <button id="aeCancelBtn" style="
              padding:9px 20px;border-radius:8px;border:1px solid #475569;background:transparent;
              color:#cbd5e1;cursor:pointer;font-size:14px;font-weight:600;">Cancel</button>
          <button id="aeUploadBtn" disabled style="
              padding:9px 24px;border-radius:8px;border:none;background:#3b82f6;
              color:#fff;cursor:not-allowed;font-size:14px;font-weight:600;opacity:.5;
              display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-cloud-arrow-up"></i> Upload Admins
          </button>
        </div>
      </div>
    </div>
    <style>
      @keyframes aeModalIn { from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
      #aeDropZone.dragover { border-color:#3b82f6 !important; background:#172554 !important; }
    </style>`;
}

// ── Template download ────────────────────────────────────────────────────────
function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['full_name', 'email', 'phone_number', 'role'],
        ['Jane Doe', 'jane@school.edu', '+2348012345678', 'School Admin'],
        ['John Smith', 'john@school.edu', '', 'Super Admin'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Admins');
    XLSX.writeFile(wb, 'school_admins_template.xlsx');
}

// ── Parse file → array of row objects ────────────────────────────────────────
function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
                resolve(raw);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// ── Normalize a raw row to expected keys (case-insensitive header matching) ──
function normalizeRow(raw, index) {
    // Build a lowercased-key version of the row
    const lower = {};
    for (const k of Object.keys(raw)) {
        lower[k.toLowerCase().trim().replace(/\s+/g, '_')] = raw[k];
    }

    const fullName = (lower['full_name'] || lower['fullname'] || lower['name'] || '').toString().trim();
    const email = (lower['email'] || lower['email_address'] || '').toString().trim().toLowerCase();
    const phoneNumber = (lower['phone_number'] || lower['phone'] || lower['mobile'] || '').toString().trim();
    const rawRole = (lower['role'] || '').toString().trim();
    const role = VALID_ROLES.includes(rawRole) ? rawRole : DEFAULT_ROLE;

    const errors = [];
    if (!fullName) errors.push('Missing full_name');
    if (!email) errors.push('Missing email');
    if (email && !/^[^@]+@[^@]+\.[^@]+$/.test(email)) errors.push('Invalid email format');

    return { index, fullName, email, phoneNumber, role, errors, raw };
}

// ── Render preview table ─────────────────────────────────────────────────────
function renderPreview(rows) {
    const tbody = document.getElementById('aePreviewBody');
    tbody.innerHTML = '';
    const validCount = rows.filter(r => r.errors.length === 0).length;
    const invalidCount = rows.length - validCount;
    document.getElementById('aePreviewTitle').textContent =
        `${rows.length} row${rows.length !== 1 ? 's' : ''} found — ` +
        `${validCount} valid, ${invalidCount} with issues`;

    rows.forEach(r => {
        const hasError = r.errors.length > 0;
        const statusHtml = hasError
            ? `<span style="color:#ef4444;font-size:12px;">⚠ ${r.errors.join('; ')}</span>`
            : `<span style="color:#22c55e;font-size:12px;">✓ Ready</span>`;

        tbody.insertAdjacentHTML('beforeend', `
            <tr style="background:${hasError ? 'rgba(239,68,68,.06)' : 'transparent'};border-bottom:1px solid #1e293b;">
                <td style="padding:10px 14px;color:#64748b;">${r.index + 1}</td>
                <td style="padding:10px 14px;color:#e2e8f0;">${r.fullName || '<em style="color:#64748b">—</em>'}</td>
                <td style="padding:10px 14px;color:#93c5fd;font-family:monospace;">${r.email || '<em style="color:#64748b">—</em>'}</td>
                <td style="padding:10px 14px;color:#94a3b8;">${r.phoneNumber || '—'}</td>
                <td style="padding:10px 14px;">
                    <span style="padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;
                        background:${r.role === 'Super Admin' ? 'rgba(245,158,11,.12)' : 'rgba(59,130,246,.12)'};
                        color:${r.role === 'Super Admin' ? '#fbbf24' : '#93c5fd'};">${r.role}</span>
                </td>
                <td style="padding:10px 14px;">${statusHtml}</td>
            </tr>`);
    });
}

// ── Upload loop ──────────────────────────────────────────────────────────────
async function uploadAdmins(validRows) {
    const tempClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const progressBar = document.getElementById('aeProgressBar');
    const progressLabel = document.getElementById('aeProgressLabel');
    const progressPct = document.getElementById('aeProgressPct');
    const progressNote = document.getElementById('aeProgressNote');

    let succeeded = 0;
    let failed = 0;
    const errors = [];

    document.getElementById('aeProgress').style.display = 'block';
    document.getElementById('aeFooter').style.display = 'none';

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        const pct = Math.round(((i) / validRows.length) * 100);
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        progressLabel.textContent = `Uploading ${i + 1} of ${validRows.length}: ${row.email}`;

        try {
            // 1. Auth signUp
            const { data: authData, error: authErr } = await tempClient.auth.signUp({
                email: row.email,
                password: DEFAULT_PASSWORD,
                options: { data: { full_name: row.fullName, role: row.role } }
            });

            if (authErr) throw new Error(`Auth: ${authErr.message}`);
            if (!authData.user) throw new Error('Auth signup returned no user');

            // 2. Insert into School_Admin
            const { error: dbErr } = await supabaseClient
                .from('School_Admin')
                .insert([{
                    admin_id: authData.user.id,
                    full_name: row.fullName,
                    email: row.email,
                    phone_number: row.phoneNumber || null,
                    role: row.role,
                    created_at: new Date().toISOString()
                }]);

            if (dbErr) throw new Error(`DB: ${dbErr.message}`);
            succeeded++;

        } catch (err) {
            failed++;
            errors.push(`Row ${row.index + 1} (${row.email}): ${err.message}`);
            console.warn('[AdminUpload] Failed row:', row, err);
        }
    }

    // Done
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    progressLabel.textContent = 'Upload complete!';

    if (errors.length > 0) {
        progressNote.innerHTML = errors.map(e =>
            `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`
        ).join('');
    }

    return { succeeded, failed };
}

// ── Main entry point ─────────────────────────────────────────────────────────
function openAdminExcelUpload() {
    // Ensure XLSX library is available
    if (typeof XLSX === 'undefined') {
        showToast('Excel library not loaded. Please refresh the page.', 'error');
        return;
    }

    // Inject modal into DOM
    const wrapper = document.createElement('div');
    wrapper.id = 'aeWrapper';
    wrapper.innerHTML = buildModalHTML();
    document.body.appendChild(wrapper);

    let parsedRows = [];

    function closeModal() {
        document.getElementById('aeWrapper')?.remove();
    }

    function setUploadEnabled(enabled) {
        const btn = document.getElementById('aeUploadBtn');
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? '1' : '.5';
        btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    async function handleFile(file) {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            showToast('Please select an Excel (.xlsx, .xls) or CSV file.', 'warning');
            return;
        }

        showToast('Parsing file…', 'info', 2000);
        try {
            const raw = await parseFile(file);
            if (!raw.length) {
                showToast('The file is empty or has no data rows.', 'warning');
                return;
            }

            parsedRows = raw.map((r, i) => normalizeRow(r, i));
            const validCount = parsedRows.filter(r => r.errors.length === 0).length;

            document.getElementById('aeDropZone').style.display = 'none';
            document.getElementById('aePreview').style.display = 'block';
            renderPreview(parsedRows);
            setUploadEnabled(validCount > 0);

            if (validCount === 0) {
                showToast('No valid rows found. Fix the errors and re-upload.', 'warning');
            } else {
                showToast(`${validCount} valid admin${validCount !== 1 ? 's' : ''} ready to upload.`, 'success', 3500);
            }
        } catch (err) {
            console.error('[AdminUpload] Parse error:', err);
            showToast('Failed to read file. Make sure it is a valid Excel or CSV file.', 'error');
        }
    }

    // Events
    document.getElementById('aeCloseBtn').addEventListener('click', closeModal);
    document.getElementById('aeCancelBtn').addEventListener('click', closeModal);

    document.getElementById('aeDownloadTemplate').addEventListener('click', downloadTemplate);

    document.getElementById('aeClearFile').addEventListener('click', () => {
        parsedRows = [];
        document.getElementById('aeDropZone').style.display = 'block';
        document.getElementById('aePreview').style.display = 'none';
        document.getElementById('aeFileInput').value = '';
        setUploadEnabled(false);
    });

    document.getElementById('aeFileInput').addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    // Drag & drop
    const dz = document.getElementById('aeDropZone');
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    dz.addEventListener('click', () => document.getElementById('aeFileInput').click());

    // Upload button
    document.getElementById('aeUploadBtn').addEventListener('click', async () => {
        const validRows = parsedRows.filter(r => r.errors.length === 0);
        if (!validRows.length) return;

        const confirmed = await window.showConfirm(
            `Upload ${validRows.length} admin${validRows.length !== 1 ? 's' : ''}? Each will receive a temporary password of "${DEFAULT_PASSWORD}".`,
            'Confirm Bulk Upload'
        );
        if (!confirmed) return;

        document.getElementById('aePreview').style.display = 'none';
        const { succeeded, failed } = await uploadAdmins(validRows);

        // Show result toast & re-enable close button
        if (succeeded > 0 && failed === 0) {
            showToast(`✅ ${succeeded} admin${succeeded !== 1 ? 's' : ''} uploaded successfully!`, 'success', 7000);
        } else if (succeeded > 0) {
            showToast(`Uploaded ${succeeded} admin${succeeded !== 1 ? 's' : ''}, ${failed} failed. Check details below.`, 'warning', 8000);
        } else {
            showToast('Upload failed for all rows. Check details below.', 'error');
        }

        // Re-show footer with just a "Done" button; reload list
        document.getElementById('aeFooter').style.display = 'flex';
        document.getElementById('aeCancelBtn').textContent = 'Close';
        document.getElementById('aeUploadBtn').style.display = 'none';

        // Trigger table refresh if viewAllSchoolAdmins exposes a reload
        if (typeof window.reloadSchoolAdmins === 'function') {
            window.reloadSchoolAdmins();
        }
    });
}

// Expose globally so inline onclick and other modules can call it
window.openAdminExcelUpload = openAdminExcelUpload;
