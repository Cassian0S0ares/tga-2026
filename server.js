// Bolão TGA 2026 — servidor sem dependências (Node 18+).
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DB = path.join(ROOT, "data", "db.json"); // { picks: {player:{catId:nominee}}, winners: {catId:nominee} }
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "config.json"), "utf8"));
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const PT = {
  "Game of the Year": "Jogo do Ano", "Best Game Direction": "Melhor Direção", "Best Narrative": "Melhor Narrativa",
  "Best Art Direction": "Melhor Direção de Arte", "Best Score and Music": "Melhor Trilha Sonora e Música",
  "Best Audio Design": "Melhor Design de Áudio", "Best Performance": "Melhor Atuação", "Games for Impact": "Jogos de Impacto",
  "Innovation in Accessibility": "Inovação em Acessibilidade", "Best Ongoing Game": "Melhor Jogo em Andamento (Live Service)",
  "Best Community Support": "Melhor Apoio à Comunidade", "Best Independent Game": "Melhor Jogo Indie",
  "Best Debut Indie Game": "Melhor Estreia Indie", "Best Mobile Game": "Melhor Jogo Mobile", "Best VR/AR Game": "Melhor Jogo VR/AR",
  "Best Action Game": "Melhor Jogo de Ação", "Best Action/Adventure Game": "Melhor Jogo de Ação/Aventura",
  "Best Role Playing Game": "Melhor RPG", "Best Fighting Game": "Melhor Jogo de Luta", "Best Family Game": "Melhor Jogo Família",
  "Best Sim/Strategy Game": "Melhor Simulação/Estratégia", "Best Sports/Racing Game": "Melhor Jogo de Esporte/Corrida",
  "Best Multiplayer Game": "Melhor Multiplayer", "Best Adaptation": "Melhor Adaptação", "Most Anticipated Game": "Jogo Mais Aguardado",
  "Content Creator of the Year": "Criador de Conteúdo do Ano", "Best User Creation": "Melhor Criação de Usuário",
  "Best Esports Game": "Melhor Jogo de eSports", "Best Esports Athlete": "Melhor Atleta de eSports", "Best Esports Team": "Melhor Time de eSports",
  "Players' Voice": "Voz dos Jogadores",
};
const UPSET = config.upsetMultiplier || 3;
const marketSnapshot = require("./data/doxa-2026.json");
const categories = require("./data/categories.js").map(([name, nominees]) => {
  const id = slug(name);
  const weight = config.weights?.[id] || config.defaultWeight || 1;
  const market = marketSnapshot[name];
  const prices = nominees.map(n => market?.percent[n]);
  const ranked = prices.every(Number.isFinite) ? [...prices].sort((a, b) => b - a) : [];
  const favorites = nominees.filter(n => ranked.length && market.percent[n] === ranked[0]);
  const pointsByNominee = Object.fromEntries(nominees.map(nominee => {
    const price = market?.percent[nominee];
    const underdog = price <= 15 && price < ranked[1] && price <= ranked.at(-2);
    return [nominee, weight * (underdog ? UPSET : 1)];
  }));
  return { id, name: PT[name] || name, nominees, market, favorites, favorite: favorites[0] || null, weight, pointsByNominee };
});

