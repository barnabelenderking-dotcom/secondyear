import React, { useState, useMemo } from "react";

// ══════════════════════════════════════════════════════════════
// SECOND YEAR — Oxbridge tutoring
// White base. Two accents only: Oxford Blue + Cambridge Blue,
// alternated across full-bleed bands. Two typefaces: Fraunces
// (display, modern high-contrast serif) + Inter (everything).
// Curated model, no prices. Now with A-Levels + working enquiry form.
// ══════════════════════════════════════════════════════════════

const OX = "#002147";
const CAM = "#8EE8D8";
const CAM_INK = "#0B3B36";
const WHITE = "#FFFFFF";
const INK = "#111318";
const MUTED = "#5F6470";
const LINE = "#E6E8EC";

const DISPLAY = "'Fraunces', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";

const SUBJECTS = ["Mathematics", "Further Maths", "Physics", "Chemistry", "Biology", "Economics", "History", "English Literature", "Russian", "German", "French", "Computer Science", "Philosophy", "Politics"];

// Full A-Level options for the tutor application (with Other write-in).
const ALEVEL_SUBJECTS = [
  "Mathematics", "Further Mathematics", "Physics", "Chemistry", "Biology",
  "Economics", "Business Studies", "Accounting", "History", "Geography",
  "English Literature", "English Language", "English Language & Literature",
  "Religious Studies", "Philosophy", "Politics", "Government & Politics",
  "Psychology", "Sociology", "Law", "Classical Civilisation", "Latin",
  "Ancient Greek", "French", "German", "Spanish", "Italian", "Russian",
  "Mandarin Chinese", "Arabic", "Computer Science", "Design & Technology",
  "Electronics", "Art & Design", "Fine Art", "Photography", "Music",
  "Music Technology", "Drama & Theatre", "Film Studies", "Media Studies",
  "Physical Education", "Environmental Science", "Geology", "Statistics",
  "Other (write in)",
];
const COURSES = [
  // Sciences & Medicine
  "Medicine", "Veterinary Medicine", "Natural Sciences", "Biological Sciences",
  "Biochemistry", "Biomedical Sciences", "Physics", "Chemistry", "Materials Science",
  "Earth Sciences", "Engineering", "Chemical Engineering", "Computer Science",
  "Mathematics", "Mathematics & Physics", "Psychology", "PBS (Psychological & Behavioural Sciences)",
  // Social sciences
  "Economics", "PPE (Philosophy, Politics & Economics)", "HSPS (Human, Social & Political Sciences)",
  "Land Economy", "Geography", "Human Sciences", "Archaeology", "Anthropology",
  // Humanities
  "Law", "History", "History & Politics", "History & Economics", "History of Art",
  "English", "Philosophy", "Theology & Religious Studies", "Classics",
  "Asian & Middle Eastern Studies", "MML (Modern & Medieval Languages)",
  "Linguistics", "Music", "Education", "Fine Art", "Architecture",
  "Other (write in)",
];
const STAGES = ["A-Level / IB tutoring", "Personal statement", "Admissions test", "Interview preparation"];

// ── Supabase (live) ───────────────────────────────────────────
const SB_URL = "https://gfaxejykbciwwyucucld.supabase.co";
const SB_KEY = "sb_publishable_bfiVgLUsYheH-vm5Dfeevw_YlzisfJN";
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

// Cloudflare Turnstile sitekey — safe to expose (public by design).
// Empty string = widget disabled. Paste your sitekey here once created.
const TURNSTILE_SITEKEY = "";

async function fetchTutors() {
  const res = await fetch(
    `${SB_URL}/rest/v1/tutors?select=*&order=created_at.asc`,
    { headers: SB_HEADERS }
  );
  if (!res.ok) throw new Error(`tutors fetch failed: ${res.status}`);
  const rows = await res.json();
  // map DB columns -> UI shape
  return rows.map((r) => ({
    id: r.id, first: r.first_name, last: r.last_name, uni: r.uni,
    college: r.college, course: r.course, year: r.study_year,
    sat: r.interview_year, alevels: r.alevels,
    subjects: r.subjects || [], stages: r.stages || [], blurb: r.blurb,
  }));
}

