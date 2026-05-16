// upload_notes.js — Teacher Lesson Notes Upload Engine
import { supabase as supabaseClient } from '../../core/config.js';
import { waitForUser, debounce } from '/core/perf.js';

// ─── CDN library references (loaded via <script> tags in HTML) ───
// window.mammoth   — DOCX → HTML
// window.jspdf     — HTML → PDF   (access via window.jspdf.jsPDF)
// window.PDFLib    — PDF compression

// ─── State ───────────────────────────────────────────────────────
let processedPdfBytes = null;   // final compressed PDF ArrayBuffer
let selectedFile = null;

// ─── DOM References ──────────────────────────────────────────────
const subjectSelect = document.getElementById('subjectSelect');
const classSelect = document.getElementById('classSelect');
const noteTitleInput = document.getElementById('noteTitle');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const processBtn = document.getElementById('processBtn');
const confirmBtn = document.getElementById('confirmBtn');
const resetBtn = document.getElementById('resetBtn');
const previewFrame = document.getElementById('pdfPreviewFrame');
const previewPlaceholder = document.getElementById('previewPlaceholder');
const alertSuccess = document.getElementById('alertSuccess');
const alertError = document.getElementById('alertError');

// ─── Stepper ─────────────────────────────────────────────────────
const STEPS = ['stepConvert', 'stepCompress', 'stepUpload'];

function setStepState(stepId, state) {
    // state: 'inactive' | 'active' | 'done'
    const el = document.getElementById(stepId);
    if (!el) return;
    el.className = `step-item ${state}`;
    const dot = el.querySelector('.step-dot');
    if (state === 'done') dot.innerHTML = '✓';
    if (state === 'active') dot.innerHTML = '<span class="spinner"></span>';
    if (state === 'inactive') dot.innerHTML = dot.dataset.num;
}

function resetStepper() {
    STEPS.forEach(id => setStepState(id, 'inactive'));
}

// ─── Supabase: load teacher's classes, subjects on demand ─────────

// Holds the teacher's auth UID for reuse
let currentTeacherId = null;

async function loadSubjectsAndClasses() {
    // ── 1. Get the logged-in teacher's UID ───────────────────────
    const user = await waitForUser();
    if (authErr || !user) {
        console.error('Not authenticated');
        classSelect.innerHTML = '<option value="">Not logged in</option>';
        subjectSelect.innerHTML = '<option value="">Not logged in</option>';
        return;
    }
    currentTeacherId = user.id;

    // ── 2. Fetch ONLY this teacher's classes ─────────────────────
    const { data: classData, error: classErr } = await supabaseClient
        .from('Classes')
        .select('class_id, class_name, section')
        .eq('teacher_id', currentTeacherId)
        .order('class_name', { ascending: true });

    if (classErr) {
        console.error('Error loading classes:', classErr.message);
        classSelect.innerHTML = '<option value="">Error loading classes</option>';
    } else if (!classData || classData.length === 0) {
        classSelect.innerHTML = '<option value="">No classes assigned</option>';
    } else {
        classSelect.innerHTML = '<option value="">Select a Class</option>';
        classData.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.class_id;
            opt.textContent = `${c.class_name} ${c.section}`;
            classSelect.appendChild(opt);
        });
    }

    // ── 3. Subjects start empty — loaded dynamically on class pick
    subjectSelect.innerHTML = '<option value="">Select a Class first</option>';
    subjectSelect.disabled = true;
}

