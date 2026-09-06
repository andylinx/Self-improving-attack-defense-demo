(() => {
  "use strict";

  const LOGICAL_HEIGHT = 760;
  const WORLD_WIDTH = 7900;
  const END_TIME = 70;
  const moments = [
    [0, "EVOLVING ATTACKER", "Automated red teams keep discovering new attack patterns."],
    [8, "ATTACKS GET THROUGH", "Three simple failures reveal where protection is missing."],
    [19, "FAILURES BECOME EVIDENCE", "The harness studies every successful attack case."],
    [30, "DEFENSE GATES GENERATED", "Each lesson becomes a small, reusable safeguard."],
    [43, "HARNESS REASSEMBLED", "The new gates snap into one coordinated defense."],
    [53, "ATTACKS REPLAYED", "The same threats are stopped at the right boundary."],
    [63, "DEFENSE KEEPS EVOLVING", "Every new attack can improve the next defense."],
  ];
  const cameraTrack = [
    [0, 0], [4, 0], [8, 650], [13, 1180], [18, 1770], [23, 2330], [28, 2820],
    [33, 3370], [38, 3890], [43, 4410], [48, 4830], [53, 5480], [58, 6030],
    [63, 6570], [67, 7000], [70, 7350],
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
  const statusPill = document.querySelector("#status-pill");
  const statusText = document.querySelector("#status-text");
  const statusDetail = document.querySelector("#status-detail");
  const playButton = document.querySelector("#play-button");
  const playIcon = document.querySelector("#play-icon");
  const replayButton = document.querySelector("#replay-button");
  const progressFill = document.querySelector("#progress-fill");
  const progressHead = document.querySelector("#progress-head");
  const progressTrack = document.querySelector(".track");
  const timecode = document.querySelector("#timecode");
  const momentTitle = document.querySelector("#moment-title");
  const momentSummary = document.querySelector("#moment-summary");
  const attackMeter = document.querySelector("#attack-meter");
  const attackSkills = document.querySelector("#attack-skills");
  const attackLevel = document.querySelector("#attack-level");
  const attackerState = document.querySelector("#attacker-state");
  const patternsFound = document.querySelector("#patterns-found");
  const defenseCore = document.querySelector("#defense-core");
  const defenseState = document.querySelector("#defense-state");
  const defenseMeter = document.querySelector("#defense-meter-fill");
  const defenseGates = document.querySelector("#defense-gates");

  let width = 0;
  let height = 0;
  let scale = 1;
  let dpr = 1;
  let cameraX = 0;
  let currentTime = 0;
  let playing = true;
  let lastFrame = performance.now();
  let particles = [];

  const requestedTime = Number.parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requestedTime)) {
    currentTime = clamp(requestedTime, 0, END_TIME);
    playing = false;
  }

  const staticEdges = [
    { birth: 3.7, death: 15, a: [845, 340], b: [1035, 325], color: "red", bend: -35 },
    { birth: 7.5, death: 23, a: [1210, 330], b: [1420, 275], color: "red", bend: -45 },
    { birth: 9.5, death: 24, a: [1210, 340], b: [1715, 515], color: "red", bend: 110 },
    { birth: 11.5, death: 26, a: [1220, 320], b: [2010, 270], color: "red", bend: -120 },
    { birth: 18.5, death: 34, a: [2310, 555], b: [2570, 305], color: "amber", bend: -85 },
    { birth: 20, death: 38, a: [2880, 315], b: [2945, 325], color: "green", bend: 0 },
    { birth: 24.5, death: 40, a: [3275, 325], b: [3335, 330], color: "green", bend: 0 },
    { birth: 29, death: 45, a: [3645, 330], b: [3830, 330], color: "green", bend: 0 },
    { birth: 32, death: 49, a: [4135, 330], b: [4195, 190], color: "green", bend: -40 },
  ];
  const assemblyEdges = [
    { birth: 43.5, death: 61, a: [4555, 190], b: [5140, 205], color: "green", bend: -85 },
    { birth: 45.5, death: 61, a: [4555, 290], b: [5565, 205], color: "green", bend: -165 },
    { birth: 47.5, death: 61, a: [4555, 390], b: [5105, 540], color: "green", bend: 115 },
    { birth: 49.5, death: 61, a: [4555, 490], b: [5600, 540], color: "green", bend: 165 },
  ];
  const replayEdges = [
    { birth: 53.5, death: 68, a: [6385, 210], b: [6475, 195], color: "red", bend: -16, stop: true },
    { birth: 55, death: 68, a: [6385, 305], b: [6475, 293], color: "red", bend: 0, stop: true },
    { birth: 56.5, death: 68, a: [6385, 405], b: [6475, 393], color: "red", bend: 16, stop: true },
    { birth: 57, death: 69, a: [6825, 195], b: [6900, 275], color: "green", bend: 35 },
    { birth: 58, death: 69, a: [6825, 293], b: [6900, 330], color: "green", bend: 15 },
    { birth: 59, death: 69, a: [6825, 393], b: [6900, 390], color: "green", bend: -20 },
  ];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function ease(value) { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); }
  function trackValue(track, time, index = 1) {
    if (time <= track[0][0]) return track[0][index];
    for (let i = 1; i < track.length; i += 1) {
      if (time <= track[i][0]) {
        const before = track[i - 1];
        const after = track[i];
        const progress = ease((time - before[0]) / (after[0] - before[0]));
        return before[index] + (after[index] - before[index]) * progress;
      }
    }
    return track[track.length - 1][index];
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
    const count = Math.min(78, Math.max(36, Math.round((width * height) / 21000)));
    particles = Array.from({ length: count }, (_, index) => ({
      x: (index * 197.3) % width,
      y: (index * 91.7) % height,
      size: 0.35 + (index % 5) * 0.12,
      phase: index * 0.61,
    }));
  }

  function updateTimed(time) {
    timedElements.forEach(({ element, start, end }) => {
      const visible = time >= start && time < end;
      element.classList.toggle("show", visible);
      element.classList.toggle("fading", visible && time > end - 0.85);
    });
  }

  function updateStory(time) {
    let tone = "threat";
    let text = "Red team testing";
    let detail = "LIVE";
    if (time >= 8) [tone, text, detail] = ["threat", "Attacks succeeding", "3 CASES"];
    if (time >= 19) [tone, text, detail] = ["learn", "Analyzing attack cases", "LEARNING"];
    if (time >= 30) [tone, text, detail] = ["safe", "Generating defense gates", "BUILDING"];
    if (time >= 43) [tone, text, detail] = ["safe", "Harness upgrading", "v1 → v2"];
    if (time >= 53) [tone, text, detail] = ["safe", "Replaying attacks", "0 / 3"];
    if (time >= 63) [tone, text, detail] = ["safe", "OpenClaw protected", "DEFENSE v2"];
    statusPill.className = `status-pill ${tone}`;
    statusText.textContent = text;
    statusDetail.textContent = detail;

    const attackProgress = clamp((time - 1) / 10, 0, 1);
    attackMeter.style.width = `${46 + attackProgress * 46}%`;
    attackSkills.textContent = time < 5 ? "03" : time < 8 ? "04" : "05";
    attackLevel.textContent = time < 5 ? "v1.2" : time < 8 ? "v1.3" : "v1.4";
    attackerState.textContent = time < 4 ? "EXPLORING" : time < 8 ? "ADDING NEW SKILL" : "LAUNCHING TESTS";

    const patterns = clamp(Math.floor((time - 22) / 2.1) + 1, 0, 4);
    patternsFound.textContent = `${String(patterns).padStart(2, "0")} / 04`;

    let gates = 0;
    if (time >= 44) gates = 1;
    if (time >= 46) gates = 2;
    if (time >= 48) gates = 3;
    if (time >= 50) gates = 4;
    defenseGates.textContent = String(gates).padStart(2, "0");
    defenseMeter.style.width = `${Math.max(3, gates * 25)}%`;
    defenseState.textContent = gates < 4 ? "ASSEMBLING" : time < 53 ? "UPGRADED · v2" : "DEFENDING";
    defenseCore.classList.toggle("complete", gates === 4);
  }

  function updateControls(time) {
    let selected = moments[0];
    moments.forEach((moment) => { if (time >= moment[0]) selected = moment; });
    momentTitle.textContent = selected[1];
    momentSummary.textContent = selected[2];
    const progress = (time / END_TIME) * 100;
    progressFill.style.width = `${progress}%`;
    progressHead.style.left = `${progress}%`;
    const totalSeconds = Math.floor(time);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timecode.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")} / 01:10`;
    playIcon.textContent = playing ? "Ⅱ" : time >= END_TIME ? "↻" : "▶";
    playButton.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
  }

  function positionWorld(time) {
    const desiredCamera = trackValue(cameraTrack, time);
    const maxCamera = Math.max(0, WORLD_WIDTH - width / scale);
    cameraX = clamp(desiredCamera, 0, maxCamera);
    world.style.transform = `translate3d(${-cameraX * scale}px,0,0) scale(${scale})`;
  }

  function screenPoint(point) { return [(point[0] - cameraX) * scale, point[1] * scale]; }

  function drawCurve(edge, time) {
    if (time < edge.birth || time >= edge.death) return;
    const progress = clamp((time - edge.birth) / 1.35, 0, 1);
    const start = screenPoint(edge.a);
    const end = screenPoint(edge.b);
    const controlX = (start[0] + end[0]) / 2;
    const controlY = (start[1] + end[1]) / 2 + edge.bend * scale;
    const palette = { red: [255, 78, 67], green: [141, 255, 50], amber: [255, 184, 78] };
    const rgb = palette[edge.color];
    const steps = 45;
    const visibleSteps = Math.max(1, Math.floor(steps * progress));
    ctx.beginPath();
    for (let i = 0; i <= visibleSteps; i += 1) {
      const t = i / steps;
      const inv = 1 - t;
      const x = inv * inv * start[0] + 2 * inv * t * controlX + t * t * end[0];
      const y = inv * inv * start[1] + 2 * inv * t * controlY + t * t * end[1];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(${rgb.join(",")},${edge.stop ? ".62" : ".48"})`;
    ctx.lineWidth = edge.stop ? 1.25 : 1;
    ctx.shadowBlur = edge.stop ? 13 : 8;
    ctx.shadowColor = `rgba(${rgb.join(",")},.3)`;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const travel = progress < 1 ? progress : ((time - edge.birth) * 0.55) % 1;
    const inv = 1 - travel;
    const x = inv * inv * start[0] + 2 * inv * travel * controlX + travel * travel * end[0];
    const y = inv * inv * start[1] + 2 * inv * travel * controlY + travel * travel * end[1];
    ctx.fillStyle = `rgba(${rgb.join(",")},.95)`;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `rgb(${rgb.join(",")})`;
    ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    if (edge.stop && progress >= 1) drawBlockBurst(end[0], end[1], rgb, time - edge.birth);
  }

  function drawBlockBurst(x, y, rgb, age) {
    const pulse = 7 + ((age * 20) % 18);
    ctx.strokeStyle = `rgba(${rgb.join(",")},${0.75 - (pulse - 7) / 28})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(141,255,50,.7)";
    ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y + 5); ctx.moveTo(x + 5, y - 5); ctx.lineTo(x - 5, y + 5); ctx.stroke();
  }

  function drawBackground(frameTime) {
    ctx.clearRect(0, 0, width, height);
    const spacing = 92 * scale;
    const offset = -((cameraX * scale) % spacing);
    ctx.strokeStyle = "rgba(196,226,204,.028)";
    ctx.lineWidth = 1;
    for (let x = offset; x < width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = spacing * 0.45; y < height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    particles.forEach((particle) => {
      const alpha = 0.08 + (Math.sin(frameTime * 0.0007 + particle.phase) + 1) * 0.035;
      ctx.fillStyle = `rgba(183,224,193,${alpha})`;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
  }

  function drawScene(time, frameTime) {
    drawBackground(frameTime);
    staticEdges.forEach((edge) => drawCurve(edge, time));
    assemblyEdges.forEach((edge) => drawCurve(edge, time));
    replayEdges.forEach((edge) => drawCurve(edge, time));
  }

  function render(frameTime) {
    if (playing) {
      currentTime += Math.min((frameTime - lastFrame) / 1000, 0.1);
      if (currentTime >= END_TIME) { currentTime = END_TIME; playing = false; }
    }
    lastFrame = frameTime;
    updateTimed(currentTime);
    updateStory(currentTime);
    updateControls(currentTime);
    positionWorld(currentTime);
    drawScene(currentTime, frameTime);
    requestAnimationFrame(render);
  }

  function togglePlayback() {
    if (currentTime >= END_TIME) currentTime = 0;
    playing = !playing;
    lastFrame = performance.now();
  }

  playButton.addEventListener("click", togglePlayback);
  replayButton.addEventListener("click", () => { currentTime = 0; playing = true; lastFrame = performance.now(); });
  progressTrack.addEventListener("click", (event) => {
    const bounds = progressTrack.getBoundingClientRect();
    currentTime = clamp(((event.clientX - bounds.left) / bounds.width) * END_TIME, 0, END_TIME);
    lastFrame = performance.now();
  });
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
    if (event.code === "ArrowRight") currentTime = clamp(currentTime + 3, 0, END_TIME);
    if (event.code === "ArrowLeft") currentTime = clamp(currentTime - 3, 0, END_TIME);
  });
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(render);
})();
