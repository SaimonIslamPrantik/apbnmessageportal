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
    if (userError || !user) throw new Error("Invalid session");

    const { data: profile, error: profileError } = await caller
      .from("profiles")
      .select("role,banned")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "admin" || profile?.banned) {
      return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: {...cors, "Content-Type":"application/json"} });
    }

    const body = await req.json();
    const targetId = body?.user_id;

    if (!targetId || targetId === user.id) {
      return new Response(JSON.stringify({ error: "Invalid target user" }), { status: 400, headers: {...cors, "Content-Type":"application/json"} });
    }

    const admin = createClient(url, service);
    const { error } = await admin.auth.admin.deleteUser(targetId, false);
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
