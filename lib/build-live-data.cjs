const SOURCE_URL = "https://www.d27exp.xyz/";

const D27_SCHEDULE = [
  { phase: "Phase 1", start: "2026-04-03T16:00:00Z", end: "2026-04-04T16:00:00Z" },
  { phase: "Interphase 1", start: "2026-04-04T16:00:00Z", end: "2026-04-05T16:00:00Z" },
  { phase: "Phase 2", start: "2026-04-07T16:00:00Z", end: "2026-04-08T04:00:00Z" },
  { phase: "Interphase 2", start: "2026-04-08T04:00:00Z", end: "2026-04-08T16:00:00Z" },
  { phase: "Phase 3", start: "2026-04-08T16:00:00Z", end: "2026-04-09T04:00:00Z" },
  { phase: "Interphase 3", start: "2026-04-09T04:00:00Z", end: "2026-04-09T16:00:00Z" },
  { phase: "Phase 4", start: "2026-04-09T16:00:00Z", end: "2026-04-10T04:00:00Z" },
  { phase: "Interphase 4", start: "2026-04-10T04:00:00Z", end: "2026-04-10T16:00:00Z" },
  { phase: "Phase 5", start: "2026-04-10T16:00:00Z", end: "2026-04-11T16:00:00Z" }
];

function extractPhase(html) {
  const match =
    html.match(/Track <!-- -->(Phase \d)<!-- --> participants/i) ||
    html.match(/(Phase \d) total raised/i);
  return match ? match[1] : "Phase 2";
}

function resolvePhase(rawPhase) {
  const now = Date.now();
  const scheduled =
    D27_SCHEDULE.find(({ start, end }) => {
      const startMs = new Date(start).getTime();
      const endMs = new Date(end).getTime();
      return now >= startMs && now < endMs;
    }) ?? null;

  if (scheduled) {
    return scheduled.phase;
  }

  return rawPhase;
}

