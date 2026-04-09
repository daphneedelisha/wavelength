// ═══════════════════════════════════════════════════
//  DATA
// ═══════════════════════════════════════════════════
const SPECTRA = [
  ["Hot","Cold"],["Good","Evil"],["Loud","Quiet"],["Fast","Slow"],
  ["Cheap","Expensive"],["Beautiful","Ugly"],["Smart","Dumb"],["Old","New"],
  ["Happy","Sad"],["Big","Small"],["Safe","Dangerous"],["Rare","Common"],
  ["Simple","Complex"],["Fictional","Real"],["Strong","Weak"],
  ["Light","Heavy"],["Sweet","Salty"],["Formal","Casual"],
  ["Obvious","Subtle"],["Natural","Artificial"],["Boring","Exciting"],
  ["Serious","Funny"],["Ancient","Futuristic"],["Overrated","Underrated"],
  ["Popular","Niche"],["Relaxing","Stressful"]
];

const COLORS = [
  "#a78bfa","#34d399","#fb923c","#60a5fa",
  "#f472b6","#fbbf24","#4ade80","#f87171"
];

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let S = {
  screen: "home",
  phase: "",
  players: [],
  nameInput: "",
  rounds: 5,
  isPrivate: true,
  code: "",
  joinInput: "",
  // game
  round: 1,
  itIdx: 0,
  spec: ["Hot","Cold"],
  target: 50,
  clueInput: "",
  clue: "",
  guesses: {},
  curGuest: 0,
  needlePos: 50,
  cum: {},
  roundSc: {},
  usedSp: [],
};

let _cleanupDial = null;

