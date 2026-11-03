import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return Response.json({ error: "Sign in required." }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY", !serviceKey && "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)"]
    .filter(Boolean);
  if (missing.length || !url || !anonKey || !serviceKey) {
    return Response.json({ error: `Missing server environment variable(s): ${missing.join(", ")}. Restart the Next.js server after adding them.` }, { status: 500 });
  }

  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return Response.json({ error: "Invalid session." }, { status: 401 });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: manager } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (manager?.role !== "manager") return Response.json({ error: "Manager access required." }, { status: 403 });

  let body: { accounts?: { name?: string; email?: string; password?: string }[] };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  if (!Array.isArray(body.accounts) || !body.accounts.length || body.accounts.length > 500) {
    return Response.json({ error: "Upload between 1 and 500 accounts at a time." }, { status: 400 });
  }

  const created: { id: string; name: string; email: string }[] = [];
  const errors: string[] = [];
  for (const [index, account] of body.accounts.entries()) {
    const name = String(account.name || "").trim();
    const email = String(account.email || "").trim().toLowerCase();
    const password = String(account.password || "");
    if (!name || !email.includes("@") || password.length < 6) { errors.push(`Row ${index + 2}: name, valid email, and password of at least 6 characters are required.`); continue; }
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name, role: "submanager", manager_id: user.id } });
    if (error || !data.user) { errors.push(`Row ${index + 2}: ${error?.message || "account creation failed"}`); continue; }
    const { error: profileError } = await admin.from("profiles").upsert({ id: data.user.id, email, name, role: "submanager", manager_id: user.id });
    if (profileError) { await admin.auth.admin.deleteUser(data.user.id); errors.push(`Row ${index + 2}: ${profileError.message}`); continue; }
    created.push({ id: data.user.id, name, email });
  }
  return Response.json({ created: created.length, people: created, errors });
}