function loadDb() {
  let db;
  try {
    db = JSON.parse(fs.readFileSync(DB, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { picks: {}, winners: {} };
    throw error;
  }
  for (const { name, previousName } of config.players) {
    if (previousName && db.picks[previousName]) {
      db.picks[name] = { ...db.picks[previousName], ...db.picks[name] };
      delete db.picks[previousName];
    }
  }
  return db;
}
const saveDb = (db) => { // escrita atômica
  fs.mkdirSync(path.dirname(DB), { recursive: true });
  fs.writeFileSync(DB + ".tmp", JSON.stringify(db, null, 2));
  fs.renameSync(DB + ".tmp", DB);
};
const locked = () => Date.now() >= new Date(config.lockAt).getTime();

function score(db) {
  const out = {};
  for (const p of config.players) {
    out[p.name] = categories.reduce((t, c) => t + (db.winners[c.id] && db.picks[p.name]?.[c.id] === db.winners[c.id] ? c.pointsByNominee[db.winners[c.id]] : 0), 0);
  }
  return out;
}

function votersFor(db, categoryId) {
  return config.players.filter(p => db.picks[p.name]?.[categoryId]).map(p => p.name);
}

function state(db) {
  const isLocked = locked();
  const progress = {};
  for (const p of config.players) progress[p.name] = Object.keys(db.picks[p.name] || {}).length;
  return {
    categories, players: config.players.map((p) => p.name),
    renamedPlayers: Object.fromEntries(config.players.filter(p => p.previousName).map(p => [p.previousName, p.name])),
    voters: Object.fromEntries(categories.map(c => [c.id, votersFor(db, c.id)])),
    lockAt: config.lockAt, upset: UPSET, locked: isLocked, progress,
    winners: db.winners, scores: score(db),
    // palpites alheios só aparecem depois do prazo (evita copiar)
    picks: isLocked ? db.picks : null,
  };
}

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": /^(text\/|application\/json)/.test(type) ? type + "; charset=utf-8" : type });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok, no) => {
  let d = ""; req.on("data", (c) => { d += c; if (d.length > 1e6) req.destroy(); });
  req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch (e) { no(e); } });
});

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && url.pathname === "/api/state") return send(res, 200, state(loadDb()));

    if (req.method === "GET" && url.pathname === "/api/mine") { // palpites do próprio jogador
      const player = config.players.find((p) => p.name === url.searchParams.get("player"));
      if (!player) return send(res, 404, { error: "Jogador não encontrado" });
      return send(res, 200, loadDb().picks[player.name] || {});
    }

    if (req.method === "PUT" && url.pathname === "/api/pick") {
      const { player, categoryId, nominee, group, review, previousNominee } = await readBody(req);
      if (locked()) return send(res, 403, { error: "Palpites encerrados" });
      if (!config.players.some(p => p.name === player)) return send(res, 404, { error: "Jogador não encontrado" });
      const category = categories.find(c => c.id === categoryId);
      if (!category?.nominees.includes(nominee)) return send(res, 400, { error: "Indicado inválido para esta categoria" });
      const db = loadDb();
      if (group) {
        const voters = votersFor(db, categoryId);
        const next = config.players.find(p => !voters.includes(p.name));
        if (review ? !voters.includes(player) : next?.name !== player) {
          return send(res, 409, { error: "A vez mudou. Confira quem vota agora." });
        }
      }
      if (review && previousNominee !== undefined && db.picks[player]?.[categoryId] !== previousNominee && db.picks[player]?.[categoryId] !== nominee) {
        return send(res, 409, { error: "O voto já foi alterado. Abra a edição novamente para ver a escolha atual." });
      }
      db.picks[player] ??= {};
      db.picks[player][categoryId] = nominee;
      saveDb(db);
      return send(res, 200, group ? state(db) : { saved: Object.keys(db.picks[player]).length });
    }

    if (req.method === "PUT" && url.pathname === "/api/picks") {
      if (locked()) return send(res, 403, { error: "Palpites encerrados" });
      const { player: name, picks } = await readBody(req);
      const player = config.players.find((p) => p.name === name);
      if (!player) return send(res, 404, { error: "Jogador não encontrado" });
      const clean = {};
      for (const c of categories) if (picks?.[c.id] && c.nominees.includes(picks[c.id])) clean[c.id] = picks[c.id];
      const db = loadDb(); db.picks[name] = clean; saveDb(db);
      return send(res, 200, { saved: Object.keys(clean).length });
    }

    if (req.method === "PUT" && url.pathname === "/api/winner") {
      const { token, categoryId, nominee } = await readBody(req);
      if (token !== config.adminToken) return send(res, 401, { error: "Token inválido" });
      if (!locked()) return send(res, 403, { error: "A votação ainda está aberta." });
      const category = categories.find(c => c.id === categoryId);
      if (!category?.nominees.includes(nominee)) return send(res, 400, { error: "Indicado inválido para esta categoria." });
      const db = loadDb();
      if (db.winners[categoryId] && db.winners[categoryId] !== nominee) {
        return send(res, 409, { error: "Esta categoria já foi anunciada. Para corrigir o vencedor, use Admin." });
      }
      db.winners[categoryId] = nominee;
      saveDb(db);
      return send(res, 200, state(db));
    }

    if (req.method === "PUT" && url.pathname === "/api/winners") { // admin: informar vencedores
      const { token, winners, previousWinners } = await readBody(req);
      if (token !== config.adminToken) return send(res, 401, { error: "Token inválido" });
      const clean = {};
      for (const c of categories) if (winners?.[c.id] && c.nominees.includes(winners[c.id])) clean[c.id] = winners[c.id];
      const db = loadDb();
      if (previousWinners && categories.some(c => previousWinners[c.id] !== db.winners[c.id])) {
        return send(res, 409, { error: "O placar mudou. Recarregue a página antes de editar os resultados." });
      }
      db.winners = clean;
      saveDb(db);
      return send(res, 200, { saved: Object.keys(clean).length });
    }

    // arquivos estáticos
    const file = path.join(ROOT, "public", url.pathname === "/" ? "index.html" : url.pathname);
    if (file.startsWith(path.join(ROOT, "public")) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".ttf": "font/ttf" };
      return send(res, 200, fs.readFileSync(file), types[path.extname(file)] || "application/octet-stream");
    }
    send(res, 404, { error: "não encontrado" });
  } catch (e) { send(res, 500, { error: String(e.message || e) }); }
}).listen(config.port, () => console.log(`Bolão TGA 2026 em http://localhost:${config.port}`));
