import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: {...cors, "Content-Type":"application/json"} });
    }

    const token = authHeader.replace("Bearer ", "");
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await caller.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401, headers: {...cors, "Content-Type":"application/json"} });
    }

    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) {
      return new Response(JSON.stringify({ error: "Deletion not confirmed" }), { status: 400, headers: {...cors, "Content-Type":"application/json"} });
    }

    const admin = createClient(url, service);

    // The profiles row cascades its messages because messages.user_id
    // references profiles(id) ON DELETE CASCADE.
    const { error } = await admin.auth.admin.deleteUser(user.id, false);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: {...cors, "Content-Type":"application/json"}
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Deletion failed" }), {
      status: 500, headers: {...cors, "Content-Type":"application/json"}
    });
  }
});
