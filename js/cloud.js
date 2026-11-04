/* =========================================================
   السحابة: الحسابات ومزامنة التقدّم وسجلّ الإجابات ولوحة المعلّم
   ========================================================= */
const Cloud = (() => {
  const cfg = typeof DHAIQA_CONFIG !== "undefined" ? DHAIQA_CONFIG : {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  let sb = null, ready = false;
  function loadLib() {
    return new Promise((res, rej) => {
      if (window.supabase) return res();
      const s = document.createElement("script"); s.src = LIB; s.onload = res; s.onerror = () => rej(new Error("تعذّر تحميل مكتبة الحسابات"));
      document.head.appendChild(s);
    });
  }
  let user = null, profile = null;
  const listeners = [];
  const emit = () => listeners.forEach((f) => { try { f(user, profile); } catch (e) { console.error(e); } });

  async function loadProfile() {
    if (!user) { profile = null; return; }
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = data || { id: user.id, full_name: user.user_metadata && user.user_metadata.full_name || "", role: (user.user_metadata && user.user_metadata.role) || "student" };
  }
  async function init() {
    if (!enabled) return;
    try { await loadLib(); } catch (e) { console.warn(e.message); return; }
    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    ready = true;
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    await loadProfile(); emit();
    sb.auth.onAuthStateChange(async (_e, session) => {
      const nu = session ? session.user : null;
      if ((nu && nu.id) === (user && user.id)) return;
      user = nu; await loadProfile(); emit();
    });
  }
  const arErr = (e) => {
    const m = (e && e.message) || String(e);
    if (/Invalid login/i.test(m)) return "البريد أو كلمة المرور غير صحيحة.";
    if (/already registered|already exists/i.test(m)) return "هذا البريد مسجّل من قبل؛ سجّل الدخول.";
    if (/Password should be/i.test(m)) return "كلمة المرور قصيرة؛ اجعلها ستة أحرف فأكثر.";
    if (/Email not confirmed/i.test(m)) return "لم يُؤكَّد البريد بعد؛ افتح الرسالة التي وصلتك.";
    if (/valid email|invalid format/i.test(m)) return "صيغة البريد غير صحيحة.";
    if (/rate limit/i.test(m)) return "محاولات كثيرة؛ انتظر قليلاً ثم أعد المحاولة.";
    return m;
  };
  async function signUp(email, password, fullName, role) {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } });
    if (error) throw new Error(arErr(error));
    return { needsConfirm: !data.session };
  }
  async function signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(arErr(error));
  }
  async function signOut() { await sb.auth.signOut(); user = null; profile = null; emit(); }
  async function updateName(name) {
    const { error } = await sb.from("profiles").update({ full_name: name }).eq("id", user.id);
    if (error) throw new Error(arErr(error));
    profile.full_name = name; emit();
  }

  /* ===== التقدّم ===== */
  let pushTimer = null, pendingData = null;
  function pushProgress(data) {
    if (!user) return;
    pendingData = data; clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      const d = pendingData; pendingData = null;
      await sb.from("progress").upsert({ user_id: user.id, data: d, updated_at: new Date().toISOString() });
    }, 1200);
  }
  async function pullProgress() {
    if (!user) return null;
    const { data } = await sb.from("progress").select("data").eq("user_id", user.id).maybeSingle();
    return data ? data.data : null;
  }
  async function logAttempt(level, score, total) {
    if (!user) return;
    await sb.from("attempts").insert({ user_id: user.id, level, score, total });
  }
  let buf = [], bufTimer = null;
  function logAnswer(a) {
    if (!user) return;
    buf.push({ user_id: user.id, ...a });
    clearTimeout(bufTimer);
    bufTimer = setTimeout(flush, buf.length >= 10 ? 0 : 2500);
  }
  async function flush() {
    if (!buf.length || !user) return;
    const rows = buf; buf = [];
    const { error } = await sb.from("answers").insert(rows);
    if (error) console.warn("answers", error.message);
  }
  window.addEventListener("pagehide", flush);

  /* ===== الفصول ===== */
  async function myClasses() {
    if (!user) return [];
    if (profile && profile.role === "teacher") {
      const { data } = await sb.from("classes").select("*").eq("teacher_id", user.id).order("created_at");
      return data || [];
    }
    const { data } = await sb.from("class_members").select("class_id, classes(id, name, code)").eq("student_id", user.id);
    return (data || []).map((r) => r.classes).filter(Boolean);
  }
  async function createClass(name) {
    const { data, error } = await sb.rpc("create_class", { p_name: name });
    if (error) throw new Error(arErr(error));
    return data;
  }
  async function joinClass(code) {
    const { data, error } = await sb.rpc("join_class", { p_code: code });
    if (error) throw new Error(arErr(error));
    return data;
  }
  async function leaveClass(cid) { await sb.from("class_members").delete().eq("class_id", cid).eq("student_id", user.id); }
  async function deleteClass(cid) { const { error } = await sb.from("classes").delete().eq("id", cid); if (error) throw new Error(arErr(error)); }
  async function removeStudent(cid, sid) { await sb.from("class_members").delete().eq("class_id", cid).eq("student_id", sid); }
  async function overview(cid) {
    const { data, error } = await sb.rpc("class_overview", { p_class: cid });
    if (error) throw new Error(arErr(error)); return data || [];
  }
  async function itemStats(cid) {
    const { data, error } = await sb.rpc("class_item_stats", { p_class: cid, p_limit: 15 });
    if (error) throw new Error(arErr(error)); return data || [];
  }
  async function qtypeStats(cid) {
    const { data, error } = await sb.rpc("class_qtype_stats", { p_class: cid });
    if (error) throw new Error(arErr(error)); return data || [];
  }
  async function studentDetail(sid) {
    const [a, t] = await Promise.all([
      sb.from("answers").select("qtype,item,item_kind,ok,level,created_at").eq("user_id", sid).order("created_at", { ascending: false }).limit(500),
      sb.from("attempts").select("level,score,total,created_at").eq("user_id", sid).order("created_at", { ascending: false }).limit(100),
    ]);
    return { answers: a.data || [], attempts: t.data || [] };
  }

  return {
    enabled, get ready() { return ready; }, init, onChange: (f) => listeners.push(f),
    get user() { return user; }, get profile() { return profile; },
    signUp, signIn, signOut, updateName,
    pushProgress, pullProgress, logAttempt, logAnswer, flush,
    myClasses, createClass, joinClass, leaveClass, deleteClass, removeStudent,
    overview, itemStats, qtypeStats, studentDetail,
  };
})();
