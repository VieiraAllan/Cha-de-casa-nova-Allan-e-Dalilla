# Állan & Dalilla — Chá de Casa Nova

Site mobile-first de convite e lista de presentes para o chá de casa nova de Állan e Dalilla. Os convidados reservam o presente online e os anfitriões acompanham tudo por um painel administrativo.

**Site no ar:** https://chadecasa-allanedalilla.netlify.app

## Funcionalidades
**Página pública**
- Lista de presentes com foto, categoria, preço e link para o produto
- Filtro "apenas disponíveis" e ordenação
- Reserva pelo celular, sem cadastro; a reserva é validada no servidor (Edge Function com limite de requisições) para dois convidados não reservarem o mesmo presente
- Atualização em tempo real (Supabase Realtime)

**Painel administrativo (`/admin`)**
- Login com Supabase Auth
- Resumo: total de presentes, disponíveis, reservados e recebidos
- Tabela com o nome de quem reservou cada item
- Cadastrar, editar e excluir presentes
- Alterar o status (disponível, reservado, recebido); a reserva correspondente é atualizada junto


## Estrutura
- `index.html` — página pública
- `admin.html` e `admin.js` — painel administrativo (login, resumo e gestão dos presentes)
- `styles.css` — identidade visual e responsividade
- `app.js` — catálogo, filtros, modal de reserva e Realtime
- `supabase/schema.sql` — banco, RLS, RPC de reserva e Realtime
- `supabase/functions/reservar/index.ts` — Edge Function para reserva com Rate Limit
- `supabase/config.toml` — configuração da função
- `assets/` — reservado para imagens dos presentes

## Identidade visual
Conceito: **romântico contemporâneo** — aconchegante, delicado, moderno e sem aparência de site de casamento tradicional.

Paleta:
- Creme: `#FAF7F2`
- Rosé suave: `#D9A7A0`
- Terracota: `#B97868`
- Verde sálvia: `#A8B7A0`
- Vinho suave: `#6F4A4A`
- Texto: `#302A29`

Tipografia sugerida:
- Títulos: Cormorant Garamond
- Interface/textos: DM Sans

## Antes de publicar
1. Crie um projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL Editor.
3. Crie um usuário para o painel administrativo em Authentication > Users.
4. Preencha no `app.js` a URL e a anon key do projeto.
5. Faça deploy da Edge Function `supabase/functions/reservar/index.ts`.
6. Substitua os dados de exemplo dos presentes.
7. Coloque as imagens reais em `assets/` ou no Supabase Storage.

**Importante:** a `service_role` nunca deve ser colocada no HTML/JS público.
