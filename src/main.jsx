import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import {
  motion, AnimatePresence, animate, useInView, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform,
} from "framer-motion";
import { BLOG_POSTS } from "./blogData.mjs";
import SETTINGS from "./siteSettings.json";
import qrcode from "qrcode-generator";
import { BRANDS } from "./brandIcons.js";
import { loadPublic } from "./live.js";
import "./styles.css";
import "./theme.css";

/* ---------- content (taken from prof-chandrashekhar.com) ---------- */
const NAME = "Prof. Dr. Chandra Shekhar";
const ROLE_LINE = "Professor & In-Charge (Admissions)";
/* Home-page blog preview comes from the build (Supabase); the bundled file is the fallback for local development. */
const BUILD_POSTS = (typeof window !== "undefined" && Array.isArray(window.__POSTS__) ? window.__POSTS__ : BLOG_POSTS).filter((p) => p.status !== "draft");
const SITE_URL = (typeof window !== "undefined" && window.__SITE__) || (typeof location !== "undefined" ? location.origin : "");
const STATEMENT =
  "A distinguished academician, educational strategist, researcher and administrator, with two decades of academic leadership behind him.";
const STATS = [
  { n: 20, l: "Years in academia", i: "clock" },
  { n: 200, l: "Colleges guided as strategic advisor", i: "building" },
  { n: 10000, l: "Students mentored", i: "users" },
  { n: 20, l: "Research papers published", i: "doc" },
  { n: 5, l: "National awards received", i: "award" },
];
const ROLES = [
  { i: "cap", k: "Educator", t: "Professor & In-Charge (Admissions)", d: "Bharatiya Vidya Bhavan College (BVBC), GGSIP University, Delhi." },
  { i: "star", k: "Founder", t: "GuidanceShiksha.com", d: "Education guidance platform founded by him." },
  { i: "target", k: "Strategic advisor", t: "200+ colleges guided", d: "Advising institutions as an educational strategist." },
  { i: "tv", k: "On television", t: "Career advisor, DD National", d: "Appears on the programme “Shiksha Avam Rojgar”." },
  { i: "building", k: "Former Director", t: "DITM College", d: "Previously served as Director of the college." },
  { i: "flask", k: "Researcher", t: "20+ published papers", d: "Big data, data mining, cybersecurity and sentiment analysis." },
];
const EXPERTISE = ["Big Data Analytics", "Apache Hadoop", "Data Mining", "Sentiment Analysis", "Cybersecurity", "ECDSA & Digital Signatures", "Machine Learning", "Cloud Computing", "Educational Administration", "Career Counseling"];
const QUALS = [
  { d: "Ph.D.", f: "Big Data Analytics", n: "Doctoral research" },
  { d: "Ph.D.", f: "Education", n: "Honorary doctorate" },
  { d: "M.Tech", f: "Computer Science Engineering", n: "" },
  { d: "M.Tech", f: "Information Technology", n: "" },
  { d: "MCA", f: "Master of Computer Applications", n: "" },
  { d: "M.Sc", f: "Mathematics", n: "" },
];
const SCHOLAR = "https://scholar.google.com/scholar?q=";
const PUBS = [
  {
    y: "June 2025",
    t: "Enhanced Sentiment Analysis and Data Mining of Political Leaders' Popularity",
    v: "Journal of Theoretical and Applied Information Technology (JATIT), Vol. 103, No. 11",
    tag: "Sentiment analysis",
    href: "http://www.jatit.org/volumes/Vol103No11/23Vol103No11.pdf",
  },
  {
    y: "March 2025",
    t: "An Innovative and Secured Electronic Voting System Based on Elliptic Curved Signing Approach (ECDSA) and Digital Signatures",
    v: "International Journal of Information Technology (Springer), Vol. 17, Issue 5",
    tag: "Cybersecurity",
    href: "https://doi.org/10.1007/s41870-025-02405-3",
  },
  {
    y: "April 2024",
    t: "Efficient Data Mining of Political Results Through the Apache Hadoop Structure: Unveiling Insights and Patterns in the Era of Big Data",
    v: "Tuijin Jishu / Journal of Propulsion Technology, Vol. 45, No. 2",
    tag: "Apache Hadoop",
    href: "https://doi.org/10.52783/tjjpt.v45.i02.6964",
  },
  {
    y: "2023",
    t: "A Robust and Secured Encryption Scheme for Big Data Security Based on Hadoop Distributed File System",
    v: "European Chemical Bulletin, Vol. 12, Special Issue 3",
    tag: "Big data",
    href: "https://doi.org/10.31838/ecb/2023.12.s3.839",
  },
  {
    y: "Feb 2018",
    t: "Defiance and Predicament: 4G Network",
    v: "5th National Conference",
    tag: "Networks",
    href: SCHOLAR + encodeURIComponent('"Defiance and Predicament: 4G Network"'),
    search: true,
  },
];
const HONOURS = [
  { y: "2024", t: "National Recognition Award", d: "Presented by the Speaker of the Delhi Vidhan Sabha.", k: "Award" },
  { y: "2023", t: "Shiksha Ratna Award", d: "Presented by Delhi Vidhan Sabha Speaker Shri Ram Nivas.", k: "Award" },
  { y: "Past", t: "Shiksha Samman Award", d: "One of the five-plus national awards received.", k: "Award" },
];
const MEDIA = { t: "Career Advisor, DD Morning Live Show", d: "A regular guest on DD National's “Shiksha Avam Rojgar”, guiding viewers on higher education, career paths and employment.", href: "https://www.youtube.com/watch?v=LDwy1OKb5Vw" };
const brandOf = (name) => ["youtube", "instagram", "linkedin", "facebook", "whatsapp"].find((b) => name.toLowerCase().includes(b)) || "";
const socialsOf = (settings) => [
  ...settings.socials.map((s) => ({ n: s.name, u: s.url, b: brandOf(s.name) })),
  { n: "WhatsApp", u: "https://wa.me/" + settings.whatsapp, b: "whatsapp" },
];
const NAV = [
  { id: "about", label: "About", hideS: true },
  { id: "research", label: "Research" },
  { id: "honours", label: "Honours", hideS: true },
  { id: "videos", label: "Videos", hideS: true },
  { id: "gallery", label: "Gallery" },
  { id: "contact", label: "Contact" },
];
const EASE = [0.2, 0.75, 0.2, 1];

