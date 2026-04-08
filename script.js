const fallbackData = {
  phase: "Phase 2",
  deadlineLabel: "Phase 2 deadline",
  deadlineStatus: "Deadline reached",
  nextTransitionIso: null,
  totals: {
    raisedEth: 7.4148,
    retainedEth: 7.4148,
    participants: 56,
    transfers: 56,
    defectionRate: 0,
    refundCount: 0,
    avgTicket: 0.1324,
    topWalletShare: 13.5
  },
  curves: {
    raised: [0.22, 0.6, 1.35, 2.14, 3.05, 4.1, 5.22, 6.41, 7.41],
    entries: [2, 6, 9, 13, 19, 27, 38, 47, 56],
    exits: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    labels: ["16:00", "17:00", "18:30", "20:00", "21:30", "23:00", "00:00", "01:30", "03:00"]
  },
  health: [],
  timeline: [],
  activity: [],
  narrative: {
    heroSummary: "",
    statusIntro: "",
    statusDetail: "",
    statusWarning: ""
  },
  analytics: {
    phaseCap: 72,
    maturityWeight: 0.75,
    topShare: 13.5,
    topFiveShare: 46.5,
    hhi: 0.059,
    lateShare: 41.6,
    recentBreadth: 25,
    commitmentRatio: 100,
    componentScores: {
      commitment: 100,
      breadth: 100,
      concentration: 99,
      momentum: 95,
      defensibility: 92
    }
  },
  scores: {
    successScore: 72,
    failureRisk: 16,
    changeSummary: "Constructive",
    ribbonTitle: "The experiment is holding, but still under active test.",
    confidence: 70
  },
  history: [],
  lastUpdatedIso: null,
  sourceUrl: "https://www.d27exp.xyz/"
};

let experimentData = structuredClone(fallbackData);

function formatEth(value) {
  return `${Number(value).toFixed(4)} ETH`;
}

