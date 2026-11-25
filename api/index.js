'use strict';
/*
 * InfoPathos na Vercel: uma única função atende toda a API (/api/*) e as imagens enviadas (/uploads/*).
 * O site em si (HTML, CSS, JS, imagens fixas) sai da pasta public/, servida direto pela Vercel.
 * O conteúdo fica num arquivo JSON num repositório do GitHub (lib/nuvem.js).
 *
 * Variáveis de ambiente: ADMIN_PASSWORD, SESSION_SECRET, GITHUB_TOKEN, GITHUB_REPO (e, se quiser, ADMIN_USER, GITHUB_BRANCH).
 */
const crypto = require('node:crypto');
const auth = require('../lib/auth');
const { validar, TIPOS } = require('../lib/validar');
const nuvem = require('../lib/nuvem');

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const LIMITE_IMAGEM = 3 * 1024 * 1024; // a Vercel recusa pedidos acima de ~4,5 MB, e o envio da imagem vai em base64 dentro do pedido
const TIPO_IMG = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

let est = null; // estado da instância (reaproveitado enquanto ela estiver "quente")
function estado() {
  if (est) return est;
  const falta = ['ADMIN_PASSWORD', 'SESSION_SECRET', 'GITHUB_TOKEN', 'GITHUB_REPO'].filter((k) => !process.env[k]);
  if (falta.length) throw Object.assign(new Error('Faltam variáveis de ambiente: ' + falta.join(', ')), { configuracao: true });
  est = {
    loja: nuvem.criar(),
    segredo: process.env.SESSION_SECRET,
    usuario: (process.env.ADMIN_USER || 'infopathos').toLowerCase(),
    hash: auth.hashSenha(process.env.ADMIN_PASSWORD),
  };
  return est;
}
function reiniciarEstado() { est = null; } // usado nos testes

function cabecalhos(extra) {
  return Object.assign({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': CSP }, extra);
}
function json(res, status, obj, extra) {
  res.writeHead(status, cabecalhos(Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra)));
  res.end(JSON.stringify(obj));
}
const erroHttp = (status) => Object.assign(new Error('http'), { status });

async function lerJson(req, limite = 200 * 1024) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw erroHttp(415);
  // A Vercel já lê o corpo e entrega pronto em req.body; fora dela (testes, Node puro) lemos o fluxo.
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) { if (req.body.length > limite) throw erroHttp(413); try { return JSON.parse(req.body.toString('utf8') || '{}'); } catch { throw erroHttp(400); } }
    if (typeof req.body === 'string') { if (req.body.length > limite) throw erroHttp(413); try { return JSON.parse(req.body || '{}'); } catch { throw erroHttp(400); } }
    if (JSON.stringify(req.body).length > limite) throw erroHttp(413);
    return req.body;
  }
  const partes = []; let n = 0;
  await new Promise((resolve, reject) => {
    req.on('data', (c) => { n += c.length; if (n > limite) { reject(erroHttp(413)); } else partes.push(c); });
    req.on('end', resolve); req.on('error', reject);
  });
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch { throw erroHttp(400); }
}

