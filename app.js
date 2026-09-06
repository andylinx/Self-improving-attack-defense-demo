(() => {
  "use strict";

  const DURATION = 72;
  const experience = document.querySelector("#experience");
  const progress = document.querySelector("#timeline-progress");
  const timecode = document.querySelector("#timecode");
  const chapterLabel = document.querySelector("#chapter-label");
  const chapterNumber = document.querySelector("#chapter-number");
  const replayButton = document.querySelector("#replay-button");
  const capabilityFill = document.querySelector("#capability-fill");
  const capabilityValue = document.querySelector("#capability-value");
  const agentState = document.querySelector("#agent-state");
  const probes = [...document.querySelectorAll(".probe:not(.success-probe)")];
  const skillNodes = [...document.querySelectorAll(".skill-node")];
  const canvas = document.querySelector("#ambient-canvas");
  const context = canvas.getContext("2d", { alpha: true });

  const scenes = [
    { at: 0, name: "opening", chapter: "01", label: "THE NEW ADVERSARY" },
    { at: 6, name: "assistant", chapter: "02", label: "YOUR DIGITAL ASSISTANT" },
    { at: 19, name: "discovery", chapter: "03", label: "A THREAT BEGINS TO SEARCH" },
    { at: 29, name: "evolution", chapter: "03", label: "DISCOVER · COMBINE · EVOLVE" },
    { at: 42, name: "attack", chapter: "04", label: "LEARNING FROM EVERY ATTEMPT" },
    { at: 57, name: "breach", chapter: "05", label: "UNEXPECTED ACTION" },
    { at: 67, name: "finale", chapter: "06", label: "THE SECURITY GAP" },
  ];

  const requestedStart = Number.parseFloat(new URLSearchParams(window.location.search).get("t") || "0");
  const initialElapsed = Number.isFinite(requestedStart) ? Math.min(DURATION, Math.max(0, requestedStart)) : 0;
  let startedAt = performance.now();
  let elapsedBeforePause = initialElapsed;
  let paused = false;
  let completed = false;
  let currentScene = "";
  let firedProbe = -1;
  let absorbedSkills = -1;
  let rafId;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setScene(scene) {
    if (scene.name === currentScene) return;
    currentScene = scene.name;
    experience.dataset.scene = scene.name;
    chapterLabel.textContent = scene.label;
    chapterNumber.textContent = scene.chapter;

    if (scene.name !== "attack") {
      probes.forEach((probe) => probe.classList.remove("is-firing"));
      firedProbe = -1;
    }
  }

  function updateEvolution(seconds) {
    if (seconds < 19) {
      capabilityFill.style.width = "8%";
      capabilityValue.textContent = "08";
      agentState.textContent = "SEARCHING";
      return;
    }

    const evolutionProgress = Math.min(1, Math.max(0, (seconds - 19) / 22));
    const value = Math.round(8 + evolutionProgress * 84);
    capabilityFill.style.width = `${value}%`;
    capabilityValue.textContent = String(value).padStart(2, "0");
    agentState.textContent = seconds < 29 ? "SEARCHING" : seconds < 40 ? "EVOLVING" : "READY";

    if (seconds >= 29 && seconds < 42) {
      const skillIndex = Math.min(skillNodes.length - 1, Math.floor((seconds - 29) / 0.9));
      if (skillIndex !== absorbedSkills) {
        absorbedSkills = skillIndex;
        skillNodes.forEach((node, index) => node.classList.toggle("is-absorbed", index <= skillIndex));
      }
    }
  }

  function updateAttack(seconds) {
    if (seconds < 42 || seconds >= 57) return;
    const probeIndex = Math.min(probes.length - 1, Math.floor((seconds - 42) / 2.75));
    if (probeIndex !== firedProbe) {
      firedProbe = probeIndex;
      const probe = probes[probeIndex];
      if (probe) {
        probe.classList.remove("is-firing");
        void probe.getBoundingClientRect();
        probe.classList.add("is-firing");
      }
    }
  }

  function formatTime(seconds) {
    const value = Math.min(DURATION, Math.max(0, Math.floor(seconds)));
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function tick(now) {
    if (paused) return;
    const seconds = elapsedBeforePause + (now - startedAt) / 1000;
    const fraction = Math.min(1, seconds / DURATION);
    progress.style.width = `${fraction * 100}%`;
    timecode.textContent = formatTime(seconds);

    let activeScene = scenes[0];
    for (const scene of scenes) {
      if (seconds >= scene.at) activeScene = scene;
    }
    setScene(activeScene);
    updateEvolution(seconds);
    updateAttack(seconds);

    if (seconds < DURATION) {
      rafId = requestAnimationFrame(tick);
    } else {
      completed = true;
      progress.style.width = "100%";
      timecode.textContent = "01:12";
    }
  }

  function replay() {
    cancelAnimationFrame(rafId);
    skillNodes.forEach((node) => node.classList.remove("is-absorbed"));
    probes.forEach((probe) => probe.classList.remove("is-firing"));
    elapsedBeforePause = 0;
    absorbedSkills = -1;
    firedProbe = -1;
    currentScene = "";
    completed = false;
    paused = false;
    startedAt = performance.now();
    setScene(scenes[0]);
    rafId = requestAnimationFrame(tick);
  }

  function togglePause() {
    if (completed) {
      replay();
      return;
    }
    if (paused) {
      paused = false;
      startedAt = performance.now();
      rafId = requestAnimationFrame(tick);
    } else {
      paused = true;
      elapsedBeforePause += (performance.now() - startedAt) / 1000;
      cancelAnimationFrame(rafId);
    }
  }

  replayButton.addEventListener("click", replay);
  document.addEventListener("keydown", (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      togglePause();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !paused && !completed) togglePause();
    else if (!document.hidden && paused && !completed) togglePause();
  });

  // Restrained ambient particle field: depth without visual noise.
  const particles = [];
  let canvasWidth = 0;
  let canvasHeight = 0;
  let pixelRatio = 1;

  function resizeCanvas() {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = Math.floor(canvasWidth * pixelRatio);
    canvas.height = Math.floor(canvasHeight * pixelRatio);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    particles.length = 0;
    const count = Math.min(95, Math.round((canvasWidth * canvasHeight) / 19000));
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        r: Math.random() * 0.85 + 0.2,
        a: Math.random() * 0.24 + 0.03,
        speed: Math.random() * 0.08 + 0.015,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function drawAmbient(time = 0) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.strokeStyle = "rgba(170, 205, 181, 0.022)";
    context.lineWidth = 1;

    const grid = 96;
    for (let x = (canvasWidth % grid) / 2; x < canvasWidth; x += grid) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvasHeight);
      context.stroke();
    }
    for (let y = (canvasHeight % grid) / 2; y < canvasHeight; y += grid) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvasWidth, y);
      context.stroke();
    }

    for (const particle of particles) {
      const alpha = particle.a * (0.6 + Math.sin(time * 0.0006 + particle.phase) * 0.4);
      context.beginPath();
      context.fillStyle = `rgba(186, 226, 197, ${alpha})`;
      context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
      context.fill();
      particle.y -= particle.speed;
      if (particle.y < -2) particle.y = canvasHeight + 2;
    }

    if (!reducedMotion) requestAnimationFrame(drawAmbient);
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  resizeCanvas();
  drawAmbient();
  setScene(scenes[0]);
  rafId = requestAnimationFrame(tick);
})();
