// ═══════════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════════
const SERVER = window.location.hostname === "localhost"
  ? "http://localhost:3001"
  : "https://wavelength-production-f176.up.railway.app";

// ═══════════════════════════════════════════════════
//  COLORS
// ═══════════════════════════════════════════════════
const COLORS = ["#a78bfa","#34d399","#fb923c","#60a5fa","#f472b6","#fbbf24","#4ade80","#f87171"];
function pc(i) { return COLORS[i % COLORS.length]; }

// ═══════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════
let S = {
  screen:      "home",
  nameInput:   "",
  joinInput:   "",
  clueInput:   "",
  roundsInput: 5,
  needlePos:   50,
  error:       "",
  playerIdx:   null,
  code:        "",
  lobby:       null,
};

// ═══════════════════════════════════════════════════
//  SOCKET
// ═══════════════════════════════════════════════════
const socket = io(SERVER, { transports: ["websocket"] });

socket.on("connect", () => {
  console.log("connected:", socket.id);
  S.error = "";
  render();
});

socket.on("connect_error", () => {
  S.error = "can't reach server — check your Railway URL";
  render();
});

socket.on("joined", ({ code, playerIdx, lobby }) => {
  S.code      = code;
  S.playerIdx = playerIdx;
  S.lobby     = lobby;
  S.screen    = "lobby";
  S.error     = "";
  render();
});

socket.on("state", (lobby) => {
  S.lobby = lobby;
  S.screen = lobby.phase === "lobby" ? "lobby" : "game";
  render();
});

socket.on("err", (msg) => {
  S.error = msg;
  render();
});

// ═══════════════════════════════════════════════════
//  DIAL — SVG
// ═══════════════════════════════════════════════════
const CX=250, CY=244, RO=210, RI=128, VW=500, VH=268;

function pt(pos, r) {
  const a = Math.PI * (1 - pos / 100);
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
    const [x,y] = pt(p, r);
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
    ? `<text x="${tx}" y="${ty-11}" text-anchor="middle" font-size="9" fill="${color}" font-weight="500" opacity="0.88">${he(label)}</text>`
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

  s += `<path d="${band(RO,RI,0,100)}" fill="#141414"/>`;
  s += `<path d="${strokeArc(RO,0,100)}" fill="none" stroke="#222" stroke-width="0.5"/>`;
  s += `<path d="${strokeArc(RI,0,100)}" fill="none" stroke="#222" stroke-width="0.5"/>`;

  for (let k=0; k<=20; k++) {
    const p = k*5;
    const [ox,oy] = pt(p, RO+2);
    const [ix,iy] = pt(p, RO-(p%10===0?14:6));
    s += `<line x1="${ix}" y1="${iy}" x2="${ox}" y2="${oy}" stroke="${p%10===0?"#2a2a2a":"#1e1e1e"}" stroke-width="${p%10===0?1:0.4}"/>`;
  }

  if (showZone && !reveal) {
    s += `<path d="${band(RO,RI,Math.max(0,t-30),Math.min(100,t+30))}" fill="#f97316" opacity="0.1"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-15),Math.min(100,t+15))}" fill="#f59e0b" opacity="0.18"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-5), Math.min(100,t+5))}"  fill="#34d399" opacity="0.36"/>`;
  }

  if (reveal) {
    s += `<path d="${band(RO,RI,Math.max(0,t-30),Math.min(100,t+30))}" fill="#f97316" opacity="0.16"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-15),Math.min(100,t+15))}" fill="#f59e0b" opacity="0.26"/>`;
    s += `<path d="${band(RO,RI,Math.max(0,t-5), Math.min(100,t+5))}"  fill="#34d399" opacity="0.42"/>`;
    guesses.forEach(g => { s += `<g>${needleSVG(g.pos, g.color, 1, g.name)}</g>`; });
    s += `<g>${needleSVG(t, "#34d399", 1.4, "target")}</g>`;
  }

  if (interactive && !reveal) {
    s += `<g id="needle">${needleSVG(playerPos, "#fff", 1, null, true)}</g>`;
  }

  if (showLabels) {
    s += `<text x="10" y="263" font-size="11" fill="#363636">${he(left.toLowerCase())}</text>`;
    s += `<text x="${VW-10}" y="263" font-size="11" fill="#363636" text-anchor="end">${he(right.toLowerCase())}</text>`;
  }

  s += `<circle cx="${CX}" cy="${CY}" r="8" fill="#0a0a0a" stroke="#222" stroke-width="1"/>`;

  return `<svg id="dial" viewBox="0 0 ${VW} ${VH}"
    style="width:100%;max-width:520px;display:block;margin:0 auto;user-select:none;touch-action:none;cursor:${interactive?"crosshair":"default"}">${s}</svg>`;
}