// ── When teacher picks a class, load its subjects via Class_Subjects
classSelect.addEventListener('change', debounce(async () => {
    const classId = classSelect.value;
    subjectSelect.innerHTML = '<option value="">Loading subjects…</option>';
    subjectSelect.disabled = true;

    if (!classId) {
        subjectSelect.innerHTML = '<option value="">Select a Class first</option>';
        return;
    }

    // ── FIXED QUERY ──
    // We fetch from Subject_Allocations where this teacher is assigned to this class
    const { data, error } = await supabaseClient
        .from('Subject_Allocations')
        .select(`
            subject_id, 
            Subjects!inner (
                subject_id, 
                subject_name
            )
        `)
        .eq('class_id', classId)
        .eq('teacher_id', currentTeacherId);

    if (error) {
        console.error('Error:', error.message);
        subjectSelect.innerHTML = '<option value="">Error loading subjects</option>';
        return;
    }

    if (!data || data.length === 0) {
        subjectSelect.innerHTML = '<option value="">No subjects assigned to you for this class</option>';
        return;
    }

    // Populate dropdown
    subjectSelect.innerHTML = '<option value="">Select a Subject</option>';
    data.forEach(row => {
        if (row.Subjects) {
            const opt = document.createElement('option');
            opt.value = row.Subjects.subject_id;
            opt.textContent = row.Subjects.subject_name;
            subjectSelect.appendChild(opt);
        }
    });
    subjectSelect.disabled = false;
});



// ─── File Handling ────────────────────────────────────────────────
function handleFileSelected(file) {
    if (!file) return;
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
        showAlert('error', `Unsupported file type: ${ext}. Please use PDF, DOCX, or DOC.`);
        return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = `📄 ${file.name}`;
    fileNameDisplay.classList.add('visible');
    dropZone.classList.add('has-file');
    processBtn.disabled = false;
    hideAlerts();
    processedPdfBytes = null;
    hidePreview();
    resetStepper();
    confirmBtn.disabled = true;
}

// Drag & drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleFileSelected(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
    if (e.target.files.length > 0) handleFileSelected(e.target.files[0]);
});

// ─── Process Pipeline ─────────────────────────────────────────────
processBtn.addEventListener('click', runProcessingPipeline);

async function runProcessingPipeline() {
    if (!selectedFile) return;
    hideAlerts();
    processBtn.disabled = true;
    confirmBtn.disabled = true;
    resetStepper();

    const ext = selectedFile.name.split('.').pop().toLowerCase();

    try {
        let pdfBytes;

        // ── Step 1: Convert (DOCX only) ──────────────────────────
        if (ext === 'docx' || ext === 'doc') {
            setStepState('stepConvert', 'active');
            pdfBytes = await convertDocxToPdf(selectedFile);
            setStepState('stepConvert', 'done');
        } else {
            // PDF: skip convert step, mark done immediately
            setStepState('stepConvert', 'done');
            const ab = await selectedFile.arrayBuffer();
            pdfBytes = new Uint8Array(ab);
        }

        // ── Step 2: Compress ──────────────────────────────────────
        setStepState('stepCompress', 'active');
        await delay(400); // slight pause so state is visible
        const compressed = await compressPdf(pdfBytes);
        setStepState('stepCompress', 'done');

        processedPdfBytes = compressed;

        // ── Show Preview ──────────────────────────────────────────
        const blob = new Blob([compressed], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        previewFrame.src = url;
        previewFrame.style.display = 'block';
        previewPlaceholder.style.display = 'none';

        setStepState('stepUpload', 'inactive');
        confirmBtn.disabled = false;
        processBtn.disabled = false;

    } catch (err) {
        console.error('Processing error:', err);
        showAlert('error', `Processing failed: ${err.message}`);
        resetStepper();
        processBtn.disabled = false;
    }
}

// ─── DOCX → PDF via mammoth + jsPDF ──────────────────────────────
async function convertDocxToPdf(file) {
    if (!window.mammoth) throw new Error('mammoth.js not loaded');
    if (!window.jspdf) throw new Error('jsPDF not loaded');

    const ab = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: ab });
    const text = result.value || '';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 48;
    const maxWidth = pageW - margin * 2;
    const lineH = 16;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);

    const lines = doc.splitTextToSize(text, maxWidth);
    let y = margin;

    lines.forEach(line => {
        if (y > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }
        doc.text(line, margin, y);
        y += lineH;
    });

    const pdfArrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(pdfArrayBuffer);
}

