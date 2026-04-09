const express  = require("express");
const http      = require("http");
const { Server } = require("socket.io");

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"] }
});

const PORT = process.env.PORT || 3001;

// ── Spectrum pairs ────────────────────────────────
const SPECS = [
  ["hot","cold"], ["loud","quiet"], ["fast","slow"], ["big","small"],
  ["heavy","light"], ["dark","bright"], ["old","new"], ["hard","soft"],
  ["rough","smooth"], ["wet","dry"], ["sharp","dull"], ["sweet","sour"],
  ["brave","cowardly"], ["funny","serious"], ["rich","poor"],
  ["happy","sad"], ["complex","simple"], ["beautiful","ugly"],
  ["famous","unknown"], ["powerful","weak"], ["good","evil"],
  ["boring","exciting"], ["natural","artificial"], ["safe","dangerous"],
  ["healthy","unhealthy"], ["realistic","unrealistic"], ["classy","trashy"],
  ["overrated","underrated"], ["chaotic","organized"], ["wholesome","cursed"],
];

function randSpec() { return SPECS[Math.floor(Math.random() * SPECS.length)]; }
function randCode() { return Math.random().toString(36).slice(2,6).toUpperCase(); }
function score(pos, target) {
  const d = Math.abs(pos - target);
  if (d <= 10) return 4;
  if (d <= 20) return 3;
  if (d <= 30) return 2;
  return 0;
}

// ── In-memory lobbies ─────────────────────────────
// { code: { players:[{name,score,socketId}], phase, itIdx, curGuest,
//            spec, target, clue, guesses, roundScores, round, rounds } }
const lobbies = {};

function lobbyView(L) {
  // strip socketIds before sending to clients
  return {
    ...L,
    players: L.players.map(({ name, score }) => ({ name, score }))
  };
}

function broadcast(code) {
  const L = lobbies[code];
  if (!L) return;
  io.to(code).emit("state", lobbyView(L));
}

// ── Connection ────────────────────────────────────
io.on("connection", (socket) => {

  // ── create_lobby ──────────────────────────────
  socket.on("create_lobby", ({ playerName, rounds = 5 }) => {
    const name = String(playerName || "").trim().slice(0, 20);
    if (!name) return socket.emit("err", "enter a name");

    let code;
    do { code = randCode(); } while (lobbies[code]);

    lobbies[code] = {
      players:     [{ name, score: 0, socketId: socket.id }],
      phase:       "lobby",
      itIdx:       0,
      curGuest:    null,
      spec:        null,
      target:      null,
      clue:        "",
      guesses:     {},
      roundScores: {},
      round:       0,
      rounds:      Math.max(1, Math.min(20, rounds || 5)),
    };

    socket.join(code);
    socket.emit("joined", { code, playerIdx: 0, lobby: lobbyView(lobbies[code]) });
  });

  // ── join_lobby ────────────────────────────────
  socket.on("join_lobby", ({ code, playerName }) => {
    const name = String(playerName || "").trim().slice(0, 20);
    const L    = lobbies[String(code).toUpperCase()];
    if (!name)  return socket.emit("err", "enter a name");
    if (!L)     return socket.emit("err", "room not found");
    if (L.phase !== "lobby") return socket.emit("err", "game already started");
    if (L.players.length >= 8) return socket.emit("err", "lobby is full");

    const idx = L.players.length;
    L.players.push({ name, score: 0, socketId: socket.id });

    socket.join(code.toUpperCase());
    socket.emit("joined", { code: code.toUpperCase(), playerIdx: idx, lobby: lobbyView(L) });
    broadcast(code.toUpperCase());
  });

  // ── start_game ────────────────────────────────
  socket.on("start_game", ({ code }) => {
    const L = lobbies[code];
    if (!L) return;
    if (L.players.length < 2) return socket.emit("err", "need at least 2 players");
    if (L.players[0].socketId !== socket.id) return socket.emit("err", "only host can start");

    L.round   = 1;
    L.itIdx   = 0;
    L.phase   = "it_clue";
    L.spec    = randSpec();
    L.target  = Math.round(Math.random() * 96 + 2); // 2–98
    L.clue    = "";
    L.guesses = {};
    L.roundScores = {};
    // reset scores
    L.players.forEach(p => { p.score = 0; });

    broadcast(code);
  });

  // ── submit_clue ───────────────────────────────
  socket.on("submit_clue", ({ code, clue }) => {
    const L = lobbies[code];
    if (!L || L.phase !== "it_clue") return;
    const idx = L.players.findIndex(p => p.socketId === socket.id);
    if (idx !== L.itIdx) return socket.emit("err", "you are not the psychic");

    L.clue = String(clue).trim().slice(0, 60);
    L.phase    = "guest_guess";
    L.guesses  = {};
    L.roundScores = {};

    // First non-IT player goes first
    L.curGuest = nextGuest(L, null);

    broadcast(code);
  });

  // ── submit_guess ──────────────────────────────
  socket.on("submit_guess", ({ code, pos }) => {
    const L = lobbies[code];
    if (!L || L.phase !== "guest_guess") return;
    const idx = L.players.findIndex(p => p.socketId === socket.id);
    if (idx !== L.curGuest) return socket.emit("err", "not your turn");

    const p = Math.max(0, Math.min(100, Number(pos) || 50));
    L.guesses[idx]     = p;
    L.roundScores[idx] = score(p, L.target);
    L.players[idx].score += L.roundScores[idx];

    const next = nextGuest(L, idx);
    if (next === null) {
      // all guessed → reveal
      L.phase = "reveal";
    } else {
      L.curGuest = next;
    }

    broadcast(code);
  });

  // ── show_leaderboard (host advances from reveal) ──
  socket.on("show_leaderboard", ({ code }) => {
    const L = lobbies[code];
    if (!L || L.phase !== "reveal") return;
    if (L.players[0].socketId !== socket.id) return;

    if (L.round >= L.rounds) {
      L.phase = "gameover";
    } else {
      L.phase = "leaderboard";
    }
    broadcast(code);
  });

  // ── next_round ────────────────────────────────
  socket.on("next_round", ({ code }) => {
    const L = lobbies[code];
    if (!L || L.phase !== "leaderboard") return;
    if (L.players[0].socketId !== socket.id) return;

    L.round++;
    L.itIdx      = L.round % L.players.length; // rotate psychic
    L.phase      = "it_clue";
    L.spec       = randSpec();
    L.target     = Math.round(Math.random() * 96 + 2);
    L.clue       = "";
    L.guesses    = {};
    L.roundScores = {};
    L.curGuest   = null;

    broadcast(code);
  });

  // ── disconnect ────────────────────────────────
  socket.on("disconnect", () => {
    for (const code of Object.keys(lobbies)) {
      const L = lobbies[code];
      const idx = L.players.findIndex(p => p.socketId === socket.id);
      if (idx === -1) continue;

      // Remove player
      L.players.splice(idx, 1);

      if (L.players.length === 0) {
        delete lobbies[code];
        break;
      }

      // Reassign socketIds indices (scores stay, just reindex)
      io.to(code).emit("state", lobbyView(L));
      break;
    }
  });
});

// ── helpers ───────────────────────────────────────
function nextGuest(L, currentIdx) {
  const all = L.players.map((_, i) => i).filter(i => i !== L.itIdx);
  if (currentIdx === null) return all[0] ?? null;
  const pos = all.indexOf(currentIdx);
  return all[pos + 1] ?? null;
}

server.listen(PORT, () => console.log(`wavelength server on :${PORT}`));