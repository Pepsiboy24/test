
import { supabase } from '../config.js';

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAdminStats();
});

async function fetchAdminStats() {
    try {
        // Fetch Students count
        const { count: studentCount, error: studentError } = await supabase
            .from('Students')
            .select('*', { count: 'exact', head: true });

        if (studentError) {
            console.error('Error fetching students count:', studentError);
        } else {
            updateStat('total-students-count', studentCount);
        }

        // Fetch Teachers count
        const { count: teacherCount, error: teacherError } = await supabase
            .from('Teachers')
            .select('*', { count: 'exact', head: true });

        if (teacherError) {
            console.error('Error fetching teachers count:', teacherError);
        } else {
            updateStat('total-teachers-count', teacherCount);
        }

    } catch (err) {
        console.error('Unexpected error fetching stats:', err);
    }
}

function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        // Simple update, animation is handled by existing script if it runs after this,
        // but existing script might have already run.
        // The existing script uses .stat-number class and animates from 0.
        // We can just set the text content and let the existing animation script pick it up 
        // IF the existing script runs after this one. 
        // However, this script is async. 
        // Let's just set the text content. If the animation script has already run, it might overwrite this?
        // Actually the animation script animates to `finalValue` which it gets from `stat.textContent`.
        // If we update `textContent` before the animation script runs, it will animate to our new value.
        // If we update it after, we should probably manually trigger animation or just set it.
        // Given we are loading data, just setting it is fine for now.
        element.textContent = value.toLocaleString();
    }
}
