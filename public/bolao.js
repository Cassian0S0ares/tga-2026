'use strict';

const main = document.querySelector('main');
const portraits = ['astronauta', 'cavaleiro', 'mago'];
const paths = {
  ticket: '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4zM15 7v2m0 3v1m0 3v1"/>',
  trophy: '<path d="M7 3h10v5c0 4-2 6-5 6s-5-2-5-6zM7 5H3v2a4 4 0 0 0 5 4m9-6h4v2a4 4 0 0 1-5 4m-4 3v5m-4 2h8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>'
};
const icon = key => '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24">' + paths[key] + '</svg>';
const esc = value => String(value).replace(/[&<>"]/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'}[ch]));
const avatar = name => '/art/' + portraits[state.players.indexOf(name) % portraits.length] + '.webp';
let state, art = {}, ballotCategories = [], categoryIndex = 0, featuredIndex = 0;
let ballotMessage = '', editingVote = null, saving = false;
const route = () => ['palpites','cerimonia','placar','gestao','retrospectiva'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';

async function api(path, body) {
  const options = body ? {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {};
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Falha na conexão.'), {status:response.status});
  return result;
}

function deadline() {
  const format = options => new Intl.DateTimeFormat('pt-BR', {...options,timeZone:'America/Sao_Paulo'}).format(new Date(state.lockAt));
  return format({day:'numeric',month:'short'}).replace(/\.$/,'') + ' às ' + format({hour:'2-digit',minute:'2-digit'}) + ' (Brasília)';
}

function render() {
  if (!state) return;
  const page = route();
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === '#' + (page === 'retrospectiva' ? 'cerimonia' : page)) a.setAttribute('aria-current','page');
    else a.removeAttribute('aria-current');
  });
  main.innerHTML = ({inicio:home, palpites:ballot, cerimonia:ceremony, placar:board, gestao:admin, retrospectiva:retrospective})[page]();
}

function participants() {
  return '<div class="people">' + state.players.map(name => {
    const done = state.progress[name] || 0, total = state.categories.length;
    return '<article class="person"><img class="avatar" src="' + avatar(name) + '" alt=""><span class="person-info"><span class="person-name">' + esc(name) + '</span><span class="fine">' + done + ' de ' + total + ' palpites</span><span class="progress"><i style="width:' + (100 * done / total) + '%"></i></span></span></article>';
  }).join('') + '</div>';
}

function categorySelect(id, index, categories = state.categories) {
  return '<label class="picker">Categoria <select id="' + id + '">' + categories.map((c,i) =>
    '<option value="' + i + '"' + (i === index ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select></label>';
}

function nominees(c, editable = false) {
  return '<div class="gallery" role="group" aria-label="' + esc(c.name) + '">' + c.nominees.map(name => {
    const img = art[name] ? '<img src="' + esc(art[name]) + '" loading="lazy" alt="">' : '<div class="art-empty"></div>';
    const caption = '<span class="caption">' + esc(name) + '</span>';
    if (!editable) return '<article class="nominee">' + img + caption + '</article>';
    const selected = editingVote?.nominee === name;
    const marker = selected ? '<span class="saved-pick">Voto atual</span>' : '';
    return '<button type="button" class="nominee" data-vote="' + esc(name) + '"' + (saving ? ' disabled' : '') +
      '>' + img + caption + marker + '</button>';
  }).join('') + '</div>';
}

function home() {
  return '<section class="hero"><div class="wrap"><p class="overline">The Game Awards · 2026</p><h1>Bolão do<em>Game Awards</em></h1><p class="hero-copy">Quem leva o troféu na noite de 10 de dezembro?</p><div class="actions"><a class="btn" href="#palpites">' + icon('ticket') + (state.locked ? 'Ver palpites' : 'Votar em grupo') + '</a><a class="subtle" href="#placar">Ver placar</a></div></div></section>' +
    '<div class="eventline"><div class="wrap"><span class="status"><i class="dot"></i>' + (state.locked ? 'Palpites encerrados' : 'Palpites abertos') + '</span><span>' + icon('calendar') + 'Prazo · ' + deadline() + '</span><span>' + icon('trophy') + state.categories.length + ' categorias</span></div></div>' +
    '<div class="wrap"><section class="section"><div class="heading"><h2>Participantes</h2><small>' + state.players.length + ' jogadores</small></div>' + participants() + '</section>' +
    '<section class="section"><div class="heading"><h2>Os indicados</h2></div><div class="filters">' + categorySelect('feature',featuredIndex) + '</div>' + nominees(state.categories[featuredIndex]) + '</section></div>';
}

function intro(label,title) {
  return '<p class="overline">' + label + '</p><h1 class="page-title">' + title + '</h1>';
}

function currentVoter(category) {
  return state.players.find(name => !state.voters[category.id].includes(name));
}

function nextPendingCategory(start) {
  for (let offset = 0; offset < ballotCategories.length; offset++) {
    const index = (start + offset) % ballotCategories.length;
    if (state.voters[ballotCategories[index].id].length < state.players.length) return index;
  }
  return -1;
}

function selectBallotCategory(index) {
  categoryIndex = index;
  editingVote = null;
  ballotMessage = '';
  localStorage.tgaGroupCategory = ballotCategories[index].id;
}

function ballot() {
  const c = ballotCategories[categoryIndex];
  const heading = '<section class="wrap inner-page">' + intro('Votação em grupo',esc(c.name));
  const selector = '<div class="filters">' + categorySelect('ballot-category',categoryIndex,ballotCategories) +
    '<span class="fine">Categoria ' + (categoryIndex + 1) + ' de ' + ballotCategories.length + '</span></div>';
  if (state.locked) return heading + selector + '<p class="summary">Palpites encerrados.</p>' +
    pickCards(c,state.winners[c.id],false) + '<div class="actions"><a class="btn" href="#cerimonia">Ver cerimônia</a></div></section>';
  if (!state.voters) return heading + '<p>Reinicie o servidor para abrir a votação em grupo.</p></section>';
  const voter = editingVote?.player || currentVoter(c);
  const editors = state.voters[c.id].map(name => '<button class="subtle" type="button" data-edit-player="' +
    esc(name) + '">Alterar voto de ' + esc(name) + '</button>').join('');
  const editActions = editors && !editingVote ? '<div class="vote-edits">' + editors + '</div>' : '';
  const status = '<p role="status" id="notice">' + esc(ballotMessage) + '</p>';
  if (!voter) {
    const pending = nextPendingCategory(categoryIndex + 1);
    const title = pending < 0 ? 'Votação concluída' : 'Categoria concluída';
    return heading + selector + '<h2>' + title + '</h2><p class="summary">' +
      (pending < 0 ? 'Todos os palpites do grupo foram salvos.' : 'Todos já votaram nesta categoria.') +
      '</p><div class="actions">' + (pending < 0 ? '' : '<button class="btn" data-action="resume">Continuar votação</button>') +
      '</div>' + editActions + status + '</section>';
  }
  if (editingVote) return heading + selector + '<div class="ballotbar"><h2 id="turn" tabindex="-1">Alterar voto de ' +
    esc(voter) + '</h2><button class="subtle" data-action="cancel-edit">Cancelar</button></div>' +
    status + nominees(c,true) + '</section>';
  const queue = state.players.map(name => '<li' + (name === voter ? ' aria-current="step"' : '') + '>' + esc(name) + '</li>').join('');
  return heading + selector + '<div class="ballotbar"><div class="who"><img src="' + avatar(voter) +
    '" alt=""><h2 id="turn" tabindex="-1">Vez de ' + esc(voter) + '</h2></div><ol class="vote-queue" aria-label="Ordem de votação">' +
    queue + '</ol></div>' + status + editActions + nominees(c,true) + '</section>';
}

async function groupVote(nominee) {
  const c = ballotCategories[categoryIndex];
  const edit = editingVote;
  const player = edit?.player || currentVoter(c);
  if (!player || saving || state.locked) return;
  saving = true;
  main.querySelectorAll('button, select').forEach(el => { el.disabled = true; });
  notice('Salvando palpite…');
  try {
    state = await api('/api/pick', {player, categoryId:c.id, nominee, group:true, review:!!edit, previousNominee:edit?.nominee});
    editingVote = null;
    if (!edit && !currentVoter(c)) {
      const next = nextPendingCategory(categoryIndex + 1);
      if (next >= 0) selectBallotCategory(next);
    }
    ballotMessage = 'Palpite de ' + player + (edit ? ' atualizado.' : ' salvo.');
  } catch (error) {
    ballotMessage = error.message;
    if (error.status === 409 || error.status === 403) {
      state = await api('/api/state').catch(() => state);
      editingVote = null;
    }
  } finally {
    saving = false;
    if (route() === 'palpites' || route() === 'inicio') render();
    if (route() === 'palpites') document.querySelector('#turn')?.focus();
  }
}

let ceremonyIndex = 0, simulatedWinner = '', hostToken = '', refreshTimer;
let announcing = false, justAnnounced = '';
const listNames = names => new Intl.ListFormat('pt-BR', {type:'conjunction'}).format(names);

function outcome(c, nominee) {
  const announced = state.winners[c.id] === nominee;
  return state.players.map(name => {
    const pick = state.picks[name]?.[c.id];
    const gain = pick === nominee ? c.pointsByNominee[nominee] : 0;
    const total = state.scores[name] + (announced ? 0 : gain);
    return {name, pick, gain, total};
  });
}

function leaders(rows) {
  const high = Math.max(...rows.map(r => r.total));
  return rows.filter(r => r.total === high).map(r => r.name);
}

function leadText(rows, projected) {
  const first = leaders(rows);
  const names = esc(listNames(first));
  const pts = Math.max(...rows.map(r => r.total));
  if (first.length === 1 && !projected && justAnnounced === ballotCategories[ceremonyIndex].id) {
    const previous = leaders(rows.map(r => ({name:r.name, total:r.total - r.gain})));
    if (previous.length !== 1 || previous[0] !== first[0]) return names + ' assumiu a liderança com ' + pts + ' pts.';
  }
  if (first.length > 1) return names + (projected ? ' dividiriam' : ' dividem') + ' a liderança com ' + pts + ' pts.';
  const before = leaders(state.players.map(name => ({name, total:state.scores[name]})));
  const stays = before.length === 1 && before[0] === first[0];
  const verb = projected ? (stays ? ' seguiria na liderança' : ' assumiria a liderança') : ' lidera';
  return names + verb + ' com ' + pts + ' pts.';
}

function pickCards(c, winner, showScore = true) {
  return '<div class="ceremony-picks">' + state.players.map(name => {
    const pick = state.picks[name]?.[c.id];
    const hit = winner && pick === winner;
    const gain = hit ? c.pointsByNominee[winner] : 0;
    const result = winner && showScore ? '<span class="' + (hit ? 'hit' : 'fine') + '">' +
      (hit ? 'Acertou' : pick ? 'Errou' : 'Sem palpite') + ' · +' + gain + ' pts</span>' : '';
    return '<article class="ceremony-pick"><div class="who"><img alt="" src="' + avatar(name) + '"><b>' +
      esc(name) + '</b>' + (showScore ? '<span class="counter">' + state.scores[name] + ' pts</span>' : '') + '</div><h3>'  +
      esc(pick || 'Sem palpite') + '</h3>' + result + '</article>';
  }).join('') + '</div>';
}

function projectedResult(c, nominee) {
  const rows = outcome(c, nominee);
  const gains = rows.filter(row => row.gain);
  const reward = gains.length ? esc(listNames(gains.map(row => row.name))) +
    (gains.length === 1 ? ' ganharia ' : ' ganhariam ') + c.pointsByNominee[nominee] +
    (gains.length === 1 ? ' pts.' : ' pts cada.') : 'Ninguém pontuaria.';
  return '<h3>Se ' + esc(nominee) + ' vencer</h3><p>' + reward + ' ' + leadText(rows,true) +
    '</p><ul class="projected-totals">' + rows.map(r => '<li>' + esc(r.name) + ' · ' + r.total +
    ' pts (+' + r.gain + ')</li>').join('') + '</ul>';
}

function ceremony() {
  const heading = intro('The Game Awards · 2026','Cerimônia');
  if (!state.locked || !state.picks) {
    return '<section class="wrap inner-page">' + heading + '<p class="summary">A revelação dos palpites e as simulações abrem em ' +
      deadline() + ', quando a votação encerrar.</p><a class="subtle" href="#palpites">Votação</a></section>';
  }
  const c = ballotCategories[ceremonyIndex];
  const winner = state.winners[c.id];
  const head = '<section class="wrap inner-page">' + heading + '<div class="filters">' +
    categorySelect('ceremony-category',ceremonyIndex,ballotCategories) + '<span class="counter">' +
    Object.keys(state.winners).length + ' de ' + state.categories.length + ' resultados anunciados</span></div>';
  if (winner) {
    return head + '<div class="revealed" role="status"><img src="' + esc(art[winner]) +
      '" alt=""><div><p class="overline">Vencedor · ' + esc(c.name) + '</p><h2>' + esc(winner) +
      '</h2><p>' + leadText(outcome(c,winner),false) + '</p></div></div>' + pickCards(c,winner) +
      '<div class="actions"><a class="subtle" href="#placar">Ver placar completo</a>' + recapLink() + '</div></section>';
  }
  if (!c.nominees.includes(simulatedWinner)) simulatedWinner = c.nominees[0];
  const options = c.nominees.map(n => '<button type="button" class="scenario" data-scenario="' + esc(n) +
    '" aria-pressed="' + (n === simulatedWinner) + '"><img alt="" src="' + esc(art[n]) + '"><span>' +
    esc(n) + '</span></button>').join('');
  return head + pickCards(c) + '<section class="section"><div class="heading"><h2>O que muda se…?</h2></div>' +
    '<p class="summary">Escolha um indicado para simular o placar.</p><div class="scenarios">' + options +
    '</div><div id="projection" aria-live="polite">' + projectedResult(c,simulatedWinner) + '</div></section>' +
    '<form id="announce" class="announce"><label for="host-token"' + (hostToken ? ' hidden' : '') +
    '>Token de administrador</label><input id="host-token" type="password" autocomplete="off"' +
    (hostToken ? ' hidden' : ' required') + '><button class="btn">Confirmar vencedor · ' + esc(simulatedWinner) + '</button>' +
    '<span role="status" id="notice"></span></form></section>';
}

async function announceWinner(form) {
  if (announcing) return;
  const c = ballotCategories[ceremonyIndex];
  const nominee = simulatedWinner;
  const token = hostToken || form.querySelector('input').value;
  announcing = true;
  const controls = main.querySelectorAll('button, select, input');
  controls.forEach(el => { el.disabled = true; });
  try {
    state = await api('/api/winner', {token, categoryId:c.id, nominee});
    hostToken = token;
    justAnnounced = c.id;
    if (route() === 'cerimonia' && nightComplete()) location.hash = 'retrospectiva';
    else if (route() === 'cerimonia' || route() === 'placar') render();
  } catch (error) {
    if (error.status === 401) {
      hostToken = '';
      form.querySelector('label').hidden = false;
      form.querySelector('input').hidden = false;
      form.querySelector('input').required = true;
    }
    if (error.status === 409 && form.isConnected) {
      try {
        state = await api('/api/state');
        if (form.isConnected) render();
      } catch { /* The operator can retry the original request. */ }
    }
    if (form.isConnected) notice(error.message);
  } finally {
    announcing = false;
    controls.forEach(el => { el.disabled = false; });
  }
}

function board() {
  const rank = state.players.slice().sort((a,b) => state.scores[b]-state.scores[a]);
  const rows = rank.map(name => '<div class="rank"><span class="pos">' + (rank.findIndex(n => state.scores[n] === state.scores[name]) + 1) + 'º</span><div class="who"><img src="' + avatar(name) + '" alt=""><strong>' + esc(name) + '</strong></div><span>' + state.scores[name] + ' pts</span></div>').join('');
  const comparison = state.picks ? '<div class="table-wrap"><table><thead><tr><th>Categoria</th>' + state.players.map(p => '<th>' + esc(p) + '</th>').join('') + '<th>Vencedor</th></tr></thead><tbody>' + state.categories.map(c => {
    const w = state.winners[c.id], values = state.players.map(p => state.picks[p]?.[c.id]);
    return '<tr><th scope="row">' + esc(c.name) + (values.every(v => v && v === values[0]) ? ' · todos iguais' : '') + '</th>' + values.map(v => '<td class="' + (w ? (w === v ? 'hit' : 'miss') : '') + '">' + (w && w === v ? '✓ ' : '') + esc(v || '—') + '</td>').join('') + '<td>' + esc(w || 'A definir') + '</td></tr>';
  }).join('') + '</tbody></table></div>' : '<p class="summary">A comparação entre os jogadores abre após o prazo dos palpites, em ' + deadline() + '.</p>';
  return '<section class="wrap inner-page">' + intro('Resultado do bolão','Placar geral') + recapLink() + '<p class="summary">' + Object.keys(state.winners).length + ' de ' + state.categories.length + ' vencedores anunciados. Cada acerto entra no placar após o anúncio do vencedor.</p>' + rows + '<div class="section"><div class="heading"><h2>Comparação de palpites</h2></div>' + comparison + '</div></section>';
}

function admin() {
  return '<section class="wrap inner-page">' + intro('Administração','Apuração dos vencedores') + '<p class="summary">Registre o vencedor de cada categoria conforme o anúncio da cerimônia.</p><form id="results"><div class="admin-top"><label for="token">Token de administrador</label><input id="token" type="password" autocomplete="off" required></div>' + state.categories.map(c => '<label class="category-row">' + esc(c.name) + '<select name="' + c.id + '"><option value="">Aguardando anúncio</option>' + c.nominees.map(n => '<option' + (n === state.winners[c.id] ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></label>').join('') + '<div class="paging"><button class="btn">Salvar vencedores</button><span id="notice" role="status"></span></div></form></section>';
}

function notice(message) {
  const el = document.querySelector('#notice');
  if (el) el.textContent = message;
}

main.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || saving) return;
  if (button.hasAttribute('data-recap')) {
    recapIndex = Number(button.dataset.recap);
    render();
    document.querySelector('#award-panel')?.focus({preventScroll:true});
    window.scrollTo(0,0);
    return;
  }
  if (button.dataset.scenario) {
    simulatedWinner = button.dataset.scenario;
    document.querySelectorAll('[data-scenario]').forEach(el => el.setAttribute('aria-pressed', String(el === button)));
    document.querySelector('#announce button').textContent = 'Confirmar vencedor · ' + simulatedWinner;
    document.querySelector('#projection').innerHTML = projectedResult(ballotCategories[ceremonyIndex], simulatedWinner);
    return;
  }
  if (button.dataset.vote && event.detail < 2) return groupVote(button.dataset.vote);
  if (button.dataset.editPlayer) {
    const player = button.dataset.editPlayer;
    const c = ballotCategories[categoryIndex];
    button.disabled = true;
    try {
      const picks = await api('/api/mine?player=' + encodeURIComponent(player));
      if (!button.isConnected || saving) return;
      if (!picks[c.id]) throw new Error('Este jogador ainda não votou nesta categoria.');
      editingVote = {player, nominee:picks[c.id]};
      ballotMessage = 'Escolha um indicado para salvar o voto.';
      render();
      document.querySelector('#turn').focus();
    } catch (error) {
      if (button.isConnected) notice(error.message);
    } finally { button.disabled = false; }
  }
  if (button.dataset.action === 'cancel-edit') {
    editingVote = null;
    ballotMessage = '';
    render();
  }
  if (button.dataset.action === 'resume') {
    const next = nextPendingCategory(categoryIndex + 1);
    if (next >= 0) selectBallotCategory(next);
    render();
  }
});

main.addEventListener('change', async event => {
  const field = event.target;
  if (field.id === 'ceremony-category') {
    justAnnounced = '';
    ceremonyIndex = Number(field.value);
    simulatedWinner = '';
  } else if (field.id === 'feature') featuredIndex = Number(field.value);
  else if (field.id === 'ballot-category' && !saving) selectBallotCategory(Number(field.value));
  else return;
  render();
  document.getElementById(field.id).focus({preventScroll:true});
});

main.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'announce') return announceWinner(form);
  if (form.id !== 'results') return;
  const winners = Object.fromEntries([...new FormData(form)].filter(([,value]) => value));
  const submit = form.querySelector('button');
  submit.disabled = true;
  try {
    const wasComplete = nightComplete();
    await api('/api/winners',{token:form.querySelector('#token').value,winners,previousWinners:state.winners});
    state = await api('/api/state');
    if (form.isConnected && !wasComplete && nightComplete()) location.hash = 'retrospectiva';
    else if (form.isConnected) notice('Vencedores salvos. O placar foi atualizado.');
  } catch (error) { if (form.isConnected) notice(error.message); }
  finally { submit.disabled = false; }
});

