'use strict';
/*
 * Guarda uma cópia do conteúdo do site (um arquivo JSON + as imagens) num repositório do GitHub.
 *
 * Por quê: em hospedagens gratuitas (como a Render grátis) o disco é apagado a cada reinício.
 * O site continua trabalhando com o banco local (rápido), mas toda mudança é enviada ao GitHub,
 * e no próximo início o conteúdo é restaurado de lá.
 *
 * Variáveis de ambiente (só liga se GITHUB_TOKEN e GITHUB_REPO existirem):
 *   GITHUB_TOKEN   chave de acesso (fine-grained), com permissão "Contents: Read and write" SÓ no repositório de dados
 *   GITHUB_REPO    dono/repositório, ex.: Mil-hub10/infopathos-dados
 *   GITHUB_BRANCH  ramo (padrão: o padrão do repositório)
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const github = require('./github');
const db = require('./db');

const ARQUIVO = 'dados.json';
const NOME_IMAGEM = /^[a-f0-9]{24}\.(?:jpg|png|webp)$/;

function configurar(uploadsDir, conn, env = process.env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return null;
  if (!/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO)) throw new Error('GITHUB_REPO deve ter o formato dono/repositorio.');
  const gh = github.criar({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || '', apiUrl: env.GITHUB_API_URL });

  let shaDados = null, hashEnviado = null;
  const imagensPendentes = new Set();
  let timer = null, rodando = null, sujo = false, falhas = 0;

  const instantaneo = () => JSON.stringify(db.exportar(conn), null, 1) + '\n';
  const hash = (txt) => crypto.createHash('sha256').update(txt).digest('hex');

  /* No início: se já existe cópia no GitHub, traz para o banco local. Devolve true se restaurou. */
  async function restaurar() {
    const r = await gh.ler(ARQUIVO);
    if (!r) return false;
    const obj = JSON.parse(r.buf.toString('utf8'));
    db.restaurar(conn, obj);
    shaDados = r.sha;
    hashEnviado = hash(instantaneo());
    return true;
  }

  async function enviarTudo() {
    for (const nome of [...imagensPendentes]) {
      const arq = path.join(uploadsDir, nome);
      if (fs.existsSync(arq)) await gh.gravar('uploads/' + nome, fs.readFileSync(arq), 'Imagem enviada pelo painel');
      imagensPendentes.delete(nome);
    }
    const txt = instantaneo(), h = hash(txt);
    if (h !== hashEnviado) {
      shaDados = await gh.gravar(ARQUIVO, Buffer.from(txt), 'Conteúdo atualizado pelo painel', shaDados || undefined);
      hashEnviado = h;
    }
  }

  function executar() {
    if (rodando) { sujo = true; return rodando; }
    rodando = (async () => {
      try {
        do {
          sujo = false;
          await enviarTudo();
          falhas = 0;
        } while (sujo);
      } catch (e) {
        falhas++;
        console.error('[armazenamento] não consegui salvar no GitHub (tentativa ' + falhas + '):', e.message);
        const espera = Math.min(300000, 5000 * 2 ** Math.min(falhas, 6));
        clearTimeout(timer);
        timer = setTimeout(executar, espera);
        timer.unref();
      } finally { rodando = null; }
    })();
    return rodando;
  }

  /* Chamado depois de qualquer mudança: agrupa mudanças próximas e envia. */
  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(executar, 1200);
    timer.unref();
  }
  function registrarImagem(nome) { imagensPendentes.add(nome); agendar(); }

  /* Imagem que existe no GitHub mas não no disco (depois de um reinício): baixa sob demanda. */
  async function baixarImagem(nome) {
    if (!NOME_IMAGEM.test(nome)) return null;
    const buf = await gh.lerBruto('uploads/' + nome);
    if (buf) { fs.mkdirSync(uploadsDir, { recursive: true }); fs.writeFileSync(path.join(uploadsDir, nome), buf); }
    return buf;
  }

  /* Ao desligar (a Render avisa antes): termina de enviar o que estiver pendente. */
  async function finalizar() {
    clearTimeout(timer);
    const limite = new Promise((r) => { const t = setTimeout(r, 20000); t.unref(); });
    await Promise.race([executar(), limite]);
  }

  /* Usado depois de semear o conteúdo inicial: envia já, sem esperar. */
  function enviarAgora() { clearTimeout(timer); return executar(); }

  return { restaurar, agendar, registrarImagem, baixarImagem, finalizar, enviarAgora, repo: env.GITHUB_REPO };
}

module.exports = { configurar, NOME_IMAGEM };