// ─── PDF Compression via pdf-lib ──────────────────────────────────
async function compressPdf(pdfBytes) {
    if (!window.PDFLib) {
        console.warn('pdf-lib not loaded — skipping compression');
        return pdfBytes;
    }
    const { PDFDocument } = window.PDFLib;
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Compact object streams and remove unused objects
    const compressed = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
    });

    const origKB = Math.round(pdfBytes.byteLength / 1024);
    const compKB = Math.round(compressed.byteLength / 1024);
    console.log(`📦 Compressed: ${origKB}KB → ${compKB}KB`);

    return compressed;
}

// ─── Confirm Upload ───────────────────────────────────────────────
confirmBtn.addEventListener('click', uploadToSupabase);

async function uploadToSupabase() {
    if (!processedPdfBytes) return;

    const subjectId = subjectSelect.value;
    const classId = classSelect.value;
    const title = noteTitleInput.value.trim();

    if (!subjectId || !classId || !title) {
        showAlert('error', 'Please fill in Subject, Class, and Note Title before uploading.');
        return;
    }

    setStepState('stepUpload', 'active');
    confirmBtn.disabled = true;

    try {
        const user = await waitForUser();
        if (authErr || !user) throw new Error('Not authenticated. Please log in again.');

        // Get school_id from user metadata
        const schoolId = user.user_metadata?.school_id;
        if (!schoolId) throw new Error('User missing school_id in metadata');

        // Build a unique filename
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const timestamp = Date.now();
        const filePath = `${user.id}/${safeTitle}_${timestamp}.pdf`;

        // ── Upload to Storage ──────────────────────────────────────
        const { error: storageErr } = await supabaseClient
            .storage
            .from('lesson-notes')
            .upload(filePath, processedPdfBytes, {
                contentType: 'application/pdf',
                upsert: false,
            });

        if (storageErr) throw new Error(`Storage: ${storageErr.message}`);

        // ── Get Public URL ─────────────────────────────────────────
        const { data: urlData } = supabaseClient
            .storage
            .from('lesson-notes')
            .getPublicUrl(filePath);

        const fileUrl = urlData?.publicUrl ?? '';

        // ── Insert DB Record ───────────────────────────────────────
        const { error: dbErr } = await supabaseClient
            .from('Lesson_Notes')
            .insert([{
                subject_id: subjectId,
                class_id: classId,
                file_url: fileUrl,
                title: title,
                teacher_id: user.id,
                school_id: schoolId, // CRITICAL: Add school_id for RLS compliance
            }]);

        if (dbErr) throw new Error(`Database: ${dbErr.message}`);

        setStepState('stepUpload', 'done');
        showAlert('success', `"${title}" uploaded successfully! Students can now access this note.`);
        confirmBtn.disabled = true;

    } catch (err) {
        console.error('Upload error:', err);
        setStepState('stepUpload', 'inactive');
        showAlert('error', `Upload failed: ${err.message}`);
        confirmBtn.disabled = false;
    }
}

// ─── Reset ────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
    selectedFile = null;
    processedPdfBytes = null;
    fileInput.value = '';
    fileNameDisplay.classList.remove('visible');
    dropZone.classList.remove('has-file', 'drag-over');
    noteTitleInput.value = '';
    processBtn.disabled = true;
    confirmBtn.disabled = true;
    hideAlerts();
    hidePreview();
    resetStepper();
});

// ─── Helpers ──────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function hidePreview() {
    previewFrame.src = '';
    previewFrame.style.display = 'none';
    previewPlaceholder.style.display = 'flex';
}

function showAlert(type, msg) {
    hideAlerts();
    const el = type === 'success' ? alertSuccess : alertError;
    el.querySelector('span').textContent = msg;
    el.classList.add('visible');
}

function hideAlerts() {
    alertSuccess.classList.remove('visible');
    alertError.classList.remove('visible');
}

// ─── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    processBtn.disabled = true;
    confirmBtn.disabled = true;
    loadSubjectsAndClasses();
    // Set stepper dot numbers
    document.querySelectorAll('.step-dot').forEach((dot, i) => {
        dot.dataset.num = i + 1;
        dot.textContent = i + 1;
    });
});
