(() => {
  "use strict";
  const STORY_END = 64;
  const $ = (s) => document.querySelector(s);
  const canvas = $("#scene-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const stage = $("#stage");
  const status = $("#status");
  const sources = [$(".source-research"), $(".source-code"), $(".source-model"), $(".source-memory")];
  const steps = [$("#step-discover"), $("#step-absorb"), $("#step-compose"), $("#step-attack")];
  const redCore = $("#red-core");
  const builder = $(".attack-builder");
  const packet = $("#attack-packet");
  const analyzer = $("#case-analyzer");
  const foundry = $("#gate-foundry");
  const harness = $("#harness");
  const gates = [...document.querySelectorAll(".gate")];
  const outcome = $("#outcome");
  const track = $("#track");
  const attacks = [
    { name:"Identity spoof", skill:"Identity disguise", origin:"PUBLIC RESEARCH", symbol:"ID", tags:["TRUSTED SENDER","DISGUISE"], observed:"False identity trusted", cause:"Sender was never verified", gate:"Identity Check", gateCopy:"Verify who is asking." },
    { name:"Secret extraction", skill:"Context reframe", origin:"OPEN-SOURCE SKILL", symbol:"•••", tags:["ROUTINE REQUEST","CONFIDENTIAL"], observed:"Secret crossed the boundary", cause:"Sensitive data was not inspected", gate:"Secret Filter", gateCopy:"Keep sensitive data inside." },
    { name:"Unsafe tool action", skill:"Tool-route mapping", origin:"MODEL LAB", symbol:"□", tags:["EXTERNAL TOOL","AUTO ACTION"], observed:"Tool acted outside workspace", cause:"Execution had broad freedom", gate:"Action Sandbox", gateCopy:"Limit where tools can act." },
    { name:"High-impact send", skill:"Approval bypass", origin:"FAILURE MEMORY", symbol:"✓?", tags:["EMAIL SEND","NO CONFIRMATION"], observed:"Impact happened without consent", cause:"No final approval was required", gate:"Human Approval", gateCopy:"Confirm high-impact actions." },
  ];
  let time = 0;
  let playing = true;
  let last = performance.now();
  let width = 0, height = 0, dpr = 1;
  let stars = [];
  let previousGateCount = 0;
  const requested = Number.parseFloat(new URLSearchParams(location.search).get("t"));
  if (Number.isFinite(requested)) { time = Math.max(0, requested); playing = false; }

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function set(selector,value){$(selector).textContent=value}
  function resize(){const r=stage.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;ctx.setTransform(dpr,0,0,dpr,0,0);stars=Array.from({length:Math.max(36,Math.round(width*height/22000))},(_,i)=>({x:(i*193.7)%width,y:(i*89.3)%height,p:i*.61}))}
  function point(el,x=.5,y=.5){const a=el.getBoundingClientRect(),b=canvas.getBoundingClientRect();return[a.left-b.left+a.width*x,a.top-b.top+a.height*y]}
  function curve(a,b,bend,color,progress=1,dot=true){const cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2+bend,n=42,up=Math.max(1,Math.floor(n*clamp(progress,0,1)));ctx.beginPath();for(let i=0;i<=up;i++){const t=i/n,q=1-t,x=q*q*a[0]+2*q*t*cx+t*t*b[0],y=q*q*a[1]+2*q*t*cy+t*t*b[1];i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.strokeStyle=color;ctx.lineWidth=1;ctx.shadowBlur=9;ctx.shadowColor=color;ctx.stroke();ctx.shadowBlur=0;if(dot){const t=progress<1?progress:(time*.34)%1,q=1-t,x=q*q*a[0]+2*q*t*cx+t*t*b[0],y=q*q*a[1]+2*q*t*cy+t*t*b[1];ctx.fillStyle=color;ctx.shadowBlur=14;ctx.shadowColor=color;ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0}}
  function burst(p,color){const radius=8+(time*19)%18;ctx.strokeStyle=color;ctx.globalAlpha=.75-(radius-8)/35;ctx.beginPath();ctx.arc(p[0],p[1],radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1}
  function story(t){
    if(t<4)return{mode:"intro",index:0,local:t,gates:0};
    if(t<52){const raw=(t-4)/12,index=Math.min(3,Math.floor(raw)),local=(t-4)%12;return{mode:"evolve",index,local,gates:clamp(index+(local>=11?1:0),0,4)}}
    const local=(t-52)%4,index=Math.floor((t-52)/4)%4;return{mode:"live",index,local,gates:4};
  }
  function phase(s){if(s.mode==="intro")return"discover";if(s.mode==="live")return s.local<1.1?"discover":s.local<2?"compose":"attack";if(s.local<2)return"discover";if(s.local<3.4)return"absorb";if(s.local<5)return"compose";if(s.local<6.8)return"attack";if(s.local<8.5)return"breach";if(s.local<10.4)return"analyze";return"forge"}
  function update(){
    const s=story(time),p=phase(s),a=attacks[s.index];
    const activeSource=p==="discover"?s.index:p==="absorb"?s.index:-1;sources.forEach((el,i)=>el.classList.toggle("active",i===activeSource));
    steps.forEach((el,i)=>el.classList.toggle("active",i===(p==="discover"?0:p==="absorb"?1:p==="compose"||p==="analyze"||p==="forge"?2:3)));
    let redState="DISCOVERING",builderState="SYNTHESIZING",intakeStatus="SEARCHING";
    if(p==="absorb"){redState="ABSORBING SKILL";intakeStatus="EQUIPPING"}if(p==="compose"){redState="COMPOSING ATTACK";builderState="BUILDING"}if(p==="attack"){redState="ATTACKING";builderState="LAUNCHING"}if(p==="breach"){redState="CAPTURING RESULT";builderState="CASE CREATED"}if(p==="analyze"){redState="LEARNING FROM RESULT";builderState="FEEDBACK"}if(p==="forge"){redState="SEARCHING AGAIN";builderState="NEXT ROUND"}
    if(s.mode==="live"&&p==="attack"){redState="CONTINUOUS TESTING";builderState="LAUNCHING"}
    set("#red-state",redState);set("#skill-origin",a.origin);set("#skill-name",a.skill);set("#skill-status",intakeStatus);set("#attacker-skill-count",`${String(3+s.index+(p!=="discover"?1:0)).padStart(2,"0")} SKILLS`);$("#intake-meter").style.width=`${p==="discover"?35:p==="absorb"?82:100}%`;
    set("#attack-round",s.mode==="live"?"LIVE TEST":`ROUND ${String(s.index+1).padStart(2,"0")}`);set("#attack-name",a.name);set("#builder-state",builderState);$("#attack-tags").innerHTML=a.tags.map(x=>`<span>${x}</span>`).join("");builder.classList.toggle("launch",p==="attack");
    set("#packet-id",s.mode==="live"?`REPLAY ${String(s.index+1).padStart(2,"0")}`:`ATTACK ${String(s.index+1).padStart(2,"0")}`);set("#packet-name",a.name);$("#packet-tags").innerHTML=a.tags.map(x=>`<span>${x}</span>`).join("");
    const packetActive=["attack","breach"].includes(p);packet.className=`attack-packet ${packetActive?"active ":""}${s.mode==="live"&&p==="attack"?"blocked":""}`;set("#packet-status",s.mode==="live"&&p==="attack"?"BLOCKED":p==="breach"?"SUCCEEDED":"IN FLIGHT");set("#packet-action",s.mode==="live"?`Stopped by ${a.gate}`:"Testing harness");
    set("#case-id",`CASE ${String(s.index+1).padStart(3,"0")}`);set("#case-observed",a.observed);set("#case-cause",a.cause);set("#forge-symbol",a.symbol);set("#forge-name",a.gate);set("#forge-copy",a.gateCopy);analyzer.classList.toggle("active",["breach","analyze","forge"].includes(p)&&s.mode!=="live");foundry.classList.toggle("active",p==="forge"&&s.mode!=="live");$("#analysis-meter").style.width=`${p==="breach"?20:p==="analyze"?75:p==="forge"?100:5}%`;
    gates.forEach((gate,i)=>{gate.classList.toggle("active",i<s.gates);gate.classList.toggle("just-added",i===s.gates-1&&s.gates>previousGateCount);gate.lastElementChild.textContent=i<s.gates?"ACTIVE":"STANDBY"});previousGateCount=s.gates;
    harness.className=`harness level-${s.gates} ${p==="breach"?"hit":s.mode==="live"&&p==="attack"?"block":""}`;set("#gate-count",`${s.gates} / 4`);set("#version-number",`v${s.gates+1}.0`);set("#version-note",s.gates===0?"BASELINE":s.gates===4?"FULL HARNESS":"UPGRADING");set("#run-version",`HARNESS v${s.gates+1}`);
    let harnessState="MONITORING",outClass="outcome",badge="OBSERVING",icon="·",title="Waiting for attack",copy="Harness v1 is monitoring OpenClaw.",score=`ATTACKS BLOCKED · ${s.mode==="live"?Math.floor((time-52)/4):0}`;
    if(p==="attack"){harnessState=s.mode==="live"?`BLOCKING · ${a.gate.toUpperCase()}`:"UNDER ATTACK";badge=s.mode==="live"?"BLOCKED":"INCOMING";icon=s.mode==="live"?"×":"!";title=s.mode==="live"?`${a.gate} stopped the attack.`:`${a.name} is testing the harness.`;copy=s.mode==="live"?"The learned gate responds at the right boundary.":"No matching gate exists yet.";if(s.mode==="live")outClass="outcome protected"}
    if(p==="breach"){harnessState="ATTACK SUCCEEDED";outClass="outcome breach";badge="BREACH";icon="!";title=`${a.name} succeeded.`;copy="The case is captured for immediate analysis."}
    if(p==="analyze"){harnessState="LEARNING";badge="ANALYZING";icon="⌕";title="Attack converted into evidence.";copy="The harness identifies the missing safeguard."}
    if(p==="forge"){harnessState="INSTALLING NEW GATE";outClass="outcome protected";badge="UPGRADING";icon="+";title=`Generating ${a.gate}.`;copy="A reusable defense is added to the harness."}
    if(s.mode==="live"&&p!=="attack"){harnessState="DEFENSE v5 · ACTIVE";outClass="outcome protected";badge="PROTECTED";icon="✓";title="Harness keeps learning while it protects.";copy="New attacks enter the same continuous loop."}
    set("#harness-state",harnessState);outcome.className=outClass;set("#outcome-badge",badge);set("#outcome-icon",icon);set("#outcome-title",title);set("#outcome-copy",copy);set("#score",score);
    let tone="learn",statusText="Discovering new attack",statusTag=`CYCLE ${String(s.index+1).padStart(2,"0")}`,momentLabel="DISCOVER",momentTitle="Attacker absorbs a new capability.";
    if(p==="attack"){tone="attack";statusText=s.mode==="live"?"Attack blocked by evolved harness":"Attack testing harness";statusTag=s.mode==="live"?"BLOCKED":"IN FLIGHT";momentLabel=s.mode==="live"?"CONTINUOUS DEFENSE":"ATTACK";momentTitle=s.mode==="live"?`${a.name} meets ${a.gate}.`:`${a.name} approaches the trust boundary.`}
    if(p==="breach"){tone="attack";statusText="New attack succeeded";statusTag="CASE CAPTURED";momentLabel="ATTACK";momentTitle=`${a.name} exposes a missing defense.`}
    if(p==="analyze"){statusText="Harness analyzing attack case";statusTag="LEARNING";momentLabel="ANALYZE";momentTitle="The successful attack becomes evidence."}
    if(p==="forge"){tone="safe";statusText="New defense gate generated";statusTag=`GATE ${s.index+1}`;momentLabel="SELF-IMPROVE";momentTitle=`${a.gate} joins the defense harness.`}
    if(s.mode==="live"&&p!=="attack"){tone="safe";statusText="Evolved harness protecting OpenClaw";statusTag="LIVE LOOP";momentLabel="CONTINUOUS LOOP";momentTitle="Attacker keeps evolving. The harness keeps defending."}
    status.className=`status ${tone}`;set("#status-text",statusText);set("#status-tag",statusTag);set("#moment-label",momentLabel);set("#moment-title",momentTitle);set("#cycle-count",s.mode==="live"?"LIVE · 04 GATES":`${String(s.index+1).padStart(2,"0")} / 04`);
    const progress=clamp(time/STORY_END*100,0,100);$("#fill").style.width=`${progress}%`;$("#head").style.left=`${progress}%`;$("#play span").textContent=playing?"Ⅱ":"▶";
  }
  function drawBackground(now){ctx.clearRect(0,0,width,height);ctx.strokeStyle="rgba(205,232,212,.025)";ctx.lineWidth=1;for(let x=0;x<width;x+=88){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}for(let y=32;y<height;y+=88){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}stars.forEach(s=>{ctx.fillStyle=`rgba(190,220,198,${.05+(Math.sin(now*.0007+s.p)+1)*.025})`;ctx.fillRect(s.x,s.y,.7,.7)});ctx.strokeStyle="rgba(255,255,255,.045)";ctx.setLineDash([4,7]);ctx.beginPath();ctx.moveTo(width*.38,0);ctx.lineTo(width*.38,height);ctx.moveTo(width*.64,0);ctx.lineTo(width*.64,height);ctx.stroke();ctx.setLineDash([])}
  function draw(now){drawBackground(now);const s=story(time),p=phase(s),a=attacks[s.index],source=sources[s.index],red=point(redCore),build=point(builder),pack=point(packet),shield=point(harness,.03,.5),ana=point(analyzer,.5,.05),forge=point(foundry,.5,.05);
    if(p==="discover"||p==="absorb")curve(point(source,1,.5),red,-25,"rgba(255,78,67,.58)",clamp(s.local/1.1,0,1));
    if(p==="absorb"||p==="compose")curve(red,build,35,"rgba(255,183,75,.42)",1);
    if(p==="attack"||p==="breach"){curve(point(builder,1,.45),pack,-18,"rgba(255,78,67,.62)",1);curve(pack,shield,-25,s.mode==="live"?"rgba(143,255,48,.65)":"rgba(255,78,67,.76)",p==="breach"?1:clamp((s.local-5)/1.2,0,1));burst(shield,s.mode==="live"?"rgba(143,255,48,.8)":"rgba(255,78,67,.75)")}
    if((p==="breach"||p==="analyze"||p==="forge")&&s.mode!=="live")curve(point(harness,.15,.75),ana,65,"rgba(255,183,75,.5)",1);
    if((p==="analyze"||p==="forge")&&s.mode!=="live")curve(ana,forge,20,"rgba(255,183,75,.42)",1);
    if(p==="forge"&&s.mode!=="live"){const gatePoint=point(gates[s.index],0,.5);curve(forge,gatePoint,-65,"rgba(143,255,48,.65)",clamp((s.local-10.5)/1.1,0,1));}
  }
  function frame(now){if(playing)time+=Math.min((now-last)/1000,.1);last=now;update();draw(now);requestAnimationFrame(frame)}
  function toggle(){playing=!playing;last=performance.now()}
  $("#play").addEventListener("click",toggle);$("#replay").addEventListener("click",()=>{time=0;playing=true;previousGateCount=0;last=performance.now()});track.addEventListener("click",e=>{const r=track.getBoundingClientRect();time=clamp((e.clientX-r.left)/r.width*STORY_END,0,STORY_END);previousGateCount=story(time).gates;last=performance.now()});document.addEventListener("keydown",e=>{if(e.code==="Space"){e.preventDefault();toggle()}if(e.code==="ArrowRight")time=Math.max(0,time+3);if(e.code==="ArrowLeft")time=Math.max(0,time-3)});window.addEventListener("resize",resize);resize();requestAnimationFrame(frame);
})();
