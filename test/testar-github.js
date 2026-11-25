'use strict';
/* Teste da cópia no GitHub: npm run test:github
   Sobe um "GitHub de mentira" local, publica conteúdo, reinicia o site com o disco vazio e confere que tudo voltou. */
const http = require('node:http');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), assert = require('node:assert'), crypto = require('node:crypto');

const arquivos = new Map(); // caminho -> { sha, buf }
let gravacoes = 0;
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
  if (req.method === 'PUT') {
    const partes = []; req.on('data', (c) => partes.push(c)); req.on('end', () => {
      const b = JSON.parse(Buffer.concat(partes).toString());
      const atual = arquivos.get(caminho);
      if (atual && b.sha !== atual.sha) return fim(409, { message: 'sha does not match' });
      if (!atual && b.sha) return fim(422, { message: 'sha wasn\'t supplied correctly' });
      const buf = Buffer.from(b.content, 'base64'), sha = crypto.createHash('sha1').update(buf).digest('hex');
      arquivos.set(caminho, { sha, buf }); gravacoes++;
      fim(atual ? 200 : 201, { content: { sha } });
    });
    return;
  }
  fim(405, {});
});

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const noticia = (titulo, extra = {}) => ({ tipo: 'noticia', status: 'publicado', dados: { titulo, resumo: 'Resumo de teste.', texto: 'Texto de teste.', data: '2026-11-12', fonte_nome: 'Fonte', fonte_url: 'https://exemplo.org', ...extra } });
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));
async function esperaAte(cond, ms = 8000) { const t = Date.now(); while (Date.now() - t < ms) { if (await cond()) return true; await dorme(100); } return false; }

let ok = 0;
const t = async (nome, f) => { try { await f(); ok++; console.log('ok  ', nome); } catch (e) { console.log('FALHOU', nome, '\n   ', e.message); process.exitCode = 1; } };

function sobe(portaGh, extra = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipg-'));
  const porta = 3800 + Math.floor(Math.random() * 90);
  const env = { ...process.env, PORT: porta, DATA_DIR: dir, ADMIN_PASSWORD: 'SenhaSoDeTeste-42', SESSION_SECRET: 'segredo-de-teste-bem-longo', GITHUB_TOKEN: TOKEN, GITHUB_REPO: 'dono/dados', GITHUB_API_URL: `http://localhost:${portaGh}`, ...extra };
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let saida = ''; proc.stdout.on('data', (d) => { saida += d; }); proc.stderr.on('data', (d) => { saida += d; });
  const encerrou = new Promise((r) => proc.on('exit', (c) => r(c)));
  return { proc, base: `http://localhost:${porta}`, saida: () => saida, encerrou };
}
async function pronto(s) { return esperaAte(async () => { try { await fetch(s.base + '/api/me'); return true; } catch { return false; } }, 8000); }
async function login(s) {
  const r = await fetch(s.base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'infopathos', senha: 'SenhaSoDeTeste-42' }) });
  assert.equal(r.status, 200); return r.headers.get('set-cookie').split(';')[0];
}

