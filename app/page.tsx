"use client";

import { useState } from "react";
import {
  Bell, Camera, ChevronRight, Droplets, Flame, Home, MessageCircle,
  Plus, ScanLine, Sparkles, Target, TrendingDown, Utensils, X,
} from "lucide-react";

const macros = [
  { name: "Protein", value: "112", unit: "g", target: "of 155g", color: "#81918a", width: "72%" },
  { name: "Carbs", value: "126", unit: "g", target: "of 210g", color: "#c6a36c", width: "60%" },
  { name: "Fat", value: "48", unit: "g", target: "of 68g", color: "#9d8a79", width: "70%" },
];

export default function Dashboard() {
  const [water, setWater] = useState(5);
  const [craving, setCraving] = useState(false);
  const [active, setActive] = useState("Today");

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>forma</span></div>
        <nav>
          {[{n:"Today",i:Home},{n:"Progress",i:TrendingDown},{n:"Coach",i:MessageCircle}].map(({n,i:Icon}) => (
            <button key={n} className={active === n ? "nav-active" : ""} onClick={() => setActive(n)}><Icon size={19}/><span>{n}</span></button>
          ))}
        </nav>
        <div className="sidebar-profile"><div className="avatar">N</div><div><b>Nima</b><span>89.0 kg</span></div><ChevronRight size={17}/></div>
      </aside>

      <section className="content">
        <header>
          <div><p className="eyebrow">MONDAY, JULY 27</p><h1>Good afternoon, Nima.</h1><p className="subtitle">You’re doing well today. Let’s keep the evening intentional.</p></div>
          <button className="icon-button" aria-label="Notifications"><Bell size={20}/><i /></button>
        </header>

        <section className="hero-card">
          <div className="hero-copy">
            <span className="status-pill"><span /> ON TRACK</span>
            <p>Your remaining budget</p>
            <div className="calories"><strong>743</strong><span>kcal</span></div>
            <p className="after">after 1,307 kcal consumed</p>
            <div className="budget-bar"><span /></div>
            <div className="bar-labels"><span>0</span><span>Daily target · 2,050</span></div>
          </div>
          <div className="hero-action">
            <div className="meal-icon"><ScanLine size={32}/><Utensils size={24}/></div>
            <div><h2>Can I afford to eat this?</h2><p>Photograph your food before eating. Get a calm, instant answer.</p></div>
            <button><Camera size={19}/> Check my meal</button>
          </div>
        </section>

        <div className="section-heading"><div><h2>Today at a glance</h2><p>Small choices, clearly understood.</p></div><button>View details <ChevronRight size={16}/></button></div>

        <section className="metrics-grid">
          <article className="macro-card">
            <div className="card-label"><Target size={18}/><span>NUTRITION</span></div>
            <div className="macro-list">{macros.map(m => <div className="macro" key={m.name}>
              <div><span>{m.name}</span><p><strong>{m.value}</strong> {m.unit} <small>{m.target}</small></p></div>
              <div className="mini-bar"><span style={{background:m.color,width:m.width}} /></div>
            </div>)}</div>
          </article>

          <article className="water-card">
            <div className="card-label"><Droplets size={18}/><span>WATER</span></div>
            <div><strong>{water}</strong><span> / 8 glasses</span></div>
            <div className="glasses">{Array.from({length:8}).map((_,i)=><button key={i} onClick={()=>setWater(i+1)} className={i<water?"filled":""} aria-label={`Set water to ${i+1} glasses`}><Droplets size={17}/></button>)}</div>
            <button className="add-water" onClick={()=>setWater(Math.min(8,water+1))}><Plus size={17}/> Add water</button>
          </article>

          <article className="trend-card">
            <div className="card-label"><TrendingDown size={18}/><span>WEIGHT TREND</span></div>
            <div className="trend-top"><div><strong>88.4</strong><span> kg</span><p>7-day average</p></div><span className="down">↘ 0.6 kg</span></div>
            <div className="chart"><svg viewBox="0 0 300 72" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#82958b" stopOpacity=".3"/><stop offset="1" stopColor="#82958b" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,15 C25,20 35,13 58,25 S95,31 112,35 S145,27 165,40 S200,48 220,49 S260,54 300,59 L300,72 L0,72Z"/><path className="line" d="M0,15 C25,20 35,13 58,25 S95,31 112,35 S145,27 165,40 S200,48 220,49 S260,54 300,59"/></svg></div>
            <div className="chart-label"><span>JUL 21</span><span>TODAY</span></div>
          </article>
        </section>

        <section className="evening-card">
          <div className="evening-icon"><Flame size={21}/></div>
          <div className="evening-copy"><span>HOME ARRIVAL PLAN</span><h2>Your evening, already thought through.</h2><p>A dinner around <b>550 kcal</b> with <b>40g protein</b> will leave room for something small later.</p></div>
          <button><Camera size={18}/> Photograph dinner</button>
        </section>

        <section className="coach-row">
          <div className="coach-orb"><Sparkles size={24}/></div>
          <div><span>YOUR COACH</span><h3>“Consistency doesn’t mean perfection.”</h3><p>You’ve stayed within your budget 5 of the last 7 days. That’s exactly how progress is built.</p></div>
          <button onClick={()=>setCraving(true)}>I’m craving sweets <ChevronRight size={17}/></button>
        </section>
      </section>

      <nav className="mobile-nav">{[{n:"Today",i:Home},{n:"Check meal",i:Camera},{n:"Progress",i:TrendingDown},{n:"Coach",i:MessageCircle}].map(({n,i:Icon})=><button key={n} className={n==="Today"?"active":""}><Icon size={20}/><span>{n}</span></button>)}</nav>

      {craving && <div className="modal-backdrop" onClick={()=>setCraving(false)}><div className="modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setCraving(false)}><X size={20}/></button><span className="modal-icon">✦</span><p>TAKE A GENTLE PAUSE</p><h2>What are you feeling right now?</h2><span>There’s no wrong answer. Naming it helps you choose.</span><div className="modal-actions"><button>I'm physically hungry</button><button>I simply want something sweet</button></div></div></div>}
    </main>
  );
}
