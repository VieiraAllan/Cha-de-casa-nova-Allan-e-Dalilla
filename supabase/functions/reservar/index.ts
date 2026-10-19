import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Rate limit simples por IP em memória da instância.
// Para proteção mais forte/multirréplica, usar um storage/serviço
// compartilhado de rate limit ou ampliar a estratégia.
const buckets = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";

  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    bucket.count += 1;
    if (bucket.count > MAX_REQUESTS) {
      return response({ error: "Muitas tentativas. Aguarde um minuto e tente novamente." }, 429);
    }
  }

  let body: { present_id?: string; guest_name?: string };
  try {
    body = await req.json();
  } catch {
    return response({ error: "Requisição inválida." }, 400);
  }

  const presentId = String(body.present_id || "").trim();
  const guestName = String(body.guest_name || "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(presentId)) {
    return response({ error: "Presente inválido." }, 400);
  }
  if (guestName.length < 3 || guestName.length > 120) {
    return response({ error: "Informe seu nome e sobrenome." }, 400);
  }

  const { data, error } = await supabase.rpc("reserve_present", {
    p_present_id: presentId,
    p_guest_name: guestName,
  });

  if (error) {
    return response({ error: error.message }, 409);
  }

  // Não devolvemos nome do convidado ao navegador.
  return response({ ok: true, present_id: presentId }, 201);
});
