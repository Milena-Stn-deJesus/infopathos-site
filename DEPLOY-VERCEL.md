# Colocar o InfoPathos no ar na Vercel (grátis)

Na Vercel o site público (HTML, CSS, imagens) sai da pasta `public/`, e uma única função (`api/index.js`) cuida do login, do painel e das imagens
enviadas. O conteúdo fica num arquivo JSON (`dados.json`) num **repositório separado** do GitHub. Não existe servidor ligado nem disco: por isso
nada se perde quando a Vercel "desliga" a função, e o site não precisa "acordar".

## 1. Repositório de dados (uma vez)
1. No GitHub: **New repository** → nome `infopathos-dados` → **Private** → marque **Add a README file** → Create.

## 2. Chave de acesso (uma vez)
1. GitHub → foto do perfil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nome: `infopathos-vercel`. **Repository access** → *Only select repositories* → **só** `infopathos-dados`.
3. **Permissions** → *Repository permissions* → **Contents: Read and write**.
4. Gere e **copie o token agora** (só aparece uma vez). Não cole em chat nem no código.

## 3. Vercel
1. Em vercel.com → **Add New… → Project** → importe o repositório do site (entre com o GitHub).
2. **Framework Preset: Other**. Não mude os comandos de build (o `vercel.json` já define tudo).
3. Em **Environment Variables**, adicione:
   - `ADMIN_PASSWORD`: a senha do login da equipe (usuário: `infopathos`)
   - `SESSION_SECRET`: um texto longo e aleatório (30+ caracteres; qualquer coisa que ninguém adivinhe)
   - `GITHUB_REPO`: `SEU-USUARIO/infopathos-dados`
   - `GITHUB_TOKEN`: o token do passo 2
4. **Deploy**. Abra o endereço `*.vercel.app` que aparecer. Na primeira visita o site cria o `dados.json` com a febre amarela.

## Como funciona e limites
- Cada "Publicar", edição ou exclusão grava no `dados.json` do repositório de dados (e as imagens em `uploads/`). Se duas pessoas salvarem ao mesmo tempo, o site refaz a segunda mudança em cima da primeira, sem perder nenhuma.
- O site público guarda a resposta por ~10 segundos: uma publicação nova pode levar alguns segundos para aparecer para os visitantes.
- Imagens: até 3 MB (o painel já reduz as fotos antes de enviar). A Vercel recusa pedidos acima de ~4,5 MB.
- Para trocar a senha: mude `ADMIN_PASSWORD` na Vercel e faça **Redeploy**.
- O limite de tentativas de login vale por instância da função (é mais fraco que na versão com servidor). Use uma senha forte.
- O histórico de commits do repositório de dados guarda todas as versões do conteúdo (serve de backup).
- Plano gratuito da Vercel (Hobby): confira as regras atuais de uso; ele é voltado a projetos pessoais e não comerciais.