async function postTutorApplication(f, turnstileToken) {
  const res = await fetch(`${SB_URL}/functions/v1/submit-tutor-application`, {
    method: "POST",
    headers: SB_HEADERS,
    body: JSON.stringify({
      first_name: f.first.trim(), last_name: f.last.trim(), email: f.email.trim(),
      uni: f.uni, college: f.college.trim(), course: f.course,
      study_year: f.year.trim() || null, interview_year: f.sat ? Number(f.sat) : null,
      alevels: f.alevels.trim() || null, subjects: f.subjects, stages: f.stages,
      blurb: f.blurb.trim(), website: f.website || "", turnstileToken: turnstileToken || "",
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `application failed: ${res.status}`);
  }
}

async function postEnquiry(f, turnstileToken) {
  const res = await fetch(`${SB_URL}/functions/v1/submit-enquiry`, {
    method: "POST",
    headers: SB_HEADERS,
    body: JSON.stringify({
      name: f.name.trim(), email: f.email.trim(), relationship: f.relationship,
      target_uni: f.uni || null, target_course: f.course, stages: f.stages,
      timeline: f.timeline, requested_tutor: f.tutor || null, notes: f.notes || null,
      student_alevels: f.student_alevels || [],
      website: f.website || "", turnstileToken: turnstileToken || "",
    }),
  });
  if (!res.ok) throw new Error(`enquiry failed: ${res.status}`);
}


// Tutor data now loads live from Supabase (see fetchTutors).

export default function App() {
  // Hash routing: '#apply' shows the tutor application (the shareable link).
  const routeFromHash = () => {
    if (typeof window === "undefined") return "home";
    const h = window.location.hash;
    const p = window.location.pathname;
    if (h === "#apply" || p === "/apply" || p === "/apply/") return "apply";
    if (h === "#admin" || p === "/admin" || p === "/admin/") return "admin";
    return "home";
  };
  const [route, setRoute] = useState(routeFromHash);
  React.useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const [filters, setFilters] = useState({ uni: "", course: "", subject: "", stage: "" });
  const [enquiry, setEnquiry] = useState(null); // null | prefilled tutor name
  const [tutors, setTutors] = useState([]);
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error

  React.useEffect(() => {
    let alive = true;
    fetchTutors()
      .then((rows) => { if (alive) { setTutors(rows); setLoadState("ready"); } })
      .catch(() => { if (alive) setLoadState("error"); });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => tutors.filter((t) => {
    if (filters.uni && t.uni !== filters.uni) return false;
    if (filters.course && t.course !== filters.course) return false;
    if (filters.subject && !t.subjects.includes(filters.subject)) return false;
    if (filters.stage && !t.stages.includes(filters.stage)) return false;
    return true;
  }), [tutors, filters]);

  function openEnquiry(tutorName = "") {
    setEnquiry({ tutor: tutorName });
    setTimeout(() => document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth" }), 20);
  }

  return (
    <div style={{ background: WHITE, color: INK, fontFamily: SANS, minHeight: "100vh", fontSize: 16, lineHeight: 1.5 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select, button, a, input, textarea { font-family: inherit; }
        a { color: inherit; text-decoration: none; }
        ::selection { background: ${OX}; color: ${WHITE}; }
        .card { transition: transform .18s ease, box-shadow .18s ease; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(0,33,71,.08); }
        .btn-req { transition: background .18s ease, color .18s ease; }
        .btn-req:hover { background: ${OX}; color: ${WHITE}; }
        .chip { transition: background .15s ease, color .15s ease, border-color .15s ease; cursor: pointer; }
        button:focus-visible, select:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${OX}; outline-offset: 2px; }
        input, textarea, select { width: 100%; }
        @media (prefers-reduced-motion: reduce){ .card,.btn-req,.chip{transition:none} }
      `}</style>

      {/* ── Header ── */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 40px", borderBottom: `1px solid ${LINE}`, position: "sticky", top: 0, background: WHITE, zIndex: 20 }}>
        <a href="#" onClick={() => setRoute("home")} style={{ fontFamily: DISPLAY, fontSize: 25, fontWeight: 700, color: OX, letterSpacing: "-.01em" }}>Second Year</a>
        {route === "home" ? (
          <nav style={{ display: "flex", gap: 30, fontSize: 15, alignItems: "center" }}>
            <a href="#story">Our story</a>
            <a href="#tutors">Tutors</a>
            <a href="#apply" style={{ color: MUTED }}>For tutors</a>
            <a href="#enquire" onClick={() => openEnquiry("")} style={{ background: OX, color: WHITE, padding: "10px 20px", fontWeight: 500 }}>Enquire</a>
          </nav>
        ) : (
          <nav style={{ display: "flex", gap: 30, fontSize: 15, alignItems: "center" }}>
            <a href="#" onClick={() => setRoute("home")}>← Back to site</a>
          </nav>
        )}
      </header>

      {route === "admin" ? <AdminPanel /> : route === "apply" ? <TutorApply /> : (<>

      {/* ── HERO ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(64px,10vw,128px) 40px clamp(52px,7vw,88px)" }}>
        <p style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED, fontWeight: 600, marginBottom: 26 }}>
          Oxford &amp; Cambridge admissions · A-Level &amp; IB · UCAS
        </p>
        <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: "clamp(44px,8vw,100px)", lineHeight: 0.98, letterSpacing: "-.025em", maxWidth: 960, color: INK }}>
          The people who <span style={{ fontStyle: "italic", color: OX }}>just</span> got in, teaching the people who want to.
        </h1>
        <p style={{ fontSize: "clamp(17px,1.7vw,20px)", lineHeight: 1.6, color: MUTED, maxWidth: 600, marginTop: 34 }}>
          Every tutor is a current Oxford or Cambridge student who sat these interviews within the last three years. We match you by course, college and subject.
        </p>
        <div style={{ display: "flex", gap: 14, marginTop: 38, flexWrap: "wrap" }}>
          <a href="#tutors" style={{ background: OX, color: WHITE, padding: "15px 30px", fontWeight: 600, fontSize: 16 }}>Meet the tutors</a>
          <a href="#enquire" onClick={() => openEnquiry("")} style={{ border: `1px solid ${OX}`, color: OX, padding: "15px 30px", fontWeight: 600, fontSize: 16 }}>Request a match</a>
        </div>
      </section>

      {/* ── OXFORD band: story ── */}
      <section id="story" style={{ background: OX, color: WHITE, padding: "clamp(68px,9vw,116px) 40px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          <p style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: CAM, fontWeight: 600, marginBottom: 30 }}>Why we built this</p>
          <p style={{ fontFamily: DISPLAY, fontSize: "clamp(26px,4vw,42px)", lineHeight: 1.28, fontWeight: 500, letterSpacing: "-.01em" }}>
            The help that existed when we applied was expensive, distant, and years out of date. The person who actually got each of us in was a <span style={{ fontStyle: "italic", color: CAM }}>second year</span> who'd sat the same interview months earlier and simply remembered. We made that person available to everyone.
          </p>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,.72)", marginTop: 34, lineHeight: 1.6, maxWidth: 560 }}>
            Founded by Oxford and Cambridge students. Every tutor is verified against a current university email before they meet a single student.
          </p>
        </div>
      </section>

      {/* ── WHITE: matching ── */}
      <section style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(60px,8vw,100px) 40px" }}>
        <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(30px,4vw,44px)", color: INK, fontWeight: 600, marginBottom: 52, maxWidth: 640, lineHeight: 1.08, letterSpacing: "-.02em" }}>
          We curate the match. This isn't an open marketplace.
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 44 }}>
          {[
            ["01", "You tell us the goal", "Course, college, subjects, and where you are in the process. Browse the tutors and name anyone you'd like to work with."],
            ["02", "We match you", "We hand-pick the tutor whose interview and subjects fit yours — or the one you requested, if they're right for it."],
            ["03", "You meet, then decide", "A short introductory call before anything is committed. The fit has to be real on both sides."],
          ].map(([n, h, s]) => (
            <div key={n}>
              <div style={{ fontSize: 14, fontWeight: 600, color: OX, letterSpacing: ".1em", marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${LINE}` }}>{n}</div>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 25, color: INK, fontWeight: 600, marginBottom: 12, letterSpacing: "-.01em" }}>{h}</h3>
              <p style={{ fontSize: 15.5, color: MUTED, lineHeight: 1.6 }}>{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CAMBRIDGE band: coverage ── */}
      <section style={{ background: CAM, color: CAM_INK, padding: "clamp(52px,7vw,84px) 40px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 40 }}>
          {[
            ["Oxbridge admissions", "Interviews, admissions tests, and personal statements — the whole gauntlet, from the people who cleared it."],
            ["A-Level & IB", "The subject grades underneath the application. Taught by students who scored them recently."],
            ["UCAS, everywhere", "Personal statement support for any course at any university — not only Oxford and Cambridge."],
          ].map(([h, s]) => (
            <div key={h}>
              <h3 style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 600, marginBottom: 10, letterSpacing: "-.01em" }}>{h}</h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(11,59,54,.82)" }}>{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHITE: directory ── */}
      <section id="tutors" style={{ maxWidth: 1080, margin: "0 auto", padding: "clamp(60px,8vw,100px) 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginBottom: 34 }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(32px,4.5vw,48px)", color: INK, fontWeight: 600, lineHeight: 1, letterSpacing: "-.02em" }}>Browse, then request</h2>
          <p style={{ fontSize: 14.5, color: MUTED, maxWidth: 340 }}>Placement is by application and verification. Rates are discussed once you're matched.</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 34 }}>
          {[["uni", "university", ["Oxford", "Cambridge"]], ["course", "course", COURSES], ["subject", "subject", SUBJECTS], ["stage", "stage", STAGES]].map(([key, label, opts]) => (
            <select key={key} value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              style={{ padding: "12px 14px", border: `1px solid ${LINE}`, background: WHITE, color: INK, fontSize: 14.5, minWidth: 150, width: "auto" }}>
              <option value="">{`Any ${label}`}</option>
              {opts.map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
          {(filters.uni || filters.course || filters.subject || filters.stage) && (
            <button onClick={() => setFilters({ uni: "", course: "", subject: "", stage: "" })}
              style={{ padding: "12px 16px", border: "none", background: "transparent", color: OX, fontWeight: 600, fontSize: 14, cursor: "pointer", width: "auto" }}>Clear</button>
          )}
        </div>

        {loadState === "loading" ? (
          <div style={{ border: `1px dashed ${LINE}`, padding: "56px 24px", textAlign: "center", color: MUTED }}>
            Loading tutors…
          </div>
        ) : loadState === "error" ? (
          <div style={{ border: `1px dashed ${LINE}`, padding: "56px 24px", textAlign: "center", color: MUTED }}>
            Couldn't load the directory. Check your connection and refresh — or send an enquiry below and we'll match you directly.
          </div>
        ) : shown.length === 0 ? (
          <div style={{ border: `1px dashed ${LINE}`, padding: "56px 24px", textAlign: "center", color: MUTED }}>
            No tutor matches that combination right now. Send an enquiry and we'll match you to the next available tutor for your course.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(330px,1fr))", gap: 20 }}>
            {shown.map((t) => <Card key={t.id} t={t} onRequest={() => openEnquiry(`${t.first} ${t.last} (${t.uni})`)} />)}
          </div>
        )}
      </section>

      {/* ── ENQUIRY (Oxford band) ── */}
      <EnquirySection prefill={enquiry} onOpen={openEnquiry} />
      </>)}

      <footer style={{ padding: "36px 40px", textAlign: "center", color: MUTED, fontSize: 13, borderTop: `1px solid ${LINE}` }}>
        <div style={{ marginBottom: 10 }}>
          <a href="#privacy" onClick={(e) => { e.preventDefault(); document.getElementById("privacy-modal").style.display = "flex"; }} style={{ color: MUTED, textDecoration: "underline" }}>Privacy notice</a>
        </div>
        Second Year — not affiliated with or endorsed by the Universities of Oxford or Cambridge.
      </footer>

      <PrivacyModal />
    </div>
  );
}

function Card({ t, onRequest }) {
  const isOx = t.uni === "Oxford";
  const bar = isOx ? OX : CAM;
  return (
    <article className="card" style={{ background: WHITE, border: `1px solid ${LINE}`, borderTop: `3px solid ${bar}`, padding: 26, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: DISPLAY, fontSize: 25, fontWeight: 600, color: INK, lineHeight: 1, letterSpacing: "-.01em" }}>{t.first} {t.last}</div>
          <div style={{ fontSize: 13.5, color: OX, fontWeight: 600, marginTop: 7 }}>{t.uni} · {t.college}</div>
        </div>
        <span title="Verified current student" style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: OX, border: `1px solid ${LINE}`, padding: "4px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>✓ Verified</span>
      </div>
      <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 4 }}>Reading <strong style={{ color: INK }}>{t.course}</strong> · {t.year}</div>
      <div style={{ fontSize: 13.5, color: MUTED, marginBottom: 14 }}>Sat the interview <strong style={{ color: INK }}>{t.sat}</strong></div>

      {/* A-Levels */}
      <div style={{ background: "#F7F8FA", border: `1px solid ${LINE}`, padding: "10px 12px", marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: MUTED, fontWeight: 600, marginBottom: 4 }}>A-Levels achieved</div>
        <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{t.alevels}</div>
      </div>

      <p style={{ fontFamily: DISPLAY, fontSize: 17.5, lineHeight: 1.45, color: INK, marginBottom: 18, fontWeight: 500 }}>{t.blurb}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22 }}>
        {t.subjects.map((s) => <span key={s} style={{ fontSize: 12, color: MUTED, border: `1px solid ${LINE}`, padding: "3px 9px" }}>{s}</span>)}
      </div>
      <button onClick={onRequest} className="btn-req" style={{ marginTop: "auto", textAlign: "center", border: `1px solid ${OX}`, color: OX, background: WHITE, padding: "12px", fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}>Request {t.first}</button>
    </article>
  );
}

// ── Enquiry form ──────────────────────────────────────────────
function EnquirySection({ prefill }) {
  const [f, setF] = useState({
    name: "", email: "", relationship: "", uni: "", course: "", stages: [], timeline: "", tutor: "", notes: "", website: "",
  });
  const [studentAlevels, setStudentAlevels] = useState([]);
  const [studentAlevelOther, setStudentAlevelOther] = useState("");
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [tsToken, setTsToken] = useState("");

  // sync requested tutor from card clicks
  React.useEffect(() => {
    if (prefill && prefill.tutor !== undefined) {
      setF((s) => ({ ...s, tutor: prefill.tutor }));
      setSent(false);
    }
  }, [prefill]);

  const relOpts = ["I'm the student", "Parent / guardian", "Teacher / adviser"];
  const timeOpts = ["This application cycle (urgent)", "Next cycle", "Just exploring"];

  function toggleStage(v) {
    setF((s) => ({ ...s, stages: s.stages.includes(v) ? s.stages.filter((x) => x !== v) : [...s.stages, v] }));
  }
  function validate() {
    const e = {};
    if (!f.name.trim()) e.name = "Tell us who to reply to";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = "We need a valid email to reach you";
    if (!f.relationship) e.relationship = "Pick one";
    if (!f.course) e.course = "Which course are they aiming for?";
    if (!f.stages.length) e.stages = "Pick at least one";
    if (!f.timeline) e.timeline = "When are you working to?";
    setErrors(e);
    return !Object.keys(e).length;
  }
  async function submit() {
    if (!validate() || sending) return;
    setSending(true);
    setSendError(false);
    try {
      const composedStudentAlevels = [...studentAlevels.filter((a) => a !== "Other (write in)"), ...(studentAlevelOther.trim() ? [studentAlevelOther.trim()] : [])];
      await postEnquiry({ ...f, student_alevels: composedStudentAlevels }, tsToken);
      setSent(true);
      setTimeout(() => document.getElementById("enquire")?.scrollIntoView({ behavior: "smooth" }), 20);
    } catch (e) {
      setSendError(true);
    } finally {
      setSending(false);
    }
  }

  const L = { fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block", color: "rgba(255,255,255,.9)" };
  const field = (err) => ({ padding: "12px 14px", border: `1px solid ${err ? "#FF9A8B" : "rgba(255,255,255,.25)"}`, background: "rgba(255,255,255,.06)", color: WHITE, fontSize: 15, borderRadius: 2, outline: "none" });
  const ERR = { color: "#FFC7BD", fontSize: 12.5, marginTop: 5 };

  if (sent) {
    return (
      <section id="enquire" style={{ background: OX, color: WHITE, padding: "clamp(80px,11vw,140px) 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 60, fontWeight: 600, color: CAM, lineHeight: 1, marginBottom: 20 }}>✓</div>
          <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(30px,4.5vw,46px)", fontWeight: 600, marginBottom: 18, letterSpacing: "-.02em" }}>Enquiry received.</h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,.8)", lineHeight: 1.6 }}>
            We'll read it properly and reply — usually within a day — with the tutor we think fits{f.tutor ? `, starting with your request for ${f.tutor}` : ""}. Keep an eye on {f.email || "your inbox"}.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="enquire" style={{ background: OX, color: WHITE, padding: "clamp(64px,9vw,112px) 40px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: "clamp(32px,5vw,54px)", fontWeight: 600, lineHeight: 1.06, marginBottom: 16, letterSpacing: "-.02em" }}>Tell us where you're aiming.</h2>
          <p style={{ fontSize: 17, color: "rgba(255,255,255,.78)", lineHeight: 1.6, maxWidth: 520, margin: "0 auto" }}>
            One short enquiry. We reply with a match, usually within a day. No payment now — nothing's committed until you've met your tutor.
          </p>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={L}>Your name</label>
              <input style={field(errors.name)} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="First and last" />
              {errors.name && <div style={ERR}>{errors.name}</div>}
            </div>
            <div>
              <label style={L}>Email</label>
              <input style={field(errors.email)} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@example.com" />
              {errors.email && <div style={ERR}>{errors.email}</div>}
            </div>
          </div>

          <div>
            <label style={L}>Who's enquiring?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {relOpts.map((o) => {
                const on = f.relationship === o;
                return <button key={o} type="button" className="chip" onClick={() => setF({ ...f, relationship: o })}
                  style={{ padding: "10px 16px", borderRadius: 2, fontSize: 14, fontWeight: 500, width: "auto", border: `1px solid ${on ? CAM : "rgba(255,255,255,.25)"}`, background: on ? CAM : "transparent", color: on ? CAM_INK : WHITE }}>{o}</button>;
              })}
            </div>
            {errors.relationship && <div style={ERR}>{errors.relationship}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={L}>Target university</label>
              <select style={{ ...field(false), background: OX }} value={f.uni} onChange={(e) => setF({ ...f, uni: e.target.value })}>
                <option value="" style={{ color: INK }}>Any / undecided</option>
                <option style={{ color: INK }}>Oxford</option>
                <option style={{ color: INK }}>Cambridge</option>
                <option style={{ color: INK }}>Other UK university</option>
              </select>
            </div>
            <div>
              <label style={L}>Target course</label>
              <select style={{ ...field(errors.course), background: OX }} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })}>
                <option value="" style={{ color: INK }}>Choose…</option>
                {COURSES.map((c) => <option key={c} style={{ color: INK }}>{c}</option>)}
              </select>
              {errors.course && <div style={ERR}>{errors.course}</div>}
            </div>
          </div>

          <div>
            <label style={L}>What do you need help with?</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {STAGES.map((o) => {
                const on = f.stages.includes(o);
                return <button key={o} type="button" className="chip" onClick={() => toggleStage(o)}
                  style={{ padding: "10px 16px", borderRadius: 2, fontSize: 14, fontWeight: 500, width: "auto", border: `1px solid ${on ? CAM : "rgba(255,255,255,.25)"}`, background: on ? CAM : "transparent", color: on ? CAM_INK : WHITE }}>{o}</button>;
              })}
            </div>
            {errors.stages && <div style={ERR}>{errors.stages}</div>}
          </div>

          <div>
            <label style={L}>Which A-Levels (or IB subjects) is the student taking? <span style={{ fontWeight: 400, color: "rgba(255,255,255,.55)" }}>(helps us match a tutor)</span></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALEVEL_SUBJECTS.map((a) => {
                const on = studentAlevels.includes(a);
                return <button key={a} type="button" className="chip" onClick={() => setStudentAlevels((s) => s.includes(a) ? s.filter((x) => x !== a) : [...s, a])}
                  style={{ padding: "8px 13px", borderRadius: 2, fontSize: 13, fontWeight: 500, width: "auto", border: `1px solid ${on ? CAM : "rgba(255,255,255,.25)"}`, background: on ? CAM : "transparent", color: on ? CAM_INK : WHITE }}>{a}</button>;
              })}
            </div>
            {studentAlevels.includes("Other (write in)") && (
              <input style={{ ...field(false), marginTop: 10 }} placeholder="Type other subject(s), comma separated" value={studentAlevelOther} onChange={(e) => setStudentAlevelOther(e.target.value)} />
            )}
          </div>

          <div>
            <label style={L}>Timeline</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {timeOpts.map((o) => {
                const on = f.timeline === o;
                return <button key={o} type="button" className="chip" onClick={() => setF({ ...f, timeline: o })}
                  style={{ padding: "10px 16px", borderRadius: 2, fontSize: 14, fontWeight: 500, width: "auto", border: `1px solid ${on ? CAM : "rgba(255,255,255,.25)"}`, background: on ? CAM : "transparent", color: on ? CAM_INK : WHITE }}>{o}</button>;
              })}
            </div>
            {errors.timeline && <div style={ERR}>{errors.timeline}</div>}
          </div>

          <div>
            <label style={L}>A tutor you'd like <span style={{ fontWeight: 400, color: "rgba(255,255,255,.55)" }}>(optional)</span></label>
            <input style={field(false)} value={f.tutor} onChange={(e) => setF({ ...f, tutor: e.target.value })} placeholder="Spotted someone in the directory? Name them here." />
          </div>

          <div>
            <label style={L}>Anything else <span style={{ fontWeight: 400, color: "rgba(255,255,255,.55)" }}>(optional)</span></label>
            <textarea style={{ ...field(false), minHeight: 96, resize: "vertical" }} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Predicted grades, college preference, anything we should know." />
          </div>

          {/* Honeypot — hidden from humans (and screen readers), visible to naive bots */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
            <label>Website</label>
            <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
          </div>

          <Turnstile onToken={setTsToken} />
          <button onClick={submit} disabled={sending} style={{ background: WHITE, color: OX, padding: "16px", fontWeight: 600, fontSize: 16, border: "none", cursor: sending ? "wait" : "pointer", marginTop: 4, opacity: sending ? 0.7 : 1 }}>
            {sending ? "Sending…" : "Send enquiry"}
          </button>
          {sendError && (
            <p style={{ color: "#FFC7BD", fontSize: 14, textAlign: "center" }}>
              That didn't go through. Check your connection and try again.
            </p>
          )}
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.5)", textAlign: "center" }}>We only use your details to match you. No spam, no sharing.</p>
        </div>
      </div>
    </section>
  );
}


