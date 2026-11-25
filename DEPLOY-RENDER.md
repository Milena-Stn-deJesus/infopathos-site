# Colocar o InfoPathos no ar (Render grátis + conteúdo no GitHub)

O site roda na Render. Tudo que a equipe publica no painel é copiado automaticamente, em JSON, para um
**repositório separado** do GitHub (o de dados). Se a Render reiniciar ou "dormir", o site restaura o conteúdo de lá.

## 1. Repositório de dados (uma vez)
1. No GitHub: **New repository** → nome `infopathos-dados` → **Private** → marque **Add a README file** → Create.

## 2. Chave de acesso (uma vez)
1. GitHub → foto do perfil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Nome: `infopathos-render`. Validade: a que preferir (ao vencer, gere outra e troque na Render).
3. **Repository access** → *Only select repositories* → escolha **só** `infopathos-dados`.
4. **Permissions** → *Repository permissions* → **Contents: Read and write**.
5. Gere e **copie o token agora** (ele só aparece uma vez). Não cole em chat nem no código.

## 3. Render
1. Em render.com → **New** → **Blueprint** → escolha o repositório do site (este) → ele lê o `render.yaml`.
2. Preencha quando pedir:
   - `ADMIN_PASSWORD`: a senha do login da equipe de Biomedicina (usuário: `infopathos`).
   - `GITHUB_REPO`: `SEU-USUARIO/infopathos-dados`
   - `GITHUB_TOKEN`: o token do passo 2.
3. **Apply**. Quando terminar, abra o endereço `https://infopathos.onrender.com` (ou o que a Render mostrar).
4. Nos logs deve aparecer: `Cópia automática no GitHub ligada` e `Conteúdo inicial criado`.

## Como funciona
- Cada "Publicar", edição ou exclusão no painel vira uma gravação em `dados.json` no repositório de dados (e as imagens em `uploads/`). Várias mudanças seguidas são agrupadas.
- Ao iniciar, o site lê `dados.json`. Se o repositório estiver vazio, começa com o conteúdo inicial (febre amarela).
- Se o site não conseguir ler o GitHub (token errado, GitHub fora do ar), ele **não sobe**, para não sobrescrever o conteúdo guardado.
- Plano grátis: depois de ~15 minutos sem visitas a Render "dorme"; o primeiro acesso demora um pouco. O conteúdo não se perde.
- A senha do login vem de `ADMIN_PASSWORD`. Para trocar, mude a variável na Render e reinicie.
- Backup: o histórico de commits do repositório de dados guarda todas as versões do conteúdo.
