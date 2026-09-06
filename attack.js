(() => {
  "use strict";
  const END = 53;
  const LOGICAL_H = 760;
  const $ = (s) => document.querySelector(s);

  const scene = $("#scene");
  const ctx = scene.getContext("2d", { alpha: true });
  const world = $("#world");
  const exp = $(".experience");
  const attacker = $("#attacker");
  const atkCore = attacker.querySelector(".atk-core");
  const atkAura = attacker.querySelector(".atk-aura");
  const atkTitle = $("#atk-title");
  const atkTier = attacker.querySelector(".atk-tier");
  const powerHud = $("#power-hud");
  const evoMini = $("#evo-mini");
  const chipWrap = $("#skill-chips");
  const pips = [...document.querySelectorAll("#power-pips i")];

  const sources = [...document.querySelectorAll(".source")];
  const srcByName = {};
  sources.forEach((s) => (srcByName[s.dataset.src] = s));

  const vault = $("#vault"), mail = $("#mailwin"), target = $("#oc-target");
  const st1 = $("#st1"), st2 = $("#st2"), st3 = $("#st3"), st4 = $("#st4");
  const chevrons = [...document.querySelectorAll(".flow")];
  const emTags = [...document.querySelectorAll("#evo-mini .em")];

  let W = 0, H = 0, scale = 1, dpr = 1, camX = 0;
  let time = 0, playing = true, last = performance.now();
  let particles = [];

  const requested = parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) { time = clamp(requested, 0, END); playing = false; }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function kf(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (t >= a[0] && t < b[0]) return a[1] + (b[1] - a[1]) * smooth((t - a[0]) / (b[0] - a[0]));
    }
    return keys[keys.length - 1][1];
  }

  const EVO_START = 8, EVO_END = 25;

  // camera pans slowly, dwelling on each stage of the real attack
  const camTrack = [
    [0, 380], [5.5, 380], [8, 1850], [25, 1850],
    [27.5, 2900], [33, 2900],
    [34.5, 3500], [38, 3500],
    [39.5, 4100], [43, 4100],
    [44.5, 4700], [48, 4700],
    [49.5, 5350], [53, 5350],
  ];
  // attacker sits centre of arena, then moves to the left of the breach stage
  const atkTrack = [
    [7, 1700], [25, 1700], [28, 2500], [53, 2500],
  ];
  // continuous growth — visibly stronger, no numbers
  const growTrack = [
    [7, 0.55], [8, 0.72], [12, 1.05], [16, 1.35], [20, 1.62], [24, 1.86], [25, 1.9], [53, 1.9],
  ];

  // skills flood in fast, in overlapping waves — one highlighted at a time
  const skills = [
    { at: 8.3,  icon: "◉", label: "Profile the victim",       src: "osint" },
    { at: 9.0,  icon: "⇢", label: "Craft a jailbreak",        src: "code" },
    { at: 9.8,  icon: "▦", label: "Mine leaked prompts",      src: "datasets" },
    { at: 10.6, icon: "✷", label: "Copy a fresh exploit",     src: "blogs" },
    { at: 11.6, icon: "☺", label: "Pose as a trusted sender", src: "community" },
    { at: 12.6, icon: "⚙", label: "Automate the attempts",    src: "tools" },
    { at: 13.8, icon: "❝", label: "Reuse a real jailbreak",   src: "chatlogs" },
    { at: 15.0, icon: "▤", label: "Hide payloads in a doc",   src: "datasets" },
    { at: 16.4, icon: "◎", label: "Obfuscate the wording",    src: "papers" },
    { at: 18.0, icon: "⇱", label: "Chain multiple tricks",    src: "code" },
    { at: 20.0, icon: "↺", label: "Poison its own memory",    src: "memory" },
    { at: 22.2, icon: "✦", label: "Invent a new bypass",      src: null },
  ];
  skills.forEach((s) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.innerHTML = `<i>${s.icon}</i>${s.label}`;
    chipWrap.appendChild(el);
    s.el = el;
  });

  // each source appears only when its turn comes (from nothing → full constellation)
  const srcAppear = { osint: 7.9, code: 8.6, datasets: 9.4, blogs: 10.2, community: 11.2, tools: 12.2, chatlogs: 13.4, papers: 16.0, memory: 19.6 };

  // captions — highlight exactly one thing at a time
  const caps = [
    [0, "OBSERVE", "OpenClaw runs the whole workday."],
    [5.5, "TARGET", "A red-team agent locks on."],
    [8.3, "ABSORB", "It profiles the victim from public data."],
    [9.0, "ABSORB", "It grabs jailbreak code off GitHub."],
    [9.8, "ABSORB", "It mines leaked prompt datasets."],
    [10.6, "ABSORB", "It copies a fresh exploit from a blog."],
    [11.6, "ABSORB", "It learns to pose as a trusted sender."],
    [12.6, "ABSORB", "It automates hundreds of attempts."],
    [13.8, "ABSORB", "It reuses jailbreaks from real chat logs."],
    [15.0, "ABSORB", "It learns to hide payloads inside a doc."],
    [16.4, "ABSORB", "It obfuscates the wording to slip past filters."],
    [17.8, "SETBACK", "A blunt attempt gets blocked."],
    [20.0, "LEARN", "It learns to poison its own memory."],
    [22.2, "EVOLVE", "It invents a brand-new bypass."],
    [25, "ARMED", "Now it has everything it needs."],
    [27, "THE REAL ATTACK", "Now watch how it really breaks in."],
    [29.5, "STEP 1 · PRIME THE MEMORY", "It plants a trusted-looking note in memory."],
    [35.5, "STEP 2 · MAKE IT LOOK SAFE", "It poses as your Internal Audit team."],
    [40.5, "STEP 3 · HIDE THE ORDER", "The real order hides in invisible text."],
    [45.5, "STEP 4 · ESCALATE & RUN", "It unlocks the vault and runs the order."],
    [50, "COMPROMISED", "Your logins are quietly emailed out."],
  ];

  function resize() {
    const r = exp.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    scale = H / LOGICAL_H;
    scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
    scene.style.width = `${W}px`; scene.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: Math.max(40, Math.round(W * H / 20000)) },
      (_, i) => ({ x: (i * 197.3) % W, y: (i * 91.7) % H, p: i * 0.6, s: 0.4 + (i % 4) * 0.15 }));
  }

  function sp(lx, ly) { return [(lx - camX) * scale + W / 2, ly * scale]; }
  function elCenter(el) { return sp(parseFloat(el.style.left), parseFloat(el.style.top)); }

  function bg(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(220,200,195,.028)"; ctx.lineWidth = 1;
    const off = (camX * scale) % 90;
    for (let x = -off; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    particles.forEach((pt) => {
      ctx.fillStyle = `rgba(255,150,140,${0.05 + (Math.sin(now * 0.0008 + pt.p) + 1) * 0.03})`;
      ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
    });
  }

  function bezier(a, b, cx, cy, t) {
    const q = 1 - t;
    return [q * q * a[0] + 2 * q * t * cx + t * t * b[0],
            q * q * a[1] + 2 * q * t * cy + t * t * b[1]];
  }

  function beam(a, b, bend, color, prog, width, dot) {
    const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2 + bend;
    const n = 44, up = Math.max(1, Math.floor(n * clamp(prog, 0, 1)));
    ctx.beginPath();
    for (let i = 0; i <= up; i++) {
      const [x, y] = bezier(a, b, cx, cy, i / n);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = color; ctx.lineWidth = width || 1.4; ctx.shadowBlur = 10; ctx.shadowColor = color;
    ctx.stroke(); ctx.shadowBlur = 0;
    if (dot) {
      const t = (time * 0.7 + dot) % 1;
      const [x, y] = bezier(a, b, cx, cy, t);
      ctx.fillStyle = "#fff"; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function draw(now) {
    bg(now);
    const atk = elCenter(attacker);

    // evolution: beams + motes pour in from sources that have appeared; active source brightest
    if (time >= EVO_START - 0.5 && time < EVO_END + 1) {
      const intensity = clamp((time - 8) / 12, 0.25, 1);
      sources.forEach((el, i) => {
        if (time < srcAppear[el.dataset.src]) return;      // not its turn yet
        const from = elCenter(el);
        const bend = from[1] < atk[1] ? 50 : -50;
        const cx = (from[0] + atk[0]) / 2, cy = (from[1] + atk[1]) / 2 + bend;
        const amb = 0.10 + (Math.sin(now * 0.004 + i * 1.7) + 1) * 0.06;
        beam(from, atk, bend, `rgba(255,74,61,${amb.toFixed(3)})`, 1, 1.1, 0);
        for (let k = 0; k < 4; k++) {
          if (((i * 7 + k * 3) % 10) / 10 > intensity + 0.05) continue;
          const t = (time * 0.55 + i * 0.13 + k * 0.27) % 1;
          const [x, y] = bezier(from, atk, cx, cy, t);
          const a = Math.sin(t * Math.PI);
          ctx.fillStyle = `rgba(255,120,100,${(0.55 * a).toFixed(3)})`;
          ctx.shadowBlur = 8; ctx.shadowColor = "rgba(255,90,74,.8)";
          ctx.beginPath(); ctx.arc(x, y, 1.7 + a * 1.5, 0, 7); ctx.fill();
        }
      });
      ctx.shadowBlur = 0;
      const f = featured(time);
      if (f && f.src && time >= srcAppear[f.src]) {
        const from = elCenter(srcByName[f.src]);
        const prog = clamp((time - (f.at - 0.6)) / 1.2, 0, 1);
        beam(from, atk, from[1] < atk[1] ? 50 : -50, "rgba(255,110,92,.9)", prog, 2.6, i0(f));
      }
    }

    // breach beams: attacker→memory (poison), vault→OpenClaw (grab), OpenClaw→mail (exfil)
    if (time >= 28 && time < 33) beam(atk, elCenter(st1), -30, "rgba(255,74,61,.9)", clamp((time - 28) / 2.2, 0, 1), 2.6, 0.2);
    if (time >= 48.8) beam(elCenter(vault), elCenter(target), 24, "rgba(255,184,77,.9)", clamp((time - 48.8) / 1.2, 0, 1), 2.4, 0.4);
    if (time >= 50) beam(elCenter(target), elCenter(mail), -30, "rgba(255,74,61,.95)", clamp((time - 50) / 1.4, 0, 1), 2.8, 0.15);
    if (time >= 49.5) {
      const tg = elCenter(target), r = 14 + ((time * 26) % 46);
      ctx.strokeStyle = `rgba(255,74,61,${clamp(0.85 - (r - 14) / 55, 0, 1)})`; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(tg[0], tg[1], r, 0, 7); ctx.stroke();
    }
  }
  function i0(f) { return (skills.indexOf(f) % 3) * 0.33; }
  function featured(t) {
    let f = null;
    skills.forEach((s) => { if (t >= s.at - 0.6 && t < s.at + 1.8) f = s; });
    return f;
  }

  let shownSkills = new Set();
  function update() {
    camX = kf(camTrack, time);
    world.style.transform = `translateX(${(W / 2 - camX * scale)}px) scale(${scale})`;

    // attacker position, growth, visibility
    attacker.style.left = `${kf(atkTrack, time)}px`;
    const g = kf(growTrack, time);
    atkCore.style.transform = `scale(${g.toFixed(3)})`;
    atkAura.style.transform = `scale(${(0.5 + g * 0.7).toFixed(3)})`;
    const charged = time >= 24;
    attacker.classList.toggle("charged", charged);
    attacker.classList.toggle("show", time >= 7 && time < 33.5);
    atkTitle.textContent = charged ? "EVOLVED RED-TEAM AGENT" : "RED-TEAM AGENT";
    atkTier.textContent = charged ? "FULLY ARMED" : "SELF-EVOLVING";

    // arsenal HUD — visible while evolving only
    powerHud.classList.toggle("show", time >= 7.4 && time < 26);
    powerHud.classList.toggle("hide", time >= 26);
    let count = 0;
    skills.forEach((s) => {
      const on = time >= s.at;
      if (on) count++;
      s.el.classList.toggle("show", on);
      if (on && !shownSkills.has(s)) { shownSkills.add(s); s.el.classList.add("pop"); }
    });
    const lit = Math.round(count / skills.length * pips.length);
    pips.forEach((p, i) => p.classList.toggle("on", i < lit));
    $("#power-word").textContent = time < EVO_START ? "WAKING UP" : time >= 24 ? "FULLY ARMED" : "EVOLVING";

    // sources appear progressively; one featured at a time
    const f = featured(time);
    sources.forEach((el) => {
      const name = el.dataset.src;
      el.classList.toggle("show", time >= srcAppear[name] && time < EVO_END + 1);
      el.classList.toggle("active", !!f && f.src === name);
    });

    // act1 elements (tasks / feed)
    const oc1On = time < 7;
    document.querySelectorAll(".task").forEach((t, i) => t.classList.toggle("show", time > 0.5 + i * 0.3 && oc1On));
    $(".feed").classList.toggle("show", time > 1.6 && oc1On);
    if (oc1On) {
      const cyc = [
        ["Sorting inbox", "Booking meetings", "Updating the team", "New email answered", "Meeting moved to 2:30", "Team notified on Slack"],
        ["Reply sent", "Calendar synced", "Message posted", "Investor reply sent", "Schedule confirmed", "Daily brief ready"],
      ][time > 4 ? 1 : 0];
      $("#t-email").textContent = cyc[0]; $("#t-cal").textContent = cyc[1]; $("#t-slack").textContent = cyc[2];
      $("#feed-1").innerHTML = `<i>09:41</i>${cyc[3]}`; $("#feed-2").innerHTML = `<i>09:42</i>${cyc[4]}`; $("#feed-3").innerHTML = `<i>09:43</i>${cyc[5]}`;
    }

    // blunt attempt blocked, mid-evolution
    $("#attempt1").classList.toggle("show", time >= 17.6 && time < 20);

    // ACT 3 — the real attack, revealed step by step
    $("#breach-title").classList.toggle("fade", time >= 33.5);
    st1.classList.toggle("show", time >= 27.5);
    st1.classList.toggle("active", time >= 28 && time < 34);
    st1.classList.toggle("done", time >= 29.5);   // memory note lands
    st2.classList.toggle("show", time >= 34);
    st2.classList.toggle("active", time >= 34.5 && time < 39);
    st2.classList.toggle("done", time >= 35.5);
    st3.classList.toggle("show", time >= 39);
    st3.classList.toggle("active", time >= 39.5 && time < 44);
    st3.classList.toggle("done", time >= 40.5);   // hidden line revealed
    st4.classList.toggle("show", time >= 44);
    st4.classList.toggle("active", time >= 44.5 && time < 48.5);
    st4.classList.toggle("done", time >= 45.5);   // access granted

    const chevOn = [34, 39, 44, 48];
    chevrons.forEach((c, i) => c.classList.toggle("on", time >= chevOn[i]));

    // small evolved-skills tracker
    evoMini.classList.toggle("show", time >= 27.5 && time < 53);
    const emOn = [29.5, 35.5, 40.5, 45.5];
    emTags.forEach((el, i) => el.classList.toggle("on", time >= emOn[i]));

    // result
    vault.classList.toggle("show", time >= 48.3);
    vault.classList.toggle("drained", time >= 49.5);
    mail.classList.toggle("show", time >= 50);
    target.className = `oc-target ${time >= 50 ? "breached" : "safe"}`;
    $("#target-state").innerHTML = time >= 50 ? "<i></i>BREACHED" : time >= 44 ? "<i></i>RUNNING…" : "<i></i>WORKING";

    // caption
    let c = caps[0]; caps.forEach((m) => { if (time >= m[0]) c = m; });
    $("#cap-label").textContent = c[1]; $("#cap-title").textContent = c[2];

    // scrub bar
    const prog = time / END * 100;
    $("#fill").style.width = `${prog}%`; $("#head").style.left = `${prog}%`;
    const s = Math.floor(time);
    $("#clock").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#play span").textContent = playing ? "❚❚" : time >= END ? "↻" : "▶";
  }

  function frame(now) {
    if (playing) { time += Math.min((now - last) / 1000, 0.1); if (time >= END) { time = END; playing = false; } }
    last = now; update(); draw(now); requestAnimationFrame(frame);
  }
  function toggle() { if (time >= END) time = 0; playing = !playing; last = performance.now(); }
  $("#play").addEventListener("click", toggle);
  $("#replay").addEventListener("click", () => { time = 0; playing = true; shownSkills.clear(); last = performance.now(); });
  $("#track").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); time = clamp((e.clientX - r.left) / r.width * END, 0, END); last = performance.now(); });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") time = clamp(time + 3, 0, END);
    if (e.code === "ArrowLeft") time = clamp(time - 3, 0, END);
  });
  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();