// ── Tutor application (the shareable /#apply link) ────────────
function TutorApply() {
  const [f, setF] = useState({
    first: "", last: "", email: "", uni: "", college: "", course: "",
    year: "", sat: "", alevels: "", subjects: [], stages: [], blurb: "", website: "",
  });
  const [alevelPicks, setAlevelPicks] = useState([]);
  const [alevelOther, setAlevelOther] = useState("");
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [tsToken, setTsToken] = useState("");

  function toggle(field, v) {
    setF((s) => ({ ...s, [field]: s[field].includes(v) ? s[field].filter((x) => x !== v) : [...s[field], v] }));
  }
  function validate() {
    const e = {};
    if (!f.first.trim()) e.first = "Required";
    if (!f.last.trim()) e.last = "Required";
    if (!/^[^\s@]+@([a-z0-9-]+\.)*(cam|ox)\.ac\.uk$/i.test(f.email.trim()))
      e.email = "Use your current @cam.ac.uk or @ox.ac.uk address — it's how we verify you";
    if (!f.uni) e.uni = "Choose one";
    if (!f.college.trim()) e.college = "Required";
    if (!f.course) e.course = "Choose your course";
    if (!f.subjects.length) e.subjects = "Pick at least one";
    if (!f.stages.length) e.stages = "Pick at least one";
    if (f.blurb.trim().length < 40) e.blurb = "Give students a reason to pick you (40+ characters)";
    const hasAlevel = alevelPicks.filter((a) => a !== "Other (write in)").length > 0 || alevelOther.trim().length > 0;
    if (!hasAlevel) e.alevels = "Add at least one A-Level";
    setErrors(e);
    return !Object.keys(e).length;
  }
  async function submit() {
    if (!validate() || sending) return;
    setSending(true); setSendError("");
    const composedAlevels = [...alevelPicks.filter((a) => a !== "Other (write in)"), ...(alevelOther.trim() ? [alevelOther.trim()] : [])].join(" · ");
    const fWithAlevels = { ...f, alevels: composedAlevels };
    try { await postTutorApplication(fWithAlevels, tsToken); setSent(true); window.scrollTo({ top: 0, behavior: "smooth" }); }
    catch (err) { setSendError(err.message || "That didn't go through — try again."); }
    finally { setSending(false); }
  }

  const L = { fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block", color: INK };
  const field = (err) => ({ padding: "12px 14px", border: `1px solid ${err ? "#C0392B" : LINE}`, background: WHITE, color: INK, fontSize: 15, borderRadius: 2, outline: "none" });
  const ERR = { color: "#C0392B", fontSize: 12.5, marginTop: 5 };
  const chip = (on) => ({ padding: "9px 15px", borderRadius: 2, fontSize: 14, fontWeight: 500, width: "auto", cursor: "pointer", border: `1px solid ${on ? OX : LINE}`, background: on ? OX : WHITE, color: on ? WHITE : INK });

  if (sent) {
    return (
      <section style={{ maxWidth: 560, margin: "0 auto", padding: "clamp(80px,12vw,140px) 40px", textAlign: "center" }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 56, fontWeight: 600, color: OX, lineHeight: 1, marginBottom: 20 }}>✓</div>
        <h1 style={{ fontFamily: DISPLAY, fontSize: "clamp(30px,4.5vw,44px)", fontWeight: 600, marginBottom: 16, letterSpacing: "-.02em", color: INK }}>Application received.</h1>
        <p style={{ fontSize: 16.5, color: MUTED, lineHeight: 1.6 }}>
          We review every application by hand. We'll verify your university email and reply shortly — you won't appear in the directory until both checks pass. Check {f.email}.
        </p>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(48px,7vw,80px) 40px clamp(64px,9vw,104px)" }}>
      <p style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: MUTED, fontWeight: 600, marginBottom: 22 }}>Tutor application</p>
      <h1 style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: "clamp(34px,5.5vw,58px)", lineHeight: 1.02, letterSpacing: "-.025em", color: INK, marginBottom: 18 }}>
        Get paid to tell them how you <span style={{ fontStyle: "italic", color: OX }}>just</span> did it.
      </h1>
      <p style={{ fontSize: 17, color: MUTED, lineHeight: 1.6, maxWidth: 540, marginBottom: 44 }}>
        Current Oxford and Cambridge students only — you'll verify with your university email. You set your subjects, we handle the matching. Takes three minutes.
      </p>

      <div style={{ display: "grid", gap: 22 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={L}>First name</label>
            <input style={field(errors.first)} value={f.first} onChange={(e) => setF({ ...f, first: e.target.value })} />
            {errors.first && <div style={ERR}>{errors.first}</div>}
          </div>
          <div>
            <label style={L}>Last name</label>
            <input style={field(errors.last)} value={f.last} onChange={(e) => setF({ ...f, last: e.target.value })} />
            {errors.last && <div style={ERR}>{errors.last}</div>}
          </div>
        </div>

        <div>
          <label style={L}>University email (@cam.ac.uk / @ox.ac.uk)</label>
          <input style={field(errors.email)} placeholder="you@cam.ac.uk" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          {errors.email && <div style={ERR}>{errors.email}</div>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={L}>University</label>
            <div style={{ display: "flex", gap: 8 }}>
              {["Oxford", "Cambridge"].map((u) => (
                <button key={u} type="button" className="chip" onClick={() => setF({ ...f, uni: u })} style={chip(f.uni === u)}>{u}</button>
              ))}
            </div>
            {errors.uni && <div style={ERR}>{errors.uni}</div>}
          </div>
          <div>
            <label style={L}>College</label>
            <input style={field(errors.college)} placeholder="e.g. Trinity" value={f.college} onChange={(e) => setF({ ...f, college: e.target.value })} />
            {errors.college && <div style={ERR}>{errors.college}</div>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 16 }}>
          <div>
            <label style={L}>Course you read</label>
            <select style={field(errors.course)} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })}>
              <option value="">Choose…</option>
              {COURSES.map((c) => <option key={c}>{c}</option>)}
            </select>
            {errors.course && <div style={ERR}>{errors.course}</div>}
          </div>
          <div>
            <label style={L}>Year</label>
            <input style={field()} placeholder="2nd year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
          </div>
          <div>
            <label style={L}>Interview year</label>
            <input style={field()} placeholder="2024" value={f.sat} onChange={(e) => setF({ ...f, sat: e.target.value })} />
          </div>
        </div>

        <div>
          <label style={L}>A-Levels achieved</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALEVEL_SUBJECTS.map((a) => {
              const on = alevelPicks.includes(a);
              return <button key={a} type="button" className="chip" onClick={() => setAlevelPicks((s) => s.includes(a) ? s.filter((x) => x !== a) : [...s, a])}
                style={chip(on)}>{a}</button>;
            })}
          </div>
          {alevelPicks.includes("Other (write in)") && (
            <input style={{ ...field(), marginTop: 10 }} placeholder="Type your other A-Level(s), comma separated" value={alevelOther} onChange={(e) => setAlevelOther(e.target.value)} />
          )}
          {errors.alevels && <div style={ERR}>{errors.alevels}</div>}
        </div>

        <div>
          <label style={L}>Subjects you tutor</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SUBJECTS.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => toggle("subjects", s)} style={chip(f.subjects.includes(s))}>{s}</button>
            ))}
          </div>
          {errors.subjects && <div style={ERR}>{errors.subjects}</div>}
        </div>

        <div>
          <label style={L}>Stages you cover</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STAGES.map((s) => (
              <button key={s} type="button" className="chip" onClick={() => toggle("stages", s)} style={chip(f.stages.includes(s))}>{s}</button>
            ))}
          </div>
          {errors.stages && <div style={ERR}>{errors.stages}</div>}
        </div>

        <div>
          <label style={L}>Your pitch — why should a student pick you?</label>
          <textarea style={{ ...field(errors.blurb), minHeight: 100, resize: "vertical" }} value={f.blurb}
            placeholder="e.g. Sat the NatSci interview at Trinity in 2023. I'll show you how they actually think."
            onChange={(e) => setF({ ...f, blurb: e.target.value })} />
          {errors.blurb && <div style={ERR}>{errors.blurb}</div>}
        </div>

        {/* Honeypot */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: 0, overflow: "hidden" }}>
          <label>Website</label>
          <input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        </div>

        <Turnstile onToken={setTsToken} />
        <button onClick={submit} disabled={sending} style={{ background: OX, color: WHITE, padding: "16px", fontWeight: 600, fontSize: 16, border: "none", cursor: sending ? "wait" : "pointer", opacity: sending ? 0.7 : 1 }}>
          {sending ? "Sending…" : "Submit application"}
        </button>
        {sendError && <p style={{ color: "#C0392B", fontSize: 14, textAlign: "center" }}>{sendError}</p>}
      </div>
    </section>
  );
}

