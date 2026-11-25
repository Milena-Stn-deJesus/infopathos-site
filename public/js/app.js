(function () {
  'use strict';

  /* ---------- utilidades ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  function $(id) { return document.getElementById(id); }
  function limpa(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
  /* **negrito** vira <strong>, sem aceitar HTML */
  function rico(txt) {
    var f = document.createDocumentFragment();
    String(txt).split('**').forEach(function (parte, i) { if (parte) f.appendChild(i % 2 ? h('strong', { text: parte }) : document.createTextNode(parte)); });
    return f;
  }
  function dataBr(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
  function seta() {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'M4 12h16M14 6l6 6-6 6'); s.appendChild(p); return s;
  }
  function linkExterno(url, texto) { return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: texto }); }
  function api(metodo, url, corpo) {
    var opt = { method: metodo, headers: {}, credentials: 'same-origin' };
    if (corpo !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(corpo); }
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.erro || 'Algo deu errado. Tente de novo.'); e.status = r.status; throw e; } return j; });
    });
  }

  var D = { patologias: [], quizzes: [], mitos: [], noticias: [] };
  var reduz = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  (function menuMobile() {
    var btn = document.getElementById('menu-btn'), hd = document.querySelector('header');
    function fecha() { hd.classList.remove('aberto'); btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-label', 'Abrir menu'); }
    btn.addEventListener('click', function () {
      var ab = hd.classList.toggle('aberto'); btn.setAttribute('aria-expanded', ab); btn.setAttribute('aria-label', ab ? 'Fechar menu' : 'Abrir menu');
    });
    document.getElementById('menu-nav').addEventListener('click', function (e) { if (e.target.closest('a')) fecha(); });
    window.addEventListener('hashchange', fecha);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecha(); });

    var eb = document.getElementById('explore-btn'), li = eb.parentNode;
    function sub(ab) { li.classList.toggle('aberto', ab); eb.setAttribute('aria-expanded', ab); }
    eb.addEventListener('click', function (e) { e.stopPropagation(); sub(!li.classList.contains('aberto')); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape' && li.classList.contains('aberto')) { sub(false); eb.focus(); } });
    li.addEventListener('focusout', function (e) { if (!li.contains(e.relatedTarget)) sub(false); });
    li.addEventListener('click', function (e) { if (e.target.closest('.sub a')) sub(false); });
    document.addEventListener('click', function (e) { if (!li.contains(e.target)) sub(false); });
    window.addEventListener('hashchange', function () { sub(false); marcaAtual(); });
    function marcaAtual() {
      var hs = location.hash || '#inicio';
      Array.prototype.forEach.call(document.querySelectorAll('nav a[href^="#"]:not(.entrar)'), function (a) {
        var on = a.getAttribute('href') === hs || (hs === '#' && a.getAttribute('href') === '#inicio');
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
      eb.classList.toggle('atual', !!document.querySelector('.sub a[aria-current]'));
    }
    marcaAtual();
  })();

  /* ---------- efeitos da home: carrossel, brilho ---------- */
  (function () {
    var frases = [].slice.call(document.querySelectorAll('.frase'));
    var pontosEl = $('pontos'), btnPausa = $('pausa');
    if (pontosEl && btnPausa && frases.length > 1) {
    var atual = 0, pausado = false, timer = null;
    var pontos = frases.map(function (_, i) {
      var b = h('button', { type: 'button', 'aria-label': 'Ir para a frase ' + (i + 1) + ' de ' + frases.length, onclick: function () { ir(i); } });
      pontosEl.appendChild(b); return b;
    });
    function mostrar() {
      frases.forEach(function (f, i) {
        var a = i === atual; f.classList.toggle('ativa', a); f.setAttribute('aria-hidden', a ? 'false' : 'true'); pontos[i].classList.toggle('ativo', a);
        if (a) pontos[i].setAttribute('aria-current', 'true'); else pontos[i].removeAttribute('aria-current');
      });
    }
    function ir(i) { atual = (i + frases.length) % frases.length; mostrar(); parar(); iniciar(); }
    function iniciar() { if (!pausado && !timer) timer = setInterval(function () { atual = (atual + 1) % frases.length; mostrar(); }, 6000); }
    function parar() { if (timer) { clearInterval(timer); timer = null; } }
    function pausa(p) {
      pausado = p; btnPausa.textContent = p ? 'Retomar' : 'Pausar';
      btnPausa.setAttribute('aria-label', p ? 'Retomar a troca automática de frases' : 'Pausar a troca automática de frases');
      if (p) parar(); else iniciar();
    }
    $('anterior').addEventListener('click', function () { ir(atual - 1); });
    $('proxima').addEventListener('click', function () { ir(atual + 1); });
    btnPausa.addEventListener('click', function () { pausa(!pausado); });
    mostrar(); if (reduz) pausa(true); else iniciar();
    }

    var br = $('brilho');
    if (br && !reduz && window.matchMedia('(hover:hover)').matches) {
      var tx = 0, ty = 0, x = 0, y = 0, rodando = false;
      var anima = function () {
        x += (tx - x) * 0.16; y += (ty - y) * 0.16; br.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) requestAnimationFrame(anima); else rodando = false;
      };
      window.addEventListener('pointermove', function (e) {
        tx = e.clientX; ty = e.clientY; if (!br.classList.contains('on')) { x = tx; y = ty; br.classList.add('on'); }
        if (!rodando) { rodando = true; requestAnimationFrame(anima); }
      }, { passive: true });
      document.addEventListener('pointerleave', function () { br.classList.remove('on'); });
    }
    document.addEventListener('pointermove', function (e) {
      var c = e.target.closest && e.target.closest('.card'); if (!c) return;
      var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  })();

  /* ---------- home com conteúdo do banco ---------- */
  function montaHome() {
    var n = D.noticias[0], ch = $('chamada');
    if (n) {
      ch.hidden = false; limpa(ch).href = '#noticia/' + n.slug;
      ch.appendChild(h('span', { class: 'novo' }, h('i'), 'NOVO')); ch.appendChild(document.createTextNode(n.dados.titulo));
    } else ch.hidden = true;

    (function fontesCard() {
      var tot = {}, inst = {}, nP = 0;
      D.patologias.forEach(function (p) {
        var fs = (p.dados.fontes || []); if (fs.length) nP++;
        fs.forEach(function (f) {
          tot[f.url || f.titulo] = 1;
          var nome = String(f.titulo).split(/[:(]/)[0].trim();
          if (nome && nome.length < 60) inst[nome] = (inst[nome] || 0) + 1;
        });
      });
      var n = Object.keys(tot).length, lista = Object.keys(inst).sort(function (a, b) { return inst[b] - inst[a]; }).slice(0, 4);
      if (!n) return;
      $('fontes-resumo').textContent = n + ' fontes consultadas em ' + nP + (nP === 1 ? ' patologia' : ' patologias') + '. Cada conteúdo traz os links para conferir.';
      var box = limpa($('fontes-inst'));
      lista.forEach(function (x) { box.appendChild(h('li', null, x)); });
    })();

    var card = $('patologias'), pausadoPat = false, atualPat = 0;
    if (card._timer) { clearInterval(card._timer); card._timer = null; }
    function destaque(n) {
      var p = D.patologias[n]; atualPat = n;
      card.setAttribute('href', '#patologia/' + p.slug);
      var fundo = limpa($('pat-fundo'));
      if (p.dados.imagem) fundo.appendChild(h('img', { src: p.dados.imagem, alt: '', width: 624, height: 351, loading: 'lazy', decoding: 'async' }));
      $('pat-texto').textContent = 'Em destaque: ' + p.dados.nome + '. ' + (D.patologias.length > 1 ? 'Veja também as outras patologias publicadas.' : 'Entenda como a doença funciona, sem complicação.');
      var mais = limpa($('pat-mais')); mais.appendChild(document.createTextNode('Ver ' + p.dados.nome.toLowerCase() + ' ')); mais.appendChild(seta());
      [].forEach.call($('pat-temas').children, function (c, x) { c.classList.toggle('ativo', x === n); });
    }
    limpa($('pat-temas'));
    if (D.patologias.length) {
      D.patologias.slice(0, 8).forEach(function (x, n) {
        $('pat-temas').appendChild(h('span', { role: 'link', tabindex: '0', title: 'Abrir ' + x.dados.nome, text: x.dados.nome,
          onmouseenter: function () { pausadoPat = true; destaque(n); },
          onfocus: function () { pausadoPat = true; destaque(n); },
          onclick: function (e) { e.preventDefault(); e.stopPropagation(); location.hash = '#patologia/' + x.slug; },
          onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); location.hash = '#patologia/' + x.slug; } } }));
      });
      destaque(0);
      card.onmouseleave = function () { pausadoPat = false; };
      if (D.patologias.length > 1 && !reduz) {
        card._timer = setInterval(function () { if (!pausadoPat && !document.hidden) destaque((atualPat + 1) % Math.min(D.patologias.length, 8)); }, 5000);
      }
    } else {
      limpa($('pat-fundo')); card.setAttribute('href', '#inicio'); $('pat-texto').textContent = 'Em breve, as primeiras patologias.'; limpa($('pat-mais'));
    }

    var q = D.quizzes.length ? D.quizzes[Math.floor(Math.random() * D.quizzes.length)] : null, mock = limpa($('quiz-mock'));
    if (q) {
      var alts = q.dados.alternativas, mostra = [q.dados.correta];
      for (var i = 0; i < alts.length && mostra.length < 3; i++) if (mostra.indexOf(i) < 0) mostra.push(i);
      mostra.sort();
      mock.appendChild(h('div', { class: 'barra' }, h('i')));
      mock.appendChild(h('p', { class: 'q', text: q.dados.pergunta }));
      mostra.forEach(function (i) { mock.appendChild(h('span', { class: 'op' + (i === q.dados.correta ? ' certa' : ''), text: alts[i] })); });
    } else mock.appendChild(h('p', { class: 'q', text: 'Em breve, as primeiras perguntas.' }));

    montaJogo();
    montaNoticias();
  }

  var jogoI = 0, jogoTravado = false, jogoCat = '';
  function montaJogo() {
    var afirm = $('afirmacao'), res = $('resultado'), cont = $('contador'), prox = $('proximaAfirmacao');
    var botoes = [].slice.call(document.querySelectorAll('.jogo .resp button'));
    var todos = D.mitos, nomes = [];
    D.patologias.forEach(function (p) { if (todos.some(function (m) { return m.dados.patologia === p.dados.nome; })) nomes.push(p.dados.nome); });
    todos.forEach(function (m) { var n = m.dados.patologia; if (n && nomes.indexOf(n) < 0) nomes.push(n); });
    if (jogoCat && nomes.indexOf(jogoCat) < 0) jogoCat = '';
    var itens = jogoCat ? todos.filter(function (m) { return m.dados.patologia === jogoCat; }) : todos;
    var cats = limpa($('jogo-cats'));
    cats.hidden = nomes.length < 1;
    if (nomes.length) {
      cats.appendChild(h('span', { class: 'cats-rotulo', text: 'Assunto:' }));
      ['Todos'].concat(nomes).forEach(function (n, k) {
        var valor = k === 0 ? '' : n;
        cats.appendChild(h('button', { type: 'button', class: 'cat' + (valor === jogoCat ? ' ativa' : ''), 'aria-pressed': valor === jogoCat ? 'true' : 'false', text: n,
          onclick: function () { jogoCat = valor; jogoI = 0; montaJogo(); } }));
      });
    }
    if (!todos.length) {
      afirm.textContent = 'Em breve, as primeiras afirmações.'; cont.textContent = ''; res.textContent = ''; res.className = 'resultado';
      botoes.forEach(function (b) { b.disabled = true; }); prox.hidden = true; limpa($('fonte-jogo')); return;
    }
    if (jogoI >= itens.length) jogoI = 0;
    function carregar() {
      var it = itens[jogoI].dados;
      afirm.textContent = it.afirmacao; cont.textContent = (jogoI + 1) + ' de ' + itens.length;
      res.className = 'resultado'; res.textContent = 'Escolha uma resposta para ver a explicação.';
      botoes.forEach(function (b) { b.disabled = false; b.classList.remove('escolhida', 'certa', 'errada', 'gabarito'); }); prox.hidden = true;
      var f = limpa($('fonte-jogo'));
      if (it.fontes && it.fontes.length) {
        f.appendChild(document.createTextNode('Fontes: '));
        it.fontes.forEach(function (x, k) { if (k) f.appendChild(document.createTextNode('; ')); f.appendChild(x.url ? linkExterno(x.url, x.titulo) : document.createTextNode(x.titulo)); });
      }
    }
    botoes.forEach(function (b) {
      b.onclick = function () {
        var it = itens[jogoI].dados, acertou = b.getAttribute('data-r') === it.tipo;
        botoes.forEach(function (x) { x.disabled = true; x.classList.remove('certa', 'errada', 'gabarito'); });
        b.classList.add('escolhida', acertou ? 'certa' : 'errada');
        if (!acertou) botoes.forEach(function (x) { if (x.getAttribute('data-r') === it.tipo) x.classList.add('gabarito'); });
        res.className = 'resultado ' + (acertou ? 'certo' : 'errado');
        limpa(res).appendChild(h('strong', { text: (acertou ? '✓ Acertou! É ' : '✕ Quase! Na verdade é ') + it.tipo + '.' }));
        res.appendChild(h('span', { text: it.explicacao }));
        prox.hidden = false; prox.focus();
      };
    });
    prox.onclick = function () { jogoI = (jogoI + 1) % itens.length; carregar(); botoes[0].focus(); };
    carregar();
  }

  function dataCurta(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');
  }
  function noticiasOrdenadas(asc) {
    return D.noticias.slice().sort(function (a, b) { var r = String(b.dados.data || '').localeCompare(String(a.dados.data || '')); return asc ? -r : r; });
  }
  function cartaoNoticia(n) {
    var d = n.dados;
    return h('a', { class: 'card post noticia-card', href: '#noticia/' + n.slug },
      h('div', { class: 'img' }, d.imagem ? h('img', { src: d.imagem, alt: '', loading: 'lazy' }) : null),
      h('div', { class: 'corpo' }, h('span', { class: 'cat-not', text: d.patologia || 'Notícia' }), h('h3', { text: d.titulo }), h('p', { class: 'desc', text: d.resumo }),
        d.fonte_nome ? h('span', { class: 'fonte-not', text: 'Fonte: ' + d.fonte_nome }) : null,
        h('div', { class: 'rodape' }, h('span', { class: 'data', text: dataCurta(d.data) }), h('span', { class: 'ler', text: 'Ler notícia →' }))));
  }
  function montaNoticias() {
    var l = limpa($('lista-noticias'));
    document.querySelector('.ver-todas').hidden = D.noticias.length <= 3;
    if (!D.noticias.length) { l.appendChild(h('p', { class: 'vazio', text: 'Em breve, as primeiras notícias.' })); return; }
    noticiasOrdenadas().slice(0, 3).forEach(function (n) { l.appendChild(cartaoNoticia(n)); });
  }
  var filtroNot = '';
  function paginaNoticias() {
    document.title = 'Notícias | InfoPathos';
    var grade = limpa($('grade-todas')), cats = limpa($('cats-noticias')), busca = $('busca-noticias'), cont = $('cont-noticias');
    var nomes = [], POR = 6, mostrando = POR, ordem = $('ordem-noticias'), mais = $('mais-noticias'), todas = noticiasOrdenadas(ordem.value === 'asc');
    todas.forEach(function (n) { var p = n.dados.patologia; if (p && nomes.indexOf(p) < 0) nomes.push(p); });
    function norm(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    function desenha() {
      var q = norm(busca.value).trim();
      var lista = todas.filter(function (n) {
        var d = n.dados;
        if (filtroNot && d.patologia !== filtroNot) return false;
        return !q || norm([d.titulo, d.resumo, d.texto, d.patologia, d.fonte_nome].join(' ')).indexOf(q) >= 0;
      });
      limpa(grade);
      if (!lista.length) grade.appendChild(h('p', { class: 'vazio', text: 'Nenhuma notícia encontrada. Tente outra palavra ou outra patologia.' }));
      lista.slice(0, mostrando).forEach(function (n) { grade.appendChild(cartaoNoticia(n)); });
      mais.hidden = lista.length <= mostrando;
      cont.textContent = lista.length + (lista.length === 1 ? ' notícia' : ' notícias');
      Array.prototype.forEach.call(cats.children, function (b) { b.classList.toggle('ativo', b.getAttribute('data-c') === filtroNot); b.setAttribute('aria-pressed', b.getAttribute('data-c') === filtroNot); });
    }
    [''].concat(nomes).forEach(function (c) {
      cats.appendChild(h('button', { type: 'button', class: 'cat', 'data-c': c, onclick: function () { filtroNot = c; mostrando = POR; desenha(); }, text: c || 'Todas' }));
    });
    busca.oninput = function () { mostrando = POR; desenha(); };
    ordem.onchange = function () { todas = noticiasOrdenadas(ordem.value === 'asc'); mostrando = POR; desenha(); };
    mais.onclick = function () { mostrando += POR; desenha(); };
    desenha();
  }

  /* ---------- páginas de conteúdo ---------- */
  function voltar() { return h('a', { class: 'voltar', href: '#inicio', text: '← Voltar para a home' }); }
  function figura(d, alt) {
    if (!d.imagem) return null;
    return h('figure', { class: 'foto' }, h('img', { src: d.imagem, alt: alt || '' }),
      d.credito_texto ? h('figcaption', null, 'Foto: ', d.credito_url ? linkExterno(d.credito_url, d.credito_texto) : d.credito_texto) : null);
  }
  function listaFontes(fontes) {
    return h('ul', { class: 'fontes-lista' }, fontes.map(function (f) { return h('li', null, f.url ? linkExterno(f.url, f.titulo) : f.titulo); }));
  }
  function naoEncontrado(nome) {
    return h('div', { class: 'wrap estreito' }, voltar(), h('h1', { text: nome + ' não encontrada' }), h('p', { class: 'lead-pg', text: 'Esse conteúdo não está mais no ar ou o link está incorreto.' }));
  }

  function outras(atual) {
    var lista = D.patologias.filter(function (x) { return x.slug !== atual.slug; });
    if (!lista.length) return null;
    return h('section', { class: 'outras-pat' }, h('h2', { text: 'Outras patologias' }),
      h('div', { class: 'temas-pg' }, lista.map(function (x) { return h('a', { href: '#patologia/' + x.slug, text: x.dados.nome }); })));
  }

  function paginaPatologia(slug) {
    var pg = limpa($('pg-patologia')), p = D.patologias.filter(function (x) { return x.slug === slug; })[0];
    if (!p) { pg.appendChild(naoEncontrado('Patologia')); document.title = 'InfoPathos'; return; }
    var d = p.dados; document.title = d.nome + ' | InfoPathos';
    var secs = d.secoes.map(function (s) { return { s: s, larga: !!s.alerta || s.itens.length >= 3 }; });
    var col = 0;
    secs.forEach(function (x, i) { if (x.larga) { if (col === 1) secs[i - 1].larga = true; col = 0; } else col ^= 1; });
    if (col === 1) secs[secs.length - 1].larga = true;
    var grade = h('div', { class: 'secoes' }, secs.map(function (x) {
      return h('section', { class: 'caixa' + (x.larga ? ' larga' : '') + (x.s.alerta ? ' alerta' : '') }, h('h2', { text: x.s.titulo }),
        h('ul', null, x.s.itens.map(function (i) { return h('li', null, rico(i)); })));
    }));
    if (d.fontes.length) grade.appendChild(h('section', { class: 'caixa larga' }, h('h2', { text: 'Fontes consultadas' }), listaFontes(d.fontes)));
    pg.appendChild(h('div', { class: 'wrap estreito' }, voltar(), h('span', { class: 'rotulo', text: 'Patologia' }), h('h1', { text: d.nome }),
      h('p', { class: 'lead-pg', text: d.resumo }), figura(d, d.nome), grade, outras(p),
      h('div', { class: 'acoes-pg' }, h('a', { class: 'btn primario', href: '#quiz', text: 'Teste o que você sabe' }), h('a', { class: 'btn vazado', href: '#mito-ou-fato', text: 'Mitos e fatos' }))));
  }

  function paginaFontes() {
    document.title = 'Fontes | InfoPathos';
    var box = limpa($('lista-fontes')), vistos = {};
    function grupo(titulo, fs) {
      var itens = fs.filter(function (f) { var k = f.url || f.titulo; if (vistos[k + '|' + titulo]) return false; vistos[k + '|' + titulo] = 1; return true; });
      if (!itens.length) return;
      box.appendChild(h('section', { class: 'caixa grupo-fontes' }, h('h2', { text: titulo }), listaFontes(itens)));
    }
    D.patologias.forEach(function (p) { grupo(p.dados.nome, p.dados.fontes || []); });
    var nots = noticiasOrdenadas().map(function (n) { return { titulo: n.dados.fonte_nome + ' (' + dataCurta(n.dados.data) + ')', url: n.dados.fonte_url }; }).filter(function (f) { return f.titulo.indexOf('(') > 1 || f.url; });
    grupo('Notícias', nots);
    if (!box.children.length) box.appendChild(h('p', { class: 'vazio', text: 'As fontes aparecem aqui conforme os conteúdos são publicados.' }));
  }

  function paginaNoticia(slug) {
    var pg = limpa($('pg-noticia')), n = D.noticias.filter(function (x) { return x.slug === slug; })[0];
    if (!n) { pg.appendChild(naoEncontrado('Notícia')); document.title = 'InfoPathos'; return; }
    var d = n.dados; document.title = d.titulo + ' | InfoPathos';
    var paras = d.texto.split(/\n\s*\n/).map(function (t) { return t.trim(); }).filter(Boolean);
    pg.appendChild(h('div', { class: 'wrap estreito' }, voltar(), h('span', { class: 'chip noticia', text: 'NOTÍCIA' }), h('h1', { text: d.titulo }),
      h('p', { class: 'meta-pg', text: [dataBr(d.data), d.fonte_nome].filter(Boolean).join(' · ') }),
      h('p', { class: 'lead-pg', text: d.resumo }), figura(d, ''),
      h('article', { class: 'texto-pg' }, paras.map(function (t) { return h('p', { text: t }); })),
      h('p', { class: 'fonte-pg' }, 'Fonte: ', d.fonte_url ? linkExterno(d.fonte_url, d.fonte_nome + (d.data ? ' (' + d.data.split('-').reverse().join('/') + ')' : '')) : d.fonte_nome),
      h('div', { class: 'acoes-pg' }, h('a', { class: 'btn primario', href: '#mito-ou-fato', text: 'Mitos e fatos' }), h('a', { class: 'btn vazado', href: '#inicio', text: 'Mais conteúdos' }))));
  }

  /* quiz */
  var qi = 0, acertos = 0, LET = ['A', 'B', 'C', 'D'], QZ = [], quizCat = '';
  function nomesQuiz() {
    var nomes = [];
    D.patologias.forEach(function (p) { if (D.quizzes.some(function (q) { return q.dados.patologia === p.dados.nome; })) nomes.push(p.dados.nome); });
    D.quizzes.forEach(function (q) { var n = q.dados.patologia; if (n && nomes.indexOf(n) < 0) nomes.push(n); });
    return nomes;
  }
  /* tela de escolha: o visitante decide qual quiz fazer */
  function iniciarQuiz() {
    var box = limpa($('quiz-pg'));
    $('quiz-fontes').hidden = true;
    if (!D.quizzes.length) { box.appendChild(h('p', { text: 'Em breve, as primeiras perguntas.' })); return; }
    var nomes = nomesQuiz();
    if (nomes.length < 2) { comecarQuiz(''); return; }
    box.appendChild(h('p', { class: 'perg', text: 'Qual quiz você quer fazer?' }));
    box.appendChild(h('p', { class: 'escolha-dica', text: 'Escolha uma patologia ou misture todas.' }));
    var lista = h('div', { class: 'escolha-quiz' });
    function opcao(rotulo, qtd, cat) {
      return h('button', { type: 'button', class: 'escolha' + (cat === '' ? ' todas' : ''), onclick: function () { comecarQuiz(cat); } },
        h('strong', { text: rotulo }), h('span', { text: qtd + (qtd === 1 ? ' pergunta' : ' perguntas') }));
    }
    nomes.forEach(function (n) { lista.appendChild(opcao(n, D.quizzes.filter(function (q) { return q.dados.patologia === n; }).length, n)); });
    lista.appendChild(opcao('Todas as patologias', D.quizzes.length, ''));
    box.appendChild(lista);
  }
  function comecarQuiz(cat) {
    quizCat = cat;
    QZ = cat ? D.quizzes.filter(function (q) { return q.dados.patologia === cat; }) : D.quizzes;
    var fontes = [], vistos = {};
    QZ.forEach(function (q) { q.dados.fontes.forEach(function (f) { var k = f.url || f.titulo; if (!vistos[k]) { vistos[k] = 1; fontes.push(f); } }); });
    $('quiz-fontes').hidden = !fontes.length; limpa($('quiz-fontes-lista')).appendChild(listaFontes(fontes));
    qi = 0; acertos = 0; pergunta();
  }
  function pergunta() {
    var box = limpa($('quiz-pg')), q = QZ[qi].dados, total = QZ.length;
    box.appendChild(h('div', { class: 'prog' }, h('span', { text: (quizCat ? quizCat + ' · ' : '') + 'Pergunta ' + (qi + 1) + ' de ' + total }), h('span', { text: acertos + ' acerto' + (acertos === 1 ? '' : 's') })));
    box.appendChild(h('div', { class: 'barra2' }, h('i', { style: 'width:' + (qi / total * 100) + '%' })));
    box.appendChild(h('p', { class: 'perg', text: q.pergunta }));
    box.appendChild(h('div', { class: 'opcoes' }, q.alternativas.map(function (t, k) {
      return h('button', { type: 'button', class: 'opcao', 'data-k': k, onclick: function () { responder(k); } }, h('b', { text: LET[k] }), h('span', { text: t }));
    })));
    box.appendChild(h('div', { id: 'retorno-q' }));
  }
  function responder(k) {
    var q = QZ[qi].dados, ok = k === q.correta; if (ok) acertos++;
    [].forEach.call($('quiz-pg').querySelectorAll('.opcao'), function (b, j) { b.disabled = true; if (j === q.correta) b.classList.add('certa'); else if (j === k) b.classList.add('errada'); });
    var ult = qi === QZ.length - 1;
    var pb = h('button', { type: 'button', class: 'btn primario', onclick: function () { if (ult) fimQuiz(); else { qi++; pergunta(); } }, text: ult ? 'Ver resultado' : 'Próxima pergunta' });
    limpa($('retorno-q')).appendChild(h('div', { class: 'retorno ' + (ok ? 'certo' : 'errado') }, h('strong', { text: ok ? 'Acertou!' : 'Quase! A resposta certa é a alternativa ' + LET[q.correta] + '.' }), q.explicacao));
    $('retorno-q').appendChild(h('div', { class: 'btns', style: 'margin-top:12px' }, pb)); pb.focus();
  }
  function fimQuiz() {
    var box = limpa($('quiz-pg')), t = QZ.length, outros = nomesQuiz().length > 1;
    box.appendChild(h('p', { class: 'perg', text: 'Você acertou ' + acertos + ' de ' + t + '.' }));
    box.appendChild(h('p', { text: acertos === t ? 'Mandou bem! Que tal compartilhar o que aprendeu?' : 'Confira as explicações e tente de novo.' }));
    var btns = h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn primario', onclick: function () { comecarQuiz(quizCat); }, text: 'Refazer este quiz' }));
    if (outros) btns.appendChild(h('button', { type: 'button', class: 'btn vazado', onclick: iniciarQuiz, text: 'Escolher outro quiz' }));
    btns.appendChild(h('a', { class: 'btn vazado', href: '#inicio', text: 'Voltar para a home' }));
    box.appendChild(btns);
  }

  /* ---------- rotas ---------- */
  var PAGINAS = ['pg-patologia', 'pg-noticia', 'pg-noticias', 'pg-fontes', 'pg-quiz', 'pg-sobre', 'login-pagina', 'painel'];
  var logada = false, dadosProntos = false, aguardandoRota = false;
  function mostrarPagina(id) {
    $('inicio').hidden = !!id;
    PAGINAS.forEach(function (p) { $(p).hidden = p !== id; });
  }
  function rota() {
    var hash = decodeURIComponent(location.hash || ''), id = null, m;
    document.title = 'InfoPathos';
    if (hash === '#login') id = 'login-pagina';
    else if (hash === '#painel') id = 'painel';
    else if (hash === '#quiz') id = 'pg-quiz';
    else if (hash === '#todas-noticias') id = 'pg-noticias';
    else if (hash === '#fontes') id = 'pg-fontes';
    else if (hash === '#sobre' || hash === '#equipe') id = 'pg-sobre';
    else if ((m = /^#patologia\/([a-z0-9-]+)$/.exec(hash))) id = 'pg-patologia';
    else if ((m = /^#noticia\/([a-z0-9-]+)$/.exec(hash))) id = 'pg-noticia';

    if (id === 'painel' && !logada) {
      api('GET', '/api/me').then(function (r) { logada = !!r.logada; if (logada) rota(); else location.hash = '#login'; }).catch(function () { location.hash = '#login'; });
      return;
    }
    if (id === 'login-pagina' && logada) { location.hash = '#painel'; return; }
    mostrarPagina(id);
    if (!id) {
      var el = hash.length > 1 && $(hash.slice(1));
      if (el) el.scrollIntoView(); else window.scrollTo(0, 0);
      return;
    }
    window.scrollTo(0, 0);
    if (id === 'login-pagina') { $('lg-user').focus({ preventScroll: true }); return; }
    if (id === 'painel') { abrePainel(); return; }
    if (id === 'pg-sobre') { verificaVideo(); if (hash === '#equipe') $('equipe').scrollIntoView(); return; }
    if (!dadosProntos) { aguardandoRota = true; return; }
    if (id === 'pg-patologia') paginaPatologia(m[1]);
    else if (id === 'pg-noticia') paginaNoticia(m[1]);
    else if (id === 'pg-quiz') iniciarQuiz();
    else if (id === 'pg-noticias') paginaNoticias();
    else if (id === 'pg-fontes') paginaFontes();
  }
  window.addEventListener('hashchange', rota);

  /* ---------- login ---------- */
  $('form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var er = $('erro-login'), btn = $('btn-entrar'); er.hidden = true; btn.disabled = true;
    api('POST', '/api/login', { usuario: $('lg-user').value, senha: $('lg-senha').value }).then(function () {
      $('lg-senha').value = ''; logada = true; location.hash = '#painel';
    }).catch(function (err) {
      er.textContent = err.message; er.hidden = false; $('lg-senha').select();
    }).then(function () { btn.disabled = false; });
  });
  $('sair').addEventListener('click', function () {
    api('POST', '/api/logout', {}).catch(function () {}).then(function () { logada = false; $('lg-user').value = ''; location.hash = '#login'; });
  });

  /* ---------- painel ---------- */
  var CATS = [
    { tipo: 'patologia', nome: 'Patologias', rotulo: 'patologia' },
    { tipo: 'quiz', nome: 'Quiz', rotulo: 'pergunta' },
    { tipo: 'mito', nome: 'Mitos e fatos', rotulo: 'afirmação' },
    { tipo: 'noticia', nome: 'Notícias', rotulo: 'notícia' }
  ];
  var catAtual = CATS[0], editando = null, imagemAtual = '', ocupado = false;
  var abas = $('abas');
  CATS.forEach(function (c) {
    abas.appendChild(h('button', { type: 'button', role: 'tab', 'data-tipo': c.tipo, text: c.nome, onclick: function () { escolheCat(c); } }));
  });
  function escolheCat(c) {
    catAtual = c; editando = null;
    [].forEach.call(abas.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-tipo') === c.tipo); });
    $('lista-titulo').textContent = 'Já no painel: ' + c.nome;
    carregaLista(); formVazio();
  }
  function abrePainel() { escolheCat(catAtual); }
  $('novo').addEventListener('click', function () { editando = null; formVazio(); $('form-conteudo').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth' }); });
  $('btn-cancelar').addEventListener('click', function () { editando = null; formVazio(); });

  function msg(texto, erro) { var s = $('status'); s.textContent = erro ? '' : texto; var e = $('erro-form'); e.hidden = !erro; e.textContent = erro || ''; }
  function sessaoExpirou(err) { if (err && err.status === 401) { logada = false; location.hash = '#login'; return true; } return false; }

  function carregaLista() {
    var ul = limpa($('itens-adm'));
    ul.appendChild(h('li', { class: 'vazio', text: 'Carregando…' }));
    api('GET', '/api/admin/conteudos?tipo=' + catAtual.tipo).then(function (r) {
      limpa(ul);
      if (!r.itens.length) { ul.appendChild(h('li', { class: 'vazio', text: 'Nada por aqui ainda. Use o formulário abaixo para adicionar.' })); return; }
      r.itens.slice().reverse().forEach(function (it) {
        ul.appendChild(h('li', { class: 'item-adm' },
          h('div', { class: 'item-info' }, h('span', { class: 'chip-st ' + it.status, text: it.status === 'publicado' ? 'No ar' : 'Rascunho' }), h('span', { class: 'item-tit', text: it.titulo })),
          h('div', { class: 'item-btns' },
            it.status === 'publicado' && (it.tipo === 'patologia' || it.tipo === 'noticia') ? h('a', { class: 'mini', href: '#' + it.tipo + '/' + it.slug, text: 'Ver no site' }) : null,
            h('button', { type: 'button', class: 'mini', text: 'Editar', onclick: function () { editar(it); } }),
            h('button', { type: 'button', class: 'mini perigo', text: 'Excluir', onclick: function () { excluir(it); } }))));
      });
    }).catch(function (err) { if (sessaoExpirou(err)) return; limpa(ul).appendChild(h('li', { class: 'vazio', text: err.message })); });
  }
  function excluir(it) {
    if (!window.confirm('Excluir "' + it.titulo + '"? Isso não pode ser desfeito. Para só tirar do ar, edite e use "Salvar como rascunho".')) return;
    api('DELETE', '/api/admin/conteudos/' + it.id).then(function () {
      if (editando && editando.id === it.id) { editando = null; formVazio(); }
      msg('Excluído.'); carregaLista(); recarregaPublico();
    }).catch(function (err) { if (!sessaoExpirou(err)) msg('', err.message); });
  }

  /* campos do formulário */
  function campo(id, rotulo, dica, el) {
    return h('div', { class: 'campo' }, h('label', { for: id }, rotulo, dica ? h('small', { text: ' (' + dica + ')' }) : null), el);
  }
  function txt(id, v, ph) { return h('input', { type: 'text', id: id, value: v || '', placeholder: ph || false, maxlength: 400 }); }
  function area(id, v, alto) { var a = h('textarea', { id: id }); a.value = v || ''; if (alto) a.style.minHeight = alto; return a; }
  function url(id, v) { return h('input', { type: 'url', id: id, value: v || '', placeholder: 'https://' }); }
  function valor(id) { var e = $(id); return e ? e.value : ''; }

  function blocoImagem(d) {
    imagemAtual = d.imagem || '';
    var previa = h('div', { class: 'previa-img' }), st = h('span', { class: 'dica-img' });
    function desenha() {
      limpa(previa);
      if (imagemAtual) previa.appendChild(h('img', { src: imagemAtual, alt: 'Prévia da imagem' }));
      if (imagemAtual) previa.appendChild(h('button', { type: 'button', class: 'mini', text: 'Remover imagem', onclick: function () { imagemAtual = ''; desenha(); } }));
    }
    var arq = h('input', { type: 'file', id: 'f-img', accept: 'image/png,image/jpeg,image/webp', onchange: function () {
      var f = arq.files[0]; if (!f) return; st.textContent = 'Enviando…';
      reduzImagem(f).then(function (dataUrl) { return api('POST', '/api/admin/imagem', { dados: dataUrl }); })
        .then(function (r) { imagemAtual = r.url; st.textContent = ''; desenha(); })
        .catch(function (err) { if (!sessaoExpirou(err)) st.textContent = err.message; }).then(function () { arq.value = ''; });
    } });
    desenha();
    return h('div', { class: 'bloco' },
      campo('f-img', 'Imagem', 'opcional; JPG, PNG ou WEBP', arq), st, previa,
      campo('f-credito', 'Crédito da imagem', 'quem tirou ou de onde veio', txt('f-credito', d.credito_texto)),
      campo('f-credito-url', 'Link do crédito', 'opcional', url('f-credito-url', d.credito_url)));
  }
  /* reduz fotos grandes antes de enviar, para o site carregar rápido */
  function reduzImagem(arquivo) {
    return new Promise(function (resolve, reject) {
      var leitor = new FileReader();
      leitor.onerror = function () { reject(new Error('Não consegui ler o arquivo.')); };
      leitor.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('Esse arquivo não parece ser uma imagem.')); };
        img.onload = function () {
          var max = 1600, esc = Math.min(1, max / Math.max(img.width, img.height));
          if (esc === 1 && arquivo.size < 1500000) return resolve(leitor.result);
          var c = document.createElement('canvas'); c.width = Math.round(img.width * esc); c.height = Math.round(img.height * esc);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.86));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  /* lista de fontes (nome + link) */
  var fontesBox = null;
  function blocoFontes(fontes) {
    fontesBox = h('div', { class: 'repetidor', id: 'rep-fontes' });
    (fontes && fontes.length ? fontes : [{ titulo: '', url: '' }]).forEach(linhaFonte);
    return h('div', { class: 'campo' }, h('span', { class: 'leg', text: 'Fontes consultadas' }), h('small', { class: 'dica', text: 'Escreva o nome da fonte e cole o link. Toda informação precisa de fonte.' }), fontesBox,
      h('button', { type: 'button', class: 'mini', text: '+ Adicionar fonte', onclick: function () { linhaFonte({ titulo: '', url: '' }); } }));
  }
  function linhaFonte(f) {
    var l = h('div', { class: 'linha-fonte' },
      h('input', { type: 'text', 'aria-label': 'Nome da fonte', placeholder: 'Nome da fonte', value: f.titulo || '', 'data-k': 'titulo' }),
      h('input', { type: 'url', 'aria-label': 'Link da fonte', placeholder: 'https://', value: f.url || '', 'data-k': 'url' }),
      h('button', { type: 'button', class: 'mini perigo', text: 'Remover', onclick: function () { l.remove(); } }));
    fontesBox.appendChild(l);
  }
  function lerFontes() {
    return [].map.call(fontesBox.querySelectorAll('.linha-fonte'), function (l) {
      return { titulo: l.querySelector('[data-k=titulo]').value, url: l.querySelector('[data-k=url]').value };
    }).filter(function (f) { return f.titulo.trim() || f.url.trim(); });
  }

  /* seções da patologia */
  var secBox = null;
  function blocoSecoes(secoes) {
    secBox = h('div', { class: 'repetidor', id: 'rep-secoes' });
    (secoes && secoes.length ? secoes : [{ titulo: 'O que é', itens: [] }, { titulo: 'Sintomas', itens: [] }, { titulo: 'Prevenção', itens: [] }]).forEach(linhaSecao);
    return h('div', { class: 'campo' }, h('span', { class: 'leg', text: 'Seções da página' }),
      h('small', { class: 'dica', text: 'Cada seção tem um título e itens (um por linha). Use **texto** para negrito. Ex.: O que é, Sintomas, Diagnóstico, Tratamento, Prevenção, Quando procurar ajuda.' }),
      secBox, h('button', { type: 'button', class: 'mini', text: '+ Adicionar seção', onclick: function () { linhaSecao({ titulo: '', itens: [] }); } }));
  }
  function linhaSecao(s) {
    var ta = h('textarea', { 'aria-label': 'Itens da seção, um por linha', 'data-k': 'itens', placeholder: 'Um item por linha' }); ta.value = (s.itens || []).join('\n');
    var l = h('div', { class: 'linha-secao' },
      h('input', { type: 'text', 'aria-label': 'Título da seção', placeholder: 'Título da seção', value: s.titulo || '', 'data-k': 'titulo' }), ta,
      h('div', { class: 'linha-secao-rodape' },
        h('label', { class: 'check' }, h('input', { type: 'checkbox', 'data-k': 'alerta', checked: !!s.alerta }), ' Destacar como alerta'),
        h('button', { type: 'button', class: 'mini perigo', text: 'Remover seção', onclick: function () { l.remove(); } })));
    secBox.appendChild(l);
  }
  function lerSecoes() {
    return [].map.call(secBox.querySelectorAll('.linha-secao'), function (l) {
      return { titulo: l.querySelector('[data-k=titulo]').value, alerta: l.querySelector('[data-k=alerta]').checked,
        itens: l.querySelector('[data-k=itens]').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) };
    }).filter(function (s) { return s.titulo.trim() || s.itens.length; });
  }

  function formVazio() { montaForm(null); }
  function editar(it) { editando = it; montaForm(it); $('form-conteudo').scrollIntoView({ behavior: reduz ? 'auto' : 'smooth' }); }

  function montaForm(it) {
    var d = it ? it.dados : {}, t = catAtual.tipo, c = limpa($('form-corpo'));
    msg('', ''); $('erro-form').hidden = true; fontesBox = null; secBox = null; imagemAtual = '';
    $('form-titulo').textContent = it ? 'Editando: ' + catAtual.rotulo : 'Novo conteúdo: ' + catAtual.nome;
    $('btn-cancelar').hidden = !it;
    var pub = it && it.status === 'publicado';
    $('btn-rascunho').textContent = pub ? 'Tirar do ar (salvar como rascunho)' : 'Salvar rascunho';
    $('btn-publicar').textContent = pub ? 'Salvar alterações' : 'Publicar';
    if (t === 'patologia') {
      c.appendChild(campo('f-nome', 'Nome da patologia', null, txt('f-nome', d.nome)));
      c.appendChild(campo('f-resumo', 'O que é', 'em poucas linhas, com palavras simples', area('f-resumo', d.resumo)));
      c.appendChild(blocoSecoes(d.secoes)); c.appendChild(blocoImagem(d)); c.appendChild(blocoFontes(d.fontes));
    } else if (t === 'quiz') {
      c.appendChild(campo('f-perg', 'Pergunta', null, area('f-perg', d.pergunta)));
      var alts = d.alternativas || ['', '', '', ''];
      ['A', 'B', 'C', 'D'].forEach(function (l, i) { c.appendChild(campo('f-alt' + i, 'Alternativa ' + l, null, txt('f-alt' + i, alts[i]))); });
      var sel = h('select', { id: 'f-correta' }, ['A', 'B', 'C', 'D'].map(function (l, i) { return h('option', { value: i, text: l, selected: (d.correta || 0) === i }); }));
      c.appendChild(campo('f-correta', 'Alternativa correta', null, sel));
      var selQ = h('select', { id: 'f-pat' }, [h('option', { value: '', text: 'Geral (sem patologia específica)' })].concat(D.patologias.map(function (p) {
        return h('option', { value: p.dados.nome, text: p.dados.nome, selected: d.patologia === p.dados.nome });
      })));
      c.appendChild(campo('f-pat', 'Assunto (patologia)', 'o visitante escolhe o quiz por patologia', selQ));
      c.appendChild(campo('f-expl', 'Explicação', 'curta, em linguagem simples', area('f-expl', d.explicacao))); c.appendChild(blocoFontes(d.fontes));
    } else if (t === 'mito') {
      c.appendChild(campo('f-afirm', 'A afirmação', null, area('f-afirm', d.afirmacao)));
      var tipo = d.tipo || 'mito';
      c.appendChild(h('div', { class: 'campo', role: 'radiogroup', 'aria-labelledby': 'leg-tipo' }, h('span', { class: 'leg', id: 'leg-tipo', text: 'É mito ou fato?' }),
        h('div', { class: 'radios' }, ['mito', 'fato'].map(function (o) {
          return h('label', null, h('input', { type: 'radio', name: 'f-tipo', value: o, checked: tipo === o }), ' ' + (o === 'mito' ? 'Mito' : 'Fato'));
        }))));
      var selPat = h('select', { id: 'f-pat' }, [h('option', { value: '', text: 'Geral (sem patologia específica)' })].concat(D.patologias.map(function (p) {
        return h('option', { value: p.dados.nome, text: p.dados.nome, selected: d.patologia === p.dados.nome });
      })));
      c.appendChild(campo('f-pat', 'Assunto (patologia)', 'o visitante pode filtrar o mito ou fato por patologia', selPat));
      c.appendChild(campo('f-expl', 'Explicação em linguagem simples', null, area('f-expl', d.explicacao))); c.appendChild(blocoFontes(d.fontes));
    } else {
      c.appendChild(campo('f-tit', 'Título', null, txt('f-tit', d.titulo)));
      c.appendChild(campo('f-resumo', 'Resumo', '2 a 3 linhas', area('f-resumo', d.resumo)));
      c.appendChild(campo('f-texto', 'Texto completo', 'deixe uma linha em branco entre os parágrafos', area('f-texto', d.texto, '220px')));
      var selN = h('select', { id: 'f-pat' }, [h('option', { value: '', text: 'Geral (sem patologia específica)' })].concat(D.patologias.map(function (p) {
        return h('option', { value: p.dados.nome, text: p.dados.nome });
      })));
      selN.value = d.patologia || '';
      c.appendChild(campo('f-pat', 'Assunto (patologia)', 'aparece como categoria e vira filtro na página de notícias', selN));
      c.appendChild(campo('f-data', 'Data da notícia', null, h('input', { type: 'date', id: 'f-data', value: d.data || '' })));
      c.appendChild(campo('f-fonte-nome', 'Nome da fonte', 'ex.: G1, Agência Brasil', txt('f-fonte-nome', d.fonte_nome)));
      c.appendChild(campo('f-fonte-url', 'Link da fonte', null, url('f-fonte-url', d.fonte_url)));
      c.appendChild(blocoImagem(d));
    }
  }
  function lerForm() {
    var t = catAtual.tipo;
    if (t === 'patologia') return { nome: valor('f-nome'), resumo: valor('f-resumo'), secoes: lerSecoes(), imagem: imagemAtual, credito_texto: valor('f-credito'), credito_url: valor('f-credito-url'), fontes: lerFontes() };
    if (t === 'quiz') return { pergunta: valor('f-perg'), alternativas: [0, 1, 2, 3].map(function (i) { return valor('f-alt' + i); }), correta: parseInt(valor('f-correta'), 10), patologia: valor('f-pat'), explicacao: valor('f-expl'), fontes: lerFontes() };
    if (t === 'mito') { var r = document.querySelector('input[name=f-tipo]:checked'); return { afirmacao: valor('f-afirm'), tipo: r ? r.value : '', patologia: valor('f-pat'), explicacao: valor('f-expl'), fontes: lerFontes() }; }
    return { titulo: valor('f-tit'), patologia: valor('f-pat'), resumo: valor('f-resumo'), texto: valor('f-texto'), data: valor('f-data'), fonte_nome: valor('f-fonte-nome'), fonte_url: valor('f-fonte-url'),
      imagem: imagemAtual, credito_texto: valor('f-credito'), credito_url: valor('f-credito-url') };
  }
  function salvar(status) {
    if (ocupado) return; ocupado = true; msg('Salvando…');
    var corpo = { status: status, dados: lerForm() };
    var req = editando ? api('PUT', '/api/admin/conteudos/' + editando.id, corpo) : api('POST', '/api/admin/conteudos', Object.assign({ tipo: catAtual.tipo }, corpo));
    req.then(function (r) {
      var antes = !!editando; editando = null; formVazio();
      msg(status === 'publicado' ? (antes ? 'Alterações salvas e no ar.' : 'Publicado! Já está no site.') : 'Rascunho salvo. Ainda não aparece no site.');
      carregaLista(); recarregaPublico();
    }).catch(function (err) { if (sessaoExpirou(err)) return; msg('', err.message); }).then(function () { ocupado = false; });
  }
  $('btn-publicar').addEventListener('click', function () { salvar('publicado'); });
  $('btn-rascunho').addEventListener('click', function () { salvar('rascunho'); });
  $('form-conteudo').addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- carga inicial ---------- */
  function recarregaPublico() {
    return api('GET', '/api/publico').then(function (r) { D = r; dadosProntos = true; montaHome(); return r; });
  }
  recarregaPublico().catch(function () {
    $('afirmacao').textContent = 'Não consegui carregar o conteúdo agora. Tente recarregar a página.';
    limpa($('lista-noticias')).appendChild(h('p', { class: 'vazio', text: 'Não consegui carregar as notícias agora.' }));
  }).then(function () { dadosProntos = true; var ainda = aguardandoRota; aguardandoRota = false; if (ainda || location.hash) rota(); });
  rota();
  /* ---------- Sobre nós: entrada suave ao rolar ---------- */
  (function () {
    var els = document.querySelectorAll('#pg-sobre .rev');
    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  })();
  /* ---------- Sobre nós: vídeo (aparece sozinho quando o arquivo assets/sobre.mp4 existir) ---------- */
  var videoVerificado = false;
  function verificaVideo() {
    if (videoVerificado) return; videoVerificado = true;
    var box = document.getElementById('sb-video');
    if (!box || !window.fetch) return;
    fetch('assets/sobre.mp4', { method: 'HEAD' }).then(function (r) {
      if (!r.ok || !/video/.test(r.headers.get('content-type') || '')) return;
      var v = document.createElement('video');
      v.controls = true; v.preload = 'metadata'; v.setAttribute('playsinline', '');
      v.setAttribute('aria-label', 'Vídeo de apresentação do InfoPathos');
      var f = document.createElement('source'); f.src = 'assets/sobre.mp4'; f.type = 'video/mp4';
      v.appendChild(f);
      var vazio = document.getElementById('sb-video-vazio');
      if (vazio) vazio.remove();
      box.appendChild(v);
    }).catch(function () {});
  }
})();