function extractMetric(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escaped}<\\/p><p[^>]*>([^<]+)<\\/p>`, "i");
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

function extractDeadlineStatus(phase, nextTransitionIso) {
  if (!nextTransitionIso) {
    return { label: "Next transition", status: "Unavailable" };
  }

  const target = new Date(nextTransitionIso).getTime();
  const status = Date.now() >= target ? "Reached" : "Pending";

  return {
    label: `${phase} deadline`,
    status
  };
}

function parseTransactions(html) {
  const regex =
    /\\"sender_address\\":\\"(0x[a-f0-9]+)\\",\\"amount_eth\\":([0-9.]+).*?\\"amount_usd\\":([0-9.]+).*?\\"block_timestamp\\":\\"([^\\"]+)\\",\\"tx_hash\\":\\"(0x[a-f0-9]+)\\",\\"block_number\\":(\d+).*?\\"status_code\\":\\"([^\\"]+)\\"/g;

  const seen = new Map();
  let match;
  while ((match = regex.exec(html))) {
    const [, sender, amountEth, amountUsd, timestamp, txHash, blockNumber, statusCode] = match;
    if (!seen.has(txHash)) {
      seen.set(txHash, {
        sender,
        amountEth: Number(amountEth),
        amountUsd: Number(amountUsd),
        timestamp,
        txHash,
        blockNumber: Number(blockNumber),
        statusCode
      });
    }
  }
  return [...seen.values()];
}

function buildCurves(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return {
      raised: [0],
      entries: [0],
      exits: [0],
      labels: ["Start"]
    };
  }

  const bucketCount = Math.min(8, sorted.length);
  const bucketSize = Math.ceil(sorted.length / bucketCount);
  const labels = [];
  const raised = [];
  const entries = [];
  const exits = [];
  let runningRaised = 0;
  let runningEntries = 0;
  let runningExits = 0;

  for (let i = 0; i < sorted.length; i += bucketSize) {
    const slice = sorted.slice(i, i + bucketSize);
    for (const tx of slice) {
      runningRaised += tx.amountEth;
      runningEntries += 1;
      if (tx.statusCode !== "active_participant") runningExits += 1;
    }

    const last = slice[slice.length - 1];
    const label = new Date(last.timestamp).toLocaleString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC"
    });

    labels.push(label);
    raised.push(Number(runningRaised.toFixed(4)));
    entries.push(runningEntries);
    exits.push(runningExits);
  }

  return { raised, entries, exits, labels };
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromThresholds(value, good, weak, descending = false) {
  if (!descending) {
    if (value >= good) return 1;
    if (value <= weak) return 0;
    return (value - weak) / (good - weak);
  }

  if (value <= good) return 1;
  if (value >= weak) return 0;
  return 1 - (value - good) / (weak - good);
}

function getPhaseProfile(phase) {
  const profiles = {
    "Phase 1": { cap: 58, targetParticipants: 30, targetRaised: 4.5, stageWeight: 0.25 },
    "Interphase 1": { cap: 64, targetParticipants: 30, targetRaised: 4.5, stageWeight: 0.35 },
    "Phase 2": { cap: 72, targetParticipants: 40, targetRaised: 6, stageWeight: 0.45 },
    "Interphase 2": { cap: 78, targetParticipants: 40, targetRaised: 6, stageWeight: 0.58 },
    "Phase 3": { cap: 84, targetParticipants: 45, targetRaised: 7, stageWeight: 0.7 },
    "Interphase 3": { cap: 88, targetParticipants: 45, targetRaised: 7, stageWeight: 0.78 },
    "Phase 4": { cap: 90, targetParticipants: 48, targetRaised: 8, stageWeight: 0.86 },
    "Interphase 4": { cap: 92, targetParticipants: 48, targetRaised: 8, stageWeight: 0.92 },
    "Phase 5": { cap: 96, targetParticipants: 55, targetRaised: 9, stageWeight: 1 }
  };

  return profiles[phase] ?? { cap: 70, targetParticipants: 35, targetRaised: 5, stageWeight: 0.5 };
}

function computeAnalytics({ phase, transactions, totalRaised, retainedEth, participants, refundCount }) {
  const profile = getPhaseProfile(phase);
  const amounts = transactions.map((tx) => tx.amountEth).sort((a, b) => b - a);
  const topShare = totalRaised > 0 ? (amounts[0] ?? 0) / totalRaised : 0;
  const topFiveShare =
    totalRaised > 0 ? amounts.slice(0, 5).reduce((sum, value) => sum + value, 0) / totalRaised : 0;
  const hhi =
    totalRaised > 0 ? amounts.reduce((sum, value) => sum + (value / totalRaised) ** 2, 0) : 1;

  const sortedByTime = [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const splitIndex = Math.max(1, Math.floor(sortedByTime.length * 0.6));
  const lateShare =
    totalRaised > 0
      ? sortedByTime.slice(splitIndex).reduce((sum, tx) => sum + tx.amountEth, 0) / totalRaised
      : 0;
  const recentCount = sortedByTime.slice(-Math.max(1, Math.floor(sortedByTime.length * 0.25))).length;
  const recentBreadth = participants > 0 ? recentCount / participants : 0;
  const commitmentRatio = totalRaised > 0 ? retainedEth / totalRaised : 0;
  const defectionRate = participants > 0 ? refundCount / participants : 0;
  const breadthRatio = profile.targetParticipants > 0 ? participants / profile.targetParticipants : 0;
  const capitalRatio = profile.targetRaised > 0 ? totalRaised / profile.targetRaised : 0;

  const componentScores = {
    commitment: scoreFromThresholds(commitmentRatio, 0.92, 0.65),
    breadth: scoreFromThresholds(breadthRatio, 1, 0.35),
    concentration:
      scoreFromThresholds(topShare, 0.14, 0.32, true) * 0.55 +
      scoreFromThresholds(topFiveShare, 0.45, 0.75, true) * 0.25 +
      scoreFromThresholds(hhi, 0.08, 0.2, true) * 0.2,
    momentum:
      scoreFromThresholds(lateShare, 0.28, 0.08) * 0.7 +
      scoreFromThresholds(recentBreadth, 0.2, 0.05) * 0.3,
    defensibility:
      scoreFromThresholds(capitalRatio, 1, 0.4) * 0.45 +
      scoreFromThresholds(commitmentRatio, 0.9, 0.7) * 0.35 +
      scoreFromThresholds(topShare, 0.14, 0.3, true) * 0.2
  };

  const weightedBase =
    componentScores.commitment * 0.3 +
    componentScores.breadth * 0.2 +
    componentScores.concentration * 0.2 +
    componentScores.momentum * 0.15 +
    componentScores.defensibility * 0.15;

  const maturity = 0.55 + profile.stageWeight * 0.45;
  const riskPenalty =
    clamp(defectionRate / 0.22) * 12 +
    clamp((topShare - 0.18) / 0.16) * 8 +
    clamp((0.15 - lateShare) / 0.15) * 6;

  const rawScore = weightedBase * 100 * maturity - riskPenalty;
  const successScore = Math.round(clamp(rawScore / profile.cap) * profile.cap);
  const structuralRisk = clamp(
    (1 - componentScores.commitment) * 0.35 +
      (1 - componentScores.concentration) * 0.25 +
      (1 - componentScores.momentum) * 0.2 +
      (1 - componentScores.defensibility) * 0.2 +
      defectionRate * 0.8,
    0,
    0.95
  );
  const stageUncertainty = 1 - profile.stageWeight;
  const failureRisk = Math.round(
    clamp(structuralRisk * 0.72 + stageUncertainty * 0.28, 0.06, 0.92) * 100
  );
  const confidence = Math.round((0.45 + profile.stageWeight * 0.55) * 100);

  return {
    phaseCap: profile.cap,
    maturityWeight: Number(maturity.toFixed(2)),
    topShare,
    topFiveShare,
    hhi,
    lateShare,
    recentBreadth,
    commitmentRatio,
    componentScores,
    successScore,
    failureRisk,
    confidence
  };
}

function metricState(score) {
  if (score >= 0.72) return "Strong";
  if (score >= 0.45) return "Mixed";
  return "Weak";
}

function buildHealth({ analytics }) {
  const commitmentState = metricState(analytics.componentScores.commitment);
  const distributionState = metricState(analytics.componentScores.concentration);
  const momentumState = metricState(analytics.componentScores.momentum);
  const defensibilityState = metricState(analytics.componentScores.defensibility);

  return [
    {
      title: "Commitment",
      state: commitmentState,
      copy:
        commitmentState === "Strong"
          ? "Entered capital is still staying in the structure, which supports the commitment thesis so far."
          : commitmentState === "Mixed"
            ? "Some exits are emerging, but the structure is still holding more capital than it is losing."
            : "Exit pressure is becoming strong enough to challenge the commitment model."
    },
    {
      title: "Distribution",
      state: distributionState,
      copy:
        distributionState === "Strong"
          ? "Participation remains relatively broad, which reduces early concentration risk."
          : distributionState === "Mixed"
            ? "Concentration is visible and should be monitored, but it has not fully dominated the round."
            : "A small set of wallets now controls too much of the visible participation."
    },
    {
      title: "Momentum",
      state: momentumState,
      copy:
        momentumState === "Strong"
          ? "Demand is still building with enough breadth to read the phase as active rather than exhausted."
          : momentumState === "Mixed"
            ? "Momentum exists, but it is not yet strong enough to prove sustained later-phase demand."
            : "Participation breadth is too thin to call the phase convincingly healthy."
    },
    {
      title: "Defensibility",
      state: defensibilityState,
      copy:
        defensibilityState === "Strong"
          ? "The raise profile is building a more credible path into TGE than a fragile sprint structure would."
          : "The structure is promising, but later phases and retention behavior still need to confirm the setup."
    }
  ];
}

function buildNarrative({ phase, totals, health }) {
  const strongCount = health.filter((item) => item.state === "Strong").length;
  const defectionRate = totals.defectionRate;
  const concentration = totals.topWalletShare;

  const phaseTone = {
    "Phase 1":
      "The opening round is setting the anchor valuation, so the key question is whether broad participation appears without immediate fragility.",
    "Phase 2":
      "The first ladder round is testing whether commitment can survive beyond the opening phase and continue to attract capital.",
    "Phase 3":
      "The mid-game ladder is revealing whether demand can climb with price rather than collapsing after initial attention.",
    "Phase 4":
      "This late ladder round tests whether the structure still holds together under higher entry prices.",
    "Phase 5":
      "The final speculative round is showing whether conviction persists into the last distribution window.",
    "Interphase 1":
      "The full refund window is testing whether early participants remain aligned before the defection-cost stages begin.",
    "Interphase 2":
      "The first defection-cost refund window is the clearest live test of whether commitment is holding or starting to crack.",
    "Interphase 3":
      "This refund window tests whether earlier participants continue to stay aligned as the experiment advances.",
    "Interphase 4":
      "The final refund window before the last round reveals whether commitment can survive right before the endgame."
  };

  const heroSummary =
    phaseTone[phase] ??
    "The experiment is being read through the balance between participation, retention, and concentration.";

  let statusIntro = "This tracker is designed to show success and failure as they develop in public.";
  let statusDetail =
    "Success depends on whether the structure keeps capital committed, sustains participation across phases, limits destructive concentration, and leaves behind a defendable launch setup.";
  let statusWarning =
    "If exits accelerate, concentration rises, or later phases fail to attract demand, that deterioration will appear here as a live failure signal.";

  if (strongCount >= 3 && defectionRate <= 8) {
    statusIntro =
      "The live read is currently favorable: most core signals are still supporting the commitment model rather than undermining it.";
  } else if (defectionRate > 15 || strongCount <= 1) {
    statusIntro =
      "The live read is turning fragile: weaker commitment or fading breadth is beginning to challenge the model in real time.";
  }

  if (concentration > 20) {
    statusDetail =
      "The main risk now is concentration. Even if participation continues, a narrow wallet base would weaken the claim that distribution is structurally healthier.";
  } else if (phase.startsWith("Interphase")) {
    statusDetail =
      "This stage matters because exits are now more informative than entries. The model is being judged by who stays committed when leaving becomes costly.";
  } else if (phase === "Phase 5") {
    statusDetail =
      "This stage matters because the final round reveals whether the structure still has real demand once the earlier ladder phases have already set the tone.";
  }

  if (defectionRate === 0) {
    statusWarning =
      "So far there is no measurable exit wave. If that changes, the health layer will reflect it automatically.";
  } else if (defectionRate > 0 && defectionRate <= 10) {
    statusWarning =
      "Exits exist, but they are still limited. The key question is whether they stay contained as the experiment moves forward.";
  } else if (defectionRate > 10) {
    statusWarning =
      "Exit pressure is now a meaningful live signal. If it keeps rising, the experiment will start reading as structurally weaker.";
  }

  return { heroSummary, statusIntro, statusDetail, statusWarning };
}

function inferNextTransitionIso(phase) {
  const entry = D27_SCHEDULE.find((item) => item.phase === phase);
  return entry?.end ?? null;
}

function buildActivity(transactions) {
  return [...transactions]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 4)
    .map((tx) => ({
      time:
        new Date(tx.timestamp).toLocaleString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
          hour12: false
        }) + " UTC",
      title: `Wallet ${tx.sender.slice(0, 8)}... entered ${tx.amountEth} ETH`,
      copy: `Recorded at block ${tx.blockNumber.toLocaleString("en-GB")} with transaction ${tx.txHash.slice(0, 10)}....`
    }));
}

function buildTimeline(phase) {
  return [
    {
      tag: "Phase 1",
      time: "Apr 3",
      title: "Opening speculative round",
      copy: "10% of supply opened the experiment and established the base valuation anchor.",
      active: phase === "Phase 1"
    },
    {
      tag: "Interphase 1",
      time: "Apr 4",
      title: "Full refund window",
      copy: "Phase 1 participants could fully exit before the ladder stages began.",
      active: phase === "Interphase 1"
    },
    {
      tag: "Phase 2",
      time: "Apr 7",
      title: "First ladder round",
      copy: "5% of supply at 1.5x the Phase 1 anchor. This phase sets the tone for ongoing commitment.",
      active: phase === "Phase 2"
    },
    {
      tag: "Interphase 2",
      time: "Apr 8",
      title: "Defection-cost refund window",
      copy: "Participants may still leave, but exits now pay the 27% defection cost.",
      active: phase === "Interphase 2"
    },
    {
      tag: "Phase 5",
      time: "Apr 10",
      title: "Final speculative round",
      copy: "Residual supply rolls into the final round, where the market reveals whether conviction remains.",
      active: phase === "Phase 5"
    }
  ];
}

function buildScoreSummary({ successScore, failureRisk, phase, confidence }) {
  let changeSummary = "Stable";
  if (successScore >= 78) changeSummary = "Model holding";
  else if (successScore >= 62) changeSummary = "Constructive";
  else if (successScore >= 46) changeSummary = "Mixed read";
  else changeSummary = "Fragility rising";

  const ribbonTitle =
    successScore >= 78
      ? "The experiment is currently validating its structure."
      : successScore >= 62
        ? "The experiment is holding, but still under active test."
        : successScore >= 46
          ? "The experiment is sending mixed structural signals."
          : "The experiment is beginning to read as fragile.";

  return {
    successScore,
    failureRisk,
    changeSummary,
    ribbonTitle,
    confidence,
    note: `${phase} scores are phase-aware and capped by stage maturity.`
  };
}

async function buildLiveData(previousHistory = []) {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 Codex live tracker"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status}`);
  }

  const html = await response.text();
  const rawPhase = extractPhase(html);
  const phase = resolvePhase(rawPhase);
  const nextTransitionIso = inferNextTransitionIso(phase);
  const deadline = extractDeadlineStatus(phase, nextTransitionIso);
  const totalRaisedText = extractMetric(html, `${phase} total raised`) ?? "0 ETH";
  const participantsText = extractMetric(html, `${phase} participants`) ?? "0";
  const transfersText = extractMetric(html, `${phase} transfers`) ?? "0";
  const transactions = parseTransactions(html);

  const totalRaised = Number(totalRaisedText.replace(/[^\d.]/g, "")) || 0;
  const participants = Number(participantsText.replace(/[^\d]/g, "")) || 0;
  const transfers = Number(transfersText.replace(/[^\d]/g, "")) || transactions.length;
  const retainedEth = transactions
    .filter((tx) => tx.statusCode === "active_participant")
    .reduce((sum, tx) => sum + tx.amountEth, 0);
  const refundCount = transactions.filter((tx) => tx.statusCode !== "active_participant").length;
  const defectionRate = participants > 0 ? (refundCount / participants) * 100 : 0;
  const topWalletShare =
    totalRaised > 0 ? (Math.max(...transactions.map((tx) => tx.amountEth), 0) / totalRaised) * 100 : 0;
  const avgTicket = participants > 0 ? totalRaised / participants : 0;
  const analytics = computeAnalytics({
    phase,
    transactions,
    totalRaised,
    retainedEth,
    participants,
    refundCount
  });
  const health = buildHealth({ analytics });
  const lastUpdatedIso = new Date().toISOString();

  const history = Array.isArray(previousHistory) ? [...previousHistory] : [];
  history.push({
    capturedAt: lastUpdatedIso,
    phase,
    raisedEth: totalRaised,
    participants,
    successScore: analytics.successScore,
    failureRisk: analytics.failureRisk
  });

  return {
    phase,
    deadlineLabel: deadline.label,
    deadlineStatus: deadline.status,
    nextTransitionIso,
    totals: {
      raisedEth: totalRaised,
      retainedEth: Number(retainedEth.toFixed(4)),
      participants,
      transfers,
      defectionRate: Number(defectionRate.toFixed(1)),
      refundCount,
      avgTicket: Number(avgTicket.toFixed(4)),
      topWalletShare: Number(topWalletShare.toFixed(1))
    },
    curves: buildCurves(transactions),
    scores: buildScoreSummary({
      successScore: analytics.successScore,
      failureRisk: analytics.failureRisk,
      phase,
      confidence: analytics.confidence
    }),
    analytics: {
      phaseCap: analytics.phaseCap,
      maturityWeight: analytics.maturityWeight,
      topShare: Number((analytics.topShare * 100).toFixed(1)),
      topFiveShare: Number((analytics.topFiveShare * 100).toFixed(1)),
      hhi: Number(analytics.hhi.toFixed(3)),
      lateShare: Number((analytics.lateShare * 100).toFixed(1)),
      recentBreadth: Number((analytics.recentBreadth * 100).toFixed(1)),
      commitmentRatio: Number((analytics.commitmentRatio * 100).toFixed(1)),
      componentScores: {
        commitment: Number((analytics.componentScores.commitment * 100).toFixed(0)),
        breadth: Number((analytics.componentScores.breadth * 100).toFixed(0)),
        concentration: Number((analytics.componentScores.concentration * 100).toFixed(0)),
        momentum: Number((analytics.componentScores.momentum * 100).toFixed(0)),
        defensibility: Number((analytics.componentScores.defensibility * 100).toFixed(0))
      }
    },
    health,
    timeline: buildTimeline(phase),
    activity: buildActivity(transactions),
    narrative: buildNarrative({
      phase,
      totals: {
        raisedEth: totalRaised,
        retainedEth: Number(retainedEth.toFixed(4)),
        participants,
        transfers,
        defectionRate: Number(defectionRate.toFixed(1)),
        refundCount,
        avgTicket: Number(avgTicket.toFixed(4)),
        topWalletShare: Number(topWalletShare.toFixed(1))
      },
      health
    }),
    history: history.slice(-12),
    lastUpdatedIso,
    sourceUrl: SOURCE_URL
  };
}

module.exports = {
  SOURCE_URL,
  buildLiveData
};