// ── Turnstile widget (renders only if a sitekey is set) ───────
function Turnstile({ onToken }) {
  const ref = React.useRef(null);
  const widgetId = React.useRef(null);
  React.useEffect(() => {
    if (!TURNSTILE_SITEKEY) return;
    let cancelled = false;
    function render() {
      if (cancelled || !ref.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: TURNSTILE_SITEKEY,
        callback: (token) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    }
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true; s.defer = true; s.onload = render;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; try { window.turnstile?.remove(widgetId.current); } catch {} };
  }, [onToken]);
  if (!TURNSTILE_SITEKEY) return null;
  return <div ref={ref} style={{ marginTop: 4 }} />;
}

// ── Privacy notice (hidden modal, opened from footer) ─────────
function PrivacyModal() {
  const close = () => { document.getElementById("privacy-modal").style.display = "none"; };
  return (
    <div id="privacy-modal" onClick={close} style={{ display: "none", position: "fixed", inset: 0, background: "rgba(17,19,24,.55)", zIndex: 100, alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: WHITE, maxWidth: 640, maxHeight: "85vh", overflowY: "auto", padding: "40px", borderRadius: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, color: OX, letterSpacing: "-.02em" }}>Privacy notice</h2>
          <button onClick={close} style={{ border: "none", background: "none", fontSize: 26, cursor: "pointer", color: MUTED, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.65, color: INK }}>
          <p style={{ marginBottom: 16 }}>Second Year ("we") collects the information you enter into our enquiry and tutor-application forms so we can match students with tutors and respond to you. This notice explains what we collect and your rights under UK GDPR.</p>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, margin: "20px 0 8px", color: OX }}>What we collect</h3>
          <p style={{ marginBottom: 16 }}>From enquiries: your name, email, relationship to the student, target course and university, the support you need, timeline, and any notes you add. From tutor applicants: your name, university email, college, course, grades, and the profile text you write.</p>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, margin: "20px 0 8px", color: OX }}>Why, and the legal basis</h3>
          <p style={{ marginBottom: 16 }}>We use it solely to match tutors and students and to contact you about that. The legal basis is legitimate interest in providing the service you asked for. We do not sell your data or use it for advertising.</p>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, margin: "20px 0 8px", color: OX }}>If you are under 18</h3>
          <p style={{ marginBottom: 16 }}>If you are a student under 18, please submit the enquiry with a parent or guardian's knowledge. Parents can contact us at any time to review or remove their child's information.</p>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, margin: "20px 0 8px", color: OX }}>Where it's stored</h3>
          <p style={{ marginBottom: 16 }}>Securely with our infrastructure providers (Supabase, hosted in the EU, and Resend for email). We keep enquiry data only as long as needed to provide the service, then delete it.</p>
          <h3 style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, margin: "20px 0 8px", color: OX }}>Your rights</h3>
          <p style={{ marginBottom: 16 }}>You can ask us to show, correct, or delete your data at any time. Email <a href="mailto:hello@secondyear.co.uk" style={{ color: OX }}>hello@secondyear.co.uk</a> and we'll act within 30 days.</p>
          <p style={{ fontSize: 13, color: MUTED, marginTop: 24 }}>This notice may be updated. Last updated July 2026.</p>
        </div>
      </div>
    </div>
  );
}