const ICONS = {
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  building: "M4 21V8l8-5 8 5v13M9 21v-6h6v6M8 11h.01M12 11h.01M16 11h.01",
  users: "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M16 5.2a3 3 0 0 1 0 5.6",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  award: "M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 13.5 7 21l5-3 5 3-1.5-7.5",
  cap: "M2 9l10-5 10 5-10 5zM6 11v5c0 1 3 3 6 3s6-2 6-3v-5",
  star: "M12 2l3 6 6 1-4.5 4.2 1 6.3L12 16.5 6.5 19.5l1-6.3L3 9l6-1z",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  tv: "M3 6h18v11H3zM8 21h8M12 17v4",
  flask: "M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-10V3",
  compass: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  briefcase: "M3 8h18v11H3zM8 8V5h8v3M3 13h18",
  mic: "M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4",
  bell: "M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v2a3 3 0 0 0 3 3M16 6h4v2a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  mail: "M3 6h18v12H3zM3 7l9 6 9-6",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
};
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

/* WhatsApp: every lead lands on this number */
const wa = (text) => "https://wa.me/" + live.settings.whatsapp + "?text=" + encodeURIComponent(text);

const SERVICES = [
  { i: "compass", t: "Admission guidance", d: "Choosing the right course and college, and getting through the admission process with fewer surprises.", pts: ["Course and college shortlisting", "Eligibility, forms and deadlines", "Counselling-round planning"], q: "I need help with admission guidance." },
  { i: "target", t: "Career counselling", d: "Direction for students after school and graduation, drawn from two decades in academia.", pts: ["Strengths and interest mapping", "Options after 12th and graduation", "A clear course roadmap"], q: "I would like career counselling." },
  { i: "building", t: "Institutional advisory", d: "Strategy for colleges, from academics to admissions. He has guided 200+ institutions.", pts: ["Academic planning", "Admissions strategy", "Institutional growth advice"], q: "I would like to discuss advisory for our institution." },
  { i: "flask", t: "Research mentoring", d: "Guidance on research in big data, data mining, security and sentiment analysis.", pts: ["Topic selection and methods", "Writing and publishing papers", "Big data and security projects"], q: "I need research guidance." },
  { i: "mic", t: "Talks & media", d: "Sessions, panels and television appearances on education and careers.", pts: ["Seminars and panel sessions", "Student and parent talks", "Television and media features"], q: "I would like to invite you for a talk or media appearance." },
  { i: "bell", t: "Exam & admission updates", d: "Timely information on NEET, JEE, UPSC and admission news, shared on his YouTube channel.", pts: ["NEET, JEE and UPSC guidance", "Admission dates and notices", "Education news in plain language"], q: "I would like to know about exam and admission updates." },
];
/* Gallery: photos are embedded at build time from assets/gallery (see build.mjs). These are the empty slots shown until then. */
const GALLERY_SLOTS = [
  { cat: "Awards", cap: "Award ceremony" }, { cat: "Media", cap: "DD National studio" }, { cat: "Students", cap: "Mentoring session" },
  { cat: "Conferences", cap: "Conference stage" }, { cat: "Awards", cap: "Felicitation" }, { cat: "Campus", cap: "BVBC campus" },
  { cat: "Students", cap: "Student interaction" }, { cat: "Media", cap: "On air" },
];
/* Site data: what the build baked in, replaced by the live copy from Supabase when the admin changed something since. */
const W = typeof window !== "undefined" ? window : {};
const BUILD_GALLERY = Array.isArray(W.__GALLERY__) ? W.__GALLERY__ : [];
const BUILD_THUMBS = Array.isArray(W.__GALLERY_THUMBS__) ? W.__GALLERY_THUMBS__ : BUILD_GALLERY;
let live = {
  settings: SETTINGS, photo: W.__PHOTO__ || "", logo: W.__LOGO__ || "", thumb: W.__OFF_BEAT_THUMBNAIL__ || "",
  gallery: BUILD_GALLERY.map((url, i) => ({ url, thumb: BUILD_THUMBS[i] || url })), posts: BUILD_POSTS.slice(0, 3),
};
const listeners = new Set();
const useLive = () => useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => live, () => live);
if (typeof window !== "undefined") {
  loadPublic().then((v) => {
    if (!v) return;
    live = { settings: { ...SETTINGS, ...(v.settings || {}) }, photo: v.hero || live.photo, logo: v.logo, thumb: v.thumb, gallery: v.gallery || [], posts: (v.posts || []).slice(0, 3) };
    listeners.forEach((cb) => cb());
  }).catch(() => { /* offline or not set up: keep the built-in data */ });
}

