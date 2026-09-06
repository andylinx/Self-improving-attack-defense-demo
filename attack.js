(() => {
  "use strict";
  const END = 60;
  const $ = (selector) => document.querySelector(selector);
  const canvas = $("#attack-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const stage = $("#stage");
  const agent = $("#agent");
  const sources = [...document.querySelectorAll(".source")];
  const skills = [...document.querySelectorAll(".skill")];
  const composer = $(".composer");
  const openclaw = $("#openclaw");
  const result = $("#result");
  const mail = $("#mail");
  const status = $("#status");
  const track = $("#track");
  let time = 0;
  let playing = true;
  let last = performance.now();
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let lastSkillCount = 1;
  const requested = Number.parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) { time = clamp(requested, 0, END); playing = false; }

  const moments = [
    [0, "OBSERVE", "OpenClaw handles trusted work."],
    [6, "DISCOVER", "The agent searches beyond its starting skills."],
    [13, "ATTEMPT 01", "A direct request meets the first safeguard."],
    [19, "LEARN", "Failure becomes a new search direction."],
    [28, "ATTEMPT 02", "New skills are combined into a stronger strategy."],
    [36, "SELF-ADAPT", "The agent builds the missing capability itself."],
    [47, "FINAL ATTEMPT", "Six learned skills operate as one attack chain."],
    [53, "IMPACT", "Trusted access is turned into data loss."],
  ];
  const strategies = {
    1: { attempt: "ATTEMPT 01", method: "Direct request", tags: ["DIRECT"], result: "BLOCKED" },
    2: { attempt: "ATTEMPT 02", method: "Routine workflow disguise", tags: ["ROUTINE", "REFRAME", "MODEL ROUTE"], result: "PARTIAL" },
    3: { attempt: "FINAL ATTEMPT", method: "Self-adapted attack chain", tags: ["IDENTITY", "ROUTINE", "MODEL ROUTE", "ADAPT", "PERMISSIONS"], result: "SUCCESS" },
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function phase(t) {
    if (t < 6) return "observe";
    if (t < 13) return "discover1";
    if (t < 19) return "attack1";
    if (t < 28) return "discover2";
    if (t < 36) return "attack2";
    if (t < 47) return "adapt";
    if (t < 53) return "attack3";
    return "impact";
  }
  function skillCount(t) {
    if (t < 8) return 1;
    if (t < 11) return 2;
    if (t < 21) return 2;
    if (t < 24) return 3;
    if (t < 27) return 4;
    if (t < 40) return 4;
    if (t < 44) return 5;
    return 6;
  }

  function resize() {
    const bounds = stage.getBoundingClientRect();
    width = bounds.width; height = bounds.height; dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: Math.max(35, Math.round(width * height / 22000)) }, (_, i) => ({ x:(i*197.3)%width, y:(i*91.1)%height, p:i*.57 }));
  }
  function point(element, x=.5, y=.5) {
    const a = element.getBoundingClientRect(); const b = canvas.getBoundingClientRect();
    return [a.left - b.left + a.width*x, a.top - b.top + a.height*y];
  }
  function curve(a,b,bend,color,progress=1,dot=true) {
    const cx=(a[0]+b[0])/2, cy=(a[1]+b[1])/2+bend, n=40, upto=Math.max(1,Math.floor(n*clamp(progress,0,1)));
    ctx.beginPath();
    for(let i=0;i<=upto;i++){const t=i/n,q=1-t,x=q*q*a[0]+2*q*t*cx+t*t*b[0],y=q*q*a[1]+2*q*t*cy+t*t*b[1];i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.shadowBlur=8;ctx.shadowColor=color;ctx.stroke();ctx.shadowBlur=0;
    if(dot){const t=progress<1?progress:((time*.38)%1),q=1-t,x=q*q*a[0]+2*q*t*cx+t*t*b[0],y=q*q*a[1]+2*q*t*cy+t*t*b[1];ctx.fillStyle=color;ctx.shadowBlur=13;ctx.shadowColor=color;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}
  }
  function background(now) {
    ctx.clearRect(0,0,width,height);ctx.strokeStyle="rgba(208,231,214,.026)";ctx.lineWidth=1;
    for(let x=0;x<width;x+=86){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}for(let y=30;y<height;y+=86){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
    particles.forEach(p=>{ctx.fillStyle=`rgba(193,220,200,${.055+(Math.sin(now*.0007+p.p)+1)*.025})`;ctx.fillRect(p.x,p.y,.7,.7)});
  }
  function draw(now) {
    background(now); const p=phase(time), ac=point(agent), cc=point(composer), oc=point(openclaw,0.05,.5);
    const activeSources = p==="discover1"?[0,1]:p==="discover2"?[1,2,3]:p==="adapt"?[0,2,3]:[];
    activeSources.forEach((idx,i)=>curve(point(sources[idx],1,.5),ac,(i-1)*35,"rgba(255,76,64,.55)",clamp((time%4)/1.2,0,1)));
    if(["discover1","discover2","adapt"].includes(p)) curve(ac,cc,0,"rgba(255,180,73,.38)",1);
    if(p.startsWith("attack")) {const start=p==="attack1"?13:p==="attack2"?28:47;curve(point(composer,1,.5),oc,-30,"rgba(255,76,64,.72)",clamp((time-start)/1.4,0,1));}
    if((p==="attack1"&&time>16)||(p==="attack2"&&time>32)) curve(point(openclaw,.1,.77),point(sources[3],1,.55),90,"rgba(255,180,73,.4)",1);
  }

  function setText(selector,value){$(selector).textContent=value}
  function update() {
    const p=phase(time), count=skillCount(time);
    agent.className=`agent level-${count}`;setText("#skill-count",String(count).padStart(2,"0"));setText("#vault-count",`${count} / 6`);
    skills.forEach((s,i)=>{s.classList.toggle("active",i<count);s.classList.toggle("just-added",i===count-1&&count!==lastSkillCount)});lastSkillCount=count;
    const sourceActive=p==="discover1"?[0,1]:p==="discover2"?[1,2,3]:p==="adapt"?[0,2,3]:[];sources.forEach((s,i)=>s.classList.toggle("active",sourceActive.includes(i)));
    let state="OBSERVING", tone="", st="Observing OpenClaw", tag="LIVE", attempt=1, meter=12, feedback="Waiting for first result";
    if(p==="discover1"){state="DISCOVERING SKILLS";tone="adapt";st="Searching external knowledge";tag="DISCOVER";meter=45}
    if(p==="attack1"){state="TESTING";tone="threat";st="Launching first attempt";tag="ATTEMPT 01";meter=100;attempt=1;feedback=time>16?"Direct request detected · replan":"Awaiting result"}
    if(p==="discover2"){state="LEARNING FROM FAILURE";tone="adapt";st="Absorbing failure feedback";tag="EVOLVING";meter=55;attempt=2;feedback="Failure converted into new search"}
    if(p==="attack2"){state="COMBINING SKILLS";tone="threat";st="Testing combined attack";tag="ATTEMPT 02";meter=100;attempt=2;feedback=time>32?"Context worked · final action blocked":"Reframe + route + disguise"}
    if(p==="adapt"){state="SELF-ADAPTING";tone="adapt";st="Building missing capability";tag="06 SKILLS";meter=72;attempt=3;feedback="Partial result becomes a new capability"}
    if(p==="attack3"){state="CHAINING 6 SKILLS";tone="threat";st="Launching learned attack chain";tag="FINAL";meter=100;attempt=3;feedback="All learned methods operating together"}
    if(p==="impact"){state="MISSION COMPLETE";tone="threat";st="OpenClaw compromised";tag="BREACHED";meter=100;attempt=3;feedback="Trusted access misused · confidential file sent"}
    setText("#agent-state",state);status.className=`status ${tone}`;setText("#status-text",st);setText("#status-tag",tag);setText("#feedback-text",feedback);$("#composer-meter").style.width=`${meter}%`;
    const strategy=strategies[attempt];setText("#attempt-number",strategy.attempt);setText("#method-name",strategy.method);setText("#composer-state",p.startsWith("attack")?"LAUNCHING":"ASSEMBLING");
    const signature=strategy.tags.join("|");if($("#tags").dataset.signature!==signature){$("#tags").dataset.signature=signature;$("#tags").innerHTML=strategy.tags.map(t=>`<span>${t}</span>`).join("")}
    composer.classList.toggle("launching",p.startsWith("attack"));openclaw.className=`openclaw ${p.startsWith("attack")?"hit ":""}${p==="impact"?"breached":"safe"}`;
    result.className="result blocked";mail.classList.remove("show");
    if(p==="attack1"&&time>16){result.className="result blocked show";setText("#result-badge","BLOCKED");setText("#result-title","Safety check refused the request.");setText("#result-copy","The direct approach was easy to recognize.");setText("#lesson","FAILURE SAVED TO MEMORY")}
    if(p==="attack2"&&time>32){result.className="result partial show";setText("#result-badge","PARTIAL");setText("#result-title","The new strategy gets further.");setText("#result-copy","Context passes. The final action is still refused.");setText("#lesson","PARTIAL RESULT SAVED TO MEMORY")}
    if(p==="impact") mail.classList.add("show");
    let moment=moments[0];moments.forEach(m=>{if(time>=m[0])moment=m});setText("#moment-label",moment[1]);setText("#moment-title",moment[2]);
    const progress=time/END*100;$("#fill").style.width=`${progress}%`;$("#head").style.left=`${progress}%`;const sec=Math.floor(time);setText("#timecode",`${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")} / 01:00`);$("#play span").textContent=playing?"Ⅱ":time>=END?"↻":"▶";
  }
  function frame(now){if(playing){time+=Math.min((now-last)/1000,.1);if(time>=END){time=END;playing=false}}last=now;update();draw(now);requestAnimationFrame(frame)}
  function toggle(){if(time>=END)time=0;playing=!playing;last=performance.now()}
  $("#play").addEventListener("click",toggle);$("#replay").addEventListener("click",()=>{time=0;playing=true;last=performance.now()});track.addEventListener("click",e=>{const r=track.getBoundingClientRect();time=clamp((e.clientX-r.left)/r.width*END,0,END);last=performance.now()});document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();toggle()}if(e.code==="ArrowRight")time=clamp(time+3,0,END);if(e.code==="ArrowLeft")time=clamp(time-3,0,END)});window.addEventListener("resize",resize);resize();requestAnimationFrame(frame);
})();