// ── Admin panel (password-gated review queue) ─────────────────
function AdminPanel() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tutors, setTutors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // tutor object being edited

  async function callAdmin(action, extra = {}) {
    const res = await fetch(`${SB_URL}/functions/v1/admin-tutors`, {
      method: "POST",
      headers: { ...SB_HEADERS, "x-admin-password": pw },
      body: JSON.stringify({ action, ...extra }),
    });
    if (res.status === 401) throw new Error("Wrong password");
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
    return res.json();
  }

  async function login() {
    setErr(""); setLoading(true);
    try {
      const d = await callAdmin("list"); setTutors(d.tutors || []);
      try { const p = await callAdmin("payments"); setPayments(p.payments || []); } catch {}
      setAuthed(true);
    }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  async function refresh() {
    try { const d = await callAdmin("list"); setTutors(d.tutors || []); } catch (e) { setErr(e.message); }
  }
  async function act(id, action) {
    try { await callAdmin(action, { id }); await refresh(); } catch (e) { setErr(e.message); }
  }
  async function saveEdit(id, fields) {
    try { await callAdmin("edit", { id, fields }); setEditing(null); await refresh(); }
    catch (e) { setErr(e.message); }
  }

  if (!authed) {
    return (
      <section style={{ maxWidth: 420, margin: "0 auto", padding: "clamp(64px,10vw,120px) 40px" }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 600, color: OX, letterSpacing: "-.02em", marginBottom: 20 }}>Admin</h1>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="Admin password" style={{ width: "100%", padding: "12px 14px", border: `1px solid ${LINE}`, fontSize: 15, marginBottom: 12 }} />
        <button onClick={login} disabled={loading} style={{ width: "100%", background: OX, color: WHITE, padding: "13px", border: "none", fontWeight: 600, cursor: "pointer" }}>
          {loading ? "Checking…" : "Enter"}
        </button>
        {err && <p style={{ color: "#C0392B", fontSize: 14, marginTop: 12 }}>{err}</p>}
      </section>
    );
  }

  const pending = tutors.filter((t) => t.status === "pending");
  const live = tutors.filter((t) => t.status === "approved");

  return (
    <section style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(48px,7vw,80px) 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <h1 style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 600, color: OX, letterSpacing: "-.02em" }}>Tutor review queue</h1>
        <button onClick={refresh} style={{ border: `1px solid ${LINE}`, background: WHITE, padding: "8px 16px", cursor: "pointer", fontSize: 14 }}>Refresh</button>
      </div>
      {err && <p style={{ color: "#C0392B", fontSize: 14, marginBottom: 16 }}>{err}</p>}

      <h2 style={{ fontFamily: DISPLAY, fontSize: 22, color: INK, marginBottom: 16 }}>Pending ({pending.length})</h2>
      {pending.length === 0 ? <p style={{ color: MUTED, marginBottom: 40 }}>Nothing waiting.</p> : (
        <div style={{ display: "grid", gap: 14, marginBottom: 48 }}>
          {pending.map((t) => (
            <div key={t.id} style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid #C0392B`, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <strong style={{ fontSize: 17 }}>{t.first_name} {t.last_name}</strong> · {t.uni}, {t.college}<br />
                  <span style={{ fontSize: 14, color: MUTED }}>{t.course} · {t.study_year} · interview {t.interview_year || "—"}</span><br />
                  <span style={{ fontSize: 14, color: OX }}>{t.email} {t.verified ? "✓ verified" : "(unverified)"}</span>
                  <p style={{ fontSize: 14, marginTop: 8 }}>{t.alevels}</p>
                  <p style={{ fontSize: 14, marginTop: 4, color: MUTED }}>{t.subjects?.join(", ")}</p>
                  <p style={{ fontSize: 14, marginTop: 8, fontStyle: "italic" }}>"{t.blurb}"</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {!t.verified && <button onClick={() => act(t.id, "verify")} style={{ border: `1px solid ${OX}`, background: WHITE, color: OX, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Mark verified</button>}
                  <button onClick={() => act(t.id, "approve")} style={{ border: "none", background: OX, color: WHITE, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Approve</button>
                  <button onClick={() => setEditing(t)} style={{ border: `1px solid ${LINE}`, background: WHITE, color: INK, padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Edit</button>
                  <button onClick={() => act(t.id, "reject")} style={{ border: `1px solid ${LINE}`, background: WHITE, color: "#C0392B", padding: "8px 14px", cursor: "pointer", fontSize: 13 }}>Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: DISPLAY, fontSize: 22, color: INK, marginBottom: 16 }}>Live in directory ({live.length})</h2>
      <div style={{ display: "grid", gap: 8, marginBottom: 48 }}>
        {live.map((t) => (
          <div key={t.id} style={{ border: `1px solid ${LINE}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
            <span>{t.first_name} {t.last_name} · {t.uni}, {t.college} · {t.course}</span>
            <span style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setEditing(t)} style={{ border: "none", background: "none", color: OX, cursor: "pointer", fontSize: 13 }}>Edit</button>
              <button onClick={() => act(t.id, "reject")} style={{ border: "none", background: "none", color: "#C0392B", cursor: "pointer", fontSize: 13 }}>Remove</button>
            </span>
          </div>
        ))}
      </div>

      <h2 style={{ fontFamily: DISPLAY, fontSize: 22, color: INK, marginBottom: 6 }}>Payments</h2>
      {(() => {
        const total = payments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.amount_total || 0), 0);
        return <p style={{ color: MUTED, fontSize: 14, marginBottom: 16 }}>Total received: <strong style={{ color: OX }}>£{(total / 100).toFixed(2)}</strong> across {payments.length} payment{payments.length === 1 ? "" : "s"}.</p>;
      })()}
      {payments.length === 0 ? (
        <p style={{ color: MUTED, fontSize: 14 }}>No payments yet. Once Stripe is connected, successful payments appear here automatically.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {payments.map((p) => (
            <div key={p.id} style={{ border: `1px solid ${LINE}`, borderLeft: `3px solid ${p.status === "paid" ? "#0E7C4F" : "#C0392B"}`, padding: "12px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, fontSize: 14 }}>
              <span><strong>£{((p.amount_total || 0) / 100).toFixed(2)}</strong> · {p.customer_name || p.customer_email || "—"} · {p.package_label || p.mode}</span>
              <span style={{ color: MUTED }}>{p.status} · {new Date(p.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {editing && <EditModal tutor={editing} onClose={() => setEditing(null)} onSave={saveEdit} />}
    </section>
  );
}

// ── Admin edit modal ──────────────────────────────────────────
function EditModal({ tutor, onClose, onSave }) {
  const [e, setE] = useState({
    first_name: tutor.first_name || "", last_name: tutor.last_name || "",
    email: tutor.email || "", uni: tutor.uni || "", college: tutor.college || "",
    course: tutor.course || "", study_year: tutor.study_year || "",
    interview_year: tutor.interview_year || "", alevels: tutor.alevels || "",
    subjects: (tutor.subjects || []).join(", "), stages: (tutor.stages || []).join(", "),
    blurb: tutor.blurb || "",
  });
  const set = (k) => (ev) => setE({ ...e, [k]: ev.target.value });
  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, fontSize: 14, marginBottom: 12, boxSizing: "border-box" };
  const lab = { fontSize: 12, fontWeight: 600, color: MUTED, display: "block", marginBottom: 4 };

  function save() {
    onSave(tutor.id, {
      first_name: e.first_name.trim(), last_name: e.last_name.trim(), email: e.email.trim(),
      uni: e.uni.trim(), college: e.college.trim(), course: e.course.trim(),
      study_year: e.study_year.trim() || null,
      interview_year: e.interview_year ? Number(e.interview_year) : null,
      alevels: e.alevels.trim() || null,
      subjects: e.subjects.split(",").map((s) => s.trim()).filter(Boolean),
      stages: e.stages.split(",").map((s) => s.trim()).filter(Boolean),
      blurb: e.blurb.trim(),
    });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,19,24,.55)", zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={(ev) => ev.stopPropagation()} style={{ background: WHITE, maxWidth: 560, width: "100%", padding: 32, borderRadius: 2, margin: "40px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 600, color: OX }}>Edit tutor</h2>
          <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: MUTED }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>Reformat or correct any field. Subjects and stages are comma-separated. Changes save immediately.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lab}>First name</label><input style={inp} value={e.first_name} onChange={set("first_name")} /></div>
          <div><label style={lab}>Last name</label><input style={inp} value={e.last_name} onChange={set("last_name")} /></div>
        </div>
        <label style={lab}>Email</label><input style={inp} value={e.email} onChange={set("email")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lab}>University</label><input style={inp} value={e.uni} onChange={set("uni")} /></div>
          <div><label style={lab}>College</label><input style={inp} value={e.college} onChange={set("college")} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
          <div><label style={lab}>Course</label><input style={inp} value={e.course} onChange={set("course")} /></div>
          <div><label style={lab}>Year</label><input style={inp} value={e.study_year} onChange={set("study_year")} /></div>
          <div><label style={lab}>Interview yr</label><input style={inp} value={e.interview_year} onChange={set("interview_year")} /></div>
        </div>
        <label style={lab}>A-Levels</label><input style={inp} value={e.alevels} onChange={set("alevels")} />
        <label style={lab}>Subjects (comma separated)</label><input style={inp} value={e.subjects} onChange={set("subjects")} />
        <label style={lab}>Stages (comma separated)</label><input style={inp} value={e.stages} onChange={set("stages")} />
        <label style={lab}>Pitch</label><textarea style={{ ...inp, minHeight: 90, resize: "vertical" }} value={e.blurb} onChange={set("blurb")} />
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={save} style={{ flex: 1, background: OX, color: WHITE, border: "none", padding: "12px", fontWeight: 600, cursor: "pointer" }}>Save changes</button>
          <button onClick={onClose} style={{ border: `1px solid ${LINE}`, background: WHITE, padding: "12px 20px", cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