/* ---------- helpers ---------- */
const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
);

function Reveal({ children, delay = 0, y = 34, className }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0.35, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -70px 0px" }} transition={{ duration: 0.8, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

function Magnetic({ children }) {
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 16, mass: 0.4 });
  const ref = useRef(null);
  const move = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.32);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.32);
  };
  const leave = () => { x.set(0); y.set(0); };
  return <motion.div ref={ref} style={{ x, y, display: "inline-block" }} onPointerMove={move} onPointerLeave={leave}>{children}</motion.div>;
}

function ProgressBar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });
  return <motion.div className="progress" style={{ scaleX }} aria-hidden="true" />;
}

/* ---------- nav ---------- */
function Nav() {
  const [active, setActive] = useState("");
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((en) => en.isIntersecting && setActive(en.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <div className="nav-shell">
      <motion.nav className="nav" aria-label="Main" initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}>
        {NAV.map((n) => (
          <a key={n.id} href={"#" + n.id} className={(active === n.id ? "on " : "") + (n.hideS ? "hide-s" : "")}>
            {active === n.id && <motion.span layoutId="pill" className="pill" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
            {n.label}
          </a>
        ))}
      </motion.nav>
    </div>
  );
}

/* ---------- hero ---------- */
function useClock() {
  const [t, setT] = useState("");
  useEffect(() => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
    const tick = () => setT(f.format(new Date()));
    tick();
    const id = setInterval(tick, 20000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Badge() {
  const reduce = useReducedMotion();
  return (
    <div className="badge" aria-hidden="true">
      <motion.svg className="ring" viewBox="0 0 118 118" animate={reduce ? undefined : { rotate: 360 }} transition={{ duration: 24, ease: "linear", repeat: Infinity }}>
        <defs><path id="ringpath" d="M59,59 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
        <text><textPath href="#ringpath" textLength="283" lengthAdjust="spacing">Educator · Researcher · Advisor ·</textPath></text>
      </motion.svg>
      <span className="c">20+</span>
    </div>
  );
}

function Hero() {
  const { photo } = useLive();
  const reduce = useReducedMotion();
  const clock = useClock();
  const ref = useRef(null);
  const { scrollY } = useScroll();
  const py = useTransform(scrollY, [0, 700], [0, -50]);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", e.clientX - r.left + "px");
    el.style.setProperty("--my", e.clientY - r.top + "px");
  };
  const lines = [<>Chandra</>, <span className="mark">Shekhar</span>];
  return (
    <header className="hero" ref={ref} onPointerMove={onMove}>
      <div className="grid-bg" aria-hidden="true" />
      <div className="spot" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div>
          <motion.div className="kicker" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}>
            <span>Academician · Researcher · Advisor</span>
            <span className="live"><i className="pulse" /> Delhi {clock && "· " + clock + " IST"}</span>
          </motion.div>
          <h1>
            <span className="line"><motion.span className="pre" style={{ display: "inline-block" }} initial={reduce ? false : { y: "120%" }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}>Prof. Dr.</motion.span></span>
            {lines.map((l, i) => (
              <span className="line" key={i}>
                <motion.span initial={reduce ? false : { y: "115%", rotate: 3 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.3 + i * 0.13 }}>{l}</motion.span>
              </span>
            ))}
          </h1>
          <motion.p className="role" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.85 }}>
            <b>Professor &amp; In-Charge (Admissions)</b> at Bharatiya Vidya Bhavan College, GGSIP University, Delhi. Mentor to 10,000+ students and strategic advisor to 200+ colleges.
          </motion.p>
          <motion.div className="cta-row" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1 }}>
            <Magnetic><a className="btn solid" href="#research">Read the research <Arrow /></a></Magnetic>
            <Magnetic><a className="btn wa" href={wa("Namaste Prof. Chandra Shekhar ji, I found you through your website and would like to talk.")} target="_blank" rel="noopener noreferrer"><WaIcon /> Chat on WhatsApp</a></Magnetic>
          </motion.div>
        </div>
        <motion.div className="portrait" style={{ y: reduce ? 0 : py }} initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.5 }}>
          <div className="arch-line" aria-hidden="true" />
          <div className="arch">
            {photo ? <img src={photo} alt={NAME} /> : <span className="mono" aria-hidden="true">CS</span>}
          </div>
          <div className="float-chip"><Icon name="tv" /><span><b>Career Advisor</b>DD National</span></div>
          <Badge />
        </motion.div>
      </div>
    </header>
  );
}

