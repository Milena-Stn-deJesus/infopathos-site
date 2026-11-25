'use strict';
/* Cliente mínimo da API de arquivos do GitHub (só o que o InfoPathos precisa). Sem dependências: usa o fetch do Node. */

function criar({ token, repo, branch, apiUrl }) {
  const base = (apiUrl || 'https://api.github.com').replace(/\/$/, '');
  const cab = (extra) => Object.assign({ Authorization: 'Bearer ' + token, 'User-Agent': 'infopathos', 'X-GitHub-Api-Version': '2022-11-28' }, extra);
  const rota = (caminho) => `${base}/repos/${repo}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}`;
  const ref = () => (branch ? `?ref=${encodeURIComponent(branch)}` : '');

  async function falha(r, o_que) {
    let det = '';
    try { det = (await r.json()).message || ''; } catch { /* sem corpo */ }
    const e = new Error(`GitHub (${o_que}): ${r.status} ${det}`.trim());
    e.status = r.status;
    return e;
  }

  /* Lê um arquivo de texto/JSON pequeno. Devolve { sha, buf } ou null se não existir. */
  async function ler(caminho) {
    const r = await fetch(rota(caminho) + ref(), { headers: cab({ Accept: 'application/vnd.github+json' }) });
    if (r.status === 404) return null;
    if (!r.ok) throw await falha(r, 'ler ' + caminho);
    const j = await r.json();
    if (j.content && j.encoding === 'base64') return { sha: j.sha, buf: Buffer.from(j.content, 'base64') };
    // arquivo grande (>1 MB): pede o conteúdo bruto
    const rb = await fetch(rota(caminho) + ref(), { headers: cab({ Accept: 'application/vnd.github.raw+json' }) });
    if (!rb.ok) throw await falha(rb, 'ler ' + caminho);
    return { sha: j.sha, buf: Buffer.from(await rb.arrayBuffer()) };
  }

  /* Só o conteúdo (imagens). Devolve Buffer ou null. */
  async function lerBruto(caminho) {
    const r = await fetch(rota(caminho) + ref(), { headers: cab({ Accept: 'application/vnd.github.raw+json' }) });
    if (r.status === 404) return null;
    if (!r.ok) throw await falha(r, 'ler ' + caminho);
    return Buffer.from(await r.arrayBuffer());
  }

  /* Cria ou atualiza um arquivo. Se alguém mudou o arquivo no meio do caminho: no modo normal busca a versão nova e tenta de novo;
     no modo "estrito" devolve o erro (status 409/422) para quem chamou refazer a conta em cima da versão nova. */
  async function gravar(caminho, buf, mensagem, shaConhecido, { estrito = false } = {}) {
    let sha = shaConhecido;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const corpo = { message: mensagem, content: Buffer.from(buf).toString('base64') };
      if (branch) corpo.branch = branch;
      if (sha) corpo.sha = sha;
      const r = await fetch(rota(caminho), { method: 'PUT', headers: cab({ Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }), body: JSON.stringify(corpo) });
      if (r.ok) return (await r.json()).content.sha;
      if ((r.status === 409 || r.status === 422) && !estrito) { const atual = await ler(caminho); sha = atual ? atual.sha : undefined; continue; }
      throw await falha(r, 'gravar ' + caminho);
    }
    throw new Error('GitHub: conflito ao gravar ' + caminho);
  }

  return { ler, lerBruto, gravar };
}

module.exports = { criar };