function formatPercent(value) {
  return `${Number(value).toFixed(1)}%`;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function computeScores() {
  if (experimentData.scores) {
    return {
      success: experimentData.scores.successScore,
      failure: experimentData.scores.failureRisk,
      changeSummary: experimentData.scores.changeSummary,
      ribbonTitle: experimentData.scores.ribbonTitle,
      confidence: experimentData.scores.confidence
    };
  }

  return {
    success: 50,
    failure: 50,
    changeSummary: "Awaiting live model",
    ribbonTitle: "Live scoring model not loaded.",
    confidence: 0
  };
}

function renderRibbon() {
  const { success, failure, changeSummary, ribbonTitle, confidence } = computeScores();
  const updated = experimentData.lastUpdatedIso
    ? `Updated ${new Date(experimentData.lastUpdatedIso).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
        hour12: false
      })} UTC`
    : "Snapshot ready";

  setText("ribbon-title", ribbonTitle);
  setText("phase-pill", `${experimentData.phase} | confidence ${confidence}%`);
  setText("updated-pill", updated);
  setText("success-score", `${success}`);
  setText("failure-score", `${failure}`);
  setText("change-summary", changeSummary);
}

function renderSummary() {
  const { totals, phase } = experimentData;
  const netCommitment = totals.raisedEth > 0 ? (totals.retainedEth / totals.raisedEth) * 100 : 0;

  setText("current-phase", phase);
  setText("total-raised", formatEth(totals.raisedEth));
  setText("retained-capital", formatEth(totals.retainedEth));
  setText("participants", totals.participants.toString());
  setText("defection-rate", formatPercent(totals.defectionRate));
  setText("refund-count", totals.refundCount.toString());
  setText("avg-ticket", `${Number(totals.avgTicket).toFixed(4)} ETH`);
  setText("top-share", formatPercent(totals.topWalletShare));
  setText("net-commitment", formatPercent(netCommitment));

  const summary =
    `${phase} is active. ${totals.participants} wallets have contributed ` +
    `${formatEth(totals.raisedEth)}, while ${formatEth(totals.retainedEth)} ` +
    `remains committed. ${experimentData.narrative?.heroSummary ?? ""}`;
  setText("live-summary", summary);
}

function renderHealth() {
  const container = document.getElementById("health-grid");
  const statusCopy = document.getElementById("status-copy");
  if (!container || !statusCopy) return;

  container.innerHTML = (experimentData.health ?? [])
    .map((item) => {
      const badgeClass = item.state.toLowerCase();
      return `
        <article class="health-card">
          <span class="health-badge ${badgeClass}">${item.state}</span>
          <strong>${item.title}</strong>
          <p>${item.copy}</p>
        </article>
      `;
    })
    .join("");

  const strongCount = (experimentData.health ?? []).filter((item) => item.state === "Strong").length;
  const mixedCount = (experimentData.health ?? []).filter((item) => item.state === "Mixed").length;
  const updatedText = experimentData.lastUpdatedIso
    ? `Last refreshed ${new Date(experimentData.lastUpdatedIso).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
        hour12: false
      })} UTC.`
    : "Using fallback snapshot.";

  statusCopy.innerHTML = `
    <div class="highlight">
      The experiment currently reads as constructive: ${strongCount} core signals are strong and ${mixedCount} remain conditional.
    </div>
    <p>${experimentData.narrative?.statusIntro ?? ""}</p>
    <p>${experimentData.narrative?.statusDetail ?? ""}</p>
    <p>${experimentData.narrative?.statusWarning ?? ""}</p>
    <p>${updatedText}</p>
  `;
}

function renderAlgorithm() {
  const breakdown = document.getElementById("score-breakdown");
  const benchmark = document.getElementById("benchmark-list");
  const trend = document.getElementById("trend-grid");
  if (!breakdown || !benchmark || !trend) return;

  const componentScores = experimentData.analytics?.componentScores ?? {};
  const breakdownItems = [
    ["Commitment", componentScores.commitment, "How much entered capital is still staying inside the structure."],
    ["Breadth", componentScores.breadth, "How close participation is to the target breadth for this phase."],
    ["Concentration", componentScores.concentration, "How safely the round avoids top-wallet dominance."],
    ["Momentum", componentScores.momentum, "How much of the flow is still arriving later in the phase."],
    ["Defensibility", componentScores.defensibility, "How credible the current structure looks heading into later rounds and TGE."]
  ];

  breakdown.innerHTML = breakdownItems
    .map(
      ([label, score, copy]) => `
        <article class="breakdown-item">
          <div class="breakdown-head">
            <strong>${label}</strong>
            <span class="timeline-time">${score ?? 0}/100</span>
          </div>
          <div class="breakdown-bar">
            <div class="breakdown-fill" style="width:${score ?? 0}%"></div>
          </div>
          <p>${copy}</p>
        </article>
      `
    )
    .join("");

  benchmark.innerHTML = `
    <article class="benchmark-item">
      <strong>Phase score cap</strong>
      <p>This stage is capped at ${experimentData.analytics?.phaseCap ?? "-"} / 100 so early strength cannot be mistaken for final validation.</p>
    </article>
    <article class="benchmark-item">
      <strong>Maturity weight</strong>
      <p>The current phase contributes with a maturity weight of ${experimentData.analytics?.maturityWeight ?? "-"}, which controls how much confidence the model allows at this point.</p>
    </article>
    <article class="benchmark-item">
      <strong>Concentration benchmark</strong>
      <p>Top wallet share is ${experimentData.analytics?.topShare ?? "-"}% and top five wallet share is ${experimentData.analytics?.topFiveShare ?? "-"}%.</p>
    </article>
    <article class="benchmark-item">
      <strong>Participation benchmark</strong>
      <p>Recent breadth is ${experimentData.analytics?.recentBreadth ?? "-"}% and late capital share is ${experimentData.analytics?.lateShare ?? "-"}%.</p>
    </article>
  `;

  const history = experimentData.history ?? [];
  if (history.length === 0) {
    trend.innerHTML = `
      <article class="trend-item">
        <strong>Waiting for more snapshots</strong>
        <p>Trend memory becomes meaningful after multiple refreshes have been stored.</p>
      </article>
    `;
    return;
  }

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const scoreDelta = previous ? latest.successScore - previous.successScore : 0;
  const raiseDelta = previous ? latest.raisedEth - previous.raisedEth : 0;
  const participantDelta = previous ? latest.participants - previous.participants : 0;

  trend.innerHTML = `
    <article class="trend-item">
      <div class="trend-head">
        <strong>Score drift</strong>
        <span class="timeline-time">${scoreDelta >= 0 ? "+" : ""}${scoreDelta}</span>
      </div>
      <p>Change in success score between the latest two stored refreshes.</p>
    </article>
    <article class="trend-item">
      <div class="trend-head">
        <strong>Capital change</strong>
        <span class="timeline-time">${raiseDelta >= 0 ? "+" : ""}${raiseDelta.toFixed(4)} ETH</span>
      </div>
      <p>How much total raised moved between the latest two snapshots.</p>
    </article>
    <article class="trend-item">
      <div class="trend-head">
        <strong>Participant change</strong>
        <span class="timeline-time">${participantDelta >= 0 ? "+" : ""}${participantDelta}</span>
      </div>
      <p>How many new participants appeared between the latest two snapshots.</p>
    </article>
    <article class="trend-item">
      <div class="trend-head">
        <strong>Snapshots stored</strong>
        <span class="timeline-time">${history.length}</span>
      </div>
      <p>The algorithm keeps recent refresh memory so the page can reason about trend, not just the latest state.</p>
    </article>
  `;
}

function renderTimeline() {
  const container = document.getElementById("timeline-list");
  if (!container) return;

  container.innerHTML = (experimentData.timeline ?? [])
    .map(
      (item) => `
        <article class="timeline-item ${item.active ? "active" : ""}">
          <div class="timeline-time">${item.time}</div>
          <div>
            <div class="timeline-tag">${item.tag}</div>
            <h3>${item.title}</h3>
            <p class="timeline-copy">${item.copy}</p>
          </div>
          <div class="timeline-tag">${item.active ? "Live now" : "Checkpoint"}</div>
        </article>
      `
    )
    .join("");
}

function renderActivity() {
  const container = document.getElementById("activity-feed");
  if (!container) return;

  container.innerHTML = (experimentData.activity ?? [])
    .map(
      (item) => `
        <article class="activity-item">
          <div class="timeline-time">${item.time}</div>
          <div>
            <strong>${item.title}</strong>
            <p>${item.copy}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderConcentration() {
  const container = document.getElementById("concentration-chart");
  const reading = document.getElementById("growth-reading");
  if (!container || !reading) return;

  const topShare = experimentData.analytics?.topShare ?? 0;
  const topFiveShare = experimentData.analytics?.topFiveShare ?? 0;
  const recentBreadth = experimentData.analytics?.recentBreadth ?? 0;
  const lateShare = experimentData.analytics?.lateShare ?? 0;

  container.innerHTML = `
    <div class="mini-bars">
      <div class="mini-bar-row">
        <span class="mini-bar-label">Top wallet</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${topShare}%"></div>
        </div>
        <span class="mini-bar-value">${topShare}%</span>
      </div>
      <div class="mini-bar-row">
        <span class="mini-bar-label">Top 5 wallets</span>
        <div class="mini-bar-track">
          <div class="mini-bar-fill" style="width:${Math.min(topFiveShare, 100)}%"></div>
        </div>
        <span class="mini-bar-value">${topFiveShare}%</span>
      </div>
      <article class="breakdown-item">
        <p>Largest single wallet share and combined top-five share help us read early concentration risk at a glance.</p>
      </article>
    </div>
  `;

  reading.innerHTML = `
    <article class="benchmark-item">
      <strong>Recent participant breadth</strong>
      <p>${recentBreadth}% of visible participation is still represented in the most recent activity slice.</p>
    </article>
    <article class="benchmark-item">
      <strong>Late capital share</strong>
      <p>${lateShare}% of raised capital arrived in the later part of the phase, which helps us judge whether momentum kept building.</p>
    </article>
    <article class="benchmark-item">
      <strong>Current interpretation</strong>
      <p>The participation chart now focuses on wallet growth, which is more meaningful than an empty exits line when refund data is not yet visible here.</p>
    </article>
  `;
}

function buildPath(values, width, height, padding) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const xStep = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = padding + index * xStep;
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderLineChart(targetId, series, labels, colors) {
  const container = document.getElementById(targetId);
  if (!container) return;

  const width = 640;
  const height = 280;
  const padding = 28;
  const guides = 4;
  const allValues = series.flat();
  const maxValue = Math.max(...allValues, 1);

  let grid = "";
  let yLabels = "";
  for (let i = 0; i <= guides; i += 1) {
    const y = padding + ((height - padding * 2) / guides) * i;
    const value = maxValue - (maxValue / guides) * i;
    grid += `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="rgba(255,255,255,0.08)" />`;
    yLabels += `<text class="chart-value-label" x="${padding - 8}" y="${y + 4}" text-anchor="end">${value.toFixed(0)}</text>`;
  }

  const denominator = Math.max(labels.length - 1, 1);
  const labelStep = (width - padding * 2) / denominator;
  const xLabels = labels
    .map((label, index) => {
      const x = padding + index * labelStep;
      return `<text class="chart-label" x="${x}" y="${height - 6}" text-anchor="middle">${label}</text>`;
    })
    .join("");

  const paths = series
    .map((values, index) => {
      const path = buildPath(values, width, height, padding);
      return `<path d="${path}" fill="none" stroke="${colors[index]}" stroke-width="3.2" stroke-linecap="round" />`;
    })
    .join("");

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Experiment chart">
      ${grid}
      ${yLabels}
      ${paths}
      ${xLabels}
    </svg>
  `;
}

function updateCountdown() {
  if (!experimentData.nextTransitionIso) {
    setText("countdown", "00d 00h 00m 00s");
    return;
  }

  const target = new Date(experimentData.nextTransitionIso).getTime();
  const now = Date.now();
  const diff = Math.max(0, target - now);

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  const parts = [days, hours, minutes, seconds].map((part) => String(part).padStart(2, "0"));
  setText("countdown", `${parts[0]}d ${parts[1]}h ${parts[2]}m ${parts[3]}s`);
}

function renderAll() {
  document.body.classList.remove("is-loading");
  renderRibbon();
  renderSummary();
  renderHealth();
  renderAlgorithm();
  renderTimeline();
  renderActivity();
  renderConcentration();
  renderLineChart("raised-chart", [experimentData.curves.raised], experimentData.curves.labels, ["#ffffff"]);
  renderLineChart("flow-chart", [experimentData.curves.entries], experimentData.curves.labels, ["#ffffff"]);
  updateCountdown();
}

async function loadLiveData() {
  try {
    let response = await fetch(`/api/data?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) {
      response = await fetch(`./data.json?ts=${Date.now()}`, { cache: "no-store" });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    experimentData = await response.json();
  } catch (_error) {
    experimentData = structuredClone(fallbackData);
  }
  renderAll();
}

loadLiveData();
setInterval(updateCountdown, 1000);
setInterval(loadLiveData, 60 * 60 * 1000);
