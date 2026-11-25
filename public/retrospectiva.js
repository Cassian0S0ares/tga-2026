'use strict';

let recapIndex = 0;

function nightComplete() {
  return state.locked && state.picks && state.categories.every(c => c.nominees.includes(state.winners[c.id]));
}

function recapLink() {
  return nightComplete() ? '<a class="btn" href="#retrospectiva">Ver retrospectiva da noite</a>' : '';
}

function nightStats() {
  const rows = state.players.map(name => ({name, hits:0, upsetPoints:0, total:state.scores[name]}));
  const solos = [];
  for (const category of ballotCategories) {
    const winner = state.winners[category.id];
    const correct = rows.filter(row => state.picks[row.name]?.[category.id] === winner);
    const points = category.pointsByNominee[winner];
    for (const row of correct) {
      row.hits++;
      if (points > category.weight) row.upsetPoints += points;
    }
    if (correct.length === 1) solos.push({name:correct[0].name, category, winner});
  }
  return {rows, solos};
}

function recapPortrait(name) {
  return '<figure class="award-player"><img src="' + avatar(name) + '" alt=""><figcaption>' + esc(name) + '</figcaption></figure>';
}

function meritAward(rows, metric, title, empty) {
  const high = Math.max(...rows.map(row => row[metric]));
  if (high === 0) return '<h1>' + title + '</h1><p class="award-answer">' + empty + '</p>';
  const winners = rows.filter(row => row[metric] === high);
  const unit = metric === 'hits' ? (high === 1 ? 'acerto' : 'acertos') : (high === 1 ? 'ponto com azarão' : 'pontos com azarões');
  return '<h1>' + title + '</h1><div class="award-cast">' + winners.map(row => recapPortrait(row.name)).join('') +
    '</div><p class="award-answer">' + high + ' ' + unit + (winners.length > 1 ? ' por jogador' : '') + '</p>';
}

function soloAward(solo) {
  if (!solo) return '<h1>Palpite exclusivo</h1><p class="award-answer">Nenhuma vitória foi prevista por um único jogador.</p>';
  return '<h1>Palpite exclusivo</h1><div class="solo-reveal"><img class="solo-art" alt="" src="' + esc(art[solo.winner]) +
    '"><div><p class="meta">' + esc(solo.category.name) + '</p><h2>' + esc(solo.winner) +
    '</h2><p>Só <strong>' + esc(solo.name) + '</strong> acertou.</p></div></div>';
}

function finalPodium(rows) {
  const ranked = rows.slice().sort((a,b) => b.total - a.total);
  const first = ranked.filter(row => row.total === ranked[0].total);
  if (!Object.values(state.progress).some(n => n > 0)) {
    return '<h1>Resultado final</h1><p class="award-answer">A noite terminou sem palpites registrados.</p>';
  }
  const title = first.length > 1 ? 'Empate na liderança' : 'Campeão do bolão';
  const podium = ranked.map(row => {
    const place = ranked.findIndex(r => r.total === row.total) + 1;
    return '<div class="podium-place' + (place === 1 ? ' first' : '') + '" style="--delay:' +
      ((ranked.length - place) * 230) + 'ms"><span class="standing">' + place + 'º lugar</span>' +
      recapPortrait(row.name) + '<b>' + row.total + (row.total === 1 ? ' ponto' : ' pontos') + '</b></div>';
  }).join('');
  return '<h1>' + title + '</h1><div class="podium">' + podium + '</div>';
}

function retrospective() {
  if (!nightComplete()) return '<section class="wrap inner-page">' + intro('Encerramento','Retrospectiva da noite') +
    '<p class="summary">A retrospectiva abre após o encerramento dos palpites e o anúncio de todos os vencedores.</p>' +
    '<a class="subtle" href="#cerimonia">Voltar à cerimônia</a></section>';

  const {rows,solos} = nightStats();
  const finalIndex = 3 + Math.max(1,solos.length);
  const step = Math.min(recapIndex,finalIndex);
  const final = step === finalIndex;
  let content, theme, caption;
  if (step === 0) {
    theme = 'intro'; caption = 'Encerramento · The Game Awards';
    content = '<h1>Retrospectiva<br><em>da noite</em></h1><p>Os acertos, as surpresas e o campeão do bolão.</p>';
  } else if (step === 1) {
    theme = 'hits'; caption = 'Prêmio de precisão';
    content = meritAward(rows,'hits','Mais acertos da noite','Ninguém acertou uma categoria.');
  } else if (step === 2) {
    theme = 'upsets'; caption = 'Prêmio da surpresa';
    content = meritAward(rows,'upsetPoints','Mestre dos azarões','Ninguém pontuou com azarões nesta noite.');
  } else if (!final) {
    theme = 'solo'; caption = solos.length ? 'Revelação exclusiva · ' + (step - 2) + ' de ' + solos.length : 'Revelação exclusiva';
    content = soloAward(solos[step - 3]);
  } else {
    theme = 'final'; caption = 'Resultado final · Pontuação oficial';
    content = finalPodium(rows);
  }
  const sparks = Array.from({length:18},(_,i) => '<i style="--x:' + ((i*37)%100) + '%;--delay:' + ((i%7)*95) + 'ms"></i>').join('');
  const next = final ? 'Rever retrospectiva' : step === 0 ? 'Abrir premiação' : step === finalIndex - 1 ? 'Revelar resultado final' : 'Próxima revelação';
  return '<section class="wrap finale"><div class="award-stage stage-' + theme + '"><div class="award-sparks" aria-hidden="true">' +
    sparks + '</div><div class="award-content" tabindex="-1" id="award-panel"><p class="award-caption">' + caption +
    '</p>' + content + '</div></div><div class="award-controls"><a class="secondary-link" href="#placar">Placar geral</a><div>' +
    (step ? '<button class="subtle" data-recap="' + (step-1) + '">Anterior</button>' : '') +
    '<button class="btn" data-recap="' + (final ? 0 : step+1) + '">' + next + '</button></div></div></section>';
}
