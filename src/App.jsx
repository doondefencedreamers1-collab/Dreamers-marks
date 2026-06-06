import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  GraduationCap, Target, BookOpen, Medal, Users, TrendingUp, Award,
  Plus, ChevronRight, ArrowLeft, Calendar, Trash2, Pencil, X, Search,
  Trophy, Activity, FileText, Hash, Upload, LogOut,
  ShieldCheck, User, Lock, Mail, RefreshCw, AlertCircle, FileSpreadsheet, Download, CheckCircle2,
  HeartPulse, Sparkles, AlertTriangle, TrendingDown, Crown, Flame, Star, Zap, Shield, Swords, Gauge,
  ArrowUp, ArrowDown, Minus, Home,
} from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient.js";
import * as A from "./analytics.js";

/* ───────────────────────── Config ───────────────────────── */

const INSTITUTE_NAME = "Dreamers Edu";

const CATEGORIES = {
  class11: { label: "Class 11", short: "11", color: "#60a5fa", icon: BookOpen },
  class12: { label: "Class 12", short: "12", color: "#2dd4bf", icon: GraduationCap },
  nda:     { label: "NDA",      short: "NDA", color: "#f5b544", icon: Target },
  cds:     { label: "CDS",      short: "CDS", color: "#fb7185", icon: Medal },
};
const CAT_ORDER = ["class11", "class12", "nda", "cds"];

const DEFAULT_SUBJECTS = {
  class11: [{ name: "Physics", maxMarks: 100 }, { name: "Chemistry", maxMarks: 100 }, { name: "Maths", maxMarks: 100 }, { name: "English", maxMarks: 100 }],
  class12: [{ name: "Physics", maxMarks: 100 }, { name: "Chemistry", maxMarks: 100 }, { name: "Maths", maxMarks: 100 }, { name: "English", maxMarks: 100 }],
  nda:     [{ name: "Mathematics", maxMarks: 300 }, { name: "General Ability (GAT)", maxMarks: 600 }],
  cds:     [{ name: "English", maxMarks: 100 }, { name: "General Knowledge", maxMarks: 100 }, { name: "Elementary Maths", maxMarks: 100 }],
};

// Houses — yahan naam/colour badal sakte hain (apne coaching ke houses ke hisaab se)
const HOUSES = {
  Shivaji: "#f5b544",
  Tagore:  "#34d399",
  Ashoka:  "#60a5fa",
  Raman:   "#fb7185",
};
const HOUSE_NAMES = Object.keys(HOUSES);
const houseColor = (h) => HOUSES[h] || "#8a94ad";

const BADGE_ICONS = { Crown, Flame, Shield, Swords, Star, TrendingUp, CheckCircle2 };

/* ───────────────────────── Mapping (DB <-> app) ───────────────────────── */

const mapStudent = (r) => ({ id: r.id, name: r.name, roll: r.roll, category: r.category, house: r.house || "" });
const mapTest = (r) => ({
  id: r.id, studentId: r.student_id, category: r.category, testName: r.test_name,
  date: r.test_date, subjects: r.subjects || [],
  total: Number(r.total) || 0, maxTotal: Number(r.max_total) || 0, percentage: Number(r.percentage) || 0,
});
const testToRow = (t) => ({
  student_id: t.studentId, category: t.category, test_name: t.testName, test_date: t.date,
  subjects: t.subjects, total: t.total, max_total: t.maxTotal, percentage: t.percentage,
});

/* ───────────────────────── Helpers ───────────────────────── */

const round = (n) => Math.round(n * 10) / 10;
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return d; } };
const pctColor = (p) => (p >= 75 ? "#34d399" : p >= 50 ? "#f5b544" : "#fb7185");

/* ───────────────────────── Root ───────────────────────── */

export default function App() {
  const [data, setData] = useState({ students: [], tests: [] });
  const [session, setSession] = useState(null); // {role:'director'} | {role:'student', roll}
  const [loaded, setLoaded] = useState(false);
  const [synced, setSynced] = useState(false);

  const fetchAll = useCallback(async () => {
    const [{ data: st }, { data: te }] = await Promise.all([
      supabase.from("students").select("*").order("created_at"),
      supabase.from("tests").select("*").order("created_at"),
    ]);
    setData({ students: (st || []).map(mapStudent), tests: (te || []).map(mapTest) });
    setSynced(true); setTimeout(() => setSynced(false), 1200);
  }, []);

  // initial: restore session + first fetch
  useEffect(() => {
    (async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (sess) setSession({ role: "director" });
      else { const roll = localStorage.getItem("de_roll"); if (roll) setSession({ role: "student", roll }); }
      await fetchAll();
      setLoaded(true);
    })();
  }, [fetchAll]);

  // realtime + polling fallback
  useEffect(() => {
    if (!loaded) return;
    const ch = supabase.channel("rt-dreamers")
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "tests" }, fetchAll)
      .subscribe();
    const poll = setInterval(fetchAll, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [loaded, fetchAll]);

  /* auth */
  const loginDirector = async (email, pass) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pass });
    if (error) return "Email ya password galat hai.";
    setSession({ role: "director" }); fetchAll(); return null;
  };
  const loginStudent = (roll) => { localStorage.setItem("de_roll", roll); setSession({ role: "student", roll }); };
  const logout = async () => { await supabase.auth.signOut(); localStorage.removeItem("de_roll"); setSession(null); };

  /* mutations (director only — RLS enforced on server) */
  const mut = {
    addStudent: async (s) => { await supabase.from("students").insert({ name: s.name, roll: s.roll, category: s.category, house: s.house || null }); fetchAll(); },
    updateStudent: async (s) => { await supabase.from("students").update({ name: s.name, roll: s.roll, category: s.category, house: s.house || null }).eq("id", s.id); fetchAll(); },
    deleteStudent: async (id) => { await supabase.from("students").delete().eq("id", id); fetchAll(); },
    addTest: async (t) => { await supabase.from("tests").insert(testToRow(t)); fetchAll(); },
    updateTest: async (t) => { await supabase.from("tests").update(testToRow(t)).eq("id", t.id); fetchAll(); },
    deleteTest: async (id) => { await supabase.from("tests").delete().eq("id", id); fetchAll(); },
    bulkUpload: async ({ category, testName, date, parsed }) => {
      const rollToId = {};
      data.students.forEach((s) => { rollToId[s.roll] = s.id; });
      let created = 0; const skipped = [];
      // create missing students that include a Name (dedupe by roll)
      const seen = new Set();
      const toCreate = parsed.filter((p) => !rollToId[p.roll] && p.name && !seen.has(p.roll) && seen.add(p.roll));
      if (toCreate.length) {
        const { data: ins } = await supabase.from("students")
          .insert(toCreate.map((p) => ({ name: p.name, roll: p.roll, category, house: p.house || null }))).select();
        (ins || []).forEach((s) => { rollToId[s.roll] = s.id; created++; });
      }
      const testRows = [];
      parsed.forEach((p) => {
        const sid = rollToId[p.roll];
        if (!sid) { skipped.push(p.roll); return; }
        testRows.push({ student_id: sid, category, test_name: testName, test_date: date, subjects: p.subjects, total: p.total, max_total: p.maxTotal, percentage: p.percentage });
      });
      if (testRows.length) await supabase.from("tests").insert(testRows);
      await fetchAll();
      return { added: testRows.length, created, skipped };
    },
  };

  if (!loaded) return <div className="cpt-root"><style>{STYLES}</style><div className="loading">Loading…</div></div>;
  if (!session) return <Wrapper><Login data={data} onLoginDirector={loginDirector} onLoginStudent={loginStudent} /></Wrapper>;
  if (session.role === "director") return <Wrapper><Director data={data} mut={mut} synced={synced} onLogout={logout} /></Wrapper>;
  return <Wrapper><Student data={data} roll={session.roll} synced={synced} onLogout={logout} /></Wrapper>;
}

function Wrapper({ children }) { return <div className="cpt-root"><style>{STYLES}</style>{children}</div>; }

/* ───────────────────────── Login ───────────────────────── */