// ═══════════════════════════════════════════════════
//  DIAL DRAG
// ═══════════════════════════════════════════════════
let _cleanupDial = null;

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
    return Math.max(0, Math.min(100, (1 - a / Math.PI) * 100));
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
  const onUp   = () => { dragging = false; };
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
//  HELPERS
// ═══════════════════════════════════════════════════
function he(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function av(name, color, size=40) {
  const fs = Math.max(11, size * 0.38);
  return `<div class="av" style="width:${size}px;height:${size}px;background:${color}18;border:1.5px solid ${color};font-size:${fs}px;color:${color}">${he(name[0]).toUpperCase()}</div>`;
}

function legend() {
  return `<div class="legend">
    <div class="legend-item"><div class="legend-dot" style="background:#34d399"></div>100 pts</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f59e0b"></div>50–99</div>
    <div class="legend-item"><div class="legend-dot" style="background:#f97316"></div>1–49</div>
  </div>`;
}

function scoreColor(pts) {
  if (pts === 100) return "#34d399";
  if (pts >= 50)   return "#f59e0b";
  if (pts >= 1)    return "#f97316";
  return "#2a2a2a";
}

function scoreLabel(pts) {
  if (pts === 100) return " 🎯";
  if (pts >= 50)   return " ✓";
  return "";
}

// ═══════════════════════════════════════════════════
//  SCREENS
// ═══════════════════════════════════════════════════
function renderHome() {
  const roundOpts = [3, 5, 7, 10];
  return `
  <div class="page-center">
    <p class="t-label mb12" style="letter-spacing:.1em">a party game of</p>
    <h1 class="t-game-title mb8">wavelength</h1>
    <p class="t-muted mb32">find the frequency. give the perfect clue.</p>
    ${S.error ? `<p style="color:#f87171;font-size:13px;margin-bottom:16px">${he(S.error)}</p>` : ""}
    <div class="col" style="width:280px;gap:10px">
      <input class="inp" placeholder="your name" value="${he(S.nameInput)}"
        oninput="S.nameInput=this.value">
      <div style="display:flex;flex-direction:column;gap:6px">
        <p class="t-label" style="text-align:center">rounds</p>
        <div style="display:flex;gap:6px;justify-content:center">
          ${roundOpts.map(r => `
            <button onclick="S.roundsInput=${r};render()"
              style="flex:1;padding:8px 0;border-radius:6px;font-size:13px;cursor:pointer;
                border:1px solid ${S.roundsInput===r?"#a78bfa":"#222"};
                background:${S.roundsInput===r?"#a78bfa22":"#111"};
                color:${S.roundsInput===r?"#a78bfa":"#555"}">${r}</button>
          `).join("")}
        </div>
      </div>
      <button class="btn btn-primary" onclick="createLobby()">create lobby</button>
      <button class="btn btn-secondary" onclick="S.screen='join';S.error='';render()">join lobby</button>
    </div>
  </div>`;
}

function renderJoin() {
  return `
  <div class="page-full" style="text-align:center;padding-top:52px">
    <button class="btn t-muted mb24" style="background:none;border:none;cursor:pointer;font-size:13px;display:block" onclick="S.screen='home';S.error='';render()">← back</button>
    <h2 style="font-size:22px;font-weight:400;color:#f0f0f0;margin-bottom:6px">join a lobby</h2>
    <p class="t-muted mb24">enter the room code.</p>
    ${S.error ? `<p style="color:#f87171;font-size:13px;margin-bottom:12px">${he(S.error)}</p>` : ""}
    <div style="max-width:220px;margin:0 auto">
      <input class="inp inp-code mb12" placeholder="XXXX" maxlength="4"
        value="${he(S.joinInput)}"
        oninput="S.joinInput=this.value.toUpperCase();this.value=S.joinInput">
      <button class="btn btn-primary" onclick="joinLobby()">join →</button>
    </div>
  </div>`;
}

function renderLobby() {
  const L = S.lobby;
  const isHost = S.playerIdx === 0;
  return `
  <div class="page-full">
    <p class="t-label mb4">room code — share this</p>
    <p class="t-mono mb4">${he(S.code)}</p>
    <p class="t-label mb20" style="color:#555">${L.rounds} rounds</p>
    <p class="t-label mb8">players (${L.players.length}/8)</p>
    <div class="sec mb20">
      ${L.players.map((p, i) => `
        <div class="row-sb" style="padding:9px 0;border-bottom:${i < L.players.length-1 ? "1px solid #161616" : "none"}">
          <div class="row" style="gap:10px">
            ${av(p.name, pc(i), 28)}
            <span style="font-size:14px;color:${i===0?"#e0e0e0":"#888"}">${he(p.name)}</span>
          </div>
          ${i === 0 ? `<span class="t-label">host</span>` : ""}
        </div>`).join("")}
    </div>
    ${isHost
      ? `<button class="btn btn-primary" onclick="startGame()" ${L.players.length < 2 ? "disabled" : ""}>start game →</button>
         ${L.players.length < 2 ? `<p style="font-size:12px;color:#2e2e2e;text-align:center;margin-top:10px">waiting for more players...</p>` : ""}`
      : `<p class="t-muted" style="text-align:center;padding-top:8px">waiting for host to start...</p>`
    }
  </div>`;
}

function renderGame() {
  const L = S.lobby;
  if (!L) return `<div class="page-center"><p class="t-muted">loading...</p></div>`;

  const { phase, itIdx, spec, target, clue, guesses, roundScores, players, round, rounds } = L;
  const itp    = players[itIdx]?.name || "";
  const itCol  = pc(itIdx);
  const isIT   = S.playerIdx === itIdx;
  const ni     = players.map((_,i) => i).filter(i => i !== itIdx);
  const myGuess = guesses?.[S.playerIdx];
  const hasGuessed = myGuess !== undefined;

  // ── psychic gives clue ────────────────────────
  if (phase === "it_clue" && isIT) return `
  <div class="page-full">
    <div class="row-sb mb8">
      <span class="t-label">round ${round} / ${rounds}</span>
      <div class="row" style="gap:6px">${av(itp,itCol,20)}<span class="t-label">you are the psychic</span></div>
    </div>
    <p class="t-muted mb6" style="text-align:center;font-size:12px">the green zone is the target — give a clue that hints where it falls</p>
    ${dialSVG({ showLabels:true, left:spec[0], right:spec[1], showZone:true, target })}
    <div class="row-sb mt4 mb6" style="padding:0 8px">
      <span style="font-size:12px;color:#383838">${he(spec[0].toLowerCase())}</span>
      ${legend()}
      <span style="font-size:12px;color:#383838">${he(spec[1].toLowerCase())}</span>
    </div>
    <div class="sec mb10">
      <p class="t-label mb6">your clue (word or phrase — no numbers)</p>
      <input id="clue-inp" class="inp" placeholder='e.g. "lukewarm"'
        value="${he(S.clueInput)}"
        oninput="S.clueInput=this.value"
        onkeydown="if(event.key==='Enter')submitClue()"
        autofocus>
    </div>
    <button class="btn btn-primary" onclick="submitClue()">submit clue →</button>
  </div>`;

  // ── psychic waiting for clue phase ───────────
  if (phase === "it_clue" && !isIT) return `
  <div class="page-center">
    <p class="t-label mb12">round ${round} of ${rounds}</p>
    <div class="mb12">${av(itp, itCol, 52)}</div>
    <h2 class="t-big mb6">${he(itp)}</h2>
    <p class="t-muted">is thinking of a clue...</p>
  </div>`;

  // ── guessing phase — everyone guesses at once ─
  if (phase === "guest_guess") {
    // psychic watches
    if (isIT) {
      const guessedCount  = Object.keys(guesses || {}).length;
      const totalGuessers = ni.length;
      return `
      <div class="page-center">
        <p class="t-label mb12">round ${round} of ${rounds}</p>
        <div class="sec mb16" style="text-align:center;width:100%">
          <p class="t-label mb4">your clue</p>
          <p class="t-clue">"${he(clue)}"</p>
        </div>
        <p class="t-muted mb16">${guessedCount} / ${totalGuessers} guessed</p>
        <div style="display:flex;flex-direction:column;gap:8px;width:100%">
          ${ni.map(pi => {
            const done = guesses?.[pi] !== undefined;
            return `<div class="row" style="gap:10px;opacity:${done?1:0.35}">
              ${av(players[pi]?.name||"", pc(pi), 28)}
              <span style="font-size:13px;color:${done?"#e0e0e0":"#555"}">${he(players[pi]?.name||"")}</span>
              <span style="margin-left:auto;font-size:12px;color:${done?"#34d399":"#333"}">${done?"locked in":"..."}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }

    // guesser who has already locked in
    if (hasGuessed) {
      const guessedCount  = Object.keys(guesses || {}).length;
      const totalGuessers = ni.length;
      return `
      <div class="page-center">
        <p class="t-label mb12">round ${round} of ${rounds}</p>
        <div class="sec mb16" style="text-align:center;width:100%">
          <p class="t-label mb4">the clue is</p>
          <p class="t-clue">"${he(clue)}"</p>
        </div>
        <p style="color:#34d399;font-size:13px;margin-bottom:20px">✓ locked in!</p>
        <p class="t-muted mb16">${guessedCount} / ${totalGuessers} guessed</p>
        <div style="display:flex;flex-direction:column;gap:8px;width:100%">
          ${ni.map(pi => {
            const done = guesses?.[pi] !== undefined;
            return `<div class="row" style="gap:10px;opacity:${done?1:0.35}">
              ${av(players[pi]?.name||"", pc(pi), 28)}
              <span style="font-size:13px;color:${done?"#e0e0e0":"#555"}">${he(players[pi]?.name||"")}</span>
              <span style="margin-left:auto;font-size:12px;color:${done?"#34d399":"#333"}">${done?"locked in":"..."}</span>
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }

    // guesser's turn to place needle
    return `
    <div class="page-full">
      <div class="row-sb mb6">
        <span class="t-label">round ${round} / ${rounds}</span>
        <span class="t-label">${Object.keys(guesses||{}).length} / ${ni.length} guessed</span>
      </div>
      <div class="sec mb10" style="text-align:center">
        <p class="t-label mb4">the clue is</p>
        <p class="t-clue">"${he(clue)}"</p>
      </div>
      ${dialSVG({ interactive:true, playerPos:S.needlePos, showLabels:true, left:spec?.[0]||"", right:spec?.[1]||"" })}
      <div class="row-sb mt4 mb4" style="padding:0 8px">
        <span style="font-size:12px;color:#383838">${he((spec?.[0]||"").toLowerCase())}</span>
        <p id="pos-label" class="t-label">${Math.round(S.needlePos)}%</p>
        <span style="font-size:12px;color:#383838">${he((spec?.[1]||"").toLowerCase())}</span>
      </div>
      <button class="btn btn-primary mt8" onclick="submitGuess()">lock in →</button>
    </div>`;
  }

  // ── reveal ────────────────────────────────────
  if (phase === "reveal") {
    const ag = Object.entries(guesses).map(([pi,p]) => ({
      pos: p, name: players[+pi]?.name || "", color: pc(+pi)
    }));
    return `
    <div class="page-full">
      <p class="t-label mb8">round ${round} results</p>
      <div class="sec mb8" style="text-align:center">
        <p class="t-label mb4">clue by ${he(itp)}</p>
        <p class="t-clue">"${he(clue)}"</p>
      </div>
      ${dialSVG({ reveal:true, target, guesses:ag, showLabels:true, left:spec[0], right:spec[1] })}
      <div class="mt6 mb10">${legend()}</div>
      <div class="sec">
        <p class="t-label mb4">this round</p>
        ${ni.map(pi => {
          const pts = roundScores?.[pi] ?? 0;
          return `<div class="score-row">
            <div class="row" style="gap:10px">${av(players[pi]?.name||"",pc(pi),26)}<span style="font-size:14px">${he(players[pi]?.name||"")}</span></div>
            <span style="font-weight:500;color:${scoreColor(pts)};font-size:14px">${pts} pts${scoreLabel(pts)}</span>
          </div>`;
        }).join("")}
        <div class="row-sb mt8" style="opacity:.3">
          <span class="t-muted" style="font-size:12px">${he(itp)} (psychic)</span>
          <span class="t-muted" style="font-size:12px">no score this round</span>
        </div>
      </div>
      ${S.playerIdx === 0
        ? `<button class="btn btn-primary mt10" onclick="showLeaderboard()">leaderboard →</button>`
        : `<p class="t-muted mt10" style="text-align:center;font-size:13px">waiting for host...</p>`
      }
    </div>`;
  }

  // ── leaderboard / gameover ────────────────────
  if (phase === "leaderboard" || phase === "gameover") {
    const over   = phase === "gameover";
    const sorted = [...players.map((p,i) => ({ n:p.name, i, s:p.score }))].sort((a,b) => b.s - a.s);
    const maxS   = Math.max(1, ...sorted.map(p => p.s));
    return `
    <div class="page-full">
      <p class="t-label mb12">${over ? "final standings" : `after round ${round} of ${rounds}`}</p>
      ${over ? `
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:40px;margin-bottom:8px">🏆</div>
        <h2 class="t-big mb4">${he(sorted[0].n)} wins!</h2>
        <p class="t-muted">${sorted[0].s} total points</p>
      </div>` : ""}
      <div class="sec">
        ${sorted.map((p, rank) => `
        <div style="margin-bottom:${rank < sorted.length-1 ? 16 : 0}px">
          <div class="row-sb mb6">
            <div class="row" style="gap:8px">
              <span class="t-muted" style="font-size:12px;min-width:14px;text-align:right">${rank+1}</span>
              ${av(p.n, pc(p.i), 26)}
              <span style="font-size:14px;font-weight:${rank===0?500:400};color:${rank===0?"#f0f0f0":"#b0b0b0"}">${he(p.n)}</span>
            </div>
            <span style="font-size:15px;font-weight:500;color:#e0e0e0">${p.s}</span>
          </div>
          <div class="lb-bar" style="margin-left:46px">
            <div class="lb-fill" style="width:${Math.round((p.s/maxS)*100)}%;background:${pc(p.i)}"></div>
          </div>
        </div>`).join("")}
      </div>
      <div class="row mt12" style="gap:8px">
        <button class="btn btn-secondary" style="flex:1" onclick="leaveGame()">leave</button>
        ${S.playerIdx === 0 && !over
          ? `<button class="btn btn-primary" style="flex:2" onclick="nextRound()">round ${round+1} →</button>`
          : !over ? `<p class="t-muted" style="flex:2;text-align:center;font-size:13px;align-self:center">waiting for host...</p>` : ""
        }
      </div>
    </div>`;
  }

  return `<div class="page-center"><p class="t-muted">loading...</p></div>`;
}

// ═══════════════════════════════════════════════════
//  ACTIONS
// ═══════════════════════════════════════════════════
function createLobby() {
  const name = S.nameInput.trim();
  if (!name) { S.error = "enter your name first"; render(); return; }
  socket.emit("create_lobby", { playerName: name, rounds: S.roundsInput });
}

function joinLobby() {
  const name = S.nameInput.trim();
  if (!name) { S.error = "enter your name first"; render(); return; }
  if (S.joinInput.length < 4) { S.error = "enter a 4-letter room code"; render(); return; }
  socket.emit("join_lobby", { code: S.joinInput, playerName: name });
}

function startGame()      { socket.emit("start_game",       { code: S.code }); }
function submitClue()     { const c=(S.clueInput||"").trim(); if(!c)return; socket.emit("submit_clue",{code:S.code,clue:c}); S.clueInput=""; }
function submitGuess()    { socket.emit("submit_guess",     { code: S.code, pos: S.needlePos }); }
function showLeaderboard(){ socket.emit("show_leaderboard", { code: S.code }); }
function nextRound()      { socket.emit("next_round",       { code: S.code }); }
function leaveGame()      { S.screen="home"; S.lobby=null; S.code=""; S.playerIdx=null; render(); }

// ═══════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════
function render() {
  if (_cleanupDial) { _cleanupDial(); _cleanupDial = null; }

  let html = "";
  if      (S.screen === "home")  html = renderHome();
  else if (S.screen === "join")  html = renderJoin();
  else if (S.screen === "lobby") html = renderLobby();
  else if (S.screen === "game")  html = renderGame();

  document.getElementById("app").innerHTML = html;

  const L = S.lobby;
  const shouldShowDial = S.screen === "game"
    && L?.phase === "guest_guess"
    && S.playerIdx !== L?.itIdx
    && L?.guesses?.[S.playerIdx] === undefined;

  if (shouldShowDial) {
    _cleanupDial = initDial(p => {
      const el = document.getElementById("pos-label");
      if (el) el.textContent = Math.round(p) + "%";
    });
  }

  setTimeout(() => { const el = document.querySelector("[autofocus]"); if (el) el.focus(); }, 40);
}

render();