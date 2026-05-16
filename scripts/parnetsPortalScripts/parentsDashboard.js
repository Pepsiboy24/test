import { supabase } from '../config.js';

// ---- Main Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  // For demo purposes, we will fetch the first student or a specific one
  const childId = await getLinkedChildId();
  if (!childId) return;

  await fetchRecentGrades(childId);
  await fetchOverallProgress(childId);
});


async function getLinkedChildId() {
  // 1. Get the currently logged-in parent's Auth ID
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("No authenticated parent found.");
    window.location.href = "/login"; // Redirect to login
    return null;
  }

  // 2. Find the Parent record linked to this Auth ID
  const { data: parentRecord, error: parentError } = await supabase
    .from('Parents')
    .select('parent_id, full_name')
    .eq('user_id', user.id)
    .single();

  if (parentError || !parentRecord) {
    console.error("Could not find parent profile for this user.", parentError);
    return null;
  }

  // 3. Find the first child linked to this parent in the Link table
  const { data: linkData, error: linkError } = await supabase
    .from('Parent_Student_Links')
    .select(`
      relationship,
      Students (student_id, full_name)
    `)
    .eq('parent_id', parentRecord.parent_id)
    .limit(1)
    .single();

  if (linkError || !linkData) {
    console.error("No children linked to this parent account.", linkError);
    return null;
  }

  const child = linkData.Students;
  console.log(`Successfully linked to: ${child.full_name}`);

  // Update UI Header
  const parentNameEl = document.querySelector('.user-details h4');
  const childNameEl = document.querySelector('.user-details p');

  if (parentNameEl) parentNameEl.textContent = parentRecord.full_name;
  if (childNameEl) childNameEl.textContent = `${linkData.relationship} of ${child.full_name}`;

  return child.student_id;
}


async function fetchRecentGrades(childId) {
  const { data: grades, error } = await supabase
    .from('Grades')
    .select(`
            score,
            created_at,
            term,
            Subjects (subject_name)
        `)
    .eq('student_id', childId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching recent grades:', error);
    return;
  }

  const container = document.getElementById('recentGradesContainer');
  if (!container) return;

  if (!grades || grades.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#666;">No recent grades found.</p>';
    return;
  }

  container.innerHTML = '';

  grades.forEach(grade => {
    const item = document.createElement('div');
    item.className = 'grade-item';
    item.innerHTML = `
            <div>
                <div class="grade-subject">${grade.Subjects?.subject_name || 'Subject'}</div>
                <div class="grade-type">${grade.term || 'Assessment'}</div>
            </div>
            <div class="grade-score">${grade.score}%</div>
        `;
    container.appendChild(item);
  });
}

let progressChartInstance = null;

async function fetchOverallProgress(childId) {
  // Fetch all grades to calculate average per month or term
  const { data: grades, error } = await supabase
    .from('Grades')
    .select('score, created_at')
    .eq('student_id', childId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching progress:', error);
    return;
  }

  // Process data for chart
  // Simple approach: Group by Month of recorded date
  const monthlyData = {}; // "Jan": [85, 90], "Feb": [88]...

  grades.forEach(g => {
    const date = new Date(g.created_at);
    const month = date.toLocaleString('default', { month: 'short' });
    if (!monthlyData[month]) monthlyData[month] = [];
    monthlyData[month].push(g.score);
  });

  // Prepare Chart Data
  // Ensure chronological order if possible, but object keys might be mixed.
  // Let's use specific months array for labels to be safe/clean
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = [];
  const dataPoints = [];

  months.forEach(m => {
    if (monthlyData[m]) {
      const scores = monthlyData[m];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      labels.push(m);
      dataPoints.push(avg);
    }
  });

  // If no data, use some defaults or show empty
  if (labels.length === 0) {
    // Fallback to demo data or empty
    // console.log("No data for chart");
  }

  updateChart(labels, dataPoints);
}

function updateChart(labels, data) {
  const ctx = document.getElementById("progressChart");
  if (!ctx) return;

  if (progressChartInstance) {
    progressChartInstance.destroy();
  }

  // If empty, show defaults for visual 
  if (labels.length === 0) {
    labels = ["Jan", "Feb", "Mar"];
    data = [0, 0, 0];
  }

  progressChartInstance = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average Grade",
          data: data,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#3b82f6",
          pointBorderColor: "#ffffff",
          pointBorderWidth: 3,
          pointRadius: 6,
          pointHoverRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: "#e2e8f0",
            lineWidth: 1,
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });
}
