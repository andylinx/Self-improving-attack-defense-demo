(() => {
  "use strict";

  const LOGICAL_HEIGHT = 760;
  const WORLD_WIDTH = 7100;
  const END_TIME = 72;
  const checkpoints = [
    { time: 6, title: "OPENCLAW AT WORK", summary: "Trusted tools quietly handle everyday work." },
    { time: 20, title: "FAILURE BECOMES RESEARCH", summary: "A blocked request triggers autonomous research." },
    { time: 38, title: "LEARNING FROM FAILURE", summary: "Each attempt adds knowledge to the next one." },
    { time: 53, title: "SELF-EVOLUTION", summary: "The missing capability is built and equipped." },
    { time: 72, title: "THE CONSEQUENCE", summary: "A learned chain turns trusted access into data loss." },
  ];

  const cameraTrack = [
    [0, 0], [4.5, 0], [6, 150], [7.5, 660], [11, 1110], [15, 1640], [20, 2050],
    [24, 2520], [29, 2910], [34, 3440], [38, 3650], [43, 4140],
    [48, 4480], [53, 4550], [58, 5290],
    [63, 5580], [67, 5940], [72, 6420],
  ];
  const agentTrack = [
    [5.6, 1080, 380], [8, 1270, 430], [11, 1650, 410], [14, 2020, 395],
    [18, 2440, 390], [21, 2860, 390], [24, 3090, 410], [28, 3440, 405],
    [31, 3600, 425], [35, 3990, 415], [39, 4270, 395], [44, 4660, 385],
    [48, 4910, 405], [53, 5230, 390], [58, 5580, 395], [62, 5850, 385],
    [66, 6200, 405], [72, 6410, 405],
  ];

  const viewport = document.querySelector("#viewport");
  const world = document.querySelector("#world");
  const canvas = document.querySelector("#scene-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const timedElements = [...document.querySelectorAll(".timed")].map((element) => ({
    element,
    start: Number(element.dataset.in || 0),
    end: Number(element.dataset.out || END_TIME),
  }));
  const agent = document.querySelector("#red-agent");
  const agentState = document.querySelector("#agent-state");
  const agentSkills = document.querySelector("#agent-skills");
  const agentMeterFill = document.querySelector("#agent-meter-fill");
  const statusPill = document.querySelector("#status-pill");
  const statusText = document.querySelector("#status-text");
  const roundLabel = document.querySelector("#round-label");
  const backButton = document.querySelector("#back-button");
  const continueButton = document.querySelector("#continue-button");
  const continueLabel = document.querySelector("#continue-label");
  const chapterCount = document.querySelector("#chapter-count");
  const chapterTitle = document.querySelector("#chapter-title");
  const chapterSummary = document.querySelector("#chapter-summary");
  const chapterDots = document.querySelector("#chapter-dots");

  let width = 0;
  let height = 0;
  let scale = 1;
  let dpr = 1;
  let cameraX = 0;
  let currentTime = 0;
  let targetCheckpoint = 0;
  let paused = false;
  let lastFrame = performance.now();
  let particles = [];

  const requestedTime = Number.parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requestedTime)) {
    currentTime = clamp(requestedTime, 0, END_TIME);
    targetCheckpoint = checkpoints.findIndex((checkpoint) => checkpoint.time >= currentTime);
    if (targetCheckpoint < 0) targetCheckpoint = checkpoints.length - 1;
    paused = true;
  }

  const edges = [
    { birth: 12.5, a: [2030, 395], b: [2140, 195], color: "red", bend: -95 },
    { birth: 13.5, a: [2050, 400], b: [2130, 375], color: "red", bend: 0 },
    { birth: 14.5, a: [2030, 405], b: [2160, 560], color: "red", bend: 85 },
    { birth: 16.5, a: [2415, 195], b: [2520, 345], color: "red", bend: 70 },
    { birth: 17.2, a: [2405, 375], b: [2520, 360], color: "red", bend: 0 },
    { birth: 18, a: [2435, 560], b: [2520, 380], color: "red", bend: -70 },
    { birth: 19, a: [2725, 365], b: [2790, 355], color: "green", bend: 0 },
    { birth: 25.5, a: [3245, 455], b: [3370, 535], color: "red", bend: 45 },
    { birth: 27, a: [3490, 550], b: [3600, 400], color: "amber", bend: -55 },
    { birth: 32.5, a: [3910, 430], b: [3950, 555], color: "amber", bend: 45 },
    { birth: 36.5, a: [4185, 555], b: [4290, 375], color: "amber", bend: -60 },
    { birth: 42, a: [4680, 375], b: [4700, 360], color: "green", bend: 0 },
  ];
  const finalEdges = [
    { birth: 49.5, a: [4980, 390], b: [5810, 355], bend: -245 },
    { birth: 50.5, a: [5120, 405], b: [5810, 355], bend: 205 },
    { birth: 51.5, a: [5290, 390], b: [5810, 355], bend: -155 },
    { birth: 52.5, a: [5480, 405], b: [5810, 355], bend: 135 },
  ];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function ease(value) { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); }
  function trackValue(track, time, index = 1) {
    if (time <= track[0][0]) return track[0][index];
    for (let i = 1; i < track.length; i += 1) {
      if (time <= track[i][0]) {
        const previous = track[i - 1];
        const next = track[i];
        const progress = ease((time - previous[0]) / (next[0] - previous[0]));
        return previous[index] + (next[index] - previous[index]) * progress;
      }
    }
    return track[track.length - 1][index];
  }

  function buildDots() {
    checkpoints.forEach((checkpoint) => {
      const dot = document.createElement("i");
      dot.title = checkpoint.title;
      dot.setAttribute("aria-hidden", "true");
      chapterDots.appendChild(dot);
    });
  }

  function resize() {
    const bounds = viewport.getBoundingClientRect();
    width = bounds.width;
    height = bounds.height;
    scale = height / LOGICAL_HEIGHT;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(74, Math.max(35, Math.round((width * height) / 22000)));
    particles = Array.from({ length: count }, (_, index) => ({
      x: (index * 197.3) % width,
      y: (index * 89.7) % height,
      size: 0.35 + (index % 5) * 0.12,
      phase: index * 0.57,
    }));
  }

  function showTimedContent(time) {
    timedElements.forEach(({ element, start, end }) => {
      const visible = time >= start && time < end;
      element.classList.toggle("show", visible);
      element.classList.toggle("fading", visible && time > end - 0.8);
    });
  }

  function updateWorkActivity(time) {
    const cycles = [
      [0, "New email received", "Checking calendar", "Drafting daily brief"],
      [1.4, "Inbox triaged", "Calendar conflict found", "Preparing Slack update"],
      [2.8, "Reply sent to investor", "Meeting moved to 2:30 PM", "Team notified in Slack"],
      [4.2, "Email thread resolved", "Schedule confirmed", "Daily brief ready"],
    ];
    let copy = cycles[0];
    cycles.forEach((cycle) => { if (time >= cycle[0]) copy = cycle; });
    document.querySelector("#activity-main").textContent = copy[1];
    document.querySelector("#activity-second").textContent = copy[2];
    document.querySelector("#activity-third").textContent = copy[3];
    document.querySelector("#mail-task").textContent = time < 2.2 ? "Reading inbox" : "Reply sent";
    document.querySelector("#calendar-task").textContent = time < 2.8 ? "Checking schedule" : "Meeting moved";
    document.querySelector("#slack-task").textContent = time < 3.5 ? "Updating team" : "Message sent";
  }

  function getAgentPhase(time) {
    if (time < 7) return ["OBSERVING", 0, 0, 4];
    if (time < 12) return ["TESTING", 0, 0, 4];
    if (time < 17) return ["SEARCHING", 0, 0, 8];
    if (time < 21) return ["SYNTHESIZING", 1, 3, 62];
    if (time < 26) return ["RETRYING", 1, 3, 62];
    if (time < 29) return ["ANALYZING FAILURE", 2, 3, 68];
    if (time < 34) return ["COMBINING SKILLS", 2, 3, 72];
    if (time < 38) return ["LEARNING", 2, 3, 76];
    if (time < 44) return ["SELF-ADAPTING", 3, 3, 82];
    if (time < 49) return ["NEW SKILL EQUIPPED", 4, 4, 100];
    if (time < 60) return ["CHAINING ATTACK", 4, 4, 100];
    if (time < 65) return ["ACCESS GAINED", 4, 4, 100];
    return ["MISSION COMPLETE", 4, 4, 100];
  }

  function updateAgent(time) {
    const visible = time >= 5.55 && time < 66.5;
    agent.style.opacity = visible ? "1" : "0";
    agent.style.pointerEvents = "none";
    agent.style.left = `${trackValue(agentTrack, time, 1)}px`;
    agent.style.top = `${trackValue(agentTrack, time, 2)}px`;
    const [state, level, skills, meter] = getAgentPhase(time);
    agent.className = `red-agent level-${level}`;
    agentState.textContent = state;
    agentSkills.textContent = String(skills).padStart(2, "0");
    agentMeterFill.style.width = `${meter}%`;
  }

  function updateStatus(time) {
    let tone = "safe";
    let text = "OpenClaw working";
    let round = "LIVE";
    if (time >= 6) [tone, text, round] = ["threat", "Testing OpenClaw", "ROUND 00"];
    if (time >= 12) [tone, text, round] = ["threat", "Autonomous research", "DISCOVER"];
    if (time >= 20) [tone, text, round] = ["attack", "New skills equipped", "03 SKILLS"];
    if (time >= 23) [tone, text, round] = ["threat", "Attack failed · learning", "ROUND 01"];
    if (time >= 29) [tone, text, round] = ["attack", "Combining methods", "ROUND 02"];
    if (time >= 34) [tone, text, round] = ["attack", "Partial result · learning", "2 / 3"];
    if (time >= 38) [tone, text, round] = ["threat", "Building missing skill", "EVOLVING"];
    if (time >= 44) [tone, text, round] = ["attack", "Self-adaptation equipped", "04 SKILLS"];
    if (time >= 49) [tone, text, round] = ["threat", "Learned attack chain", "FINAL"];
    if (time >= 59) [tone, text, round] = ["threat", "OpenClaw compromised", "BREACHED"];
    if (time >= 65) [tone, text, round] = ["threat", "Confidential file sent", "IMPACT"];
    statusPill.className = `status-pill ${tone}`;
    statusText.textContent = text;
    roundLabel.textContent = round;
  }

  function currentAct(time) {
    const index = checkpoints.findIndex((checkpoint) => time <= checkpoint.time + 0.01);
    return index < 0 ? checkpoints.length - 1 : index;
  }

  function updateControls(time) {
    const act = currentAct(time);
    const chapter = checkpoints[act];
    chapterCount.textContent = "LIVE TIMELINE";
    chapterTitle.textContent = chapter.title;
    chapterSummary.textContent = chapter.summary;
    backButton.disabled = time < 0.1;
    const atEnd = time >= END_TIME - 0.02;
    continueLabel.textContent = atEnd ? "REPLAY" : paused ? "CONTINUE" : "PLAYING";
    continueButton.classList.toggle("ready", paused && !atEnd);
    continueButton.classList.toggle("replay", atEnd);
    [...chapterDots.children].forEach((dot, index) => {
      dot.classList.toggle("done", index < act || (index === act && time >= checkpoints[index].time - 0.02));
      dot.classList.toggle("active", index === act);
    });
  }

  function positionWorld(time) {
    const desiredCamera = trackValue(cameraTrack, time);
    const maxCamera = Math.max(0, WORLD_WIDTH - width / scale);
    cameraX = clamp(desiredCamera, 0, maxCamera);
    world.style.transform = `translate3d(${-cameraX * scale}px,0,0) scale(${scale})`;
  }

  function screenPoint(point) { return [(point[0] - cameraX) * scale, point[1] * scale]; }

  function drawCurve(a, b, bend, color, progress, lineWidth = 1) {
    const start = screenPoint(a);
    const end = screenPoint(b);
    const controlX = (start[0] + end[0]) / 2;
    const controlY = (start[1] + end[1]) / 2 + bend * scale;
    const steps = 42;
    const drawSteps = Math.max(1, Math.floor(steps * clamp(progress, 0, 1)));
    const palette = { red: [255, 74, 61], green: [145, 255, 36], amber: [255, 178, 69] };
    const rgb = palette[color];
    ctx.beginPath();
    for (let i = 0; i <= drawSteps; i += 1) {
      const t = i / steps;
      const inv = 1 - t;
      const x = inv * inv * start[0] + 2 * inv * t * controlX + t * t * end[0];
      const y = inv * inv * start[1] + 2 * inv * t * controlY + t * t * end[1];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${rgb.join(",")},.52)`;
    ctx.lineWidth = lineWidth;
    ctx.shadowBlur = 9;
    ctx.shadowColor = `rgba(${rgb.join(",")},.25)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (progress > 0 && progress < 1) {
      const t = clamp(progress, 0, 1);
      const inv = 1 - t;
      const x = inv * inv * start[0] + 2 * inv * t * controlX + t * t * end[0];
      const y = inv * inv * start[1] + 2 * inv * t * controlY + t * t * end[1];
      ctx.fillStyle = `rgba(${rgb.join(",")},.95)`;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `rgb(${rgb.join(",")})`;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function drawBackground(frameTime) {
    ctx.clearRect(0, 0, width, height);
    const spacing = 92 * scale;
    const offsetX = -((cameraX * scale) % spacing);
    ctx.strokeStyle = "rgba(205,230,213,.025)";
    ctx.lineWidth = 1;
    for (let x = offsetX; x < width; x += spacing) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = spacing / 2; y < height; y += spacing) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    particles.forEach((particle) => {
      const alpha = 0.035 + Math.sin(frameTime * 0.0005 + particle.phase) * 0.018;
      ctx.fillStyle = `rgba(202,229,211,${alpha})`;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
  }

  function drawOpenClawFlows(time) {
    if (time >= 8) return;
    const center = [390, 370];
    const tasks = [[260, 184], [680, 164], [230, 574], [710, 584], [755, 352]];
    tasks.forEach((task, index) => {
      const a = index % 2 ? task : center;
      const b = index % 2 ? center : task;
      drawCurve(a, b, index % 2 ? 25 : -25, "green", clamp((time - index * 0.35) / 0.9, 0, 1), 0.8);
      drawCurve(a, b, index % 2 ? 25 : -25, "green", (time * 0.38 + index * 0.19) % 1, 1.25);
    });
  }

  function drawAttackSpine(time) {
    if (time < 5.8) return;
    const points = agentTrack.filter((point) => point[0] <= Math.min(time + 2, 65));
    if (points.length < 2) return;
    ctx.beginPath();
    points.forEach((point, index) => {
      const [x, y] = screenPoint([point[1], point[2]]);
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "rgba(255,74,61,.12)";
    ctx.setLineDash([3, 8]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawDirectImpact(time) {
    if (time < 7 || time > 12) return;
    drawCurve([1460, 365], [1685, 355], -12, "red", clamp((time - 7) / 1.4, 0, 1), 1.4);
    if (time > 8.5) {
      const [x, y] = screenPoint([1685, 355]);
      const phase = (time - 8.5) % 1;
      ctx.strokeStyle = `rgba(145,255,36,${0.5 - phase * 0.45})`;
      ctx.beginPath(); ctx.arc(x, y, (7 + phase * 16) * scale, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawEvolvingEdges(time) {
    edges.forEach((edge) => {
      const progress = clamp((time - edge.birth) / 1.25, 0, 1);
      if (progress > 0) drawCurve(edge.a, edge.b, edge.bend, edge.color, progress, 1);
    });
    finalEdges.forEach((edge, index) => {
      const progress = clamp((time - edge.birth) / 3.1, 0, 1);
      if (progress > 0) drawCurve(edge.a, edge.b, edge.bend, index === 3 ? "amber" : "red", progress, 1.35);
    });
  }

  function drawBreach(time) {
    if (time < 57) return;
    const [x, y] = screenPoint([5810, 355]);
    const pulse = (time * 1.15) % 1;
    ctx.strokeStyle = `rgba(255,74,61,${0.55 * (1 - pulse)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, (20 + pulse * 90) * scale, 0, Math.PI * 2); ctx.stroke();
    if (time >= 59) drawCurve([5900, 355], [6140, 330], -35, "red", clamp((time - 59) / 2, 0, 1), 1.4);
  }

  function render(time, frameTime) {
    positionWorld(time);
    showTimedContent(time);
    updateWorkActivity(time);
    updateAgent(time);
    updateStatus(time);
    updateControls(time);
    drawBackground(frameTime);
    drawOpenClawFlows(time);
    drawAttackSpine(time);
    drawDirectImpact(time);
    drawEvolvingEdges(time);
    drawBreach(time);
  }

  function pauseAtCheckpoint() {
    paused = true;
    currentTime = checkpoints[targetCheckpoint].time;
    history.replaceState(null, "", `${location.pathname}?t=${currentTime}`);
  }

  function playNext() {
    if (currentTime >= END_TIME - 0.02) {
      currentTime = 0;
      targetCheckpoint = 0;
      paused = false;
      lastFrame = performance.now();
      history.replaceState(null, "", location.pathname);
      return;
    }
    if (!paused) return;
    const act = currentAct(currentTime);
    targetCheckpoint = Math.min(checkpoints.length - 1, act + (currentTime >= checkpoints[act].time - 0.02 ? 1 : 0));
    paused = false;
    lastFrame = performance.now();
    history.replaceState(null, "", location.pathname);
  }

  function goBack() {
    const act = currentAct(currentTime);
    if (currentTime > checkpoints[act].time + 0.4) {
      currentTime = checkpoints[act].time;
      targetCheckpoint = act;
    } else if (act > 0) {
      currentTime = checkpoints[act - 1].time;
      targetCheckpoint = act - 1;
    } else {
      currentTime = 0;
      targetCheckpoint = 0;
    }
    paused = true;
    lastFrame = performance.now();
    history.replaceState(null, "", currentTime ? `${location.pathname}?t=${currentTime}` : location.pathname);
  }

  function frame(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.08);
    lastFrame = now;
    if (!paused) {
      currentTime += delta;
      if (currentTime >= checkpoints[targetCheckpoint].time) pauseAtCheckpoint();
    }
    render(currentTime, now);
    requestAnimationFrame(frame);
  }

  continueButton.addEventListener("click", playNext);
  backButton.addEventListener("click", goBack);
  document.addEventListener("keydown", (event) => {
    if ([" ", "ArrowRight", "Enter", "PageDown"].includes(event.key)) {
      event.preventDefault(); playNext();
    } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault(); goBack();
    } else if (event.key === "Home") {
      event.preventDefault(); currentTime = 0; targetCheckpoint = 0; paused = true;
    }
  });
  window.addEventListener("resize", resize, { passive: true });

  buildDots();
  resize();
  render(currentTime, performance.now());
  requestAnimationFrame(frame);
})();