function Login({ data, onLoginDirector, onLoginStudent }) {
  const [tab, setTab] = useState("student");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [roll, setRoll] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const doDirector = async () => {
    setBusy(true); setErr("");
    const e = await onLoginDirector(email, pass);
    setBusy(false); if (e) setErr(e);
  };
  const doStudent = () => {
    const r = roll.trim();
    if (!r) return setErr("Apna roll number daalein.");
    if (data.students.some((s) => s.roll === r)) onLoginStudent(r);
    else setErr("Is roll number ka koi student nahi mila.");
  };

  return (
    <div className="auth-screen">
      <div className="auth-card fade-in">
        <div className="auth-logo"><Trophy size={26} /></div>
        <h1 className="auth-title">{INSTITUTE_NAME}</h1>
        <p className="auth-sub">Performance Command Center</p>

        <div className="auth-tabs">
          <button className={tab === "student" ? "on" : ""} onClick={() => { setTab("student"); setErr(""); }}><User size={15} /> Student</button>
          <button className={tab === "director" ? "on" : ""} onClick={() => { setTab("director"); setErr(""); }}><ShieldCheck size={15} /> Director</button>
        </div>

        {tab === "student" ? (
          <>
            <Field label="Roll Number" icon={Hash} value={roll} set={setRoll} placeholder="e.g. 24" onEnter={doStudent} />
            {err && <div className="auth-err"><AlertCircle size={14} /> {err}</div>}
            <button className="btn primary full" onClick={doStudent}>View My Performance</button>
            <p className="auth-hint">Roll number Dreamers Edu se mila hoga.</p>
          </>
        ) : (
          <>
            <Field label="Email" icon={Mail} value={email} set={setEmail} placeholder="director@email.com" type="email" />
            <Field label="Password" icon={Lock} value={pass} set={setPass} placeholder="••••••" type="password" onEnter={doDirector} />
            {err && <div className="auth-err"><AlertCircle size={14} /> {err}</div>}
            <button className="btn primary full" disabled={busy} onClick={doDirector}>{busy ? "Logging in…" : "Login as Director"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, set, placeholder, type = "text", onEnter }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div className="auth-input">
        {Icon && <Icon size={15} />}
        <input type={type} value={value} placeholder={placeholder}
          onChange={(e) => set(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }} />
      </div>
    </label>
  );
}

/* ───────────────────────── Top Bar ───────────────────────── */

function TopBar({ roleLabel, roleIcon: RIcon, roleColor, synced, onLogout, onHome }) {
  return (
    <header className="cpt-topbar">
      <div className="brand" onClick={onHome} role="button">
        <div className="brand-mark"><Trophy size={18} /></div>
        <div>
          <div className="brand-title">{INSTITUTE_NAME}</div>
          <div className="brand-sub">Performance Command Center</div>
        </div>
      </div>
      <div className="topbar-right">
        <span className={"sync-dot " + (synced ? "on" : "")} title="Live sync">
          {synced ? <RefreshCw size={13} /> : <Activity size={13} />}{synced ? "Synced" : "Live"}
        </span>
        <span className="role-badge" style={{ "--c": roleColor }}><RIcon size={13} /> {roleLabel}</span>
        <button className="btn ghost icon" onClick={onLogout} title="Logout"><LogOut size={15} /></button>
      </div>
    </header>
  );
}

/* ───────────────────────── Director ───────────────────────── */

function Director({ data, mut, synced, onLogout }) {
  const [view, setView] = useState("dashboard");
  const [activeCat, setActiveCat] = useState(null);
  const [activeStudentId, setActiveStudentId] = useState(null);
  const [studentModal, setStudentModal] = useState(null);
  const [testModal, setTestModal] = useState(null);
  const [uploadPicker, setUploadPicker] = useState(false);
  const [bulkModal, setBulkModal] = useState(false);

  const catStudents = (cat) => data.students.filter((s) => s.category === cat);
  const findByRoll = (roll) => {
    const s = data.students.find((x) => x.roll === roll.trim());
    if (!s) return false;
    setActiveCat(s.category); setActiveStudentId(s.id); setView("student"); return true;
  };
  const studentTests = (sid) => data.tests.filter((t) => t.studentId === sid).sort((a, b) => new Date(a.date) - new Date(b.date));
  const rankOf = (test) => {
    const peers = data.tests.filter((t) => t.category === test.category && t.testName.trim().toLowerCase() === test.testName.trim().toLowerCase());
    const sorted = [...peers].sort((a, b) => b.percentage - a.percentage);
    return { rank: sorted.findIndex((t) => t.id === test.id) + 1, total: peers.length };
  };
  const liveStudent = activeStudentId ? data.students.find((s) => s.id === activeStudentId) : null;
  const existingRolls = data.students.map((s) => s.roll).filter(Boolean);

  return (
    <>
      <TopBar roleLabel="Director" roleIcon={ShieldCheck} roleColor="#f5b544" synced={synced} onLogout={onLogout} onHome={() => setView("dashboard")} />
      <main className="cpt-main">
        {view === "dashboard" ? (
          <Dashboard data={data} catStudents={catStudents} studentTests={studentTests}
            onOpenCategory={(c) => { setActiveCat(c); setView("category"); }} onUpload={() => setUploadPicker(true)}
            onBulk={() => setBulkModal(true)} onFindStudent={findByRoll} />
        ) : view === "category" ? (
          <CategoryView cat={activeCat} students={catStudents(activeCat)} studentTests={studentTests}
            onBack={() => setView("dashboard")} onAddStudent={() => setStudentModal({ category: activeCat })}
            onOpenStudent={(s) => { setActiveStudentId(s.id); setView("student"); }} />
        ) : liveStudent ? (
          <StudentView student={liveStudent} tests={studentTests(liveStudent.id)} rankOf={rankOf} readOnly={false}
            allTests={data.tests} allStudents={data.students}
            onBack={() => setView("category")}
            onAddTest={() => setTestModal({ studentId: liveStudent.id, category: liveStudent.category })}
            onEditTest={(t) => setTestModal({ studentId: liveStudent.id, category: liveStudent.category, edit: t })}
            onDeleteTest={mut.deleteTest}
            onEditStudent={() => setStudentModal({ category: liveStudent.category, edit: liveStudent })}
            onDeleteStudent={() => { mut.deleteStudent(liveStudent.id); setView("category"); }} />
        ) : null}
      </main>

      {studentModal && (
        <StudentModal info={studentModal} existingRolls={existingRolls} onClose={() => setStudentModal(null)}
          onSave={(s) => { studentModal.edit ? mut.updateStudent(s) : mut.addStudent(s); setStudentModal(null); }} />
      )}
      {testModal && (
        <TestModal info={testModal} onClose={() => setTestModal(null)}
          onSave={(t) => { testModal.edit ? mut.updateTest(t) : mut.addTest(t); setTestModal(null); }} />
      )}
      {uploadPicker && (
        <UploadPicker catStudents={catStudents} onClose={() => setUploadPicker(false)}
          onPick={(studentId, category) => { setUploadPicker(false); setTestModal({ studentId, category }); }}
          onAddStudent={(category) => { setUploadPicker(false); setStudentModal({ category }); }} />
      )}
      {bulkModal && (
        <BulkUploadModal catStudents={catStudents} onClose={() => setBulkModal(false)} onConfirm={mut.bulkUpload} />
      )}
    </>
  );
}

/* ───────────────────────── Student ───────────────────────── */

function Student({ data, roll, synced, onLogout }) {
  const student = data.students.find((s) => s.roll === roll);
  const tests = student ? data.tests.filter((t) => t.studentId === student.id).sort((a, b) => new Date(a.date) - new Date(b.date)) : [];
  const rankOf = (test) => {
    const peers = data.tests.filter((t) => t.category === test.category && t.testName.trim().toLowerCase() === test.testName.trim().toLowerCase());
    const sorted = [...peers].sort((a, b) => b.percentage - a.percentage);
    return { rank: sorted.findIndex((t) => t.id === test.id) + 1, total: peers.length };
  };
  return (
    <>
      <TopBar roleLabel={student ? student.name : "Student"} roleIcon={User} roleColor="#60a5fa" synced={synced} onLogout={onLogout} onHome={() => {}} />
      <main className="cpt-main">
        {!student ? (
          <div className="empty"><AlertCircle size={32} /><p>Aapka record ab available nahi hai. Director se sampark karein.</p>
            <button className="btn primary" onClick={onLogout}>Login screen</button></div>
        ) : (
          <StudentView student={student} tests={tests} rankOf={rankOf} readOnly={true} allTests={data.tests} allStudents={data.students} />
        )}
      </main>
    </>
  );
}

/* ───────────────────────── Dashboard ───────────────────────── */

function Dashboard({ data, catStudents, studentTests, onOpenCategory, onUpload, onBulk, onFindStudent }) {
  const totalStudents = data.students.length;
  const totalTests = data.tests.length;
  const avgPct = data.tests.length ? round(data.tests.reduce((a, t) => a + t.percentage, 0) / data.tests.length) : 0;
  const recent = [...data.tests].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  const studentName = (id) => data.students.find((s) => s.id === id)?.name || "—";
  const atRisk = A.atRiskStudents(data.students, data.tests).slice(0, 6);
  const improvers = A.topImprovers(data.students, data.tests, 5);
  const houseLb = A.houseLeaderboard(data.students, data.tests);

  return (
    <div className="fade-in">
      <div className="page-head">
        <div><h1 className="page-title">Dashboard</h1><p className="page-desc">Poore batch ka performance — class wise &amp; exam wise.</p></div>
        <div className="head-actions">
          <button className="btn ghost" onClick={onBulk}><FileSpreadsheet size={16} /> Bulk Excel</button>
          <button className="btn primary" onClick={onUpload}><Upload size={16} /> Upload Marks</button>
        </div>
      </div>
      <RollSearch onFind={onFindStudent} />
      <div className="stat-strip">
        <StatBox icon={Users} label="Total Students" value={totalStudents} accent="#60a5fa" />
        <StatBox icon={FileText} label="Tests Recorded" value={totalTests} accent="#2dd4bf" />
        <StatBox icon={TrendingUp} label="Avg Percentage" value={avgPct + "%"} accent={pctColor(avgPct)} />
      </div>
      <h2 className="section-label">Categories</h2>
      <div className="cat-grid">
        {CAT_ORDER.map((cat, i) => {
          const c = CATEGORIES[cat]; const studs = catStudents(cat);
          const tests = studs.flatMap((s) => studentTests(s.id));
          const cAvg = tests.length ? round(tests.reduce((a, t) => a + t.percentage, 0) / tests.length) : 0;
          const Icon = c.icon;
          return (
            <button key={cat} className="cat-card" style={{ animationDelay: i * 70 + "ms", "--c": c.color }} onClick={() => onOpenCategory(cat)}>
              <div className="cat-glow" />
              <div className="cat-card-top"><div className="cat-icon"><Icon size={22} /></div><ChevronRight size={18} className="cat-arrow" /></div>
              <div className="cat-name">{c.label}</div>
              <div className="cat-stats"><span><b>{studs.length}</b> students</span><span><b>{tests.length}</b> tests</span></div>
              <div className="cat-bar"><div className="cat-bar-fill" style={{ width: Math.max(cAvg, 3) + "%" }} /></div>
              <div className="cat-avg">Avg {cAvg}%</div>
            </button>
          );
        })}
      </div>
      <h2 className="section-label">Recent Activity</h2>
      {recent.length === 0 ? (
        <div className="empty soft">Abhi koi test record nahi hua. Upload Marks dabaiye ya category mein jaiye.</div>
      ) : (
        <div className="recent-list">
          {recent.map((t) => { const c = CATEGORIES[t.category]; return (
            <div className="recent-row" key={t.id}>
              <span className="tag" style={{ "--c": c.color }}>{c.short}</span>
              <div className="recent-main"><div className="recent-name">{studentName(t.studentId)}</div><div className="recent-sub">{t.testName} · {fmtDate(t.date)}</div></div>
              <div className="recent-pct" style={{ color: pctColor(t.percentage) }}>{round(t.percentage)}%</div>
            </div>); })}
        </div>
      )}

      {/* ── House Leaderboard ── */}
      {houseLb.length > 0 && (<>
        <h2 className="section-label">House Leaderboard</h2>
        <div className="house-lb">
          {houseLb.map((h) => (
            <div className="house-lb-row" key={h.house} style={{ "--c": houseColor(h.house) }}>
              <span className="lb-rank">#{h.rank}</span>
              <span className="lb-dot" />
              <div className="lb-main"><div className="lb-name">{h.house}</div>
                <div className="lb-sub">{h.students} students · {h.tests} tests{h.top ? " · Top: " + h.top.name : ""}</div></div>
              <div className="lb-avg" style={{ color: pctColor(h.avg) }}>{h.avg}%</div>
            </div>
          ))}
        </div>
      </>)}

      {/* ── At-Risk Students ── */}
      {atRisk.length > 0 && (<>
        <h2 className="section-label"><AlertTriangle size={15} style={{ verticalAlign: "-2px", color: "#fb7185" }} /> At-Risk Students</h2>
        <div className="risk-list">
          {atRisk.map(({ student, avg, latest, reasons }) => { const cc = CATEGORIES[student.category]; return (
            <div className="risk-row" key={student.id}>
              <span className="tag" style={{ "--c": cc.color }}>{cc.short}</span>
              <div className="risk-main"><div className="risk-name">{student.name} <small>Roll {student.roll}{student.house ? " · " + student.house : ""}</small></div>
                <div className="risk-reasons">{reasons.join(" · ")}</div></div>
              <div className="risk-nums"><b style={{ color: pctColor(latest) }}>{latest}%</b><small>avg {avg}%</small></div>
            </div>); })}
        </div>
      </>)}

      {/* ── Top Improvers ── */}
      {improvers.length > 0 && (<>
        <h2 className="section-label"><Flame size={15} style={{ verticalAlign: "-2px", color: "#f5b544" }} /> Top Improvers</h2>
        <div className="risk-list">
          {improvers.map(({ student, gain, from, to }) => { const cc = CATEGORIES[student.category]; return (
            <div className="risk-row" key={student.id}>
              <span className="tag" style={{ "--c": cc.color }}>{cc.short}</span>
              <div className="risk-main"><div className="risk-name">{student.name} <small>Roll {student.roll}</small></div>
                <div className="risk-reasons">{from}% → {to}% average</div></div>
              <div className="risk-nums"><b style={{ color: "#34d399" }}>+{gain}%</b><small>improvement</small></div>
            </div>); })}
        </div>
      </>)}
    </div>
  );
}

function StatBox({ icon: Icon, label, value, accent }) {
  return (<div className="stat-box"><div className="stat-ic" style={{ color: accent, background: accent + "1f" }}><Icon size={18} /></div><div className="stat-val">{value}</div><div className="stat-lab">{label}</div></div>);
}

function RollSearch({ onFind }) {
  const [roll, setRoll] = useState("");
  const [err, setErr] = useState("");
  const go = () => {
    const r = roll.trim();
    if (!r) return;
    const ok = onFind(r);
    if (!ok) setErr("Is roll number ka student nahi mila.");
    else { setErr(""); setRoll(""); }
  };
  return (
    <div className="roll-search">
      <div className="search">
        <Search size={15} />
        <input placeholder="Roll number se student dhoondein…" value={roll}
          onChange={(e) => { setRoll(e.target.value); setErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") go(); }} />
      </div>
      <button className="btn ghost" onClick={go}>Search</button>
      {err && <span className="roll-err"><AlertCircle size={13} /> {err}</span>}
    </div>
  );
}

/* ───────────────────────── Category View ───────────────────────── */

function CategoryView({ cat, students, studentTests, onBack, onAddStudent, onOpenStudent }) {
  const c = CATEGORIES[cat];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const rows = students.map((s) => {
    const tests = studentTests(s.id).sort((a, b) => new Date(b.date) - new Date(a.date));
    const avg = tests.length ? round(tests.reduce((a, t) => a + t.percentage, 0) / tests.length) : 0;
    return { s, count: tests.length, avg, latest: tests[0]?.percentage ?? null };
  });
  const filtered = rows.filter((r) => r.s.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.s.name.localeCompare(b.s.name) : sort === "avg" ? b.avg - a.avg : b.count - a.count));

  return (
    <div className="fade-in">
      <button className="back-btn" onClick={onBack}><ArrowLeft size={16} /> Dashboard</button>
      <div className="page-head">
        <div className="cat-head" style={{ "--c": c.color }}><div className="cat-head-ic"><c.icon size={24} /></div>
          <div><h1 className="page-title">{c.label}</h1><p className="page-desc">{students.length} students is batch mein.</p></div></div>
        <button className="btn primary" onClick={onAddStudent}><Plus size={16} /> Add Student</button>
      </div>
      {students.length === 0 ? (
        <div className="empty"><Users size={32} /><p>Is category mein abhi koi student nahi.</p>
          <button className="btn primary" onClick={onAddStudent}><Plus size={16} /> Pehla student add karo</button></div>
      ) : (
        <>
          <div className="toolbar">
            <div className="search"><Search size={15} /><input placeholder="Search student…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <div className="seg">{[["name", "Name"], ["avg", "Top Avg"], ["count", "Most Tests"]].map(([k, l]) => (<button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>))}</div>
          </div>
          <div className="student-grid">
            {filtered.map((r) => (
              <button key={r.s.id} className="student-card" onClick={() => onOpenStudent(r.s)} style={{ "--c": c.color }}>
                <div className="avatar">{r.s.name.charAt(0).toUpperCase()}</div>
                <div className="student-main"><div className="student-name">{r.s.name}</div>
                  <div className="student-roll">{r.s.roll ? "Roll " + r.s.roll : "No roll no."}
                    {r.s.house && <span className="house-tag" style={{ "--c": houseColor(r.s.house) }}><span className="house-dot" /> {r.s.house}</span>}
                  </div></div>
                <div className="student-metrics">
                  <div className="m"><span className="m-val" style={{ color: r.latest != null ? pctColor(r.latest) : "#5a6478" }}>{r.latest != null ? round(r.latest) + "%" : "—"}</span><span className="m-lab">Latest</span></div>
                  <div className="m"><span className="m-val">{r.avg || "—"}{r.avg ? "%" : ""}</span><span className="m-lab">Avg</span></div>
                  <div className="m"><span className="m-val">{r.count}</span><span className="m-lab">Tests</span></div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Student View ───────────────────────── */

function StudentView({ student, tests, rankOf, readOnly, allTests = [], allStudents = [], onBack, onAddTest, onEditTest, onDeleteTest, onEditStudent, onDeleteStudent }) {
  const c = CATEGORIES[student.category];
  const [confirmDel, setConfirmDel] = useState(false);
  const avg = tests.length ? round(tests.reduce((a, t) => a + t.percentage, 0) / tests.length) : 0;
  const best = tests.length ? round(Math.max(...tests.map((t) => t.percentage))) : 0;
  const latest = tests.length ? round(tests[tests.length - 1].percentage) : 0;
  const latestRank = tests.length ? rankOf(tests[tests.length - 1]) : null;
  const trend = tests.map((t, i) => ({ name: t.testName.length > 10 ? t.testName.slice(0, 9) + "…" : t.testName, idx: i + 1, pct: round(t.percentage) }));
  const subjMap = {};
  tests.forEach((t) => (t.subjects || []).forEach((s) => {
    if (!s.maxMarks) return; const p = (Number(s.marks) / Number(s.maxMarks)) * 100;
    if (!subjMap[s.name]) subjMap[s.name] = { sum: 0, n: 0 }; subjMap[s.name].sum += p; subjMap[s.name].n += 1;
  }));
  const subjData = Object.entries(subjMap).map(([name, v]) => ({ name, pct: round(v.sum / v.n) }));

  // ---- analytics (rule-based, from existing data) ----
  const health = A.healthScore(tests);
  const predicted = A.predictNext(tests);
  const target = A.nextTarget(tests);
  const sStats = A.subjectStats(tests);
  const bwTest = A.bestWorstTest(tests);
  const tl = A.trendLabel(tests);
  const arrows = A.trendArrows(tests);
  const move = A.rankMovement(allTests, tests);
  const lastTest = tests.length ? tests[tests.length - 1] : null;
  const houseRank = lastTest ? A.houseRankForTest(allTests, allStudents, lastTest) : null;
  const myBadges = A.badges(tests, { classRank: latestRank?.rank });
  const message = A.motivationMessage(tests);
  const plan = A.smartPlan(tests);

  return (
    <div className="fade-in">
      {!readOnly && <button className="back-btn" onClick={onBack}><ArrowLeft size={16} /> {c.label}</button>}
      <div className="student-head" style={{ "--c": c.color }}>
        <div className="avatar lg">{student.name.charAt(0).toUpperCase()}</div>
        <div className="student-head-main"><h1 className="page-title">{student.name}</h1>
          <p className="page-desc"><span className="tag inline" style={{ "--c": c.color }}>{c.label}</span>
            {student.house && <span className="tag inline" style={{ "--c": houseColor(student.house), marginLeft: 6 }}>{student.house} House</span>}
            {student.roll ? " · Roll " + student.roll : ""}</p></div>
        {!readOnly && (<div className="student-head-actions">
          <button className="btn ghost icon" onClick={onEditStudent} title="Edit"><Pencil size={15} /></button>
          <button className="btn ghost icon danger" onClick={() => setConfirmDel(true)} title="Delete"><Trash2 size={15} /></button>
          <button className="btn primary" onClick={onAddTest}><Plus size={16} /> Add Test</button>
        </div>)}
      </div>
      <div className="stat-strip four">
        <StatBox icon={Activity} label="Latest" value={tests.length ? latest + "%" : "—"} accent={pctColor(latest)} />
        <StatBox icon={TrendingUp} label="Average" value={tests.length ? avg + "%" : "—"} accent="#60a5fa" />
        <StatBox icon={Award} label="Best" value={tests.length ? best + "%" : "—"} accent="#34d399" />
        <StatBox icon={Trophy} label="Latest Rank" value={latestRank ? "#" + latestRank.rank + "/" + latestRank.total : "—"} accent="#f5b544" />
      </div>
      {tests.length === 0 ? (
        <div className="empty"><FileText size={32} /><p>{readOnly ? "Abhi koi test record nahi hua. Naye test ke baad yahan analytics dikhenge." : "Abhi koi test add nahi hua is student ka."}</p>
          {!readOnly && <button className="btn primary" onClick={onAddTest}><Plus size={16} /> Pehla test add karo</button>}</div>
      ) : (
        <>
          {/* ── Performance Health + Predicted + Trend ── */}
          <div className="insight-grid3">
            <div className="health-card" style={{ "--c": health.color }}>
              <div className="health-top"><HeartPulse size={16} /> Performance Health</div>
              <div className="health-score">{health.score}<small>/100</small></div>
              <div className="health-grade" style={{ color: health.color }}>{health.grade}</div>
            </div>
            <div className="ins-card">
              <div className="ins-top"><Gauge size={15} /> Predicted Next</div>
              <div className="ins-big" style={{ color: predicted.predicted != null ? pctColor(predicted.predicted) : "#5a6478" }}>
                {predicted.predicted != null ? predicted.predicted + "%" : "—"}
              </div>
              <div className="ins-sub">Confidence: {predicted.confidence}</div>
            </div>
            <div className="ins-card">
              <div className="ins-top">{tl.label === "Declining" ? <TrendingDown size={15} /> : <TrendingUp size={15} />} Trend</div>
              <div className="ins-big" style={{ fontSize: 17 }}>{tl.label}</div>
              <div className="arrow-row">{arrows.map((a, i) => (
                <span key={i} className="arrow-pill" style={{ color: pctColor(a) }}>{a}{i < arrows.length - 1 ? <span className="arr">→</span> : null}</span>
              ))}</div>
            </div>
          </div>

          {/* ── Badges ── */}
          {myBadges.length > 0 && (
            <div className="badge-row">
              {myBadges.map((b) => { const Ic = BADGE_ICONS[b.icon] || Award; return (
                <span className="badge-chip" key={b.key}><Ic size={14} /> {b.label}</span>
              ); })}
            </div>
          )}

          {/* ── Next Target ── */}
          <div className="target-box">
            <div className="target-head"><Target size={16} /> Next Target</div>
            <div className="target-flow">
              <div className="tf"><span>Current Avg</span><b>{target.current}%</b></div>
              <ChevronRight size={18} className="tf-arrow" />
              <div className="tf"><span>Next Target</span><b style={{ color: "#34d399" }}>{target.target}%</b></div>
              <div className="tf"><span>Gap</span><b style={{ color: "#f5b544" }}>+{target.gap}%</b></div>
            </div>
            {target.subjects.length > 0 && (
              <div className="target-needs">
                {target.subjects.slice(0, 4).map((s) => (
                  <span key={s.name} className="need-pill">+{s.needMarks} marks <b>{s.name}</b></span>
                ))}
              </div>
            )}
          </div>

          {/* ── Strength & Weakness ── */}
          <h2 className="section-label">Strength &amp; Weakness</h2>
          <div className="sw-grid">
            {sStats.map((s) => (
              <div className="sw-row" key={s.name}>
                <div className="sw-main"><span className="sw-name">{s.name}</span>
                  <span className={"pill " + s.status.toLowerCase()}>{s.status}</span></div>
                <div className="sw-bar"><div className="sw-fill" style={{ width: Math.max(s.pct, 3) + "%", background: pctColor(s.pct) }} /></div>
                <div className="sw-meta"><b style={{ color: pctColor(s.pct) }}>{s.pct}%</b><span>{s.action}</span></div>
              </div>
            ))}
          </div>

          {/* ── Highlights: best/weak subject, best/worst test, ranks ── */}
          <div className="hl-grid">
            <div className="hl-card up"><Sparkles size={15} /><div><span>Strongest Subject</span><b>{sStats[0]?.name || "—"}</b><small>{sStats[0] ? sStats[0].pct + "%" : ""}</small></div></div>
            <div className="hl-card down"><AlertTriangle size={15} /><div><span>Weakest Subject</span><b>{sStats.length > 1 ? sStats[sStats.length - 1].name : "—"}</b><small>{sStats.length > 1 ? sStats[sStats.length - 1].pct + "%" : ""}</small></div></div>
            <div className="hl-card up"><Award size={15} /><div><span>Best Test</span><b>{bwTest.best?.testName || "—"}</b><small>{bwTest.best ? round(bwTest.best.percentage) + "%" : ""}</small></div></div>
            <div className="hl-card">
              {move && move.delta > 0 ? <ArrowUp size={15} color="#34d399" /> : move && move.delta < 0 ? <ArrowDown size={15} color="#fb7185" /> : <Minus size={15} />}
              <div><span>Rank Movement</span>
                <b>{latestRank ? "#" + latestRank.rank : "—"}{houseRank ? <span className="hr"> · House #{houseRank.rank}</span> : ""}</b>
                <small>{move && move.previous ? (move.delta > 0 ? `+${move.delta} upar` : move.delta < 0 ? `${move.delta} neeche` : "same") : "first test"}</small></div>
            </div>
          </div>

          {/* ── Smart Improvement Plan ── */}
          {plan && (plan.plan7.length > 0 || plan.strongSubjects.length > 0) && (
            <div className="plan-box">
              <div className="plan-head"><Zap size={16} /> Smart Improvement Plan <span className="plan-tgt">Target {plan.nextTargetPct}%</span></div>
              {plan.plan7.length > 0 && <div className="plan-sec"><span className="plan-lab">Next 7 days</span><ul>{plan.plan7.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
              {plan.plan15.length > 0 && <div className="plan-sec"><span className="plan-lab">Next 15 days</span><ul>{plan.plan15.map((p, i) => <li key={i}>{p}</li>)}</ul></div>}
            </div>
          )}

          {/* ── Motivation banner ── */}
          <div className="msg-banner" style={{ "--c": pctColor(latest) }}><Sparkles size={16} /> {message}</div>

          <div className="charts">
            <div className="chart-card"><div className="chart-title"><TrendingUp size={15} /> Percentage Trend</div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#8a94ad", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#8a94ad", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip suffix="%" />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
                  <Line type="monotone" dataKey="pct" stroke={c.color} strokeWidth={2.5} dot={{ r: 3, fill: c.color }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card"><div className="chart-title"><Hash size={15} /> Subject Strength (avg %)</div>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={subjData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#8a94ad", fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#8a94ad", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip suffix="%" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                  <Bar dataKey="pct" radius={[5, 5, 0, 0]} maxBarSize={46}>{subjData.map((e, i) => <Cell key={i} fill={pctColor(e.pct)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <h2 className="section-label">Test History</h2>
          <div className="test-table">
            <div className={"tt-head" + (readOnly ? " ro" : "")}><span>Test</span><span>Date</span><span>Score</span><span>%</span><span>Rank</span>{!readOnly && <span></span>}</div>
            {[...tests].reverse().map((t) => { const r = rankOf(t); return (
              <div className={"tt-row" + (readOnly ? " ro" : "")} key={t.id}>
                <span className="tt-name">{t.testName}</span>
                <span className="tt-muted"><Calendar size={12} /> {fmtDate(t.date)}</span>
                <span className="tt-muted">{t.total}/{t.maxTotal}</span>
                <span style={{ color: pctColor(t.percentage), fontWeight: 700 }}>{round(t.percentage)}%</span>
                <span className="tt-rank">#{r.rank}<small>/{r.total}</small></span>
                {!readOnly && <span className="tt-actions">
                  <button onClick={() => onEditTest(t)} title="Edit"><Pencil size={13} /></button>
                  <button className="danger" onClick={() => onDeleteTest(t.id)} title="Delete"><Trash2 size={13} /></button>
                </span>}
              </div>); })}
          </div>
        </>
      )}
      {confirmDel && (
        <div className="overlay" onClick={() => setConfirmDel(false)}>
          <div className="modal sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete student?</h3>
            <p className="modal-desc">{student.name} aur unke saare tests permanently delete ho jayenge.</p>
            <div className="modal-foot"><button className="btn ghost" onClick={() => setConfirmDel(false)}>Cancel</button>
              <button className="btn danger-solid" onClick={onDeleteStudent}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartTip({ active, payload, label, suffix = "" }) {
  if (!active || !payload || !payload.length) return null;
  return <div className="chart-tip"><div className="ct-label">{label}</div><div className="ct-val">{payload[0].value}{suffix}</div></div>;
}

/* ───────────────────────── Upload Picker ───────────────────────── */

function UploadPicker({ catStudents, onClose, onPick, onAddStudent }) {
  const [cat, setCat] = useState(null);
  const [sid, setSid] = useState("");
  const students = cat ? catStudents(cat) : [];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 className="modal-title"><Upload size={18} /> Upload Marks</h3><button className="x" onClick={onClose}><X size={18} /></button></div>
        <p className="step-label">1 · Class chuniye</p>
        <div className="class-pick">
          {CAT_ORDER.map((k) => { const c = CATEGORIES[k]; return (
            <button key={k} className={"class-btn" + (cat === k ? " on" : "")} style={{ "--c": c.color }} onClick={() => { setCat(k); setSid(""); }}>
              <c.icon size={18} /> {c.label}<small>{catStudents(k).length} students</small>
            </button>); })}
        </div>
        {cat && (<>
          <p className="step-label">2 · Student chuniye</p>
          {students.length === 0 ? (
            <div className="empty soft" style={{ marginBottom: 14 }}>Is class mein koi student nahi.
              <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => onAddStudent(cat)}><Plus size={14} /> Add Student</button></div>
          ) : (
            <select className="select" value={sid} onChange={(e) => setSid(e.target.value)}>
              <option value="">— select student —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}{s.roll ? " (Roll " + s.roll + ")" : ""}</option>)}
            </select>
          )}
        </>)}
        <div className="modal-foot"><button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!sid} onClick={() => onPick(sid, cat)}>Continue →</button></div>
      </div>
    </div>
  );
}

/* ───────────────────────── Bulk Upload (Excel) ───────────────────────── */

function BulkUploadModal({ catStudents, onClose, onConfirm }) {
  const [cat, setCat] = useState(null);
  const [testName, setTestName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [parsed, setParsed] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState(null);
  const subjects = cat ? DEFAULT_SUBJECTS[cat] : [];

  const downloadTemplate = () => {
    const headers = ["Roll", "Name", "House", ...subjects.map((s) => `${s.name} (/${s.maxMarks})`)];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, `${CATEGORIES[cat].label.replace(/\s/g, "")}_template.xlsx`);
  };

  const handleFile = async (e) => {
    setErr(""); setParsed(null);
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const out = [];
      rows.forEach((row) => {
        const keys = Object.keys(row);
        const rollKey = keys.find((k) => k.toLowerCase().includes("roll"));
        const nameKey = keys.find((k) => k.toLowerCase().includes("name"));
        const houseKey = keys.find((k) => k.toLowerCase().includes("house"));
        const roll = String(row[rollKey] ?? "").trim();
        if (!roll) return;
        const subs = subjects.map((s) => {
          const k = keys.find((kk) => kk.toLowerCase().includes(s.name.toLowerCase()));
          return { name: s.name, marks: Number(row[k]) || 0, maxMarks: s.maxMarks };
        });
        const total = subs.reduce((a, x) => a + x.marks, 0);
        const maxTotal = subs.reduce((a, x) => a + x.maxMarks, 0);
        const percentage = maxTotal ? Math.round((total / maxTotal) * 1000) / 10 : 0;
        out.push({ roll, name: String(row[nameKey] ?? "").trim(), house: houseKey ? String(row[houseKey] ?? "").trim() : "", subjects: subs, total, maxTotal, percentage });
      });
      if (!out.length) return setErr("Koi valid row nahi mili. Template ka format use karein.");
      setParsed(out);
    } catch { setErr("File padhne mein dikkat. Sahi Excel (.xlsx) ya CSV file dalein."); }
  };

  const existRolls = cat ? new Set(catStudents(cat).map((s) => s.roll)) : new Set();
  const matched = parsed ? parsed.filter((p) => existRolls.has(p.roll)).length : 0;
  const newWithName = parsed ? parsed.filter((p) => !existRolls.has(p.roll) && p.name).length : 0;
  const willSkip = parsed ? parsed.filter((p) => !existRolls.has(p.roll) && !p.name).length : 0;

  const confirm = async () => {
    setBusy(true);
    const res = await onConfirm({ category: cat, testName: testName.trim(), date, parsed });
    setBusy(false); setSummary(res);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 className="modal-title"><FileSpreadsheet size={18} /> Bulk Upload (Excel)</h3><button className="x" onClick={onClose}><X size={18} /></button></div>

        {summary ? (
          <div className="bulk-summary">
            <CheckCircle2 size={40} color="#34d399" />
            <h3>Upload complete!</h3>
            <p><b>{summary.added}</b> tests upload hue{summary.created ? `, ${summary.created} naye students bhi bane` : ""}.</p>
            {summary.skipped.length > 0 && (
              <p className="skip-note"><AlertCircle size={14} /> {summary.skipped.length} row skip hui (roll match nahi hua aur Name bhi nahi tha): {summary.skipped.slice(0, 8).join(", ")}{summary.skipped.length > 8 ? "…" : ""}</p>
            )}
            <button className="btn primary full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <p className="step-label">1 · Class chuniye</p>
            <div className="class-pick">
              {CAT_ORDER.map((k) => { const c = CATEGORIES[k]; return (
                <button key={k} className={"class-btn" + (cat === k ? " on" : "")} style={{ "--c": c.color }} onClick={() => { setCat(k); setParsed(null); setErr(""); }}>
                  <c.icon size={18} /> {c.label}<small>{catStudents(k).length} students</small>
                </button>); })}
            </div>

            {cat && (<>
              <div className="grid2">
                <label className="field"><span>Test Name *</span><input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Weekly Test 5" /></label>
                <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              </div>

              <p className="step-label">2 · Template download karke marks bharein</p>
              <p className="bulk-hint">Columns: Roll, Name, House (optional), aur har subject ({subjects.map((s) => `${s.name} /${s.maxMarks}`).join(", ")}). Roll se purane student match honge; naya roll + Name diya to naya student ban jayega (House bhi save hoga).</p>
              <button className="btn ghost" disabled={!testName.trim()} onClick={downloadTemplate}><Download size={15} /> Download Template (.xlsx)</button>

              <p className="step-label" style={{ marginTop: 18 }}>3 · Bhari hui file upload karein</p>
              <input className="file-input" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} disabled={!testName.trim()} />
              {err && <div className="auth-err" style={{ marginTop: 12 }}><AlertCircle size={14} /> {err}</div>}

              {parsed && (
                <div className="bulk-preview">
                  <div><b>{parsed.length}</b> rows mili</div>
                  <div className="ok">✓ {matched} existing match</div>
                  {newWithName > 0 && <div className="new">+ {newWithName} naye banenge</div>}
                  {willSkip > 0 && <div className="skip">⚠ {willSkip} skip honge (Name nahi)</div>}
                </div>
              )}
            </>)}

            <div className="modal-foot">
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={!parsed || !testName.trim() || busy} onClick={confirm}>{busy ? "Uploading…" : "Upload All"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Student Modal ───────────────────────── */

function StudentModal({ info, existingRolls, onClose, onSave }) {
  const edit = info.edit;
  const c = CATEGORIES[info.category];
  const [name, setName] = useState(edit?.name || "");
  const [roll, setRoll] = useState(edit?.roll || "");
  const [house, setHouse] = useState(edit?.house || "");
  const dupRoll = roll.trim() && existingRolls.includes(roll.trim()) && roll.trim() !== edit?.roll;
  const valid = name.trim() && roll.trim() && !dupRoll;
  const submit = () => { if (!valid) return; onSave({ id: edit?.id, name: name.trim(), roll: roll.trim(), category: info.category, house }); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 className="modal-title">{edit ? "Edit Student" : "Add Student"} <span className="tag" style={{ "--c": c.color }}>{c.short}</span></h3><button className="x" onClick={onClose}><X size={18} /></button></div>
        <label className="field"><span>Student Name *</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aarav Singh" autoFocus /></label>
        <label className="field"><span>Roll Number * (student isi se login karega)</span><input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 24" /></label>
        {dupRoll && <div className="auth-err"><AlertCircle size={14} /> Ye roll number pehle se kisi student ka hai.</div>}
        <label className="field"><span>House</span>
          <div className="house-pick">
            <button type="button" className={"house-chip" + (house === "" ? " on" : "")} style={{ "--c": "#8a94ad" }} onClick={() => setHouse("")}>None</button>
            {HOUSE_NAMES.map((h) => (
              <button type="button" key={h} className={"house-chip" + (house === h ? " on" : "")} style={{ "--c": houseColor(h) }} onClick={() => setHouse(h)}>
                <span className="house-dot" /> {h}
              </button>
            ))}
          </div>
        </label>
        <div className="modal-foot"><button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={submit}>{edit ? "Save" : "Add Student"}</button></div>
      </div>
    </div>
  );
}

/* ───────────────────────── Test Modal ───────────────────────── */

function TestModal({ info, onClose, onSave }) {
  const edit = info.edit;
  const c = CATEGORIES[info.category];
  const [testName, setTestName] = useState(edit?.testName || "");
  const [date, setDate] = useState(edit?.date || new Date().toISOString().slice(0, 10));
  // Test type: "single" = ek hi subject (e.g. Maths /300), "full" = poore subjects
  const [mode, setMode] = useState(edit ? (edit.subjects?.length === 1 ? "single" : "full") : "full");
  const [subjects, setSubjects] = useState(
    edit?.subjects?.map((s) => ({ ...s })) || DEFAULT_SUBJECTS[info.category].map((s) => ({ name: s.name, marks: "", maxMarks: s.maxMarks }))
  );
  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    if (m === "single") setSubjects([{ name: "Maths", marks: "", maxMarks: "" }]);
    else setSubjects(DEFAULT_SUBJECTS[info.category].map((s) => ({ name: s.name, marks: "", maxMarks: s.maxMarks })));
  };
  const setSub = (i, key, val) => setSubjects((arr) => arr.map((s, j) => (j === i ? { ...s, [key]: val } : s)));
  const addSub = () => setSubjects((arr) => [...arr, { name: "", marks: "", maxMarks: 100 }]);
  const removeSub = (i) => setSubjects((arr) => arr.filter((_, j) => j !== i));
  const total = subjects.reduce((a, s) => a + (Number(s.marks) || 0), 0);
  const maxTotal = subjects.reduce((a, s) => a + (Number(s.maxMarks) || 0), 0);
  const pct = maxTotal ? round((total / maxTotal) * 100) : 0;
  const valid = testName.trim() && maxTotal > 0 && subjects.some((s) => s.marks !== "");
  const submit = () => {
    if (!valid) return;
    const clean = subjects.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), marks: Number(s.marks) || 0, maxMarks: Number(s.maxMarks) || 0 }));
    onSave({ id: edit?.id, studentId: info.studentId, category: info.category, testName: testName.trim(), date, subjects: clean, total, maxTotal, percentage: pct });
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h3 className="modal-title">{edit ? "Edit Test" : "Add Test"} <span className="tag" style={{ "--c": c.color }}>{c.short}</span></h3><button className="x" onClick={onClose}><X size={18} /></button></div>

        <div className="subj-head"><span>Test Type</span></div>
        <div className="seg full" style={{ marginBottom: 6 }}>
          <button className={mode === "single" ? "on" : ""} onClick={() => switchMode("single")}>Single Subject</button>
          <button className={mode === "full" ? "on" : ""} onClick={() => switchMode("full")}>Full Subjects</button>
        </div>
        <p className="bulk-hint" style={{ margin: "0 0 14px" }}>
          {mode === "single"
            ? "Ek hi subject ka test (e.g. sirf Maths /300). Neeche 'Out of' me test ke total marks likhein."
            : "Poore subjects wala exam. Har subject ke marks aur 'Out of' daalein."}
        </p>

        <div className="grid2">
          <label className="field"><span>Test Name *</span><input value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="e.g. Weekly Test 5" autoFocus /></label>
          <label className="field"><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
        <div className="subj-head"><span>Subjects &amp; Marks</span>{mode === "full" && <button className="add-subj" onClick={addSub}><Plus size={13} /> Subject</button>}</div>
        <div className="subj-list">
          <div className="subj-row labels"><span>Subject</span><span>Marks</span><span>Out of</span><span></span></div>
          {subjects.map((s, i) => (
            <div className="subj-row" key={i}>
              <input value={s.name} placeholder="Subject" onChange={(e) => setSub(i, "name", e.target.value)} />
              <input type="number" value={s.marks} placeholder="0" min="0" onChange={(e) => setSub(i, "marks", e.target.value)} />
              <input type="number" value={s.maxMarks} placeholder={mode === "single" ? "e.g. 300" : "100"} min="1" onChange={(e) => setSub(i, "maxMarks", e.target.value)} />
              <button className="rm" onClick={() => removeSub(i)} disabled={mode === "single" || subjects.length <= 1}><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="test-summary">
          <div><span>Total</span><b>{total}<small>/{maxTotal}</small></b></div>
          <div><span>Percentage</span><b style={{ color: pctColor(pct) }}>{pct}%</b></div>
          <div className="note"><Trophy size={13} /> Percentage = Total ÷ (sum of "Out of"). Rank auto-calculate hoga.</div>
        </div>
        <div className="modal-foot"><button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!valid} onClick={submit}>{edit ? "Save Test" : "Upload Test"}</button></div>
      </div>
    </div>
  );
}

/* ───────────────────────── Styles ───────────────────────── */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..800&family=Manrope:wght@400..800&family=Space+Mono:wght@400;700&display=swap');
.cpt-root{--bg:#080b14;--bg2:#0c1120;--surface:#111729;--surface2:#161e34;--line:rgba(255,255,255,0.07);--line2:rgba(255,255,255,0.12);--tx:#e7ecf6;--muted:#8a94ad;--faint:#5a6478;--gold:#f5b544;font-family:'Manrope',sans-serif;color:var(--tx);min-height:100vh;background:radial-gradient(900px 500px at 85% -10%,rgba(245,181,68,0.07),transparent 60%),radial-gradient(700px 500px at -5% 110%,rgba(96,165,250,0.07),transparent 60%),var(--bg);-webkit-font-smoothing:antialiased;}
.cpt-root *{box-sizing:border-box;}
.cpt-main{max-width:1080px;margin:0 auto;padding:26px 20px 80px;}
.loading{padding:80px;text-align:center;color:var(--muted);}
.cpt-topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;padding:13px 20px;background:rgba(8,11,20,0.82);backdrop-filter:blur(14px);border-bottom:1px solid var(--line);}
.brand{display:flex;gap:11px;align-items:center;cursor:pointer;min-width:0;}
.brand-mark{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;background:linear-gradient(140deg,var(--gold),#d98b1f);color:#1a1305;box-shadow:0 4px 16px rgba(245,181,68,0.3);}
.brand-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:16px;letter-spacing:.3px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;}
.brand-sub{font-size:10px;color:var(--muted);letter-spacing:1.3px;text-transform:uppercase;margin-top:3px;}
.topbar-right{display:flex;align-items:center;gap:9px;}
.sync-dot{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--muted);padding:5px 10px;border:1px solid var(--line);border-radius:99px;transition:.3s;}
.sync-dot.on{color:#34d399;border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.08);}
.role-badge{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:99px;color:var(--c);background:color-mix(in srgb,var(--c) 15%,transparent);border:1px solid color-mix(in srgb,var(--c) 35%,transparent);}
.auth-screen{min-height:100vh;display:grid;place-items:center;padding:22px;}
.auth-card{width:100%;max-width:380px;background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line2);border-radius:22px;padding:30px 26px;text-align:center;box-shadow:0 30px 70px rgba(0,0,0,.45);}
.auth-logo{width:54px;height:54px;border-radius:16px;margin:0 auto 16px;display:grid;place-items:center;background:linear-gradient(140deg,var(--gold),#d98b1f);color:#1a1305;box-shadow:0 8px 24px rgba(245,181,68,.35);}
.auth-title{font-family:'Bricolage Grotesque';font-weight:800;font-size:23px;margin:0;letter-spacing:-.3px;}
.auth-sub{color:var(--muted);font-size:13px;margin:6px 0 22px;}
.auth-tabs{display:flex;gap:6px;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:4px;margin-bottom:20px;}
.auth-tabs button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:none;border:none;color:var(--muted);font-family:'Manrope';font-weight:700;font-size:13px;padding:10px;border-radius:9px;cursor:pointer;transition:.2s;}
.auth-tabs button.on{background:var(--surface2);color:var(--tx);}
.auth-field{display:block;text-align:left;margin-bottom:13px;}
.auth-field>span{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px;}
.auth-input{display:flex;align-items:center;gap:9px;background:var(--bg2);border:1px solid var(--line2);border-radius:11px;padding:0 13px;color:var(--muted);transition:.2s;}
.auth-input:focus-within{border-color:var(--gold);}
.auth-input input{flex:1;background:none;border:none;outline:none;color:var(--tx);font-family:'Manrope';font-size:14px;padding:12px 0;}
.auth-err{display:flex;align-items:center;gap:7px;color:#fb7185;font-size:12.5px;background:rgba(251,113,133,.1);border:1px solid rgba(251,113,133,.25);border-radius:9px;padding:9px 12px;margin-bottom:14px;text-align:left;}
.auth-hint{font-size:11.5px;color:var(--faint);margin:13px 0 0;}
.btn.full{width:100%;justify-content:center;margin-top:6px;padding:12px;}
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:22px;flex-wrap:wrap;}
.page-title{font-family:'Bricolage Grotesque';font-weight:800;font-size:30px;letter-spacing:-.5px;margin:0;line-height:1;}
.page-desc{color:var(--muted);font-size:13.5px;margin:7px 0 0;}
.section-label{font-family:'Bricolage Grotesque';font-size:14px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--muted);margin:30px 0 14px;}
.stat-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:8px;}
.stat-strip.four{grid-template-columns:repeat(4,1fr);}
.stat-box{background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:15px;padding:16px 17px;}
.stat-ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;margin-bottom:11px;}
.stat-val{font-family:'Space Mono',monospace;font-size:25px;font-weight:700;line-height:1;letter-spacing:-1px;}
.stat-lab{font-size:11.5px;color:var(--muted);margin-top:5px;letter-spacing:.3px;}
.cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.cat-card{position:relative;overflow:hidden;text-align:left;cursor:pointer;background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:17px;padding:18px;color:var(--tx);transition:.25s;opacity:0;animation:rise .5s cubic-bezier(.2,.7,.3,1) forwards;}
.cat-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--c) 50%,transparent);box-shadow:0 14px 34px rgba(0,0,0,.4);}
.cat-glow{position:absolute;inset:0;background:radial-gradient(140px 90px at 80% 0%,var(--c),transparent 70%);opacity:.16;pointer-events:none;}
.cat-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;position:relative;}
.cat-icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c);}
.cat-arrow{color:var(--muted);transition:.2s;}
.cat-card:hover .cat-arrow{transform:translateX(3px);color:var(--c);}
.cat-name{font-family:'Bricolage Grotesque';font-weight:700;font-size:20px;}
.cat-stats{display:flex;gap:14px;font-size:12px;color:var(--muted);margin:8px 0 14px;}
.cat-stats b{color:var(--tx);}
.cat-bar{height:5px;background:rgba(255,255,255,0.07);border-radius:99px;overflow:hidden;}
.cat-bar-fill{height:100%;background:var(--c);border-radius:99px;transition:width .6s;}
.cat-avg{font-family:'Space Mono',monospace;font-size:11.5px;color:var(--muted);margin-top:8px;}
.recent-list{display:flex;flex-direction:column;gap:8px;}
.recent-row{display:flex;align-items:center;gap:13px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 15px;}
.recent-main{flex:1;min-width:0;}
.recent-name{font-weight:600;font-size:14px;}
.recent-sub{font-size:12px;color:var(--muted);margin-top:2px;}
.recent-pct{font-family:'Space Mono',monospace;font-weight:700;font-size:16px;}
.tag{font-size:10.5px;font-weight:700;letter-spacing:.5px;padding:4px 9px;border-radius:7px;background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c);white-space:nowrap;}
.tag.inline{display:inline-block;vertical-align:middle;}
.btn{display:inline-flex;align-items:center;gap:7px;font-family:'Manrope';font-weight:600;font-size:13.5px;padding:9px 15px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:.2s;}
.btn.primary{background:linear-gradient(140deg,var(--gold),#e09a28);color:#1a1305;box-shadow:0 4px 14px rgba(245,181,68,.28);}
.btn.primary:hover{transform:translateY(-1px);box-shadow:0 7px 20px rgba(245,181,68,.36);}
.btn.primary:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none;}
.btn.ghost{background:var(--surface2);border-color:var(--line2);color:var(--tx);}
.btn.ghost:hover{background:#1d2742;}
.btn.ghost.icon{padding:9px;}
.btn.ghost.danger:hover{color:#fb7185;border-color:rgba(251,113,133,.4);}
.btn.danger-solid{background:#e0455e;color:#fff;}
.back-btn{display:inline-flex;align-items:center;gap:6px;background:none;border:none;color:var(--muted);font-family:'Manrope';font-size:13px;font-weight:600;cursor:pointer;padding:6px 0;margin-bottom:14px;}
.back-btn:hover{color:var(--tx);}
.cat-head{display:flex;gap:14px;align-items:center;}
.cat-head-ic{width:50px;height:50px;border-radius:14px;display:grid;place-items:center;background:color-mix(in srgb,var(--c) 16%,transparent);color:var(--c);}
.toolbar{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;}
.search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:0 13px;flex:1;min-width:180px;color:var(--muted);}
.search input{background:none;border:none;outline:none;color:var(--tx);font-family:'Manrope';font-size:13.5px;padding:10px 0;width:100%;}
.seg{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:3px;}
.seg button{background:none;border:none;color:var(--muted);font-family:'Manrope';font-weight:600;font-size:12.5px;padding:7px 12px;border-radius:7px;cursor:pointer;transition:.2s;}
.seg button.on{background:var(--surface2);color:var(--tx);}
.seg.full{display:flex;width:100%;}
.seg.full button{flex:1;text-align:center;}
.house-pick{display:flex;flex-wrap:wrap;gap:7px;}
.house-chip{display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--line2);color:var(--tx);font-family:'Manrope';font-weight:600;font-size:13px;padding:8px 12px;border-radius:9px;cursor:pointer;transition:.18s;}
.house-chip .house-dot{width:9px;height:9px;border-radius:50%;background:var(--c);}
.house-chip:hover{border-color:color-mix(in srgb,var(--c) 50%,transparent);}
.house-chip.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 14%,var(--bg2));color:var(--c);}
.house-tag{display:inline-flex;align-items:center;gap:5px;margin-left:8px;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:6px;color:var(--c);background:color-mix(in srgb,var(--c) 15%,transparent);}
.house-tag .house-dot{width:7px;height:7px;border-radius:50%;background:var(--c);}
.student-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;}
.student-card{display:flex;align-items:center;gap:13px;text-align:left;cursor:pointer;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;color:var(--tx);transition:.2s;}
.student-card:hover{border-color:color-mix(in srgb,var(--c) 45%,transparent);transform:translateY(-2px);box-shadow:0 10px 26px rgba(0,0,0,.35);}
.avatar{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;font-family:'Bricolage Grotesque';font-weight:700;font-size:18px;background:color-mix(in srgb,var(--c) 18%,transparent);color:var(--c);}
.avatar.lg{width:58px;height:58px;font-size:24px;border-radius:15px;}
.student-main{flex:1;min-width:0;}
.student-name{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.student-roll{font-size:11.5px;color:var(--muted);margin-top:2px;}
.student-metrics{display:flex;gap:14px;}
.student-metrics .m{text-align:center;}
.m-val{display:block;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;}
.m-lab{display:block;font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:2px;}
.student-head{display:flex;gap:16px;align-items:center;margin-bottom:22px;flex-wrap:wrap;}
.student-head-main{flex:1;min-width:160px;}
.student-head-actions{display:flex;gap:8px;align-items:center;}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:8px;}
.chart-card{background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:16px;padding:16px 14px 8px;}
.chart-title{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:var(--muted);margin:0 4px 10px;letter-spacing:.3px;}
.chart-tip{background:#0a0e1a;border:1px solid var(--line2);border-radius:9px;padding:8px 11px;}
.ct-label{font-size:11px;color:var(--muted);margin-bottom:3px;}
.ct-val{font-family:'Space Mono',monospace;font-weight:700;font-size:15px;}
.test-table{border:1px solid var(--line);border-radius:14px;overflow:hidden;}
.tt-head,.tt-row{display:grid;grid-template-columns:1.6fr 1.1fr .9fr .7fr .9fr .8fr;align-items:center;gap:10px;padding:12px 16px;}
.tt-head.ro,.tt-row.ro{grid-template-columns:1.6fr 1.1fr .9fr .7fr .9fr;}
.tt-head{background:var(--bg2);font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:700;}
.tt-row{border-top:1px solid var(--line);font-size:13.5px;background:var(--surface);}
.tt-row:hover{background:var(--surface2);}
.tt-name{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tt-muted{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:12.5px;}
.tt-rank{font-family:'Space Mono',monospace;font-weight:700;}
.tt-rank small{color:var(--muted);font-weight:400;}
.tt-actions{display:flex;gap:4px;justify-content:flex-end;}
.tt-actions button{background:none;border:none;color:var(--muted);cursor:pointer;padding:6px;border-radius:7px;transition:.15s;}
.tt-actions button:hover{background:var(--surface2);color:var(--tx);}
.tt-actions button.danger:hover{color:#fb7185;}
.empty{display:flex;flex-direction:column;align-items:center;gap:12px;padding:50px 20px;text-align:center;color:var(--muted);background:var(--surface);border:1px dashed var(--line2);border-radius:16px;}
.empty.soft{padding:24px;border-style:solid;}
.empty p{margin:0;font-size:14px;}
.overlay{position:fixed;inset:0;background:rgba(4,6,12,.7);backdrop-filter:blur(5px);z-index:50;display:grid;place-items:center;padding:18px;animation:fade .2s;}
.modal{width:100%;max-width:430px;background:var(--surface);border:1px solid var(--line2);border-radius:18px;padding:22px;max-height:90vh;overflow-y:auto;animation:pop .25s cubic-bezier(.2,.8,.3,1);}
.modal.lg{max-width:540px;}.modal.sm{max-width:360px;}
.modal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.modal-title{font-family:'Bricolage Grotesque';font-weight:700;font-size:20px;margin:0;display:flex;align-items:center;gap:10px;}
.modal-desc{color:var(--muted);font-size:13.5px;margin:0 0 18px;line-height:1.5;}
.x{background:none;border:none;color:var(--muted);cursor:pointer;padding:5px;border-radius:7px;}
.x:hover{background:var(--surface2);color:var(--tx);}
.field{display:block;margin-bottom:14px;}
.field>span{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px;}
.field input{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px;color:var(--tx);font-family:'Manrope';font-size:14px;outline:none;transition:.2s;}
.field input:focus{border-color:var(--gold);}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:8px;}
.step-label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin:0 0 10px;}
.class-pick{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:18px;}
.class-btn{display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:var(--bg2);border:1px solid var(--line2);border-radius:12px;padding:13px;color:var(--tx);font-family:'Manrope';font-weight:700;font-size:14px;cursor:pointer;transition:.2s;}
.class-btn svg{color:var(--c);}
.class-btn small{font-weight:500;font-size:11px;color:var(--muted);}
.class-btn.on{border-color:var(--c);background:color-mix(in srgb,var(--c) 12%,var(--bg2));}
.select{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:12px 13px;color:var(--tx);font-family:'Manrope';font-size:14px;outline:none;margin-bottom:8px;}
.select:focus{border-color:var(--gold);}
.subj-head{display:flex;align-items:center;justify-content:space-between;margin:6px 0 8px;}
.subj-head span{font-size:12.5px;font-weight:600;color:var(--muted);}
.add-subj{display:flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--line2);color:var(--tx);font-family:'Manrope';font-weight:600;font-size:12px;padding:6px 10px;border-radius:8px;cursor:pointer;}
.add-subj:hover{border-color:var(--gold);}
.subj-list{display:flex;flex-direction:column;gap:7px;margin-bottom:14px;}
.subj-row{display:grid;grid-template-columns:1fr 70px 70px 30px;gap:7px;align-items:center;}
.subj-row.labels{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);padding:0 2px;}
.subj-row input{background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:9px 10px;color:var(--tx);font-family:'Manrope';font-size:13.5px;outline:none;width:100%;}
.subj-row input:focus{border-color:var(--gold);}
.rm{background:none;border:none;color:var(--muted);cursor:pointer;display:grid;place-items:center;padding:8px;border-radius:7px;}
.rm:hover{color:#fb7185;background:var(--surface2);}
.rm:disabled{opacity:.3;cursor:not-allowed;}
.test-summary{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:18px;display:flex;gap:24px;align-items:center;flex-wrap:wrap;}
.test-summary>div span{display:block;font-size:11px;color:var(--muted);margin-bottom:3px;}
.test-summary>div b{font-family:'Space Mono',monospace;font-size:20px;}
.test-summary>div b small{font-size:13px;color:var(--muted);font-weight:400;}
.test-summary .note{flex:1;min-width:160px;display:flex;align-items:center;gap:7px;font-size:11.5px;color:var(--muted);line-height:1.4;border-left:1px solid var(--line2);padding-left:18px;}
.test-summary .note svg{color:var(--gold);flex-shrink:0;}
.head-actions{display:flex;gap:9px;flex-wrap:wrap;}
.roll-search{display:flex;gap:9px;align-items:center;margin-bottom:22px;flex-wrap:wrap;}
.roll-search .search{flex:1;min-width:200px;max-width:420px;}
.roll-err{display:flex;align-items:center;gap:5px;color:#fb7185;font-size:12px;}
.bulk-hint{font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px;}
.file-input{width:100%;background:var(--bg2);border:1px solid var(--line2);border-radius:10px;padding:11px 13px;color:var(--tx);font-family:'Manrope';font-size:13px;}
.file-input:disabled{opacity:.4;}
.bulk-preview{display:flex;gap:14px;flex-wrap:wrap;background:var(--bg2);border:1px solid var(--line);border-radius:11px;padding:13px 15px;margin-top:14px;font-size:13px;}
.bulk-preview b{font-family:'Space Mono',monospace;}
.bulk-preview .ok{color:#34d399;}
.bulk-preview .new{color:#60a5fa;}
.bulk-preview .skip{color:#f5b544;}
.bulk-summary{text-align:center;padding:14px 6px 6px;}
.bulk-summary h3{font-family:'Bricolage Grotesque';font-size:22px;margin:12px 0 8px;}
.bulk-summary p{color:var(--muted);font-size:14px;margin:0 0 8px;line-height:1.5;}
.bulk-summary .skip-note{display:flex;gap:7px;align-items:flex-start;justify-content:center;color:#f5b544;font-size:12.5px;background:rgba(245,181,68,.08);border:1px solid rgba(245,181,68,.2);border-radius:9px;padding:10px;margin:6px 0 14px;text-align:left;}
@keyframes rise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade{from{opacity:0;}to{opacity:1;}}
@keyframes pop{from{opacity:0;transform:scale(.96) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}
.fade-in{animation:fade .35s ease;}
@media(max-width:760px){
.cat-grid{grid-template-columns:repeat(2,1fr);}
.stat-strip,.stat-strip.four{grid-template-columns:repeat(2,1fr);}
.student-grid{grid-template-columns:1fr;}
.charts{grid-template-columns:1fr;}
.page-title{font-size:25px;}
.brand-title{max-width:130px;}
.brand-sub{display:none;}
.tt-head{display:none;}
.tt-row,.tt-row.ro{grid-template-columns:1fr auto;gap:5px 10px;padding:14px;}
.tt-name{grid-column:1/2;}.tt-actions{grid-column:2/3;grid-row:1/3;}
.tt-muted,.tt-rank{font-size:12px;}
}
/* ── Phase 1 analytics UI ── */
.insight-grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:13px;margin-bottom:13px;}
.health-card{background:linear-gradient(165deg,color-mix(in srgb,var(--c) 14%,var(--surface)),var(--bg2));border:1px solid color-mix(in srgb,var(--c) 35%,var(--line));border-radius:16px;padding:16px 17px;}
.health-top{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--muted);}
.health-score{font-family:'Space Mono',monospace;font-size:34px;font-weight:700;line-height:1;margin:9px 0 3px;letter-spacing:-1px;}
.health-score small{font-size:14px;color:var(--muted);}
.health-grade{font-weight:700;font-size:13.5px;}
.ins-card{background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:16px;padding:16px 17px;}
.ins-top{display:flex;align-items:center;gap:7px;font-size:12.5px;font-weight:700;color:var(--muted);}
.ins-big{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;line-height:1;margin:9px 0 4px;letter-spacing:-.5px;}
.ins-sub{font-size:11.5px;color:var(--muted);}
.arrow-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-top:4px;font-family:'Space Mono',monospace;font-size:13px;font-weight:700;}
.arrow-pill .arr{color:var(--muted);margin:0 4px;font-weight:400;}
.badge-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.badge-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--gold);background:rgba(245,181,68,.12);border:1px solid rgba(245,181,68,.3);border-radius:99px;padding:6px 12px;}
.target-box{background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:8px;}
.target-head{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:700;color:var(--muted);margin-bottom:13px;}
.target-flow{display:flex;align-items:center;gap:16px;flex-wrap:wrap;}
.tf span{display:block;font-size:11px;color:var(--muted);margin-bottom:3px;}
.tf b{font-family:'Space Mono',monospace;font-size:21px;}
.tf-arrow{color:var(--muted);}
.target-needs{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;}
.need-pill{font-size:12px;color:var(--tx);background:var(--bg2);border:1px solid var(--line2);border-radius:8px;padding:6px 11px;}
.need-pill b{color:var(--gold);}
.sw-grid{display:flex;flex-direction:column;gap:10px;}
.sw-row{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:13px 15px;}
.sw-main{display:flex;align-items:center;gap:9px;margin-bottom:9px;}
.sw-name{font-weight:700;font-size:14px;}
.pill{font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:6px;text-transform:uppercase;letter-spacing:.4px;}
.pill.strong{color:#34d399;background:rgba(52,211,153,.13);}
.pill.average{color:#f5b544;background:rgba(245,181,68,.13);}
.pill.weak{color:#fb7185;background:rgba(251,113,133,.13);}
.sw-bar{height:6px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden;margin-bottom:8px;}
.sw-fill{height:100%;border-radius:99px;transition:width .6s;}
.sw-meta{display:flex;align-items:baseline;gap:10px;}
.sw-meta b{font-family:'Space Mono',monospace;font-size:15px;}
.sw-meta span{font-size:12px;color:var(--muted);}
.hl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:16px 0 8px;}
.hl-card{display:flex;align-items:flex-start;gap:11px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 15px;}
.hl-card>svg{flex-shrink:0;margin-top:2px;color:var(--muted);}
.hl-card.up>svg{color:#34d399;}.hl-card.down>svg{color:#fb7185;}
.hl-card span{display:block;font-size:11px;color:var(--muted);}
.hl-card b{display:block;font-size:15px;font-weight:700;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px;}
.hl-card small{font-family:'Space Mono',monospace;font-size:12px;color:var(--muted);}
.hl-card .hr{font-weight:400;color:var(--muted);font-size:12px;}
.plan-box{background:linear-gradient(165deg,var(--surface),var(--bg2));border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:16px 0 8px;}
.plan-head{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin-bottom:12px;}
.plan-head svg{color:var(--gold);}
.plan-tgt{margin-left:auto;font-size:11.5px;font-weight:700;color:#34d399;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.25);border-radius:99px;padding:4px 11px;}
.plan-sec{margin-bottom:10px;}
.plan-lab{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);}
.plan-sec ul{margin:6px 0 0;padding-left:18px;}
.plan-sec li{font-size:13px;color:var(--tx);margin:3px 0;}
.msg-banner{display:flex;align-items:center;gap:10px;background:color-mix(in srgb,var(--c) 11%,var(--surface));border:1px solid color-mix(in srgb,var(--c) 30%,var(--line));border-left:3px solid var(--c);border-radius:12px;padding:13px 16px;font-size:13.5px;font-weight:600;margin:14px 0 8px;}
.msg-banner svg{color:var(--c);flex-shrink:0;}
.house-lb{display:flex;flex-direction:column;gap:8px;}
.house-lb-row{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 15px;}
.lb-rank{font-family:'Space Mono',monospace;font-weight:700;font-size:15px;color:var(--c);width:30px;}
.lb-dot{width:11px;height:11px;border-radius:50%;background:var(--c);flex-shrink:0;}
.lb-main{flex:1;min-width:0;}
.lb-name{font-weight:700;font-size:14px;}
.lb-sub{font-size:11.5px;color:var(--muted);margin-top:2px;}
.lb-avg{font-family:'Space Mono',monospace;font-weight:700;font-size:16px;}
.risk-list{display:flex;flex-direction:column;gap:8px;}
.risk-row{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 15px;}
.risk-main{flex:1;min-width:0;}
.risk-name{font-weight:700;font-size:14px;}
.risk-name small{font-weight:400;color:var(--muted);font-size:11.5px;}
.risk-reasons{font-size:12px;color:#fb9aa8;margin-top:2px;}
.risk-nums{text-align:right;}
.risk-nums b{display:block;font-family:'Space Mono',monospace;font-size:16px;}
.risk-nums small{font-size:11px;color:var(--muted);}
`;
