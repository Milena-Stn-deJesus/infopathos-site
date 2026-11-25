'use strict';
/* Teste da versão Vercel: npm run test:vercel
   Roda a função api/index.js atrás de um "GitHub de mentira" e de um mini-Vercel que faz as mesmas reescritas do vercel.json. */
const http = require('node:http');
const assert = require('node:assert'), crypto = require('node:crypto');

const arquivos = new Map(); let gravacoes = 0, interferir = null;
const TOKEN = 'token-de-teste';
const falso = http.createServer((req, res) => {
  const fim = (st, obj, tipo) => { res.writeHead(st, { 'Content-Type': tipo || 'application/json' }); res.end(Buffer.isBuffer(obj) ? obj : JSON.stringify(obj)); };
  if (req.headers.authorization !== 'Bearer ' + TOKEN) return fim(401, { message: 'Bad credentials' });
  const m = /^\/repos\/dono\/dados\/contents\/(.+?)(?:\?.*)?$/.exec(req.url);
  if (!m) return fim(404, { message: 'Not Found' });
  const caminho = decodeURIComponent(m[1]);
  if (req.method === 'GET') {
    const f = arquivos.get(caminho);
    if (!f) return fim(404, { message: 'Not Found' });
    if (/raw/.test(req.headers.accept || '')) return fim(200, f.buf, 'application/octet-stream');
    return fim(200, { sha: f.sha, encoding: 'base64', content: f.buf.toString('base64') });
  }
  const partes = []; req.on('data', (c) => partes.push(c)); req.on('end', () => {
    const b = JSON.parse(Buffer.concat(partes).toString());
    if (interferir && caminho === 'dados.json') { const f = interferir; interferir = null; f(); } // simula outra pessoa gravando no meio
    const atual = arquivos.get(caminho);
    if (atual && b.sha !== atual.sha) return fim(409, { message: 'sha does not match' });
    if (!atual && b.sha) return fim(422, { message: "sha wasn't supplied correctly" });
    const buf = Buffer.from(b.content, 'base64'), sha = crypto.createHash('sha1').update(buf).digest('hex');
    arquivos.set(caminho, { sha, buf }); gravacoes++; fim(atual ? 200 : 201, { content: { sha } });
  });
});