async function refreshCeremony() {
  clearTimeout(refreshTimer);
  if (!state || route() !== 'cerimonia') return;
  const previous = state;
  try {
    const latest = await api('/api/state');
    if (route() !== 'cerimonia' || previous !== state || announcing) return;
    if (latest.locked !== state.locked || JSON.stringify(latest.winners) !== JSON.stringify(state.winners)) {
      state = latest;
      justAnnounced = '';
      render();
    }
  } finally {
    if (route() === 'cerimonia' && !state.locked) {
      const delay = new Date(state.lockAt).getTime() - Date.now();
      refreshTimer = setTimeout(syncCeremony, Math.max(1000, Math.min(delay, 2147483647)));
    }
  }
}

function syncCeremony() {
  refreshCeremony().catch(() => {
    if (route() === 'cerimonia' && !state.locked) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(syncCeremony, 10000);
    }
  });
}

window.addEventListener('focus', syncCeremony);
window.addEventListener('hashchange', () => {
  clearTimeout(refreshTimer);
  recapIndex = 0;
  justAnnounced = '';
  editingVote = null;
  render();
  window.scrollTo(0,0);
  main.focus({preventScroll:true});
  syncCeremony();
});

async function init() {
  const [initial,images] = await Promise.all([api('/api/state'),api('/nominee-art.json')]);
  state = initial;
  ballotCategories = [...state.categories].reverse();
  art = images;
  const last = ballotCategories.findIndex(c => c.id === localStorage.tgaGroupCategory);
  if (last >= 0 && Object.values(state.progress).some(n => n > 0)) categoryIndex = last;
  else if (state.voters) categoryIndex = Math.max(0, nextPendingCategory(0));
  render();
  syncCeremony();
}
init().catch(() => {main.innerHTML = '<div class="wrap loading" role="alert">Não foi possível carregar o bolão. <button class="subtle" onclick="location.reload()">Tentar novamente</button></div>';});