falso.listen(0, async () => {
  const portaGh = falso.address().port;
  let A, B, imagem;
  await t('primeira subida: repositório vazio recebe o conteúdo inicial', async () => {
    A = sobe(portaGh); assert.ok(await pronto(A), A.saida());
    assert.ok(await esperaAte(() => arquivos.has('dados.json')), 'dados.json não apareceu no GitHub');
    const d = JSON.parse(arquivos.get('dados.json').buf.toString());
    assert.equal(d.conteudos.length, 8);
  });
  let cookie;
  await t('publicar no painel grava no GitHub (texto e imagem)', async () => {
    cookie = await login(A);
    const H = { 'Content-Type': 'application/json', cookie };
    const up = await fetch(A.base + '/api/admin/imagem', { method: 'POST', headers: H, body: JSON.stringify({ dados: 'data:image/png;base64,' + PNG.toString('base64') }) });
    assert.equal(up.status, 201); imagem = (await up.json()).url;
    const r = await fetch(A.base + '/api/admin/conteudos', { method: 'POST', headers: H, body: JSON.stringify(noticia('Notícia que precisa sobreviver', { imagem })) });
    assert.equal(r.status, 201, JSON.stringify(await r.clone().json()));
    assert.ok(await esperaAte(() => /Notícia que precisa sobreviver/.test(arquivos.get('dados.json').buf.toString())), 'conteúdo novo não chegou ao GitHub');
    assert.ok(await esperaAte(() => arquivos.has('uploads/' + imagem.split('/').pop())), 'imagem não chegou ao GitHub');
  });
  await t('várias mudanças seguidas viram poucas gravações (e a última prevalece)', async () => {
    const antes = gravacoes;
    const H = { 'Content-Type': 'application/json', cookie };
    for (let i = 0; i < 4; i++) await fetch(A.base + '/api/admin/conteudos', { method: 'POST', headers: H, body: JSON.stringify(noticia('Rajada ' + i)) });
    assert.ok(await esperaAte(() => /Rajada 3/.test(arquivos.get('dados.json').buf.toString())));
    assert.ok(gravacoes - antes <= 2, 'gravações demais: ' + (gravacoes - antes));
  });
  await t('desligar (SIGTERM) termina de enviar o que estava pendente', async () => {
    const H = { 'Content-Type': 'application/json', cookie };
    await fetch(A.base + '/api/admin/conteudos', { method: 'POST', headers: H, body: JSON.stringify(noticia('Último antes de desligar')) });
    A.proc.kill('SIGTERM'); assert.equal(await A.encerrou, 0);
    assert.match(arquivos.get('dados.json').buf.toString(), /Último antes de desligar/);
  });
  await t('reinício com disco vazio: tudo volta do GitHub', async () => {
    B = sobe(portaGh); assert.ok(await pronto(B), B.saida());
    const r = await (await fetch(B.base + '/api/publico')).json();
    const titulos = r.noticias.map((n) => n.titulo);
    assert.ok(titulos.includes('Notícia que precisa sobreviver'), titulos.join('|'));
    assert.ok(titulos.includes('Último antes de desligar'));
    assert.equal(r.patologias.length, 1, 'o conteúdo inicial não pode duplicar');
    const img = await fetch(B.base + imagem);
    assert.equal(img.status, 200); assert.ok(Buffer.from(await img.arrayBuffer()).equals(PNG), 'imagem diferente');
  });
  await t('depois do reinício, a mesma senha do ambiente continua valendo e dá para publicar de novo', async () => {
    const c = await login(B);
    const r = await fetch(B.base + '/api/admin/conteudos', { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: c }, body: JSON.stringify(noticia('Depois do reinício')) });
    assert.equal(r.status, 201);
    assert.ok(await esperaAte(() => /Depois do reinício/.test(arquivos.get('dados.json').buf.toString())));
    assert.match(arquivos.get('dados.json').buf.toString(), /Notícia que precisa sobreviver/, 'não pode perder o que já existia');
  });
  await t('imagem fora do padrão não é buscada no GitHub', async () => {
    const r = await fetch(B.base + '/uploads/..%2fdados.json'); assert.notEqual(r.status, 200);
    assert.equal((await fetch(B.base + '/uploads/naoexiste.png')).status, 404);
  });
  B.proc.kill('SIGTERM'); await B.encerrou;
  await t('token errado: o site não sobe (para não apagar o conteúdo do GitHub)', async () => {
    const C = sobe(portaGh, { GITHUB_TOKEN: 'errado' });
    assert.equal(await C.encerrou, 1); assert.match(C.saida(), /Não consegui ler o conteúdo do GitHub/);
  });
  await t('sem ADMIN_PASSWORD/SESSION_SECRET com GitHub ligado: avisa e não sobe', async () => {
    const C = sobe(portaGh, { ADMIN_PASSWORD: undefined, SESSION_SECRET: undefined });
    assert.equal(await C.encerrou, 1); assert.match(C.saida(), /ADMIN_PASSWORD e SESSION_SECRET/);
  });
  console.log(`\n${ok} verificações passaram.`);
  falso.close(); process.exit(process.exitCode || 0);
});
