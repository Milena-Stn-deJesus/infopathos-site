'use strict';
/*
 * Armazenamento para hospedagem "sem servidor" (Vercel): todo o conteúdo fica num arquivo JSON (dados.json)
 * num repositório do GitHub, o mesmo formato usado pela cópia automática da versão com servidor.
 * Cada chamada lê o arquivo (com um cache curto), e cada mudança regrava o arquivo inteiro de forma segura:
 * se duas pessoas salvarem ao mesmo tempo, a segunda refaz a operação em cima da versão mais nova.
 */
const fs = require('node:fs');
const path = require('node:path');
const github = require('./github');
const { validar } = require('./validar');

const ARQUIVO = 'dados.json';
const NOME_IMAGEM = /^[a-f0-9]{24}\.(?:jpg|png|webp)$/;

function slugify(txt) {
  return String(txt).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(.{1,60})(?:-.*)?$/, '$1') || 'conteudo';
}

function criar(env = process.env, seedArquivo = path.join(__dirname, '..', 'seed.json')) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) throw Object.assign(new Error('Defina GITHUB_TOKEN e GITHUB_REPO.'), { configuracao: true });
  const gh = github.criar({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPO, branch: env.GITHUB_BRANCH || '', apiUrl: env.GITHUB_API_URL });
  const TTL = Number(env.CACHE_SEGUNDOS || 15) * 1000;
  let cache = null; // { dados, sha, quando }

  const agora = () => new Date().toISOString();

  function inicial() {
    if (env.SEM_CONTEUDO_INICIAL === '1') return { versao: 1, conteudos: [] };
    const itens = JSON.parse(fs.readFileSync(seedArquivo, 'utf8'));
    const conteudos = []; let id = 1;
    for (const it of itens) {
      const v = validar(it.tipo, it.dados, it.status);
      if (v.erro) throw new Error('Conteúdo inicial inválido: ' + v.erro);
      const t = agora();
      conteudos.push({ id: id++, tipo: it.tipo, slug: slugUnico(conteudos, slugify(v.titulo), 0), status: it.status, titulo: v.titulo, dados: v.dados,
        criado_em: t, atualizado_em: t, publicado_em: it.status === 'publicado' ? t : null });
    }
    return { versao: 1, conteudos };
  }
  function slugUnico(lista, base, idAtual) {
    let slug = base, n = 2;
    for (;;) { const r = lista.find((c) => c.slug === slug); if (!r || r.id === idAtual) return slug; slug = `${base}-${n++}`; }
  }
  const texto = (dados) => JSON.stringify(dados, null, 1) + '\n';

  /* Lê do GitHub. Se o repositório ainda não tem dados.json, cria com o conteúdo inicial (febre amarela). */
  async function ler() {
    const r = await gh.ler(ARQUIVO);
    if (r) {
      const dados = JSON.parse(r.buf.toString('utf8'));
      if (!dados || !Array.isArray(dados.conteudos)) throw new Error('dados.json inválido no GitHub.');
      return { dados, sha: r.sha };
    }
    const dados = inicial();
    const sha = await gh.gravar(ARQUIVO, Buffer.from(texto(dados)), 'Conteúdo inicial', undefined, { estrito: true }).catch(async (e) => {
      if (e.status === 409 || e.status === 422) { const r2 = await gh.ler(ARQUIVO); if (r2) return { _r: r2 }; }
      throw e;
    });
    if (sha && sha._r) return { dados: JSON.parse(sha._r.buf.toString('utf8')), sha: sha._r.sha };
    return { dados, sha };
  }

  /* Leitura com cache curto (para o site público não consultar o GitHub a cada visita). */
  async function lerComCache() {
    if (cache && Date.now() - cache.quando < TTL) return cache;
    const r = await ler();
    cache = { ...r, quando: Date.now() };
    return cache;
  }

  /* Muda os dados: lê a versão mais nova, aplica a mudança e grava; se alguém gravou no meio, refaz. */
  async function mutar(fn) {
    let ultimo;
    for (let i = 0; i < 4; i++) {
      const { dados, sha } = await ler();
      const resultado = fn(dados);
      try {
        const novoSha = await gh.gravar(ARQUIVO, Buffer.from(texto(dados)), 'Conteúdo atualizado pelo painel', sha, { estrito: true });
        cache = { dados, sha: novoSha, quando: Date.now() };
        return resultado;
      } catch (e) { if (e.status !== 409 && e.status !== 422) throw e; ultimo = e; }
    }
    throw ultimo;
  }

  const ordenar = (l) => l.slice().sort((a, b) => a.id - b.id);
  return {
    async listar({ tipo, apenasPublicados, fresco }) {
      const { dados } = fresco ? await ler() : await lerComCache();
      return ordenar(dados.conteudos).filter((c) => (!tipo || c.tipo === tipo) && (!apenasPublicados || c.status === 'publicado'));
    },
    async obter(id) { const { dados } = await ler(); return dados.conteudos.find((c) => c.id === id) || null; },
    criar(tipo, status, titulo, d) {
      return mutar((dados) => {
        const id = dados.conteudos.reduce((m, c) => Math.max(m, c.id), 0) + 1, t = agora();
        const item = { id, tipo, slug: slugUnico(dados.conteudos, slugify(titulo), 0), status, titulo, dados: d, criado_em: t, atualizado_em: t, publicado_em: status === 'publicado' ? t : null };
        dados.conteudos.push(item); return item;
      });
    },
    atualizar(id, status, titulo, d) {
      return mutar((dados) => {
        const c = dados.conteudos.find((x) => x.id === id); if (!c) return null;
        const t = agora();
        Object.assign(c, { status, titulo, dados: d, atualizado_em: t, publicado_em: status === 'publicado' ? (c.publicado_em || t) : null });
        return c;
      });
    },
    excluir(id) {
      return mutar((dados) => { const n = dados.conteudos.length; dados.conteudos = dados.conteudos.filter((c) => c.id !== id); return dados.conteudos.length < n; });
    },
    salvarImagem: (nome, buf) => gh.gravar('uploads/' + nome, buf, 'Imagem enviada pelo painel', undefined, { estrito: true }),
    lerImagem: (nome) => (NOME_IMAGEM.test(nome) ? gh.lerBruto('uploads/' + nome) : Promise.resolve(null)),
    esquecerCache() { cache = null; },
  };
}

module.exports = { criar, NOME_IMAGEM, slugify };