// ═══════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════
function e(s) { // html-escape
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function pc(i) { return COLORS[i % COLORS.length]; }
function genCode() { return Math.random().toString(36).slice(2,6).toUpperCase(); }
function calcSc(g, t) { const d = Math.abs(g-t); return d<=10?4:d<=20?3:d<=30?2:0; }

function av(name, color, size=40) {
  const fs = Math.max(11, size*0.38);
  return `<div class="av" style="width:${size}px;height:${size}px;background:${color}18;border:1.5px solid ${color};font-size:${fs}px;color:${color}">${e(name[0]).toUpperCase()}</div>`;
}

// ═══════════════════════════════════════════════════
//  DIAL — SVG RENDERER
// ═══════════════════════════════════════════════════
const CX=250, CY=244, RO=210, RI=128, VW=500, VH=268;

function pt(pos, r) {
  const a = Math.PI * (1 - pos/100);
  return [+(CX + r*Math.cos(a)).toFixed(1), +(CY - r*Math.sin(a)).toFixed(1)];
}

function band(r1, r2, p1, p2) {
  const o=[], i=[];
  for (let k=0; k<=54; k++) {
    const p = p1 + (p2-p1)*k/54;
    const [x,y]  = pt(p,r1); o.push(`${x} ${y}`);
    const [x2,y2]= pt(p,r2); i.unshift(`${x2} ${y2}`);
  }
  return `M ${[...o,...i].join(" L ")} Z`;
}

function strokeArc(r, p1, p2) {
  const pts = [];
  for (let k=0; k<=54; k++) {
    const p = p1 + (p2-p1)*k/54;
    const [x,y] = pt(p,r);
    pts.push(`${x} ${y}`);
  }
  return `M ${pts.join(" L ")}`;
}

function needleSVG(pos, color="#fff", size=1, label=null, ids=false) {
  const [tx,ty] = pt(pos, RO-18);
  const [bx,by] = pt(pos, RI+14);
  const lid  = ids ? ' id="n-line"' : '';
  const tid  = ids ? ' id="n-tip"'  : '';
  const bid  = ids ? ' id="n-base"' : '';
  const lbl  = label
    ? `<text x="${tx}" y="${ty-11}" text-anchor="middle" font-size="9" fill="${color}" font-weight="500" opacity="0.88">${e(label)}</text>`
    : '';
  return `${lbl}
    <line${lid} x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="${2.5*size}" stroke-linecap="round" opacity="0.93"/>
    <circle${tid} cx="${tx}" cy="${ty}" r="${6*size}" fill="${color}"/>
    <circle${bid} cx="${bx}" cy="${by}" r="${3*size}" fill="${color}" opacity="0.28"/>`;
}

function dialSVG({ showLabels=false, left="", right="", showZone=false,
                   target=50, interactive=false, playerPos=50,
                   reveal=false, guesses=[] }) {
  const t = Math.max(2, Math.min(98, target));
  let s = "";

  // base track
  s += `<path d="${band(RO,RI,0,100)}" fill="#141414"/>`;
  s += `<path d="${strokeArc(RO,0,100)}" fill="none" stroke="#222" stroke-width="0.5"/>`;
  s += `<path d="${strokeArc(RI,0,100)}" fill="none" stroke="#222" stroke-width="0.5"/>`;

  // tick marks
  for (let k=0; k<=20; k++) {
    const p  = k*5;
    const [ox,oy] = pt(p, RO+2);
    const [ix,iy] = pt(p, RO-(p%10===0?14:6));
    s += `<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${p%10===0?'#2a2a2a':'#1e1e1e'}" stroke-width="${p%10===0?1:0.4}"/>`;
  }

  // psychic's target zone
  if (showZone && !reveal) {
    s += `<path d="${band(RO,RI,Math.max(0,t-30),Math.min(100,t+30))}" fill="#f97316" opacity="0.1"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-20),Math.min(100,t+20))}" fill="#f59e0b" opacity="0.18"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-10),Math.min(100,t+10))}" fill="#34d399" opacity="0.36"/>`;
  }

  // reveal scoring zones
  if (reveal) {
    s += `<path d="${band(RO,RI,Math.max(0,t-30),Math.min(100,t+30))}" fill="#f97316" opacity="0.16"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-20),Math.min(100,t+20))}" fill="#f59e0b" opacity="0.26"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-10),Math.min(100,t+10))}" fill="#34d399" opacity="0.42"/>`;
    guesses.forEach(g => { s += `<g>${needleSVG(g.pos, g.color, 1, g.name)}</g>`; });
    s += `<g>${needleSVG(t, "#34d399", 1.4, "target")}</g>`;
  }

  // interactive needle
  if (interactive && !reveal) {
    s += `<g id="needle">${needleSVG(playerPos,"#fff",1,null,true)}</g>`;
  }

  // labels
  if (showLabels) {
    s += `<text x="10"      y="263" font-size="11" fill="#363636">${e(left.toLowerCase())}</text>`;
    s += `<text x="${VW-10}" y="263" font-size="11" fill="#363636" text-anchor="end">${e(right.toLowerCase())}</text>`;
  }

  // center pivot
  s += `<circle cx="${CX}" cy="${CY}" r="8" fill="#0a0a0a" stroke="#222" stroke-width="1"/>`;

  return `<svg id="dial" viewBox="0 0 ${VW} ${VH}"
    style="width:100%;max-width:520px;display:block;margin:0 auto;user-select:none;touch-action:none;cursor:${interactive?'crosshair':'default'}">${s}</svg>`;
}

// ═══════════════════════════════════════════════════
//  DIAL INTERACTION
// ═══════════════════════════════════════════════════
function initDial(onPosChange) {
  const svg = document.getElementById("dial");
  if (!svg) return null;
  let dragging = false;

  function getPos(e) {
    const r  = svg.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    const sx = (cx - r.left) / r.width  * VW - CX;
    const sy = (cy - r.top)  / r.height * VH - CY;
    let a = Math.atan2(-sy, sx);
    if (a < 0) a = sx >= 0 ? 0.001 : Math.PI - 0.001;
    return Math.max(0, Math.min(100, (1 - a/Math.PI) * 100));
  }

  function moveNeedle(pos) {
    const [tx,ty] = pt(pos, RO-18);
    const [bx,by] = pt(pos, RI+14);
    const l  = document.getElementById("n-line");
    const t_ = document.getElementById("n-tip");
    const b  = document.getElementById("n-base");
    if (l)  { l.setAttribute("x1",bx); l.setAttribute("y1",by); l.setAttribute("x2",tx); l.setAttribute("y2",ty); }
    if (t_) { t_.setAttribute("cx",tx); t_.setAttribute("cy",ty); }
    if (b)  { b.setAttribute("cx",bx); b.setAttribute("cy",by); }
  }

  const onMove = e => {
    if (!dragging) return;
    e.preventDefault();
    const p = getPos(e);
    S.needlePos = p;
    moveNeedle(p);
    onPosChange(p);
  };
  const onUp = () => { dragging = false; };

  const onDown = e => {
    dragging = true;
    const p = getPos(e);
    S.needlePos = p;
    moveNeedle(p);
    onPosChange(p);
  };

  svg.addEventListener("mousedown",  onDown);
  svg.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("mousemove",  onMove);
  window.addEventListener("mouseup",    onUp);
  window.addEventListener("touchmove",  onMove, { passive: false });
  window.addEventListener("touchend",   onUp);

  return () => {
    window.removeEventListener("mousemove",  onMove);
    window.removeEventListener("mouseup",    onUp);
    window.removeEventListener("touchmove",  onMove);
    window.removeEventListener("touchend",   onUp);
  };
}

// ═══════════════════════════════════════════════════
//  SCREEN RENDERERS
// ═══════════════════════════════════════════════════
function renderHome() {
  return `
  <div class="page-center">
    <p class="t-label mb12" style="letter-spacing:.1em">a party game of</p>
    <h1 class="t-game-title mb8">wavelength</h1>
    <p class="t-muted mb48">find the frequency. give the perfect clue.</p>
    <div class="col" style="width:260px;gap:10px">
      <button class="btn btn-primary" onclick="go('create')">create lobby</button>
      <button class="btn btn-secondary" onclick="go('join')">join lobby</button>
    </div>
  </div>`;
}

function renderCreate() {
  const chips = S.players.map((p,i) =>
    `<div class="chip" style="border-color:${pc(i)}28">
      <span class="chip-dot" style="background:${pc(i)}"></span>
      ${e(p)}
      <button class="chip-rm btn" onclick="removePlayer(${i})">×</button>
    </div>`
  ).join("");

  return `
  <div class="page-full">
    <button class="btn t-muted mb20" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0" onclick="go('home')">← back</button>
    <h2 style="font-size:22px;font-weight:400;color:#f0f0f0;margin-bottom:4px">create lobby</h2>
    <p class="t-muted mb20">add players, then start the game.</p>

    <div class="sec mb12">
      <p class="t-label mb8">players (${S.players.length}/8)</p>
      <div class="row mb10">
        <input id="name-inp" class="inp" placeholder="player name"
          value="${e(S.nameInput)}"
          oninput="S.nameInput=this.value"
          onkeydown="if(event.key==='Enter')addPlayer()">
        <button class="btn btn-sm" onclick="addPlayer()">add</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;min-height:28px">
        ${chips || `<span class="t-muted" style="font-size:13px;line-height:28px">no players yet</span>`}
      </div>
    </div>

    <div class="sec mb12">
      <p class="t-label mb8">rounds</p>
      <div class="row" style="gap:8px">
        ${[3,5,7,10].map(r =>
          `<button class="btn btn-sm ${S.rounds===r?'on':''}" onclick="S.rounds=${r};render()">${r}</button>`
        ).join("")}
      </div>
    </div>

    <div class="sec mb16">
      <div class="row-sb mb10">
        <p class="t-label">visibility</p>
        <div class="row" style="gap:8px">
          <button class="btn btn-sm ${S.isPrivate?'on':''}" onclick="S.isPrivate=true;render()">private</button>
          <button class="btn btn-sm ${!S.isPrivate?'on':''}" onclick="S.isPrivate=false;render()">public</button>
        </div>
      </div>
      <p class="t-label mb6">room code</p>
      <span class="t-mono">${S.code}</span>
      <p class="t-muted mt4" style="font-size:12px">share this with friends to join</p>
    </div>

    <button class="btn btn-primary" onclick="startGame()" ${S.players.length<2?'disabled':''}>
      start game →
    </button>
    ${S.players.length < 2
      ? `<p style="font-size:12px;color:#2e2e2e;text-align:center;margin-top:10px">add at least 2 players to start</p>`
      : ""}
  </div>`;
}

function renderJoin() {
  return `
  <div class="page-full" style="text-align:center;padding-top:52px">
    <button class="btn t-muted mb24" style="background:none;border:none;cursor:pointer;font-size:13px;display:block" onclick="go('home')">← back</button>
    <h2 style="font-size:22px;font-weight:400;color:#f0f0f0;margin-bottom:6px">join a lobby</h2>
    <p class="t-muted mb24">enter the room code from the host.</p>
    <div style="max-width:220px;margin:0 auto">
      <input class="inp inp-code mb12" placeholder="XXXX" maxlength="4"
        value="${e(S.joinInput)}"
        oninput="S.joinInput=this.value.toUpperCase();this.value=S.joinInput">
      <button class="btn btn-primary" onclick="go('home')" ${S.joinInput.length<4?'disabled':''}>
        join →
      </button>
      <p style="font-size:12px;color:#252525;margin-top:12px;line-height:1.5">
        wavelength is pass-and-play — use create lobby to host on this device.
      </p>
    </div>
  </div>`;
}

function renderGame() {
  const itp   = S.players[S.itIdx] || "";
  const gp    = S.players[S.curGuest] || "";
  const itCol = pc(S.itIdx);
  const gCol  = pc(S.curGuest);
  const ni    = S.players.map((_,i)=>i).filter(i => i !== S.itIdx);

  // ── it reveal ──────────────────────────────────
  if (S.phase === "it_reveal") return `
  <div class="page-center">
    <p class="t-label mb12">round ${S.round} of ${S.rounds}</p>
    <div class="sec mb32" style="display:inline-block;padding:6px 18px;border-radius:20px">
      <span style="font-size:12px;color:#2e2e2e">⚠ everyone else look away</span>
    </div>
    <div class="mb12">${av(itp, itCol, 58)}</div>
    <h2 class="t-big mb6">${e(itp)}</h2>
    <p class="t-muted mb4">you are the <span style="color:#d8d8d8;font-weight:500">psychic</span> this round</p>
    <p class="t-muted mb40" style="font-size:12px">pass the device to ${e(itp)}, then tap when ready.</p>
    <button class="btn btn-primary" style="max-width:320px" onclick="setPhase('it_clue')">
      i'm ready — i am ${e(itp)}
    </button>
  </div>`;

  // ── it clue ────────────────────────────────────
  if (S.phase === "it_clue") return `
  <div class="page-full">
    <div class="row-sb mb8">
      <span class="t-label">round ${S.round} / ${S.rounds}</span>
      <div class="row" style="gap:6px">
        ${av(itp, itCol, 20)}
        <span class="t-label">psychic</span>
      </div>
    </div>
    <p class="t-muted mb6" style="text-align:center;font-size:12px">
      the green zone is the target — give a clue that hints where it falls
    </p>
    ${dialSVG({ showLabels:true, left:S.spec[0], right:S.spec[1], showZone:true, target:S.target })}
    <div class="row-sb mt4" style="padding:0 8px">
      <span style="font-size:12px;color:#303030">${e(S.spec[0].toLowerCase())}</span>
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>4 pts</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>3 pts</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div>2 pts</div>
      </div>
      <span style="font-size:12px;color:#303030">${e(S.spec[1].toLowerCase())}</span>
    </div>
    <div class="sec mt12 mb10">
      <p class="t-label mb6">your clue (word or phrase — no numbers)</p>
      <input id="clue-inp" class="inp" placeholder='e.g. "lukewarm"'
        value="${e(S.clueInput)}"
        oninput="S.clueInput=this.value"
        onkeydown="if(event.key==='Enter')submitClue()"
        autofocus>
    </div>
    <button class="btn btn-primary" onclick="submitClue()" ${!S.clueInput?.trim()?'disabled':''}>
      submit clue →
    </button>
  </div>`;

  // ── guest reveal ───────────────────────────────
  if (S.phase === "guest_reveal") return `
  <div class="page-center">
    <p class="t-label mb12">round ${S.round} of ${S.rounds}</p>
    <div class="mb12">${av(gp, gCol, 58)}</div>
    <h2 class="t-big mb6">pass to ${e(gp)}</h2>
    <p class="t-muted mb40" style="font-size:13px">
      ${e(gp)}, don't look until you have the device!
    </p>
    <button class="btn btn-primary" style="max-width:320px" onclick="S.needlePos=50;setPhase('guest_guess')">
      i'm ready — i am ${e(gp)}
    </button>
  </div>`;

  // ── guest guess ────────────────────────────────
  if (S.phase === "guest_guess") return `
  <div class="page-full">
    <div class="row-sb mb6">
      <span class="t-label">round ${S.round} / ${S.rounds}</span>
      <div class="row" style="gap:6px">
        ${av(gp, gCol, 20)}
        <span class="t-label">${e(gp)}'s turn</span>
      </div>
    </div>
    <div class="sec mb10" style="text-align:center">
      <p class="t-label mb4">the clue is</p>
      <p class="t-clue">"${e(S.clue)}"</p>
    </div>
    ${dialSVG({ interactive:true, playerPos:S.needlePos })}
    <p class="t-muted mt4 mb2" style="text-align:center;font-size:12px">
      tap or drag the needle to your guess
    </p>
    <p id="pos-label" class="t-label mb12" style="text-align:center">
      ${Math.round(S.needlePos)}%
    </p>
    <button class="btn btn-primary" onclick="submitGuess()">lock in guess →</button>
  </div>`;

  // ── reveal ─────────────────────────────────────
  if (S.phase === "reveal") {
    const ag = Object.entries(S.guesses).map(([pi,p]) => ({
      pos: p, name: S.players[+pi], color: COLORS[+pi % COLORS.length]
    }));
    return `
    <div class="page-full">
      <p class="t-label mb8">round ${S.round} results</p>
      <div class="sec mb8" style="text-align:center">
        <p class="t-label mb4">clue by ${e(itp)}</p>
        <p class="t-clue">"${e(S.clue)}"</p>
      </div>
      ${dialSVG({ reveal:true, target:S.target, guesses:ag, showLabels:true, left:S.spec[0], right:S.spec[1] })}
      <div class="legend mt6 mb10">
        <div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>4 pts</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>3 pts</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div>2 pts</div>
      </div>
      <div class="sec">
        <p class="t-label mb4">this round</p>
        ${ni.map(pi => {
          const pts = S.roundSc[pi] ?? 0;
          const clr = pts===4?"#34d399":pts===3?"#f59e0b":pts===2?"#f97316":"#2a2a2a";
          return `<div class="score-row">
            <div class="row" style="gap:10px">
              ${av(S.players[pi], COLORS[pi%COLORS.length], 26)}
              <span style="font-size:14px">${e(S.players[pi])}</span>
            </div>
            <span style="font-weight:500;color:${clr};font-size:14px">
              ${pts} pts${pts===4?" 🎯":pts>=2?" ✓":""}
            </span>
          </div>`;
        }).join("")}
        <div class="row-sb mt8" style="opacity:.3">
          <span class="t-muted" style="font-size:12px">${e(itp)} (psychic)</span>
          <span class="t-muted" style="font-size:12px">no score this round</span>
        </div>
      </div>
      <button class="btn btn-primary mt10" onclick="setPhase('leaderboard')">
        ${S.round >= S.rounds ? "final results →" : "leaderboard →"}
      </button>
    </div>`;
  }

  // ── leaderboard / game over ────────────────────
  if (S.phase === "leaderboard" || S.phase === "gameover") {
    const over   = S.round >= S.rounds;
    const sorted = [...S.players.map((n,i) => ({ n, i, s: S.cum[i] ?? 0 }))].sort((a,b) => b.s-a.s);
    const maxS   = Math.max(1, ...sorted.map(p => p.s));
    return `
    <div class="page-full">
      <p class="t-label mb12">${over ? "final standings" : `after round ${S.round} of ${S.rounds}`}</p>
      ${over ? `
      <div style="text-align:center;margin-bottom:28px">
        <div style="font-size:40px;margin-bottom:8px">🏆</div>
        <h2 class="t-big mb4">${e(sorted[0].n)} wins!</h2>
        <p class="t-muted">${sorted[0].s} total points</p>
      </div>` : ""}
      <div class="sec">
        ${sorted.map((p,rank) => `
        <div style="margin-bottom:${rank < sorted.length-1 ? "16" : "0"}px">
          <div class="row-sb mb6">
            <div class="row" style="gap:8px">
              <span class="t-muted" style="font-size:12px;min-width:14px;text-align:right">${rank+1}</span>
              ${av(p.n, COLORS[p.i % COLORS.length], 26)}
              <span style="font-size:14px;font-weight:${rank===0?500:400};color:${rank===0?'#f0f0f0':'#b0b0b0'}">${e(p.n)}</span>
            </div>
            <span style="font-size:15px;font-weight:500;color:#e0e0e0">${p.s}</span>
          </div>
          <div class="lb-bar" style="margin-left:46px">
            <div class="lb-fill" style="width:${Math.round((p.s/maxS)*100)}%;background:${COLORS[p.i%COLORS.length]}"></div>
          </div>
        </div>`).join("")}
      </div>
      <div class="row mt12" style="gap:8px">
        <button class="btn btn-secondary" style="flex:1" onclick="resetGame()">new game</button>
        ${!over ? `<button class="btn btn-primary" style="flex:2" onclick="nextRound()">round ${S.round+1} →</button>` : ""}
      </div>
    </div>`;
  }

  return "";
}

// ═══════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════
function go(screen) { S.screen = screen; render(); }
function setPhase(phase) { S.phase = phase; render(); }

function addPlayer() {
  const n = (S.nameInput || "").trim();
  if (!n || S.players.length >= 8) return;
  S.players = [...S.players, n];
  S.nameInput = "";
  render();
  setTimeout(() => { const el = document.getElementById("name-inp"); if (el) el.focus(); }, 30);
}

function removePlayer(i) {
  S.players = S.players.filter((_,j) => j !== i);
  render();
}

function startGame() {
  S.cum = Object.fromEntries(S.players.map((_,i) => [i, 0]));
  launchRound(0, 1, []);
}

function launchRound(it, rnd, used) {
  let pool = SPECTRA.map((_,i) => i).filter(i => !used.includes(i));
  if (!pool.length) pool = SPECTRA.map((_,i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];

  S.itIdx    = it;
  S.round    = rnd;
  S.spec     = SPECTRA[idx];
  S.target   = 12 + Math.random() * 76;
  S.clue     = "";
  S.clueInput= "";
  S.guesses  = {};
  S.roundSc  = {};
  S.needlePos= 50;
  S.usedSp   = [...used, idx];

  const ni = S.players.map((_,i) => i).filter(i => i !== it);
  S.curGuest = ni[0] ?? 0;
  S.phase    = "it_reveal";
  S.screen   = "game";
  render();
}

function submitClue() {
  const c = (S.clueInput || "").trim();
  if (!c) return;
  S.clue = c;
  const ni = S.players.map((_,i) => i).filter(i => i !== S.itIdx);
  if (!ni.length) { doReveal({}); return; }
  S.curGuest  = ni[0];
  S.needlePos = 50;
  setPhase("guest_reveal");
}

function submitGuess() {
  const ng = { ...S.guesses, [S.curGuest]: S.needlePos };
  S.guesses = ng;
  const ni   = S.players.map((_,i) => i).filter(i => i !== S.itIdx);
  const next = ni.indexOf(S.curGuest) + 1;
  if (next < ni.length) {
    S.curGuest  = ni[next];
    S.needlePos = 50;
    setPhase("guest_reveal");
  } else {
    doReveal(ng);
  }
}

function doReveal(g) {
  const rs = Object.fromEntries(
    Object.entries(g).map(([pi,p]) => [pi, calcSc(p, S.target)])
  );
  S.roundSc = rs;
  Object.entries(rs).forEach(([pi,sc]) => { S.cum[pi] = (S.cum[pi] || 0) + sc; });
  setPhase("reveal");
}

function nextRound() {
  const nr  = S.round + 1;
  const nit = (S.itIdx + 1) % S.players.length;
  if (nr > S.rounds) { S.phase = "gameover"; render(); return; }
  launchRound(nit, nr, S.usedSp);
}

function resetGame() {
  S.screen = "home";
  S.players = [];
  S.phase   = "";
  S.code    = genCode();
  render();
}

// ═══════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════
function render() {
  if (_cleanupDial) { _cleanupDial(); _cleanupDial = null; }

  let html = "";
  if      (S.screen === "home")   html = renderHome();
  else if (S.screen === "create") html = renderCreate();
  else if (S.screen === "join")   html = renderJoin();
  else if (S.screen === "game")   html = renderGame();

  document.getElementById("app").innerHTML = html;

  // attach dial drag for the guessing phase
  if (S.screen === "game" && S.phase === "guest_guess") {
    _cleanupDial = initDial(p => {
      const el = document.getElementById("pos-label");
      if (el) el.textContent = Math.round(p) + "%";
    });
  }

  // auto-focus
  setTimeout(() => {
    const el = document.querySelector("[autofocus]");
    if (el) el.focus();
  }, 40);
}

// ═══════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════
S.code = genCode();
render();