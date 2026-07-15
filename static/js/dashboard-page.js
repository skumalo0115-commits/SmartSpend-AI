document.addEventListener("DOMContentLoaded", () => {
  const isStaticMode = window.location.pathname.includes("/templates/") || window.location.port === "5500";
  if (localStorage.getItem("loggedIn") !== "true") {
    window.location.href = isStaticMode ? "/templates/index.html" : "/";
    return;
  }

  const homeLink = document.getElementById("homeLink");
  const profileLink = document.getElementById("profileLink");
  if (homeLink) homeLink.href = isStaticMode ? "/templates/index.html" : "/";
  if (profileLink) profileLink.href = isStaticMode ? "/templates/profile.html" : "/profile";

  const parseInjectedJSON = (value, fallback) => {
    if (!value || value.includes("{{" )) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
  };

  const localData = JSON.parse(localStorage.getItem("ssDashboardData") || "{}");
  const getData = (serverValue, key, fallback = []) => (serverValue && serverValue.length ? serverValue : localData[key] ?? fallback);

  const data = {
    months: getData(parseInjectedJSON(window.__JINJA_MONTHS__, []), "months"),
    monthly: getData(parseInjectedJSON(window.__JINJA_MONTHLY__, []), "monthly"),
    categories: getData(parseInjectedJSON(window.__JINJA_CATEGORIES__, []), "categories"),
    categoryTotals: getData(parseInjectedJSON(window.__JINJA_CATEGORY_TOTALS__, []), "category_totals"),
    amounts: getData(parseInjectedJSON(window.__JINJA_AMOUNTS__, []), "amounts"),
    dates: getData(parseInjectedJSON(window.__JINJA_DATES__, []), "dates"),
    cumulative: getData(parseInjectedJSON(window.__JINJA_CUMULATIVE__, []), "cumulative"),
    rolling: getData(parseInjectedJSON(window.__JINJA_ROLLING__, []), "rolling"),
    velocity: getData(parseInjectedJSON(window.__JINJA_VELOCITY__, []), "velocity"),
    volLabels: getData(parseInjectedJSON(window.__JINJA_VOL_LABELS__, []), "volatility_labels"),
    volValues: getData(parseInjectedJSON(window.__JINJA_VOL_VALUES__, []), "volatility_values"),
    expenseLabels: getData(parseInjectedJSON(window.__JINJA_EXPENSE_LABELS__, []), "expense_labels"),
    expenseValues: getData(parseInjectedJSON(window.__JINJA_EXPENSE_VALUES__, []), "expense_values"),
    insights: parseInjectedJSON(window.__JINJA_INSIGHTS__, localData.insights || []),
  };
  const avgAmount = data.amounts?.length ? data.amounts.reduce((a,b)=>a+b,0)/data.amounts.length : 0;
  const stdAmount = data.amounts?.length ? Math.sqrt(data.amounts.map(v => Math.pow(v-avgAmount,2)).reduce((a,b)=>a+b,0)/Math.max(1,data.amounts.length-1)) : 0;
  const anomalyThreshold = avgAmount + (2 * stdAmount);

  if (isStaticMode && localData.total !== undefined) {
    document.getElementById("kpiTotal").textContent = `R ${localData.total}`;
    document.getElementById("kpiAvg").textContent = `R ${localData.average}`;
    document.getElementById("kpiPrediction").textContent = `R ${localData.prediction}`;
    document.getElementById("kpiAnomalies").textContent = `${localData.anomalies}`;
  }

  const insightsList = document.getElementById("insightsList");
  if (insightsList && data.insights.length) {
    insightsList.innerHTML = "";
    data.insights.forEach((ins) => {
      const li = document.createElement("li");
      li.textContent = ins;
      insightsList.appendChild(li);
    });
  }

  const axis = () => ({
    ticks: {
      color: "#b9c8ff",
      maxTicksLimit: 7,
      autoSkip: true,
      font: { size: 11, weight: "600" },
    },
    grid: { color: "rgba(159,179,255,0.12)" },
    border: { color: "rgba(159,179,255,0.18)" },
  });

  const moneyLabel = (value) => `R ${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const compactMoney = (value) => `R${Number(value || 0).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 })}`;
  const axisLabel = function(value) {
    return this.getLabelForValue ? this.getLabelForValue(value) : value;
  };
  const parsedValue = (ctx) => {
    if (ctx.parsed && typeof ctx.parsed === "object") return ctx.parsed.y ?? ctx.parsed.r ?? 0;
    return ctx.parsed ?? ctx.raw ?? 0;
  };
  const chartOptions = ({ indexAxis = "x", currencyAxis = true } = {}) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", axis: "xy", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: { color: "#dbeafe", boxWidth: 26, boxHeight: 8, useBorderRadius: true },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(7, 13, 35, 0.94)",
        borderColor: "rgba(125, 158, 255, 0.35)",
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.dataset.label || "Value"}: ${moneyLabel(parsedValue(ctx))}`,
        },
      },
    },
    scales: {
      x: { ...axis(), ticks: { ...axis().ticks, callback: currencyAxis && indexAxis === "y" ? compactMoney : axisLabel } },
      y: { ...axis(), ticks: { ...axis().ticks, callback: currencyAxis && indexAxis === "x" ? compactMoney : axisLabel } },
    },
    animation: { duration: 900 },
  });

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: "#dbeafe", padding: 14, boxWidth: 12, boxHeight: 12, useBorderRadius: true },
      },
      tooltip: {
        backgroundColor: "rgba(7, 13, 35, 0.94)",
        callbacks: { label: (ctx) => `${ctx.label}: ${moneyLabel(ctx.parsed)}` },
      },
    },
    animation: { duration: 800 },
  };

  if (window.Chart) {
    new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: { labels: data.months, datasets: [{ label: "Trend", data: data.monthly, borderColor: "#6ea8ff", backgroundColor: "rgba(110,168,255,.2)", fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: "#3158da" }] },
      options: chartOptions(),
    });
    new Chart(document.getElementById("categoryChart"), {
      type: "doughnut",
      data: { labels: data.categories, datasets: [{ data: data.categoryTotals, backgroundColor: ["#3b82f6", "#17c084", "#f59e0b", "#f43f5e", "#06b6d4", "#d946ef"], borderColor: "rgba(255,255,255,.08)", borderWidth: 2 }] },
      options: doughnutOptions,
    });
    new Chart(document.getElementById("monthlyChart"), { type: "bar", data: { labels: data.months, datasets: [{ label: "Monthly", data: data.monthly, backgroundColor: "rgba(59,130,246,.82)", borderColor: "#93c5fd", borderWidth: 1, borderRadius: 7 }] }, options: chartOptions() });
    new Chart(document.getElementById("scatterChart"), { type: "scatter", data: { datasets: [{ label: "Transactions", data: data.amounts.map((v, i) => ({ x: i + 1, y: v })), pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: "#22d3ee", pointBorderColor: "#0ea5e9" }] }, options: chartOptions() });
    new Chart(document.getElementById("cumulativeChart"), { type: "line", data: { labels: data.dates, datasets: [{ label: "Cumulative", data: data.cumulative, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,.14)", fill: true, tension: 0.24, pointRadius: 2 }] }, options: chartOptions() });
    new Chart(document.getElementById("rollingChart"), { type: "line", data: { labels: data.dates, datasets: [{ label: "Rolling", data: data.rolling, borderColor: "#22d3ee", borderDash: [6, 4], tension: 0.32, pointRadius: 2 }] }, options: chartOptions() });
    new Chart(document.getElementById("velocityChart"), { type: "line", data: { labels: data.dates, datasets: [{ label: "Velocity", data: data.velocity, borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,.12)", fill: true, tension: 0.3, pointRadius: 2 }] }, options: chartOptions() });
    new Chart(document.getElementById("volatilityChart"), { type: "bar", data: { labels: data.volLabels, datasets: [{ label: "Volatility", data: data.volValues, backgroundColor: "rgba(217,70,239,.72)", borderColor: "#f0abfc", borderWidth: 1, borderRadius: 7 }] }, options: chartOptions() });
    new Chart(document.getElementById("expenseChart"), { type: "doughnut", data: { labels: data.expenseLabels, datasets: [{ data: data.expenseValues, backgroundColor: ["#3b82f6", "#22c55e"], borderColor: "rgba(255,255,255,.08)", borderWidth: 2 }] }, options: doughnutOptions });
  }

  // KPIs ("money" cards) must be visible immediately; charts use IntersectionObserver reveal.
  document.querySelectorAll(".kpi.kpi-stat").forEach((el) => el.classList.add("visible"));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible"));
  }, { threshold: 0.15 });
  document.querySelectorAll(".chart").forEach((el) => {
    el.classList.add("visible");
    observer.observe(el);
  });

  const dashboard = document.querySelector(".dashboard");
  const backdrop = document.createElement("div");
  backdrop.className = "chart-focus-backdrop";
  document.body.appendChild(backdrop);

  function clearFocus() {
    dashboard?.classList.remove("focus-mode");
    document.querySelectorAll(".chart.focused").forEach((c) => c.classList.remove("focused"));
    backdrop.classList.remove("active");
  }

  backdrop.addEventListener("click", clearFocus);

  const toggleChartFocus = (chartCard) => {
    const isFocused = chartCard.classList.contains("focused");
    clearFocus();
    if (!isFocused) {
      dashboard?.classList.add("focus-mode");
      chartCard.classList.add("focused");
      backdrop.classList.add("active");
    }
  };

  let lastTapAt = 0;
  let lastTappedChart = null;

  document.querySelectorAll(".chart").forEach((chartCard) => {
    chartCard.addEventListener("dblclick", (event) => {
      toggleChartFocus(chartCard);
      event.stopPropagation();
    });

    chartCard.addEventListener("touchend", (event) => {
      const now = Date.now();
      const isDoubleTap = lastTappedChart === chartCard && (now - lastTapAt) < 320;
      if (isDoubleTap) {
        toggleChartFocus(chartCard);
        event.preventDefault();
        event.stopPropagation();
        lastTapAt = 0;
        lastTappedChart = null;
        return;
      }
      lastTapAt = now;
      lastTappedChart = chartCard;
    }, { passive: false });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") clearFocus();
  });

  const snapshotButton = document.getElementById("saveSnapshotBtn");
  const snapshotModal = document.getElementById("snapshotPermissionModal");
  const snapshotContinueBtn = document.getElementById("snapshotContinueBtn");
  const snapshotCancelBtn = document.getElementById("snapshotCancelBtn");

  const closeSnapshotModal = () => snapshotModal?.classList.add("hidden");
  const openSnapshotModal = () => snapshotModal?.classList.remove("hidden");

  const downloadSnapshotFromCanvas = (canvas) => {
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    link.href = canvas.toDataURL("image/png");
    link.download = `smartspend-dashboard-snapshot-${timestamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const takeDashboardSnapshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      SS.toast("Snapshot capture is not supported in this browser.", "error");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 1, max: 5 }, displaySurface: "browser" },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error("No video track returned");

      const video = document.createElement("video");
      video.style.position = "fixed";
      video.style.opacity = "0";
      video.style.pointerEvents = "none";
      video.muted = true;
      video.srcObject = stream;
      document.body.appendChild(video);

      await video.play();
      await new Promise((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.onloadeddata = () => resolve();
      });

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || window.innerWidth;
      canvas.height = video.videoHeight || window.innerHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

      downloadSnapshotFromCanvas(canvas);
      SS.toast("Snapshot downloaded.", "success");

      video.pause();
      video.srcObject = null;
      video.remove();
    } catch (error) {
      const denied = error?.name === "NotAllowedError";
      SS.toast(denied ? "Permission was denied for snapshot capture." : "Could not capture snapshot.", "error");
    } finally {
      stream?.getTracks()?.forEach((track) => track.stop());
    }
  };

  snapshotButton?.addEventListener("click", openSnapshotModal);
  snapshotCancelBtn?.addEventListener("click", closeSnapshotModal);
  snapshotModal?.addEventListener("click", (event) => {
    if (event.target === snapshotModal) closeSnapshotModal();
  });

  snapshotContinueBtn?.addEventListener("click", async () => {
    closeSnapshotModal();
    await takeDashboardSnapshot();
  });

  document.getElementById("saveAnalysisBtn")?.addEventListener("click", async () => {
    if (isStaticMode) {
      localStorage.setItem("ssDashboardData", JSON.stringify(localData));
      SS.toast("Analysis kept in browser storage.");
      return;
    }

    const profile = JSON.parse(localStorage.getItem("profile") || "{}");
    const payload = {
      email: profile.email || "",
      total: Number(document.getElementById("kpiTotal").textContent.replace(/[^\d.-]/g, "") || 0),
      average: Number(document.getElementById("kpiAvg").textContent.replace(/[^\d.-]/g, "") || 0),
      prediction: Number(document.getElementById("kpiPrediction").textContent.replace(/[^\d.-]/g, "") || 0),
      anomalies: Number(document.getElementById("kpiAnomalies").textContent || 0),
      strongest_category: localData.strongest_category || "General",
      payload: JSON.stringify(data),
    };

    SS.setLoading(true);
    const res = await fetch("/api/analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    SS.setLoading(false);

    SS.toast(res && res.ok ? "Analysis saved." : "Could not save analysis.", res && res.ok ? "success" : "error");
  });
});
