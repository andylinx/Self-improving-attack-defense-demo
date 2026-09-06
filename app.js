(() => {
  "use strict";

  const deck = document.querySelector("#deck");
  const slides = [...document.querySelectorAll(".slide")];
  const prevButton = document.querySelector("#prev-button");
  const nextButton = document.querySelector("#next-button");
  const restartButton = document.querySelector("#restart-button");
  const brand = document.querySelector(".brand");
  const pageNumber = document.querySelector("#page-number");
  const pageTitle = document.querySelector("#page-title");
  const pageSummary = document.querySelector("#page-summary");
  const topTitle = document.querySelector("#top-title");
  const dotsContainer = document.querySelector("#page-dots");
  const assistantAction = document.querySelector("#assistant-action");
  const skillCount = document.querySelector("#skill-count");
  const canvas = document.querySelector("#ambient");
  const ctx = canvas.getContext("2d", { alpha: true });
  const timers = [];

  const requestedPage = Number.parseInt(new URLSearchParams(location.search).get("page") || "1", 10) - 1;
  const initialPage = Number.isFinite(requestedPage) ? Math.max(0, Math.min(slides.length - 1, requestedPage)) : 0;
  let current = 0;
  let canvasWidth = 0;
  let canvasHeight = 0;
  let dpr = 1;
  let particles = [];

  function later(callback, delay) {
    const timer = window.setTimeout(callback, delay);
    timers.push(timer);
  }

  function clearTimers() {
    while (timers.length) window.clearTimeout(timers.pop());
  }

  function runSlideSequence(index) {
    clearTimers();

    if (index === 1) {
      const actions = [
        [0, "Reading the request…"],
        [900, "Checking the calendar…"],
        [1700, "Moving the meeting…"],
        [2500, "Notifying the team…"],
        [3300, "Confirming by email…"],
        [4100, "Workflow complete"],
      ];
      actions.forEach(([delay, text]) => later(() => { assistantAction.textContent = text; }, delay));
    }

    if (index === 5) {
      skillCount.textContent = "01";
      later(() => { skillCount.textContent = "02"; }, 900);
      later(() => { skillCount.textContent = "03"; }, 1500);
      later(() => { skillCount.textContent = "04"; }, 2200);
    }
  }

  function renderDots() {
    dotsContainer.innerHTML = "";
    slides.forEach((slide, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `Go to page ${index + 1}: ${slide.dataset.title}`);
      dot.addEventListener("click", () => goTo(index));
      dotsContainer.appendChild(dot);
    });
  }

  function goTo(index, direction = index > current ? 1 : -1) {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    const oldSlide = slides[current];
    const newSlide = slides[nextIndex];

    if (oldSlide !== newSlide) {
      oldSlide.classList.remove("is-active");
      oldSlide.classList.toggle("was-active", direction > 0);
      newSlide.classList.remove("was-active");
    } else {
      newSlide.classList.remove("is-active");
      void newSlide.offsetWidth;
    }

    current = nextIndex;
    deck.dataset.slide = String(current);
    newSlide.classList.add("is-active");

    pageNumber.textContent = `${String(current + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    pageTitle.textContent = newSlide.dataset.title;
    pageSummary.textContent = newSlide.dataset.summary;
    topTitle.textContent = newSlide.dataset.title;
    prevButton.disabled = current === 0;
    nextButton.disabled = current === slides.length - 1;

    [...dotsContainer.children].forEach((dot, indexDot) => {
      dot.classList.toggle("active", indexDot === current);
      dot.classList.toggle("done", indexDot < current);
      dot.setAttribute("aria-current", indexDot === current ? "step" : "false");
    });

    history.replaceState(null, "", current === 0 ? location.pathname : `${location.pathname}?page=${current + 1}`);
    runSlideSequence(current);
  }

  function next() {
    if (current < slides.length - 1) goTo(current + 1, 1);
  }

  function previous() {
    if (current > 0) goTo(current - 1, -1);
  }

  prevButton.addEventListener("click", previous);
  nextButton.addEventListener("click", next);
  restartButton.addEventListener("click", () => goTo(0, -1));
  brand.addEventListener("click", (event) => {
    event.preventDefault();
    goTo(0, -1);
  });

  document.addEventListener("keydown", (event) => {
    if (["ArrowRight", "PageDown", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      next();
    } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      previous();
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0, -1);
    }
  });

  // Restrained depth field. The content stays readable while the space feels alive.
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasWidth = innerWidth;
    canvasHeight = innerHeight;
    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${canvasHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = Math.min(80, Math.round((canvasWidth * canvasHeight) / 23000));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      radius: Math.random() * 0.7 + 0.2,
      opacity: Math.random() * 0.18 + 0.025,
      speed: Math.random() * 0.055 + 0.012,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  function draw(time = 0) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.strokeStyle = "rgba(182, 216, 192, 0.02)";
    ctx.lineWidth = 1;
    const grid = 96;
    for (let x = (canvasWidth % grid) / 2; x < canvasWidth; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvasHeight); ctx.stroke();
    }
    for (let y = (canvasHeight % grid) / 2; y < canvasHeight; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvasWidth, y); ctx.stroke();
    }

    particles.forEach((particle) => {
      const alpha = particle.opacity * (0.65 + Math.sin(time * 0.0007 + particle.phase) * 0.35);
      ctx.fillStyle = `rgba(190, 228, 201, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
      particle.y -= particle.speed;
      if (particle.y < -2) particle.y = canvasHeight + 2;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resizeCanvas, { passive: true });
  renderDots();
  resizeCanvas();
  draw();
  goTo(initialPage);
})();
