/* ============================================================
   Dreamers Edu — Analytics Engine (rule-based, pure functions)
   Sab kuch existing data se calculate hota hai. Koi DB change nahi.
   AI API baad me add karna ho to smartPlan() ko replace kar dena.

   Data shapes:
     student = { id, name, roll, category, house }
     test    = { id, studentId, category, testName, date,
                 subjects:[{name, marks, maxMarks, topics?:[]}],
                 total, maxTotal, percentage, difficulty? }
   ============================================================ */

export const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
export const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const byDateAsc = (tests) => [...tests].sort((a, b) => new Date(a.date) - new Date(b.date));

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const std = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
};

/* slope of percentages over last `n` tests (pct-points gained per test) */
export const trendSlope = (tests, n = 5) => {
  const pts = byDateAsc(tests).slice(-n).map((t) => t.percentage);
  if (pts.length < 2) return 0;
  const xs = pts.map((_, i) => i);
  const mx = mean(xs), my = mean(pts);
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (pts[i] - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
};

export const avgPct = (tests) => r1(mean(tests.map((t) => t.percentage)));
export const bestPct = (tests) => (tests.length ? r1(Math.max(...tests.map((t) => t.percentage))) : 0);
export const latestPct = (tests) => { const a = byDateAsc(tests); return a.length ? r1(a[a.length - 1].percentage) : 0; };

/* last up-to-5 percentages, e.g. [42,48,51,57,63] */
export const trendArrows = (tests, n = 5) => byDateAsc(tests).slice(-n).map((t) => Math.round(t.percentage));

/* Improving / Declining / Stable / Fast Improver */
export const trendLabel = (tests) => {
  if (tests.length < 2) return { label: "New", slope: 0 };
  const s = trendSlope(tests);
  if (s >= 6) return { label: "Fast Improver", slope: r1(s) };
  if (s >= 1.5) return { label: "Improving", slope: r1(s) };
  if (s <= -1.5) return { label: "Declining", slope: r1(s) };
  return { label: "Stable", slope: r1(s) };
};

/* consistency 0-100 (kam ups-downs = zyada) */
export const consistencyScore = (tests) => {
  const pts = tests.map((t) => t.percentage);
  if (pts.length < 2) return 60;
  return clamp(100 - std(pts) * 2);
};

/* ---------- Performance Health Score ---------- */
export const HEALTH_GRADES = [
  { min: 85, grade: "A+ Excellent",      color: "#34d399" },
  { min: 70, grade: "A Good",            color: "#2dd4bf" },
  { min: 55, grade: "B Average",         color: "#f5b544" },
  { min: 40, grade: "C Needs Improvement", color: "#fb923c" },
  { min: 0,  grade: "Danger Zone",       color: "#fb7185" },
];

export const healthScore = (tests) => {
  if (!tests.length) return { score: null, grade: "No Data", color: "#5a6478" };
  const avg = avgPct(tests);
  const latest = latestPct(tests);
  const slope = trendSlope(tests);
  const trendC = clamp(50 + slope * 5);
  const consistC = consistencyScore(tests);
  const volumeC = clamp((tests.length / 6) * 100);
  const score = Math.round(avg * 0.35 + latest * 0.25 + trendC * 0.15 + consistC * 0.15 + volumeC * 0.10);
  const g = HEALTH_GRADES.find((x) => score >= x.min);
  return { score, grade: g.grade, color: g.color };
};

/* ---------- Subject strength / weakness ---------- */
export const subjectStats = (tests) => {
  const map = {};
  tests.forEach((t) => (t.subjects || []).forEach((s) => {
    if (!s.maxMarks) return;
    const p = (Number(s.marks) / Number(s.maxMarks)) * 100;
    if (!map[s.name]) map[s.name] = { sum: 0, n: 0, maxSum: 0 };
    map[s.name].sum += p; map[s.name].n += 1; map[s.name].maxSum += Number(s.maxMarks);
  }));
  return Object.entries(map).map(([name, v]) => {
    const pct = r1(v.sum / v.n);
    const status = pct >= 70 ? "Strong" : pct >= 50 ? "Average" : "Weak";
    const action = status === "Strong" ? "Maintain karo, speed badhao"
      : status === "Average" ? "Thoda aur practice, target 70%+"
      : "Extra focus chahiye — basics + daily practice";
    return { name, pct, status, action, typicalMax: Math.round(v.maxSum / v.n) };
  }).sort((a, b) => b.pct - a.pct);
};

export const bestWorstSubject = (tests) => {
  const s = subjectStats(tests);
  return { best: s[0] || null, worst: s.length > 1 ? s[s.length - 1] : null };
};

export const bestWorstTest = (tests) => {
  if (!tests.length) return { best: null, worst: null };
  const a = [...tests].sort((x, y) => y.percentage - x.percentage);
  return { best: a[0], worst: a.length > 1 ? a[a.length - 1] : null };
};

/* ---------- Next target + subject-wise marks needed ---------- */
export const nextTarget = (tests, bump = 7) => {
  const cur = avgPct(tests);
  const target = clamp(Math.round(cur) + bump);
  const gap = r1(target - cur);
  const subs = subjectStats(tests)
    .filter((s) => s.pct < target)
    .map((s) => ({
      name: s.name,
      needMarks: Math.max(1, Math.round(((target - s.pct) / 100) * (s.typicalMax || 100))),
      from: s.pct, typicalMax: s.typicalMax,
    }))
    .sort((a, b) => b.needMarks - a.needMarks);
  return { current: cur, target, gap, subjects: subs };
};

/* ---------- Predicted score ---------- */
export const predictNext = (tests) => {
  if (tests.length < 2) return { predicted: tests.length ? latestPct(tests) : null, confidence: "Low" };
  const latest = latestPct(tests);
  const avg = avgPct(tests);
  const slope = trendSlope(tests);
  const predicted = clamp(r1(0.6 * (latest + slope) + 0.4 * avg));
  const consist = consistencyScore(tests);
  let confidence = "Low";
  if (tests.length >= 5 && consist >= 70) confidence = "High";
  else if (tests.length >= 3) confidence = "Medium";
  return { predicted, confidence };
};

/* ---------- Badges ---------- */
export const badges = (tests, ctx = {}) => {
  const out = [];
  if (!tests.length) return out;
  const tl = trendLabel(tests);
  const subs = subjectStats(tests);
  if (ctx.classRank === 1) out.push({ key: "topper", label: "Topper", icon: "Crown" });
  if (tl.label === "Fast Improver") out.push({ key: "fast", label: "Fast Improver", icon: "Flame" });
  if (consistencyScore(tests) >= 75 && tests.length >= 3) out.push({ key: "consist", label: "Consistency King", icon: "Shield" });
  const maths = subs.find((s) => /math/i.test(s.name));
  if (maths && maths.pct >= 80) out.push({ key: "maths", label: "Maths Warrior", icon: "Swords" });
  if (subs.some((s) => s.pct >= 85)) out.push({ key: "champ", label: "Subject Champion", icon: "Star" });
  const arr = trendArrows(tests, 6);
  if (arr.length >= 3 && latestPct(tests) - Math.min(...arr) >= 20) out.push({ key: "comeback", label: "Comeback Student", icon: "TrendingUp" });
  if (ctx.attendanceRate != null && ctx.attendanceRate >= 1) out.push({ key: "attend", label: "100% Attendance", icon: "CheckCircle2" });
  return out;
};

/* ---------- Motivational message (student-friendly) ---------- */
export const motivationMessage = (tests) => {
  if (!tests.length) return "Pehla test do — yahan tumhari progress dikhegi.";
  const latest = latestPct(tests);
  const { worst } = bestWorstSubject(tests);
  const weak = worst && worst.status !== "Strong" ? ` ${worst.name} par thoda extra dhyan do.` : "";
  if (latest >= 75) return `Shaandaar performance! Apni rank maintain karo aur speed badhao.${weak}`;
  if (latest >= 50) return `Sahi direction me ho — agle target ke liye push karo.${weak}`;
  return `Focused practice se comeback possible hai. Roz thoda-thoda karo.${weak}`;
};

/* ---------- Smart improvement plan (rule-based; AI baad me) ---------- */
export const smartPlan = (tests) => {
  if (!tests.length) return null;
  const subs = subjectStats(tests);
  const weak = subs.filter((s) => s.status !== "Strong").slice(0, 3);
  const strong = subs.filter((s) => s.status === "Strong").map((s) => s.name);
  const tgt = nextTarget(tests);
  const plan7 = weak.map((s) => `${s.name}: ${Math.max(40, s.needMarks ? 80 : 60)} questions / revision`);
  const plan15 = weak.map((s) => `${s.name}: full chapter revision + 2 mock`);
  return {
    level: healthScore(tests).grade,
    weakSubjects: weak.map((s) => s.name),
    strongSubjects: strong,
    plan7, plan15,
    nextTargetPct: tgt.target,
  };
};

/* ============================================================
   RANK helpers (same test ke andar scope)
   ============================================================ */
const samePeers = (allTests, test) =>
  allTests.filter((t) => t.category === test.category &&
    (t.testName || "").trim().toLowerCase() === (test.testName || "").trim().toLowerCase());

export const classRankForTest = (allTests, test) => {
  const peers = samePeers(allTests, test).sort((a, b) => b.percentage - a.percentage);
  return { rank: peers.findIndex((t) => t.id === test.id) + 1, total: peers.length };
};

export const houseRankForTest = (allTests, students, test) => {
  const sMap = {}; students.forEach((s) => (sMap[s.id] = s));
  const me = sMap[test.studentId];
  if (!me || !me.house) return null;
  const peers = samePeers(allTests, test)
    .filter((t) => sMap[t.studentId]?.house === me.house)
    .sort((a, b) => b.percentage - a.percentage);
  return { rank: peers.findIndex((t) => t.id === test.id) + 1, total: peers.length };
};

/* Rank movement: latest vs previous test ka class rank */
export const rankMovement = (allTests, studentTests) => {
  const a = byDateAsc(studentTests);
  if (!a.length) return null;
  const cur = classRankForTest(allTests, a[a.length - 1]);
  const prev = a.length > 1 ? classRankForTest(allTests, a[a.length - 2]) : null;
  const delta = prev ? prev.rank - cur.rank : 0; // +ve = upar gaya
  return { current: cur, previous: prev, delta };
};

/* ============================================================
   DIRECTOR-level analytics
   ============================================================ */
const testsOf = (allTests, id) => allTests.filter((t) => t.studentId === id);

export const atRiskStudents = (students, allTests) => {
  const out = [];
  students.forEach((s) => {
    const ts = testsOf(allTests, s.id);
    if (!ts.length) return;
    const avg = avgPct(ts);
    const last3 = byDateAsc(ts).slice(-3).map((t) => t.percentage);
    const declining = last3.length >= 3 && last3[0] > last3[1] && last3[1] > last3[2];
    const { worst } = bestWorstSubject(ts);
    const reasons = [];
    if (avg < 40) reasons.push("Average < 40%");
    if (declining) reasons.push("Last 3 tests girte hue");
    if (worst && worst.pct < 35) reasons.push(`${worst.name} bahut weak (${worst.pct}%)`);
    if (healthScore(ts).grade === "Danger Zone") reasons.push("Health: Danger Zone");
    if (reasons.length) out.push({ student: s, avg, latest: latestPct(ts), reasons });
  });
  return out.sort((a, b) => a.avg - b.avg);
};

export const topImprovers = (students, allTests, limit = 5) => {
  const out = [];
  students.forEach((s) => {
    const ts = byDateAsc(testsOf(allTests, s.id));
    if (ts.length < 3) return;
    const half = Math.floor(ts.length / 2);
    const older = avgPct(ts.slice(0, half));
    const recent = avgPct(ts.slice(-Math.max(2, half)));
    const gain = r1(recent - older);
    if (gain > 1) out.push({ student: s, gain, from: older, to: recent });
  });
  return out.sort((a, b) => b.gain - a.gain).slice(0, limit);
};

export const houseLeaderboard = (students, allTests) => {
  const houses = {};
  students.forEach((s) => {
    if (!s.house) return;
    if (!houses[s.house]) houses[s.house] = { house: s.house, students: 0, pcts: [], tests: 0, top: null };
    const ts = testsOf(allTests, s.id);
    houses[s.house].students += 1;
    houses[s.house].tests += ts.length;
    const a = ts.length ? avgPct(ts) : null;
    ts.forEach((t) => houses[s.house].pcts.push(t.percentage));
    if (a != null && (!houses[s.house].top || a > houses[s.house].top.avg))
      houses[s.house].top = { name: s.name, avg: a };
  });
  return Object.values(houses)
    .map((h) => ({ house: h.house, students: h.students, tests: h.tests, avg: r1(mean(h.pcts)), top: h.top }))
    .sort((a, b) => b.avg - a.avg)
    .map((h, i) => ({ ...h, rank: i + 1 }));
};

export const batchQuality = (students, allTests) => {
  let strong = 0, medium = 0, weak = 0, danger = 0, withTests = 0;
  const allPcts = [];
  students.forEach((s) => {
    const ts = testsOf(allTests, s.id);
    if (!ts.length) return;
    withTests += 1;
    ts.forEach((t) => allPcts.push(t.percentage));
    const g = healthScore(ts).grade;
    if (g.startsWith("A+")) strong++;
    else if (g.startsWith("A")) strong++;
    else if (g.startsWith("B")) medium++;
    else if (g.startsWith("C")) weak++;
    else danger++;
  });
  return {
    strong, medium, weak, danger,
    avg: r1(mean(allPcts)),
    participation: students.length ? Math.round((withTests / students.length) * 100) : 0,
    total: students.length,
  };
};

/* Test quality report for one test (same testName + category group) */
export const testQuality = (allTests, test) => {
  const peers = samePeers(allTests, test).map((t) => t.percentage).sort((a, b) => a - b);
  if (!peers.length) return null;
  const median = peers.length % 2 ? peers[(peers.length - 1) / 2]
    : (peers[peers.length / 2 - 1] + peers[peers.length / 2]) / 2;
  return {
    students: peers.length,
    avg: r1(mean(peers)),
    high: r1(Math.max(...peers)),
    low: r1(Math.min(...peers)),
    median: r1(median),
    above75: peers.filter((p) => p >= 75).length,
    mid: peers.filter((p) => p >= 50 && p < 75).length,
    below50: peers.filter((p) => p < 50).length,
  };
};
