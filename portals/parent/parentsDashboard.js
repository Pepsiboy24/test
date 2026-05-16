import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

// ---- Main Initialization ----
document.addEventListener('DOMContentLoaded', async () => {
  // For demo purposes, we will fetch the first student or a specific one
  const childId = await getLinkedChildId();
  if (!childId) return;

  await fetchRecentGrades(childId);
  await fetchOverallProgress(childId);
  await fetchReportCards(childId);
  await fetchMessages(childId);
});


async function getLinkedChildId() {
  // 1. Get the currently logged-in parent's Auth ID
  const user = await waitForUser();

  if (!user) {
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

  // 3. Find all children linked to this parent in the Link table
  const { data: linkData, error: linkError } = await supabase
    .from('Parent_Student_Links')
    .select(`
      relationship,
      Students (student_id, full_name)
    `)
    .eq('parent_id', parentRecord.parent_id);

  if (linkError || !linkData || linkData.length === 0) {
    console.error("No children linked to this parent account.", linkError);
    return null;
  }

  // Use global active child id, or default to first
  let activeId = localStorage.getItem('active_child_id') || localStorage.getItem('student_id');
  if (!activeId) {
      activeId = linkData[0].Students.student_id;
      localStorage.setItem('active_child_id', activeId);
      localStorage.setItem('student_id', activeId);
  }

  const selectedLink = linkData.find(l => l.Students.student_id === activeId) || linkData[0];
  const child = selectedLink.Students;
  console.log(`Successfully linked to: ${child.full_name}`);

  // Update UI Header
  const parentNameEl = document.querySelector('.user-details h4');
  const childNameEl = document.querySelector('.user-details p');

  if (parentNameEl) parentNameEl.textContent = parentRecord.full_name;
  if (childNameEl) childNameEl.textContent = `${selectedLink.relationship} of ${child.full_name}`;

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

  // Hide skeleton and show content
  const skeletonElement = document.getElementById('recentGradesSkeleton');
  const contentElement = document.getElementById('recentGradesContainer');
  if (skeletonElement) skeletonElement.style.display = 'none';
  if (contentElement) contentElement.style.display = 'block';

  if (error) {
    console.error('Error fetching recent grades:', error);
    if (contentElement) {
      contentElement.innerHTML = '<p style="text-align:center; color:#ef4444;">Failed to load grades.</p>';
    }
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
  // Hide skeleton and show content
  const skeletonElement = document.getElementById('progressSkeleton');
  const contentElement = document.getElementById('progressChartContainer');
  if (skeletonElement) skeletonElement.style.display = 'none';
  if (contentElement) contentElement.style.display = 'block';

  // Fetch all grades to calculate average per month or term
  const { data: grades, error } = await supabase
    .from('Grades')
    .select('score, created_at')
    .eq('student_id', childId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching progress:', error);
    if (contentElement) {
      contentElement.innerHTML = '<p style="text-align:center; color:#ef4444;">Failed to load progress chart.</p>';
    }
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

async function fetchReportCards(childId) {
  // Hide skeleton and show content
  const skeletonElement = document.getElementById('reportCardsSkeleton');
  const contentElement = document.getElementById('reportCardsContainer');
  if (skeletonElement) skeletonElement.style.display = 'none';
  if (contentElement) contentElement.style.display = 'block';

  // Mock implementation - replace with actual data fetching
  setTimeout(() => {
    contentElement.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #64748b;">
        <i class="fas fa-file-alt" style="font-size: 2rem; margin-bottom: 16px; color: #10b981;"></i>
        <h3>Term 1 Report Card</h3>
        <p>Available for download</p>
        <button class="test-btn success" style="margin-top: 16px;">
            <i class="fas fa-download"></i> Download
        </button>
      </div>
    `;
  }, 1000);
}

async function fetchMessages(childId) {
  // Hide skeleton and show content
  const skeletonElement = document.getElementById('messagesSkeleton');
  const contentElement = document.getElementById('messagesContainer');
  if (skeletonElement) skeletonElement.style.display = 'none';
  if (contentElement) contentElement.style.display = 'block';

  // Mock implementation - replace with actual data fetching
  setTimeout(() => {
    contentElement.innerHTML = `
      <div style="padding: 20px; text-align: center; color: #64748b;">
        <i class="fas fa-envelope" style="font-size: 2rem; margin-bottom: 16px; color: #f59e0b;"></i>
        <h3>3 New Messages</h3>
        <p>From teachers and school administration</p>
        <button class="test-btn" style="margin-top: 16px;">
            <i class="fas fa-inbox"></i> View Messages
        </button>
      </div>
    `;
  }, 1500);
}