let ok = 0;
const t = async (nome, f) => { try { await f(); ok++; console.log('ok  ', nome); } catch (e) { console.log('FALHOU', nome, '\n   ', e.message); process.exitCode = 1; } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

falso.listen(0, () => {
  Object.assign(process.env, { ADMIN_PASSWORD: 'SenhaSoDeTeste-42', SESSION_SECRET: 'segredo-de-teste-bem-longo', GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'dono/dados',
    GITHUB_API_URL: `http://localhost:${falso.address().port}`, CACHE_SEGUNDOS: '0', NODE_ENV: 'production' });
  const handler = require('../api/index.js');
  let modoCorpoPronto = false;
  // mini-Vercel: reescreve como o vercel.json; no "modo corpo pronto" entrega req.body já lido, como a Vercel faz
  const vercel = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const dest = /^\/(api|uploads)\//.test(u.pathname) ? `/api/index?p=${u.pathname}${u.search ? '&' + u.search.slice(1) : ''}` : null;
    if (!dest) { res.writeHead(404); return res.end('estático'); }
    if (modoCorpoPronto && req.method !== 'GET') {
      const partes = []; for await (const c of req) partes.push(c);
      const txt = Buffer.concat(partes).toString();
      req.body = /json/.test(req.headers['content-type'] || '') ? JSON.parse(txt || '{}') : txt;
    }
    req.url = dest; return handler(req, res);
  });
  vercel.listen(0, async () => {
    const base = `http://localhost:${vercel.address().port}`;
    let cookie = '';
    const J = (m, u, b) => fetch(base + u, { method: m, headers: { ...(b !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
    const noticia = (titulo, extra = {}) => ({ tipo: 'noticia', status: 'publicado', dados: { titulo, resumo: 'Resumo.', texto: 'Texto.', data: '2026-11-12', fonte_nome: 'Fonte', fonte_url: 'https://exemplo.org', ...extra } });

    for (const corpoPronto of [false, true]) {
      modoCorpoPronto = corpoPronto; cookie = '';
      const rotulo = corpoPronto ? ' [corpo já lido, como na Vercel]' : '';
      await t('site público cria o conteúdo inicial no GitHub na primeira visita' + rotulo, async () => {
        arquivos.clear();
        const r = await (await J('GET', '/api/publico')).json();
        assert.equal(r.patologias.length, 1); assert.equal(r.quizzes.length, 4); assert.equal(r.mitos.length, 2); assert.equal(r.noticias.length, 1);
        assert.ok(arquivos.has('dados.json'));
      });
      await t('painel exige login; login errado é recusado' + rotulo, async () => {
        assert.equal((await J('GET', '/api/admin/conteudos')).status, 401);
        assert.equal((await J('POST', '/api/login', { usuario: 'infopathos', senha: 'errada' })).status, 401);
      });
      await t('login certo cria sessão' + rotulo, async () => {
        const r = await J('POST', '/api/login', { usuario: 'InfoPathos', senha: 'SenhaSoDeTeste-42' });
        assert.equal(r.status, 200); const c = r.headers.get('set-cookie'); assert.match(c, /HttpOnly/); assert.match(c, /Secure/); cookie = c.split(';')[0];
        assert.equal((await (await J('GET', '/api/me')).json()).logada, true);
      });
      let id, imagem;
      await t('publicar grava no GitHub e aparece no site' + rotulo, async () => {
        const up = await J('POST', '/api/admin/imagem', { dados: 'data:image/png;base64,' + PNG.toString('base64') });
        assert.equal(up.status, 201); imagem = (await up.json()).url;
        const r = await J('POST', '/api/admin/conteudos', noticia('Notícia da Vercel', { imagem }));
        assert.equal(r.status, 201, JSON.stringify(await r.clone().json())); id = (await r.json()).item.id;
        assert.match(arquivos.get('dados.json').buf.toString(), /Notícia da Vercel/);
        assert.ok((await (await J('GET', '/api/publico')).json()).noticias.some((n) => n.titulo === 'Notícia da Vercel'));
        const img = await fetch(base + imagem); assert.equal(img.status, 200); assert.ok(Buffer.from(await img.arrayBuffer()).equals(PNG));
      });
      await t('editar, rascunho some do site, excluir' + rotulo, async () => {
        const g = await (await J('GET', '/api/admin/conteudos/' + id)).json();
        const r = await J('PUT', '/api/admin/conteudos/' + id, { status: 'rascunho', dados: g.item.dados });
        assert.equal(r.status, 200);
        assert.ok(!(await (await J('GET', '/api/publico')).json()).noticias.some((n) => n.titulo === 'Notícia da Vercel'));
        assert.equal((await J('DELETE', '/api/admin/conteudos/' + id)).status, 200);
        assert.equal((await J('GET', '/api/admin/conteudos/' + id)).status, 404);
      });
      await t('instância nova (reinício a frio) lê tudo de volta do GitHub' + rotulo, async () => {
        await J('POST', '/api/admin/conteudos', noticia('Sobrevive ao reinício'));
        handler.reiniciarEstado();
        const r = await (await J('GET', '/api/publico')).json();
        assert.ok(r.noticias.some((n) => n.titulo === 'Sobrevive ao reinício'));
        assert.equal(r.patologias.length, 1, 'conteúdo inicial não pode duplicar');
      });
      await t('duas pessoas salvando ao mesmo tempo: nenhuma perde a mudança' + rotulo, async () => {
        const outro = () => { // outra pessoa grava um item direto no GitHub, no meio da nossa gravação
          const d = JSON.parse(arquivos.get('dados.json').buf.toString());
          d.conteudos.push({ id: 9999, tipo: 'noticia', slug: 'externa', status: 'publicado', titulo: 'Item da outra pessoa', dados: noticia('x').dados, criado_em: 'x', atualizado_em: 'x', publicado_em: 'x' });
          const buf = Buffer.from(JSON.stringify(d)); arquivos.set('dados.json', { sha: crypto.createHash('sha1').update(buf).digest('hex'), buf });
        };
        interferir = outro;
        assert.equal((await J('POST', '/api/admin/conteudos', noticia('Item da nossa pessoa'))).status, 201);
        const txt = arquivos.get('dados.json').buf.toString();
        assert.match(txt, /Item da outra pessoa/); assert.match(txt, /Item da nossa pessoa/);
      });
      await t('imagem inválida e arquivos fora do padrão são recusados' + rotulo, async () => {
        assert.equal((await J('POST', '/api/admin/imagem', { dados: 'data:image/png;base64,' + Buffer.from('isto nao e imagem de verdade').toString('base64') })).status, 422);
        assert.equal((await fetch(base + '/uploads/..%2fdados.json')).status, 404);
        assert.equal((await fetch(base + '/uploads/naoexiste.png')).status, 404);
      });
      await t('logout encerra a sessão' + rotulo, async () => {
        await J('POST', '/api/logout', {}); cookie = '';
        assert.equal((await J('GET', '/api/admin/conteudos')).status, 401);
      });
    }
    await t('GitHub fora do ar ou token errado: erro claro, sem derrubar nada', async () => {
      process.env.GITHUB_TOKEN = 'errado'; handler.reiniciarEstado();
      const r = await J('GET', '/api/publico'); assert.equal(r.status, 500); assert.match((await r.json()).erro, /armazenamento/);
      process.env.GITHUB_TOKEN = TOKEN; handler.reiniciarEstado();
    });
    await t('sem variáveis de ambiente: avisa que falta configurar', async () => {
      const guardada = process.env.SESSION_SECRET; delete process.env.SESSION_SECRET; handler.reiniciarEstado();
      const r = await J('GET', '/api/me'); assert.equal(r.status, 500); assert.match((await r.json()).erro, /configurado/);
      process.env.SESSION_SECRET = guardada; handler.reiniciarEstado();
    });
    console.log(`\n${ok} verificações passaram.`);
    vercel.close(); falso.close(); process.exit(process.exitCode || 0);
  });
});
