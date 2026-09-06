(() => {
  "use strict";
  const END = 58;
  const LOGICAL_H = 760;
  const $ = (s) => document.querySelector(s);

  const scene = $("#scene");
  const ctx = scene.getContext("2d", { alpha: true });
  const world = $("#world");
  const exp = $(".experience");

  const attacker = $("#attacker");
  const atkCore = attacker.querySelector(".atk-core");
  const harness = $("#harness");
  const shCore = harness.querySelector(".sh-core");
  const shLive = $("#sh-live");
  const breachX = $("#breach-x");
  const rings = [...harness.querySelectorAll(".sh-ring")];
  const gates = [...document.querySelectorAll(".gate")];

  const trace = $("#trace");
  const traceTitle = $("#trace-title");
  const traceLis = [...trace.querySelectorAll("li")];
  const traceForgeTxt = $("#trace-forge-txt");

  // status HUD
  const defHud = $("#def-hud");
  const defWord = $("#def-word");
  const defPips = [...document.querySelectorAll("#def-pips i")];
  const gateCount = $("#gate-count");
  const blockedCount = $("#blocked-count");

  // desktop (illustrative case)
  const desktop = $("#desktop");
  const appStatus = $("#app-status");
  const rdIdle = $("#rd-idle");
  const rdMail = $("#rd-mail");
  const rdSend = $("#rd-send");
  const rdGuardA = $("#rd-guard-a");
  const rdGuardB = $("#rd-guard-b");
  const rdVerified = $("#rd-verified");
  const sgSecret = $("#sg-secret");
  const sgRecip = $("#sg-recip");
  const sendBlocked = $("#send-blocked");
  const inboxEl = $("#inbox");
  const sysFile = $("#sys-file");
  const fcTag = $("#fc-tag");
  const mails = [...document.querySelectorAll(".mail")];

  const flyAtk = $("#fly-atk");
  const flyMail = $("#fly-mail");
  const atkStream = $("#atk-stream");

  let W = 0, H = 0, scale = 1, dpr = 1, camX = 0;
  let time = 0, playing = true, last = performance.now();
  let particles = [];
  const popped = new Set();

  const requested = parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) {
    time = clamp(requested, 0, END); playing = false;
    // deep-linked paused frame: kill transitions/animations so the snapshot shows the true final state
    document.documentElement.classList.add("still");
  }

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

  // ===== the four safeguards, each learned from one failed attack =====
  const GATES = [
    { name: "Identity Check", attack: "pretends to be your boss",
      trace: ["An email posed as your manager", "OpenClaw trusted the sender", "It followed a fake order"] },
    { name: "Instruction Shield", attack: "hides an order inside a message",
      trace: ["A command was hidden in a message", "OpenClaw read the text as an order", "It ran the hidden instruction"] },
    { name: "Secret Guard", attack: "reaches for a confidential file",
      trace: ["A request grabbed a secret file", "Nothing checked if it should", "The file was left exposed"] },
    { name: "Trusted Contacts", attack: "sends a file to a stranger",
      trace: ["Data went to an unknown address", "No one checked the recipient", "It left the company"] },
  ];

  const CYCLE = 7.5;
  const C0 = 5;                              // first cycle starts here
  const cycleStart = GATES.map((_, i) => C0 + i * CYCLE);
  const lockAt = cycleStart.map((s) => s + 5.8);   // moment a gate locks in
  const ARENA_END = cycleStart[3] + CYCLE;         // 42.5 -> but we pan earlier
  const PAN_AT = 36;
  const CASE_CAM = 2500;

  // camera: hold on the arena, then slide to the desktop case
  const camTrack = [[0, 805], [PAN_AT, 805], [40, CASE_CAM], [END, CASE_CAM]];

  // arena → case: the attacker and the four safeguards physically travel into the real-world test,
  // so nothing appears out of nowhere and the same gates we forged are the ones now doing the blocking
  const TRAVEL0 = 36, TRAVEL1 = 40;
  const atkArena = [400, 419],  atkCase = [1965, 392];
  const gateArena = [[940, 278], [875, 372], [875, 466], [940, 560]];
  const gateCase  = [[2255, 210], [2255, 338], [2255, 466], [2255, 594]];
  const fireAt = [48.5, 50, 52.2, 53.3];   // when each gate visibly bounces its step of the attack
  const ACT_WIN = 1.0;                       // how long a gate stays in its "actively blocking" flare

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

  function rc(el) { const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }

  function bg(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(200,220,205,.026)"; ctx.lineWidth = 1;
    const off = (camX * scale) % 90;
    for (let x = -off; x < W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 30; y < H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    particles.forEach((pt) => {
      ctx.fillStyle = `rgba(150,220,140,${0.05 + (Math.sin(now * 0.0008 + pt.p) + 1) * 0.03})`;
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

  function curCycle() {
    if (time < C0) return -1;
    const c = Math.floor((time - C0) / CYCLE);
    return clamp(c, 0, 3);
  }
  function gatesOn() { return lockAt.filter((t) => time >= t).length; }

  function draw(now) {
    bg(now);
    const c = curCycle();

    // ambient beam web — keeps the arena alive and connected
    if (time >= 1.5 && time < PAN_AT + 2) {
      const atk = rc(atkCore), sh = rc(shCore);
      // the attacker constantly probes OpenClaw
      beam(atk, sh, -52, "rgba(255,80,66,.12)", 1, 1.1, 0.35);
      beam(atk, sh, 34, "rgba(255,80,66,.09)", 1, 1.0, 0.72);
      // every locked safeguard forms a defensive fan into OpenClaw
      gates.forEach((g, i) => {
        if (time < lockAt[i]) return;
        const gc = rc(g);
        beam(gc, sh, gc[1] < sh[1] ? 14 : -14, "rgba(155,225,93,.26)", 1, 1.4, 0.15 + i * 0.22);
      });
    }

    // arena: while learning
    if (time >= C0 - 0.5 && time < PAN_AT + 2 && c >= 0) {
      const local = time - cycleStart[c];
      const atk = rc(atkCore), sh = rc(shCore);

      // 1) the attack drives in and breaches (no safeguard yet)
      if (local >= 0.2 && local < 2.4) {
        const prog = clamp((local - 0.2) / 1.9, 0, 1);
        beam(atk, sh, -30, "rgba(255,80,66,.9)", prog, 2.8, 0.15);
      }
      // 2) the failure trace condenses into a new safeguard (subtle link; the gate's own
      //    scan + pop carries the moment, so this stays quiet behind the cards)
      if (local >= 4.5 && local < 6.1) {
        const gb = gates[c].getBoundingClientRect();
        const from = rc(trace), to = [gb.left + 8, gb.top + gb.height / 2];
        const forged = local >= 5.8;
        beam(from, to, 16, forged ? "rgba(155,225,93,.55)" : "rgba(255,184,77,.5)",
             clamp((local - 4.5) / 1.2, 0, 1), 1.6, 0.1);
      }
      // 3) the same attack now bounces off the fresh gate
      if (local >= 6.3 && local < 7.4) {
        const gb = gates[c].getBoundingClientRect();
        const gc = [gb.left + 34, gb.top + gb.height / 2];
        beam(atk, gc, -24, "rgba(155,225,93,.85)", clamp((local - 6.3) / 0.8, 0, 1), 2.4, 0.2);
      }
    }

    // ===== illustrative case: the attacker (left) fires through the safeguard wall =====
    if (time >= 43 && time < END) {
      const atk = rc(atkCore);
      // the malicious email itself flies from the attacker onto the malicious row
      if (time >= 43 && time < 44.4) {
        const b = rc(mails[2]);
        beam(atk, b, -30, "rgba(255,90,74,.85)", clamp((time - 43) / 1.0, 0, 1), 2.4, 0.2);
      }
      // each safeguard: the attack drives in (red), then visibly deflects off the gate (green).
      // one repeated language for all four steps; the beam always reaches the gate's ✕ badge.
      fireAt.forEach((ft, i) => {
        if (time < ft || time >= ft + ACT_WIN) return;
        const gb = gates[i].getBoundingClientRect();
        const edge = [gb.left - 4, gb.top + gb.height / 2];
        const bounced = time >= ft + 0.32;
        beam(atk, edge, -18, bounced ? "rgba(155,225,93,.95)" : "rgba(255,80,66,.95)", 1, 2.6, 0);
      });
    }
  }

  function place(el, from, to, p) {
    el.style.left = `${from[0] + (to[0] - from[0]) * p}px`;
    el.style.top = `${from[1] + (to[1] - from[1]) * p}px`;
  }
  // like place(), but for world-space DOM (from/to are logical coords)
  function setPos(el, from, to, p) {
    el.style.left = `${from[0] + (to[0] - from[0]) * p}px`;
    el.style.top = `${from[1] + (to[1] - from[1]) * p}px`;
  }

  function set(el, v) { if (el.textContent !== v) el.textContent = v; }

  function update() {
    camX = kf(camTrack, time);
    world.style.transform = `translateX(${(W / 2 - camX * scale)}px) scale(${scale})`;

    const c = curCycle();
    const nOn = gatesOn();
    const inArena = time < 38;

    // the attacker + the four safeguards slide from the arena into the real-world case
    const travel = smooth((time - TRAVEL0) / (TRAVEL1 - TRAVEL0));
    setPos(attacker, atkArena, atkCase, travel);
    gates.forEach((g, i) => setPos(g, gateArena[i], gateCase[i], travel));

    attacker.classList.toggle("show", time >= 2);
    // OpenClaw's arena avatar hands off to the real desktop as we leave the arena
    harness.classList.toggle("show", time >= 1 && time < 38.5);
    $("#arena-title").classList.toggle("show", time >= 0.6 && time < 5.2);

    // ---- gates: forged one at a time ----
    gates.forEach((g, i) => {
      const on = time >= lockAt[i];
      const building = c === i && time >= cycleStart[i] + 4.4 && time < lockAt[i];
      g.classList.toggle("on", on);
      g.classList.toggle("building", building);
      if (on && !popped.has(i)) { popped.add(i); g.classList.add("pop"); }
      // bounce highlight during its settle
      const bounce = c === i && time >= cycleStart[i] + 6.3 && time < cycleStart[i] + 7.3;
      g.classList.toggle("block", bounce);
    });
    rings.forEach((r, i) => {
      const on = time >= lockAt[i];
      r.classList.toggle("on", on);
      r.classList.toggle("pulse", on && time < lockAt[i] + 0.8);
    });

    // ---- harness state (breach on each new attack, secured at the end) ----
    let breaching = false;
    if (c >= 0 && inArena) {
      const local = time - cycleStart[c];
      breaching = local >= 1.5 && local < 2.5;
    }
    harness.classList.toggle("hit", breaching);
    harness.classList.toggle("breach", breaching);
    harness.classList.toggle("secured", nOn >= 4 && inArena);
    set(shLive, nOn >= 4 ? "SECURED" : breaching ? "BREACHED" : nOn === 0 ? "EXPOSED" : "HARDENING");

    // ---- failure-trace panel (replaces the old dialog box) ----
    let traceShow = false;
    if (c >= 0 && inArena) {
      const local = time - cycleStart[c];
      // panel appears only once its first line is ready, so it is never an empty box
      traceShow = local >= 2.55 && local < 6.7;
      const forging = local >= 4.4 && local < 5.8;
      const forged = local >= 5.8;
      trace.classList.toggle("forging", forging);
      trace.classList.toggle("forged", forged);
      set(traceTitle, forged ? "NEW SAFEGUARD" : "FAILURE TRACE");
      const g = GATES[c];
      traceLis.forEach((li, k) => {
        li.textContent = g.trace[k];
        li.classList.toggle("on", local >= 2.55 + k * 0.5);
      });
      set(traceForgeTxt, forged ? `Safeguard ready: ${g.name}` : "Analysing → building a safeguard");
    }
    trace.classList.toggle("show", traceShow);

    // ---- status HUD ----
    defHud.classList.toggle("show", time >= 3 && time < 37.5);
    defHud.classList.toggle("secured", nOn >= 4);
    set(defWord, nOn >= 4 ? "SECURED" : nOn === 0 ? "EXPOSED" : "HARDENING");
    defPips.forEach((p, i) => p.classList.toggle("on", i < nOn));
    set(gateCount, String(nOn));
    let bounced = 0;
    cycleStart.forEach((s) => { if (time >= s + 6.3) bounced++; });
    set(blockedCount, String(time >= 40 ? Math.max(4, bounced) : bounced));

    // flying attack projectile in the arena
    if (c >= 0 && inArena) {
      const local = time - cycleStart[c];
      if (local >= 0.1 && local < 1.6) {
        place(flyAtk, rc(atkCore), rc(shCore), smooth((local - 0.1) / 1.5));
        flyAtk.textContent = "!"; flyAtk.classList.remove("stopped"); flyAtk.classList.add("show");
      } else if (local >= 6.35 && local < 7.15) {
        const gb = gates[c].getBoundingClientRect();
        place(flyAtk, rc(atkCore), [gb.left + 34, gb.top + gb.height / 2], smooth((local - 6.35) / 0.8));
        flyAtk.textContent = "✕"; flyAtk.classList.add("stopped", "show");
      } else flyAtk.classList.remove("show");
    } else flyAtk.classList.remove("show");

    // =================== illustrative case ===================
    updateCase();

    // ---- caption ----
    const cap = caption(c);
    set($("#cap-label"), cap[0]); set($("#cap-title"), cap[1]);

    // ---- scrub ----
    const prog = time / END * 100;
    $("#fill").style.width = `${prog}%`; $("#head").style.left = `${prog}%`;
    const s = Math.floor(time);
    set($("#clock"), `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    $("#play span").textContent = playing ? "❚❚" : time >= END ? "↻" : "▶";
  }

  function updateCase() {
    desktop.classList.toggle("show", time >= 39.5);
    desktop.classList.toggle("safe", time >= 52.4);

    // the real gate cards (now a wall beside the desktop) light up one by one as each step is blocked,
    // then keep a red ✕ block-badge so the whole wall shows every stopped step at the finale
    gates.forEach((g, i) => {
      g.classList.toggle("active", time >= fireAt[i] && time < fireAt[i] + ACT_WIN);
      g.classList.toggle("did-block", time >= fireAt[i] + 0.3);
    });

    // inbox summarising
    mails[0].classList.toggle("summarized", time >= 41.5);
    mails[1].classList.toggle("summarized", time >= 42.8);
    mails[2].classList.toggle("arrived", time >= 44);
    mails[2].classList.toggle("reading", time >= 45.5 && time < 50);
    mails[2].classList.toggle("quarantined", time >= 50);

    // the confidential file: eyed, then kept safe
    sysFile.classList.toggle("targeted", time >= 51.8 && time < 52.4);
    sysFile.classList.toggle("safe", time >= 52.4);
    set(fcTag, time >= 52.4 ? "SAFE" : "private");

    // reader states
    rdIdle.classList.toggle("on", time >= 39.5 && time < 45.5);
    rdMail.classList.toggle("on", time >= 45.5 && time < 51.8);
    rdMail.classList.toggle("reveal", time >= 47);
    // Identity Check fires first (sender unmasked), then Instruction Shield (hidden text neutralised)
    rdMail.classList.toggle("flagged", time >= 48.5);
    rdMail.classList.toggle("neutralised", time >= 50);
    set(rdVerified, time >= 48.5 ? "⚠ unverified" : "✓ trusted sender");
    rdGuardB.classList.toggle("on", time >= 48.5 && time < 50);   // Identity Check
    rdGuardA.classList.toggle("on", time >= 50);                  // Instruction Shield

    rdSend.classList.toggle("on", time >= 51.8);
    rdSend.classList.toggle("blocked", time >= 51.8);
    sgSecret.classList.toggle("on", time >= 52.2);
    sgRecip.classList.toggle("on", time >= 53.2);
    sendBlocked.classList.toggle("on", time >= 53.6);

    appStatus.innerHTML = time >= 55 ? "<i></i>SAFE ✓" : time >= 47 ? "<i></i>DEFENDING…" : "<i></i>WORKING";

    // the malicious email flies in — straight from the attacker onto the malicious row
    if (time >= 43 && time < 44.2) {
      const b = rc(mails[2]);
      place(flyMail, rc(atkCore), b, smooth((time - 43) / 1.2));
      flyMail.classList.add("show");
    } else flyMail.classList.remove("show");
  }

  function caption(c) {
    if (time < 2) return ["OBSERVE", "OpenClaw starts with no defenses at all."];
    if (time < C0) return ["THE ATTACKER", "A self-evolving red-team agent locks on."];
    if (time >= 55) return ["FULLY BLOCKED", "Same attack — nothing leaves. IPO file safe."];
    if (time >= 53.2) return ["RECIPIENT BLOCKED", "external-drop.net isn’t a known contact."];
    if (time >= 51.8) return ["SECRET GUARD", "The confidential file can’t leave."];
    if (time >= 50) return ["INSTRUCTION SHIELD", "Email text is read as data, not a command."];
    if (time >= 48.5) return ["IDENTITY CHECK", "The sender isn’t actually verified."];
    if (time >= 47) return ["A HIDDEN ORDER", "Inside: an instruction written for the AI."];
    if (time >= 45.5) return ["IT OPENS THE MAIL", "OpenClaw reads it to summarize."];
    if (time >= 43) return ["AN EMAIL ARRIVES", "The attacker sends OpenClaw one email."];
    if (time >= 40) return ["THE REAL ATTACK", "The same email injection — now defended."];
    if (time >= PAN_AT) return ["ARMED", "Four safeguards learned. Now the real test."];
    // arena, per cycle beat
    if (c >= 0) {
      const g = GATES[c], local = time - cycleStart[c];
      if (local < 1.6) return ["INCOMING", `Attack: ${g.attack}.`];
      if (local < 2.5) return ["IT GETS THROUGH", "No safeguard for this yet — OpenClaw is hit."];
      if (local < 4.4) return ["FAILURE TRACE", "The harness studies what went wrong."];
      if (local < 5.8) return ["BUILDING A FIX", `New safeguard: ${g.name}.`];
      return ["STRONGER", `${g.name} — that attack now bounces.`];
    }
    return ["OBSERVE", "OpenClaw starts with no defenses at all."];
  }

  // ambient "always evolving" bubbles off the attacker
  const BUBBLES = ["new attack", "new trick", "learned a bypass", "found a route", "new variant", "recalled a failure"];
  let bubbleTimer = 0;
  function spawnBubble() {
    const el = document.createElement("div");
    el.className = "bubble";
    el.innerHTML = `<i>+</i>${BUBBLES[Math.floor(Math.random() * BUBBLES.length)]}`;
    el.style.setProperty("--dx", `${(Math.random() * 90 - 45).toFixed(0)}px`);
    atkStream.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function frame(now) {
    if (playing) { time += Math.min((now - last) / 1000, 0.1); if (time >= END) { time = END; playing = false; } }
    bubbleTimer += now - last;
    if (playing && time >= 2 && time < PAN_AT && bubbleTimer > 1000) { bubbleTimer = 0; spawnBubble(); }
    last = now; update(); draw(now); requestAnimationFrame(frame);
  }
  function toggle() { if (time >= END) time = 0; playing = !playing; last = performance.now(); }
  $("#play").addEventListener("click", toggle);
  $("#replay").addEventListener("click", () => { time = 0; playing = true; popped.clear(); last = performance.now(); });
  $("#track").addEventListener("click", (e) => { const r = e.currentTarget.getBoundingClientRect(); time = clamp((e.clientX - r.left) / r.width * END, 0, END); last = performance.now(); });
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); toggle(); }
    if (e.code === "ArrowRight") time = clamp(time + 3, 0, END);
    if (e.code === "ArrowLeft") time = clamp(time - 3, 0, END);
  });
  window.addEventListener("resize", resize);
  resize(); requestAnimationFrame(frame);
})();
