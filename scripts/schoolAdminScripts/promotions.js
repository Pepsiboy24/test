import { supabase } from '../config.js';

// --- State ---
let allClasses = [];
let studentCountMap = {}; // class_id → student count

// --- DOM refs ---
const sourceSelect = document.getElementById('sourceClassSelect');
const targetSelect = document.getElementById('targetClassSelect');
const sourcePreview = document.getElementById('sourcePreview');
const sourceCountText = document.getElementById('sourceCountText');
const capacityWarning = document.getElementById('capacityWarning');
const capacityText = document.getElementById('capacityText');
const executeBtn = document.getElementById('executeBtn');
const promotionSummary = document.getElementById('promotionSummary');
const summaryText = document.getElementById('summaryText');
const resultMessage = document.getElementById('resultMessage');

// --- Load Data ---
async function loadData() {
    const [classesRes, studentsRes] = await Promise.all([
        supabase.from('Classes').select('class_id, class_name, section').order('class_name'),
        supabase.from('Students').select('class_id')
    ]);

    if (classesRes.error) { console.error(classesRes.error); return; }
    if (studentsRes.error) { console.error(studentsRes.error); return; }

    allClasses = classesRes.data || [];

    // Build count map
    studentCountMap = {};
    (studentsRes.data || []).forEach(s => {
        if (s.class_id != null) {
            studentCountMap[s.class_id] = (studentCountMap[s.class_id] || 0) + 1;
        }
    });

    // Populate source dropdown
    sourceSelect.innerHTML = '<option value="">Select source class...</option>';
    allClasses.forEach(cls => {
        const count = studentCountMap[cls.class_id] ?? 0;
        const label = `${cls.class_name}${cls.section ? ' - ' + cls.section : ''} (${count} student${count !== 1 ? 's' : ''})`;
        const opt = new Option(label, cls.class_id);
        sourceSelect.appendChild(opt);
    });
}

// --- Source Select Change ---
sourceSelect.addEventListener('change', () => {
    const sourceId = parseInt(sourceSelect.value);
    const count = sourceId ? (studentCountMap[sourceId] ?? 0) : 0;

    // Show preview
    if (sourceId) {
        sourcePreview.style.display = 'flex';
        sourceCountText.textContent = `${count} student${count !== 1 ? 's' : ''} will be moved`;
    } else {
        sourcePreview.style.display = 'none';
    }

    // Rebuild target dropdown — exclude source, include Graduate option
    targetSelect.innerHTML = '<option value="">Select target class...</option>';
    targetSelect.innerHTML += '<option value="graduate">🎓 Graduate / Alumni (remove from class)</option>';

    allClasses.forEach(cls => {
        if (cls.class_id === sourceId) return; // exclude source
        const label = `${cls.class_name}${cls.section ? ' - ' + cls.section : ''}`;
        const opt = new Option(label, cls.class_id);
        targetSelect.appendChild(opt);
    });

    capacityWarning.style.display = 'none';
    updateSummary();
});

// --- Target Select Change ---
targetSelect.addEventListener('change', () => {
    const targetId = targetSelect.value;
    capacityWarning.style.display = 'none';

    if (targetId && targetId !== 'graduate') {
        const count = studentCountMap[parseInt(targetId)] ?? 0;
        if (count >= 40) {
            capacityText.textContent = `Target class already has ${count} students (40+ capacity).`;
            capacityWarning.style.display = 'flex';
        }
    }
    updateSummary();
});

// --- Update Summary & Button ---
function updateSummary() {
    const sourceId = parseInt(sourceSelect.value);
    const targetId = targetSelect.value;

    if (!sourceId || !targetId) {
        promotionSummary.style.display = 'none';
        executeBtn.disabled = true;
        return;
    }

    const sourceClass = allClasses.find(c => c.class_id === sourceId);
    const count = studentCountMap[sourceId] ?? 0;
    const sourceName = sourceClass ? `${sourceClass.class_name}${sourceClass.section ? ' - ' + sourceClass.section : ''}` : '?';

    let targetName;
    if (targetId === 'graduate') {
        targetName = 'Graduate / Alumni';
    } else {
        const t = allClasses.find(c => c.class_id === parseInt(targetId));
        targetName = t ? `${t.class_name}${t.section ? ' - ' + t.section : ''}` : '?';
    }

    summaryText.textContent = `${count} student${count !== 1 ? 's' : ''} from "${sourceName}" → "${targetName}"`;
    promotionSummary.style.display = 'flex';
    executeBtn.disabled = count === 0;
}

// --- Execute Promotion ---
executeBtn.addEventListener('click', async () => {
    const sourceId = parseInt(sourceSelect.value);
    const targetId = targetSelect.value;
    const count = studentCountMap[sourceId] ?? 0;

    if (!sourceId || !targetId) return;

    const sourceClass = allClasses.find(c => c.class_id === sourceId);
    const sourceName = sourceClass ? `${sourceClass.class_name}${sourceClass.section ? ' - ' + sourceClass.section : ''}` : 'this class';

    const message = targetId === 'graduate'
        ? `Graduate all ${count} student(s) from "${sourceName}"? They will be removed from the active class pool.`
        : `Move all ${count} student(s) from "${sourceName}" to the selected class? This cannot be undone.`;
    const confirmed = await window.showConfirm(message, 'Confirm Promotion');
    if (!confirmed) return;

    executeBtn.disabled = true;
    executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Executing...';
    resultMessage.style.display = 'none';

    try {
        const newClassId = targetId === 'graduate' ? null : parseInt(targetId);

        const { error } = await supabase
            .from('Students')
            .update({ class_id: newClassId })
            .eq('class_id', sourceId);

        if (error) throw error;

        showResult(
            targetId === 'graduate'
                ? `✅ ${count} student(s) graduated successfully.`
                : `✅ ${count} student(s) promoted successfully.`,
            'success'
        );

        // Refresh data & reset
        await loadData();
        sourceSelect.value = '';
        targetSelect.innerHTML = '<option value="">Select source first...</option>';
        sourcePreview.style.display = 'none';
        capacityWarning.style.display = 'none';
        promotionSummary.style.display = 'none';
        executeBtn.disabled = true;

    } catch (err) {
        console.error('Promotion error:', err);
        showResult('❌ Failed: ' + err.message, 'error');
    } finally {
        executeBtn.disabled = false;
        executeBtn.innerHTML = '<i class="fas fa-bolt"></i> Execute Promotion';
    }
});

function showResult(message, type) {
    resultMessage.textContent = message;
    resultMessage.className = `result-message result-${type}`;
    resultMessage.style.display = 'block';
    setTimeout(() => { resultMessage.style.display = 'none'; }, 6000);
}

// --- Init ---
loadData();