const ipDe = (req) => String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '').split(',')[0].trim();
const seguro = (req) => req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
function sessao(req, e) {
  const d = auth.leToken(auth.leCookies(req).ip_sessao, e.segredo);
  return d && d.u === e.usuario ? d : null;
}
function cookie(req, valor, maxAge) {
  return `ip_sessao=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}` + (seguro(req) ? '; Secure' : '');
}
function tipoImagem(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

async function rotas(req, res, p, url) {
  const e = estado();
  const m = req.method;

  if (p.startsWith('/uploads/') && (m === 'GET' || m === 'HEAD')) {
    const nome = p.slice('/uploads/'.length);
    const buf = await e.loja.lerImagem(nome);
    if (!buf) { res.writeHead(404, cabecalhos({ 'Content-Type': 'text/plain; charset=utf-8' })); return res.end('Imagem não encontrada'); }
    res.writeHead(200, cabecalhos({ 'Content-Type': TIPO_IMG[nome.split('.').pop()], 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=86400, s-maxage=86400' }));
    return res.end(m === 'HEAD' ? undefined : buf);
  }

  if (p === '/api/publico' && m === 'GET') {
    const todos = await e.loja.listar({ apenasPublicados: true });
    const por = (t) => todos.filter((c) => c.tipo === t);
    const noticias = por('noticia').sort((a, b) => String(b.dados.data).localeCompare(String(a.dados.data)));
    // o cache da Vercel segura a resposta por alguns segundos: o site público não consulta o GitHub a cada visita
    return json(res, 200, { patologias: por('patologia'), quizzes: por('quiz'), mitos: por('mito'), noticias }, { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=60' });
  }

  if (p === '/api/login' && m === 'POST') {
    const ip = ipDe(req);
    if (auth.bloqueado(ip)) return json(res, 429, { erro: 'Muitas tentativas. Aguarde 15 minutos e tente de novo.' });
    const b = await lerJson(req, 4096);
    const u = String(b.usuario || '').trim().toLowerCase(), s = String(b.senha || '');
    const okUser = u === e.usuario;
    const okSenha = auth.confereSenha(s, e.hash);
    if (!(okUser && okSenha)) { auth.registraFalha(ip); return json(res, 401, { erro: 'Usuário ou senha incorretos.' }); }
    auth.limpaFalhas(ip);
    return json(res, 200, { ok: true, usuario: u }, { 'Set-Cookie': cookie(req, auth.criaToken(u, e.segredo), auth.DURACAO_MS / 1000) });
  }
  if (p === '/api/logout' && m === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0) });
  if (p === '/api/me' && m === 'GET') { const s = sessao(req, e); return json(res, 200, { logada: !!s, usuario: s ? s.u : null }); }

  if (p.startsWith('/api/admin/')) {
    if (!sessao(req, e)) return json(res, 401, { erro: 'Sessão expirada. Entre de novo.' });

    if (p === '/api/admin/conteudos' && m === 'GET') {
      const tipo = url.searchParams.get('tipo');
      if (tipo && !TIPOS.includes(tipo)) return json(res, 400, { erro: 'Categoria desconhecida.' });
      return json(res, 200, { itens: await e.loja.listar({ tipo, fresco: true }) });
    }
    if (p === '/api/admin/conteudos' && m === 'POST') {
      const b = await lerJson(req);
      const status = b.status === 'publicado' ? 'publicado' : 'rascunho';
      const v = validar(b.tipo, b.dados, status);
      if (v.erro) return json(res, 422, { erro: v.erro, erros: v.erros });
      return json(res, 201, { item: await e.loja.criar(b.tipo, status, v.titulo, v.dados) });
    }
    const mid = p.match(/^\/api\/admin\/conteudos\/(\d+)$/);
    if (mid) {
      const id = parseInt(mid[1], 10);
      if (m === 'GET') { const it = await e.loja.obter(id); return it ? json(res, 200, { item: it }) : json(res, 404, { erro: 'Não encontrado.' }); }
      if (m === 'PUT') {
        const atual = await e.loja.obter(id);
        if (!atual) return json(res, 404, { erro: 'Não encontrado.' });
        const b = await lerJson(req);
        const status = b.status === 'publicado' ? 'publicado' : 'rascunho';
        const v = validar(atual.tipo, b.dados, status);
        if (v.erro) return json(res, 422, { erro: v.erro, erros: v.erros });
        const item = await e.loja.atualizar(id, status, v.titulo, v.dados);
        return item ? json(res, 200, { item }) : json(res, 404, { erro: 'Não encontrado.' });
      }
      if (m === 'DELETE') return (await e.loja.excluir(id)) ? json(res, 200, { ok: true }) : json(res, 404, { erro: 'Não encontrado.' });
    }
    if (p === '/api/admin/imagem' && m === 'POST') {
      const b = await lerJson(req, 4.4 * 1024 * 1024);
      const mm = /^data:image\/(?:png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.dados || ''));
      if (!mm) return json(res, 422, { erro: 'Envie uma imagem JPG, PNG ou WEBP.' });
      const buf = Buffer.from(mm[1], 'base64');
      if (buf.length > LIMITE_IMAGEM) return json(res, 413, { erro: 'A imagem passa de 3 MB. Reduza e tente de novo.' });
      const ext = tipoImagem(buf);
      if (!ext) return json(res, 422, { erro: 'O arquivo não parece ser uma imagem válida.' });
      const nome = crypto.randomBytes(12).toString('hex') + '.' + ext;
      await e.loja.salvarImagem(nome, buf);
      return json(res, 201, { url: '/uploads/' + nome });
    }
  }
  return json(res, 404, { erro: 'Não encontrado.' });
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://x');
    // vercel.json reescreve /api/* e /uploads/* para esta função e guarda o caminho original em ?p=
    const p = url.searchParams.get('p') || url.pathname;
    url.searchParams.delete('p');
    if (!/^\/(?:api|uploads)\//.test(p) || p.includes('..')) return json(res, 404, { erro: 'Não encontrado.' });
    return await rotas(req, res, p, url);
  } catch (e) {
    // só erros do próprio pedido viram 4xx; falha do GitHub (que também traz um status) é sempre 500 para o painel não achar que a sessão expirou
    const status = [400, 413, 415].includes(e.status) ? e.status : 500;
    if (status === 500) console.error(e);
    const msg = { 400: 'Pedido inválido.', 413: 'Arquivo grande demais.', 415: 'Tipo de conteúdo não aceito.' }[status]
      || (e.configuracao ? 'O site ainda não foi configurado (faltam variáveis de ambiente).' : 'Erro ao falar com o armazenamento. Tente de novo em instantes.');
    if (!res.headersSent) json(res, status, { erro: msg }); else res.end();
  }
}

module.exports = handler;
module.exports.reiniciarEstado = reiniciarEstado;
