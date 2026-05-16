const ctx = document.getElementById("canvas").getContext("2d");

new Chart(ctx, {
  type: "line",
  data: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May"],
    datasets: [
      {
        label: "Average Grade",
        data: [0, 88, 23, 91, 95],
        borderColor: "blue",
        backgroundColor: "rgba(0, 0, 255, 0.05)",
        pointBackgroundColor: "blue",
        pointRadius: 5,
        tension: 0.4, // smooth curve
      },
    ],
  },
  options: {
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: "Grade (%)",
        },
      },
      x: {
        title: {
          display: true,
          text: "Month",
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: "#333",
        },
      },
      tooltip: {
        enabled: true,
      },
    },
  },
});