/* ---------- stats ---------- */
function Counter({ to }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, to, { duration: 1.9, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, reduce, to]);
  return <span ref={ref}>{v.toLocaleString("en-IN")}<sup>+</sup></span>;
}

function Stats() {
  return (
    <div className="stats-band">
      <div className="wrap"><div className="stats-head"><span>Two decades, in numbers</span></div></div>
      <div className="wrap stats">
        {STATS.map((s, i) => (
          <Reveal key={s.l} delay={i * 0.06} y={24}>
            <div className="stat"><span className="stat-ico"><Icon name={s.i} /></span><div className="n"><Counter to={s.n} /></div><div className="l">{s.l}</div><motion.span className="stat-bar" aria-hidden="true" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.6, ease: EASE, delay: 0.3 }} /></div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ---------- about ---------- */
function Word({ w, i, n, progress, reduce }) {
  const opacity = useTransform(progress, [i / n, Math.min(1, (i + 2) / n)], [0.22, 1]);
  return <motion.span className="w" style={{ opacity: reduce ? 1 : opacity }}>{w}</motion.span>;
}

function About() {
  const { photo } = useLive();
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  const words = STATEMENT.split(" ");
  return (
    <section id="about">
      <div className="wrap about-grid">
        <div className="about-side"><Reveal><div className="eyebrow">About</div></Reveal>{photo && <Reveal delay={0.08}><figure className="about-photo"><img src={photo} alt="" loading="lazy" /><figcaption><b>{NAME}</b>Educator · Researcher · Advisor</figcaption></figure></Reveal>}</div>
        <div>
          <p className="statement" ref={ref}>{words.map((w, i) => <Word key={i} w={w} i={i} n={words.length} progress={scrollYProgress} reduce={reduce} />)}</p>
          <div className="roles">
            {ROLES.map((r, i) => (
              <Reveal key={r.k} delay={(i % 2) * 0.08}>
                <div className="role-card"><span className="role-ico"><Icon name={r.i} /></span><span className="role-no" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span><div className="k">{r.k}</div><h3>{r.t}</h3><p>{r.d}</p></div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- expertise + qualifications ---------- */
function Chip({ t, i }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className="chip" animate={reduce ? undefined : { y: [0, -7, 0] }} transition={{ duration: 4 + (i % 4) * 0.7, ease: "easeInOut", repeat: Infinity, delay: i * 0.25 }} whileHover={reduce ? undefined : { scale: 1.07, rotate: -1.5 }}>
      {t}
    </motion.span>
  );
}

function Qualifications() {
  return (
    <section id="qualifications">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Qualifications</div><h2>Academic qualifications</h2></Reveal>
          <Reveal delay={0.1}><p>Two doctorates and four postgraduate degrees across computer science, information technology, mathematics and education.</p></Reveal>
        </div>
        <div className="qgrid">
          {QUALS.map((q, i) => (
            <Reveal key={q.d + q.f} delay={(i % 3) * 0.07} y={20}>
              <article className="qitem">
                <span className="qdeg">{q.d}</span>
                <h3>{q.f}</h3>
                {q.n && <p>{q.n}</p>}
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Expertise() {
  return (
    <section id="expertise" className="exp">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Areas of expertise</div><h2>What he works on</h2></Reveal>
          <Reveal delay={0.1}><p>From big data and cybersecurity to the administration of colleges and career counselling.</p></Reveal>
        </div>
        <Reveal><div className="chips">{EXPERTISE.map((t, i) => <Chip key={t} t={t} i={i} />)}</div></Reveal>
      </div>
    </section>
  );
}

/* ---------- research ---------- */
function Research() {
  return (
    <section id="research">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Research</div><h2>Selected publications</h2></Reveal>
          <Reveal delay={0.1}><p>Twenty-plus papers in total. These are the ones highlighted on his current site.</p></Reveal>
        </div>
        <div className="pubs">
          {PUBS.map((p, i) => (
            <Reveal key={p.t} delay={i * 0.04} y={20}>
              <a className="pub" href={p.href} target="_blank" rel="noopener noreferrer" aria-label={p.t + (p.search ? " (search on Google Scholar)" : " (opens publication)")}>
                <div className="pub-yr"><span className="pub-no">{String(i + 1).padStart(2, "0")}</span>{p.y}</div>
                <div className="pub-main">
                  <span className="pub-tag">{p.tag}</span>
                  <h3>{p.t}</h3>
                  <div className="pub-venue"><Icon name="book" />{p.v}</div>
                </div>
                <span className="pub-go">{p.search ? "Find on Scholar" : "Read paper"} <Arrow /></span>
              </a>
            </Reveal>
          ))}
        </div>
        <div className="pub-foot">
          <p className="pub-note">Latest first.</p>
          <a className="btn dark" href={SCHOLAR + encodeURIComponent('"Chandra Shekhar" Hadoop OR "big data" OR "sentiment analysis"')} target="_blank" rel="noopener noreferrer">Browse on Google Scholar <Arrow /></a>
        </div>
      </div>
    </section>
  );
}

/* ---------- honours ---------- */
function HCard({ h, i }) {
  const reduce = useReducedMotion();
  return (
    <motion.article className="hcard" initial={reduce ? false : { opacity: 0.35, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -60px 0px" }} transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}>
      <span className="hmedal" aria-hidden="true"><Icon name="trophy" /></span>
      <div className="hbody">
        <span className="hyear">{h.y}</span>
        <h3>{h.t}</h3>
        <p>{h.d}</p>
      </div>
    </motion.article>
  );
}

function Honours() {
  const reduce = useReducedMotion();
  return (
    <section id="honours" className="honours">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Recognition</div><h2>Honours &amp; media</h2></Reveal>
          <Reveal delay={0.1}><p>National awards for service to education, and a regular presence on DD National.</p></Reveal>
        </div>
        <div className="honours-grid">
          <motion.a className="media-feature" href={MEDIA.href} target="_blank" rel="noopener noreferrer" initial={reduce ? false : { opacity: 0.35, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -60px 0px" }} transition={{ duration: 0.8, ease: EASE }}>
            <span className="media-live"><i className="pulse" /> On air</span>
            <span className="media-ico"><Icon name="tv" /></span>
            <div className="media-kicker">Doordarshan · DD National</div>
            <h3>{MEDIA.t}</h3>
            <p>{MEDIA.d}</p>
            <span className="media-go">Watch an episode <Arrow /></span>
          </motion.a>
          <div className="hlist">{HONOURS.map((h, i) => <HCard key={h.t} h={h} i={i} />)}</div>
        </div>
      </div>
    </section>
  );
}

const readTime = (post) => post.readMin || Math.max(1, Math.ceil((post.content || []).join(" ").split(/\s+/).filter(Boolean).length / 200));

function Blog() {
  const { posts } = useLive();
  return (
    <section id="blog" className="blog">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Blog</div><h2>Insights &amp; guidance</h2></Reveal>
          <Reveal delay={0.1}><a className="btn dark" href="blog/index.html">View all posts</a></Reveal>
        </div>
        <div className="blog-grid">
          {posts.map((post, i) => (
            <Reveal key={post.slug} delay={i * 0.08}>
              <article className="blog-card">
                <a className="blog-cover-link" href={`blog/${post.slug}.html`} tabIndex={-1} aria-hidden="true">
                  <div className="blog-cover" style={{ backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.3)), url(${post.cover})` }} />
                  <span className="blog-chip">{post.category}</span>
                </a>
                <div className="blog-body">
                  <div className="blog-meta"><span>{post.date}</span><span>{readTime(post)} min read</span></div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <a className="blog-more" href={`blog/${post.slug}.html`}>Read article <Arrow /></a>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- brand icons, QR + vCard ---------- */
const Brand = ({ name }) => (BRANDS[name] ? <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={BRANDS[name].d} /></svg> : <Icon name="link" />);

function SocialIcons({ className = "soc-row" }) {
  const { settings } = useLive();
  return (
    <div className={className}>
      {socialsOf(settings).map((s) => (
        <a key={s.n} className="soc" href={s.u} target="_blank" rel="noopener noreferrer" aria-label={s.n} title={s.n} style={{ "--bc": BRANDS[s.b]?.color || "#0a0a0a" }}><Brand name={s.b} /></a>
      ))}
    </div>
  );
}

const vEsc = (t) => String(t).replace(/([,;\\])/g, "\\$1");
const phoneDigits = (p) => p.replace(/[^+\d]/g, "");
/* The QR carries the essentials only (a shorter code scans faster); the downloaded file also has the office address. */
function buildVcard(full, settings) {
  const lines = [
    "BEGIN:VCARD", "VERSION:3.0",
    "N:Shekhar;Chandra;;Prof. Dr.;", "FN:" + NAME,
    "ORG:" + vEsc("Bharatiya Vidya Bhavan College, GGSIP University"), "TITLE:" + vEsc(ROLE_LINE),
    ...settings.phones.map((p) => "TEL;TYPE=CELL:" + phoneDigits(p)),
    ...(settings.email ? ["EMAIL;TYPE=INTERNET:" + settings.email] : []),
    ...(full && settings.office ? ["ADR;TYPE=WORK:;;" + vEsc(settings.office) + ";;;;"] : []),
    ...(SITE_URL ? ["URL:" + SITE_URL] : []),
    "END:VCARD",
  ];
  return lines.join("\r\n");
}

function QR({ text }) {
  const qr = React.useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(text);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += "M" + c + " " + r + "h1v1h-1z";
    return { n, d };
  }, [text]);
  return (
    <svg className="qr" viewBox={"-4 -4 " + (qr.n + 8) + " " + (qr.n + 8)} role="img" aria-label="QR code: scan to save the contact card to your phone" shapeRendering="crispEdges">
      <rect x="-4" y="-4" width={qr.n + 8} height={qr.n + 8} fill="#fff" /><path d={qr.d} fill="#0a0a0a" />
    </svg>
  );
}

function VCard() {
  const { settings, photo } = useLive();
  const text = React.useMemo(() => buildVcard(false, settings), [settings]);
  const fullText = React.useMemo(() => buildVcard(true, settings), [settings]);
  const download = () => {
    const url = URL.createObjectURL(new Blob([fullText], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "Chandra-Shekhar.vcf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const phone = settings.phones[0];
  return (
    <aside className="vcard" aria-label="Contact card">
      <div className="vc-top">
        <span className="vc-av">{photo ? <img src={photo} alt="" /> : "CS"}</span>
        <div><div className="vc-name">{NAME}</div><div className="vc-role">{ROLE_LINE}</div><div className="vc-org">Bharatiya Vidya Bhavan College, GGSIP University</div></div>
      </div>
      <div className="vc-qr"><QR text={text} /><div className="vc-scan"><b>Scan to save contact</b><span>Point your phone camera at the code. Name, numbers and email are added to your contacts.</span></div></div>
      <button type="button" className="vc-dl" onClick={download}><Icon name="download" /> Download vCard</button>
      <div className="vc-actions">
        {phone && <a href={"tel:" + phoneDigits(phone)}><Icon name="phone" />Call</a>}
        {settings.email && <a href={"mailto:" + settings.email}><Icon name="mail" />Email</a>}
        <a href={wa("Namaste Prof. Chandra Shekhar ji, I found you through your website and would like to talk.")} target="_blank" rel="noopener noreferrer"><WaIcon />WhatsApp</a>
      </div>
      <SocialIcons className="soc-row vc-soc" />
    </aside>
  );
}

/* ---------- WhatsApp lead helpers ---------- */
const WaIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.48 14.98L2 22l5.17-1.52A9.93 9.93 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.07.9.92-2.99-.2-.31a8.2 8.2 0 1 1 6.83 3.72Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.14.16-.29.19-.54.06-.25-.12-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.57c.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.16-.48-.29Z" /></svg>
);

/* ---------- floating WhatsApp button ---------- */
function FloatingWA() {
  useLive();
  const [show, setShow] = useState(false);
  useEffect(() => { const id = setTimeout(() => setShow(true), 1400); return () => clearTimeout(id); }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.a
          className="fab"
          href={wa("Namaste Prof. Chandra Shekhar ji, I found you through your website and would like to talk.")}
          target="_blank" rel="noopener noreferrer" aria-label="Chat with Prof. Chandra Shekhar on WhatsApp"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
        >
          <span className="fab-ring" aria-hidden="true" />
          <WaIcon />
          <span className="fab-label">Chat on WhatsApp</span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}

/* ---------- services ---------- */
function Help() {
  return (
    <section id="services" className="help">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">How he can help</div><h2>Areas of guidance</h2></Reveal>
          <Reveal delay={0.1}><p>Select a service and the enquiry form below opens with your topic ready.</p></Reveal>
        </div>
        <div className="help-grid">
          {SERVICES.map((h, i) => (
            <Reveal key={h.t} delay={(i % 3) * 0.08}>
              <a className="help-card" href="#contact" onClick={() => window.dispatchEvent(new CustomEvent("prefill", { detail: h.q }))}>
                <div className="help-top"><span className="help-ico"><Icon name={h.i} /></span><span className="k">{String(i + 1).padStart(2, "0")}</span></div>
                <h3>{h.t}</h3>
                <p>{h.d}</p>
                <ul className="help-pts">{h.pts.map((p) => <li key={p}><Icon name="check" />{p}</li>)}</ul>
                <span className="go">Send an enquiry <Arrow /></span>
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- YouTube ---------- */
function YouTube() {
  const { thumb } = useLive();
  return (
    <section id="videos" className="yt">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">On YouTube</div><h2>शिक्षा से रोज़गार तक</h2></Reveal>
          <Reveal delay={0.1}><p>Two direct ways to follow his guidance, updates and student-first advice.</p></Reveal>
        </div>

        <div className="yt-grid two-up">
          <Reveal>
            <a className="yt-column-card yt-video-card" href="https://www.youtube.com/watch?v=LDwy1OKb5Vw" target="_blank" rel="noopener noreferrer">
              <div className="yt-media yt-media-one" style={thumb ? { backgroundImage: `linear-gradient(0deg, rgba(0,0,0,0.06), rgba(0,0,0,0.06)), url("${thumb}")` } : undefined}>
                <div className="yt-live-badge"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1 5.5h2v5.3l4.5 2.7-1 1.7-5.5-3.3Z" /></svg> LIVE ON AIR</div>
                <span className="yt-media-play" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg>
                </span>
              </div>
              <div className="yt-card-body">
                <div className="yt-kicker">DOORDARSHAN (DD INTERNATIONAL) — PRASAR BHARATI</div>
                <h3>DD Morning Live Show — Shiksha Avam Rojgar</h3>
                <div className="yt-role">Role: Career Advisor</div>
                <p>Dr. Chandra Shekhar appears as a career and education advisor on this nationally televised morning show, guiding lakhs of viewers on higher education, career paths, and employment opportunities in India.</p>
                <span className="yt-cta"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg> Watch Episode</span>
              </div>
            </a>
          </Reveal>

          <Reveal delay={0.08}>
            <a className="yt-column-card yt-channel-card" href="https://www.youtube.com/@Dr.chandra_shekhar" target="_blank" rel="noopener noreferrer">
              <div className="yt-media yt-media-two">
                <div className="yt-channel-tag">YOUTUBE</div>
                <span className="yt-channel-play" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg></span>
                <div className="yt-channel-handle">@Dr.chandra_shekhar</div>
              </div>
              <div className="yt-card-body">
                <div className="yt-kicker">OFFICIAL CHANNEL</div>
                <h3>Dr. Chandra Shekhar — YouTube</h3>
                <div className="yt-role">Career Advisor • Educator • TV Expert</div>
                <p>Watch career guidance sessions, Shiksha Avam Rojgar episodes, Big Data &amp; tech talks, and education insights on the official YouTube channel.</p>
                <span className="yt-cta yt-cta-red"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" /></svg> Visit Channel</span>
              </div>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ---------- gallery ---------- */
function Gallery() {
  const { gallery } = useLive();
  const reduce = useReducedMotion();
  const total = Math.max(GALLERY_SLOTS.length, gallery.length);
  const items = Array.from({ length: total }, (_, i) => {
    const s = GALLERY_SLOTS[i] || { cat: "Moments", cap: "Moment " + (i + 1) };
    return { ...s, src: gallery[i]?.url || "", thumb: gallery[i]?.thumb || gallery[i]?.url || "", r: ["4 / 5", "1 / 1", "4 / 3", "3 / 4"][i % 4], g: ["one", "two", "three", "four"][i % 4] };
  });
  const visible = items.slice(0, 8);
  const live = visible.filter((x) => x.src);
  const [open, setOpen] = useState(-1);
  const close = () => setOpen(-1);
  const step = (d) => setOpen((o) => (o + d + live.length) % live.length);
  useEffect(() => {
    if (open < 0) return;
    const k = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <section id="gallery">
      <div className="wrap">
        <div className="sec-head">
          <Reveal><div className="eyebrow">Gallery</div><h2>Moments</h2></Reveal>
          <Reveal delay={0.1}><p>Awards, studio sessions, conferences and time with students.</p></Reveal>
        </div>
        <motion.div layout className="masonry">
          <AnimatePresence mode="popLayout">
            {visible.map((g, i) => {
              const idx = live.indexOf(g);
              return (
                <motion.figure layout key={g.cap + g.cat} className="shot" style={{ "--r": g.r }} initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.5, ease: EASE, delay: (i % 4) * 0.05 }}>
                  {g.src ? (
                    <button className="shot-btn" onClick={() => setOpen(idx)} aria-label={"Open photo: " + g.cap}><img src={g.thumb} alt={g.cap} loading="lazy" decoding="async" /></button>
                  ) : (
                    <div className={"ph " + g.g}><span aria-hidden="true">CS</span><em>Photo to be added</em></div>
                  )}
                </motion.figure>
              );
            })}
          </AnimatePresence>
        </motion.div>
        {items.length > 8 && (
          <div className="gallery-cta-wrap">
            <a className="gallery-view-more" href="gallery.html">View more</a>
          </div>
        )}
      </div>
      <AnimatePresence>
        {open >= 0 && live[open] && (
          <motion.div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
            <motion.img key={open} src={live[open].src} alt={live[open].cap} initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} onClick={(e) => e.stopPropagation()} />
            <div className="lb-cap">{live[open].cap} · {live[open].cat}</div>
            <button className="lb-btn lb-x" onClick={close} aria-label="Close">×</button>
            {live.length > 1 && <>
              <button className="lb-btn lb-l" onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Previous photo">‹</button>
              <button className="lb-btn lb-r" onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Next photo">›</button>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------- contact + WhatsApp lead form ---------- */
function Contact() {
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  const [err, setErr] = useState({});
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr({ ...err, [k]: false }); };
  useEffect(() => {
    const on = (e) => setF((p) => ({ ...p, message: p.message.trim() ? p.message : e.detail }));
    window.addEventListener("prefill", on);
    return () => window.removeEventListener("prefill", on);
  }, []);
  const submit = (e) => {
    e.preventDefault();
    const bad = {
      name: f.name.trim().length < 2,
      email: !/^\S+@\S+\.\S+$/.test(f.email.trim()),
      phone: f.phone.replace(/\D/g, "").length < 10,
      message: f.message.trim().length < 5,
    };
    setErr(bad);
    if (Object.values(bad).some(Boolean)) return;
    const text =
      "Namaste Prof. Chandra Shekhar ji,\n\n" + f.message.trim() +
      "\n\nName: " + f.name.trim() + "\nEmail: " + f.email.trim() + "\nPhone: " + f.phone.trim() +
      "\n\n(Sent from your website)";
    window.open(wa(text), "_blank", "noopener,noreferrer");
  };
  return (
    <section id="contact" className="contact">
      <div className="wrap contact-grid">
        <div className="contact-form">
          <Reveal><div className="eyebrow">Contact</div></Reveal>
          <Reveal delay={0.05}><h2>Get in touch</h2></Reveal>
          <Reveal delay={0.1}><p className="lead">Admissions, career guidance, advisory, research or media: send a message and he will get back to you.</p></Reveal>
          <Reveal delay={0.12}>
            <form className="lead-form" onSubmit={submit} noValidate>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="lf-name">Full name</label>
                  <input id="lf-name" autoComplete="name" value={f.name} onChange={set("name")} aria-invalid={!!err.name} />
                </div>
                <div className="field">
                  <label htmlFor="lf-phone">Phone</label>
                  <input id="lf-phone" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} aria-invalid={!!err.phone} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="lf-email">Email</label>
                <input id="lf-email" type="email" autoComplete="email" value={f.email} onChange={set("email")} aria-invalid={!!err.email} />
              </div>
              <div className="field">
                <label htmlFor="lf-msg">Message</label>
                <textarea id="lf-msg" rows={3} value={f.message} onChange={set("message")} aria-invalid={!!err.message} />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn solid">Send message</button>
                <span className={"form-hint" + (Object.values(err).some(Boolean) ? " err" : "")} role="status">
                  {Object.values(err).some(Boolean) ? "Please enter a valid name, phone number (10+ digits), email and message." : "All fields are required."}
                </span>
              </div>
            </form>
          </Reveal>
        </div>
        <Reveal delay={0.1} className="contact-card"><VCard /></Reveal>
      </div>
    </section>
  );
}

function Footer() {
  const { settings, logo } = useLive();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="foot-logo" aria-hidden="true">{logo ? <img src={logo} alt="" /> : "CS"}</div>
            <div className="foot-name">{NAME}</div>
            <p>Professor &amp; In-Charge (Admissions), BVBC, GGSIP University, Delhi. Educator, researcher and strategic advisor to 200+ colleges.</p>
            <a className="foot-cta" href="#contact">Get in touch <Arrow /></a>
          </div>
          <nav aria-label="Footer">
            <div className="foot-h">Explore</div>
            <ul>
              {[["about", "About"], ["qualifications", "Qualifications"], ["research", "Research"], ["gallery", "Gallery"], ["blog", "Blog"], ["contact", "Contact"]].map(([id, l]) => <li key={id}><a href={"#" + id}>{l}</a></li>)}
            </ul>
          </nav>
          <div>
            <div className="foot-h">Contact</div>
            <ul>
              {settings.phones.map((p) => <li key={p}><a href={"tel:" + p.replace(/[^+\d]/g, "")}>{p}</a></li>)}
              {settings.email && <li><a href={"mailto:" + settings.email}>{settings.email}</a></li>}
              {settings.office && <li>{settings.office}</li>}
            </ul>
          </div>
          <div>
            <div className="foot-h">Follow</div>
            <ul className="foot-soc">{socialsOf(settings).map((s) => <li key={s.n}><a href={s.u} target="_blank" rel="noopener noreferrer" style={{ "--bc": BRANDS[s.b]?.color || "#fff" }}><span className="foot-ico"><Brand name={s.b} /></span>{s.n}</a></li>)}</ul>
          </div>
        </div>
        <div className="foot-bar">
          <span>© 2026 {NAME}. All rights reserved.</span>
          <span>Designed &amp; developed by GIPSM Technology India Pvt. Ltd.</span>
        </div>
      </div>
    </footer>
  );
}

function App() {
  return (
    <div id="top">
      <ProgressBar />
      <Nav />
      <main>
        <Hero />
        <Stats />
        <About />
        <Qualifications />
        <Help />
        <Gallery />
        <Expertise />
        <YouTube />
        <Honours />
        <Research />
        <Blog />
        <Contact />
      </main>
      <Footer />
      <FloatingWA />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
