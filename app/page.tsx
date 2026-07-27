"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Camera,
  Check,
  ChevronRight,
  Download,
  Droplets,
  Flame,
  Home,
  MessageCircle,
  Mic,
  Pencil,
  Plus,
  Scale,
  ScanLine,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  Utensils,
  X,
} from "lucide-react";

type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
};

type DayLog = {
  water: number;
  meals: Meal[];
};

type WeightEntry = {
  id: string;
  value: number;
  date: string;
};

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

type TrackerStore = {
  goals: Goals;
  days: Record<string, DayLog>;
  weights: WeightEntry[];
};

type MealDraft = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: {
    results: { [index: number]: { [index: number]: { transcript: string } } };
  }) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const STORAGE_KEY = "forma-tracker-v1";
const EMPTY_MEAL: MealDraft = {
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

const DEFAULT_STORE: TrackerStore = {
  goals: { calories: 2050, protein: 155, carbs: 210, fat: 68, water: 8 },
  days: {},
  weights: [],
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseVoiceMeal(transcript: string): MealDraft {
  const find = (...patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const match = transcript.match(pattern);
      if (match?.[1]) return match[1];
    }
    return "";
  };

  return {
    name: transcript.trim(),
    calories: find(/(\d+(?:\.\d+)?)\s*(?:kcal|calories?)/i),
    protein: find(
      /(\d+(?:\.\d+)?)\s*(?:g|grams?)?\s*(?:of\s+)?protein/i,
      /protein\s*(?:is|of)?\s*(\d+(?:\.\d+)?)/i,
    ),
    carbs: find(
      /(\d+(?:\.\d+)?)\s*(?:g|grams?)?\s*(?:of\s+)?carbs?/i,
      /carbs?\s*(?:is|of)?\s*(\d+(?:\.\d+)?)/i,
    ),
    fat: find(
      /(\d+(?:\.\d+)?)\s*(?:g|grams?)?\s*(?:of\s+)?fat/i,
      /fat\s*(?:is|of)?\s*(\d+(?:\.\d+)?)/i,
    ),
  };
}

function formatDay(dateKey: string) {
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateKey}T12:00:00`));
}

export default function Dashboard() {
  const todayKey = localDateKey();
  const [store, setStore] = useState<TrackerStore>(DEFAULT_STORE);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState("Today");
  const [mealModal, setMealModal] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [goalsModal, setGoalsModal] = useState(false);
  const [craving, setCraving] = useState(false);
  const [installHelp, setInstallHelp] = useState(false);
  const [mealDraft, setMealDraft] = useState<MealDraft>(EMPTY_MEAL);
  const [weightDraft, setWeightDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState<Goals>(DEFAULT_STORE.goals);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TrackerStore;
        setStore({
          goals: { ...DEFAULT_STORE.goals, ...parsed.goals },
          days: parsed.days ?? {},
          weights: parsed.weights ?? [],
        });
      }
    } catch {
      setStore(DEFAULT_STORE);
    } finally {
      setReady(true);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [ready, store]);

  const today = store.days[todayKey] ?? { water: 0, meals: [] };

  const totals = useMemo(
    () =>
      today.meals.reduce(
        (sum, meal) => ({
          calories: sum.calories + meal.calories,
          protein: sum.protein + meal.protein,
          carbs: sum.carbs + meal.carbs,
          fat: sum.fat + meal.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [today.meals],
  );

  const remaining = Math.max(0, store.goals.calories - totals.calories);
  const calorieProgress = Math.min(100, (totals.calories / store.goals.calories) * 100);
  const latestWeight = store.weights.at(-1)?.value;
  const previousWeight = store.weights.at(-2)?.value;
  const weightChange =
    latestWeight !== undefined && previousWeight !== undefined
      ? latestWeight - previousWeight
      : null;

  const macroRows = [
    {
      name: "Protein",
      value: totals.protein,
      target: store.goals.protein,
      color: "#81918a",
    },
    {
      name: "Carbs",
      value: totals.carbs,
      target: store.goals.carbs,
      color: "#c6a36c",
    },
    {
      name: "Fat",
      value: totals.fat,
      target: store.goals.fat,
      color: "#9d8a79",
    },
  ];

  const updateToday = (updater: (day: DayLog) => DayLog) => {
    setStore((current) => ({
      ...current,
      days: {
        ...current.days,
        [todayKey]: updater(current.days[todayKey] ?? { water: 0, meals: [] }),
      },
    }));
  };

  const addMeal = (event: FormEvent) => {
    event.preventDefault();
    if (!mealDraft.name.trim() || !mealDraft.calories) return;

    const meal: Meal = {
      id: crypto.randomUUID(),
      name: mealDraft.name.trim(),
      calories: safeNumber(mealDraft.calories),
      protein: safeNumber(mealDraft.protein),
      carbs: safeNumber(mealDraft.carbs),
      fat: safeNumber(mealDraft.fat),
      createdAt: new Date().toISOString(),
    };

    updateToday((day) => ({ ...day, meals: [...day.meals, meal] }));
    setMealDraft(EMPTY_MEAL);
    setVoiceStatus("");
    setMealModal(false);
  };

  const removeMeal = (mealId: string) => {
    updateToday((day) => ({
      ...day,
      meals: day.meals.filter((meal) => meal.id !== mealId),
    }));
  };

  const saveWeight = (event: FormEvent) => {
    event.preventDefault();
    const value = safeNumber(weightDraft);
    if (!value) return;

    setStore((current) => ({
      ...current,
      weights: [
        ...current.weights.filter((entry) => entry.date !== todayKey),
        { id: crypto.randomUUID(), value, date: todayKey },
      ].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setWeightDraft("");
    setWeightModal(false);
  };

  const saveGoals = (event: FormEvent) => {
    event.preventDefault();
    setStore((current) => ({ ...current, goals: goalDraft }));
    setGoalsModal(false);
  };

  const startVoiceEntry = () => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceStatus("Voice entry is not available in this browser. You can still type the meal.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-AU";
    recognition.onstart = () => setVoiceStatus("Listening… describe your meal and nutrients if known.");
    recognition.onend = () =>
      setVoiceStatus((current) => (current.startsWith("Listening") ? "Voice captured." : current));
    recognition.onerror = () =>
      setVoiceStatus("I couldn’t hear that clearly. Please try again or type the meal.");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMealDraft(parseVoiceMeal(transcript));
      setVoiceStatus("Voice captured. Check the details before saving.");
    };
    recognition.start();
  };

  const installApp = async () => {
    if (!installPrompt) {
      setInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const openMeal = (starter = "") => {
    setMealDraft({ ...EMPTY_MEAL, name: starter });
    setVoiceStatus("");
    setMealModal(true);
  };

  const dayHistory = Object.entries(store.days)
    .map(([date, day]) => ({
      date,
      calories: day.meals.reduce((sum, meal) => sum + meal.calories, 0),
      meals: day.meals.length,
      water: day.water,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>forma</span>
        </div>
        <nav>
          {[
            { n: "Today", i: Home },
            { n: "Progress", i: TrendingDown },
            { n: "Coach", i: MessageCircle },
          ].map(({ n, i: Icon }) => (
            <button
              key={n}
              className={active === n ? "nav-active" : ""}
              onClick={() => setActive(n)}
            >
              <Icon size={19} /><span>{n}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-profile" onClick={() => setGoalsModal(true)}>
          <div className="avatar">N</div>
          <div><b>Nima</b><span>{latestWeight ? `${latestWeight.toFixed(1)} kg` : "Add first weight"}</span></div>
          <Settings size={17} />
        </button>
      </aside>

      <section className="content">
        <div className="privacy-strip">
          <Check size={14} />
          <span>Private preview · your entries are saved on this device</span>
          <button onClick={installApp}><Download size={14} /> Install on phone</button>
        </div>

        {active === "Today" && (
          <>
            <header>
              <div>
                <p className="eyebrow">
                  {new Intl.DateTimeFormat("en-AU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  }).format(new Date()).toUpperCase()}
                </p>
                <h1>Good afternoon, Nima.</h1>
                <p className="subtitle">Make the next choice clear, then carry on with your day.</p>
              </div>
              <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
            </header>

            <section className="hero-card">
              <div className="hero-copy">
                <span className="status-pill"><span /> {totals.calories <= store.goals.calories ? "ON TRACK" : "OVER TARGET"}</span>
                <p>Your remaining budget</p>
                <div className="calories"><strong>{Math.round(remaining)}</strong><span>kcal</span></div>
                <p className="after">after {Math.round(totals.calories).toLocaleString()} kcal logged</p>
                <div className="budget-bar"><span style={{ width: `${calorieProgress}%` }} /></div>
                <div className="bar-labels"><span>0</span><span>Daily target · {store.goals.calories.toLocaleString()}</span></div>
              </div>
              <div className="hero-action">
                <div className="meal-icon"><ScanLine size={32} /><Utensils size={24} /></div>
                <div>
                  <h2>What did you eat?</h2>
                  <p>Speak or type your meal, check the estimate, then save it to today.</p>
                </div>
                <div className="hero-buttons">
                  <button onClick={() => openMeal()}><Mic size={19} /> Speak or type</button>
                  <button className="secondary-hero-button" onClick={() => openMeal()}>
                    <Camera size={18} /> Photo coming next
                  </button>
                </div>
              </div>
            </section>

            <div className="section-heading">
              <div><h2>Today at a glance</h2><p>Real totals from the meals you save.</p></div>
              <button onClick={() => setGoalsModal(true)}>Edit goals <Pencil size={14} /></button>
            </div>

            <section className="metrics-grid">
              <article className="macro-card">
                <div className="card-label"><Target size={18} /><span>NUTRITION</span></div>
                <div className="macro-list">
                  {macroRows.map((macro) => (
                    <div className="macro" key={macro.name}>
                      <div>
                        <span>{macro.name}</span>
                        <p><strong>{Math.round(macro.value)}</strong> g <small>of {macro.target}g</small></p>
                      </div>
                      <div className="mini-bar">
                        <span
                          style={{
                            background: macro.color,
                            width: `${Math.min(100, (macro.value / macro.target) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="water-card">
                <div className="card-label"><Droplets size={18} /><span>WATER</span></div>
                <div><strong>{today.water}</strong><span> / {store.goals.water} glasses</span></div>
                <div className="glasses">
                  {Array.from({ length: store.goals.water }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => updateToday((day) => ({ ...day, water: index + 1 }))}
                      className={index < today.water ? "filled" : ""}
                      aria-label={`Set water to ${index + 1} glasses`}
                    >
                      <Droplets size={17} />
                    </button>
                  ))}
                </div>
                <button
                  className="add-water"
                  onClick={() =>
                    updateToday((day) => ({
                      ...day,
                      water: Math.min(store.goals.water, day.water + 1),
                    }))
                  }
                >
                  <Plus size={17} /> Add water
                </button>
              </article>

              <article className="trend-card">
                <div className="card-label"><TrendingDown size={18} /><span>WEIGHT TREND</span></div>
                <div className="trend-top">
                  <div>
                    <strong>{latestWeight ? latestWeight.toFixed(1) : "—"}</strong>
                    <span> kg</span>
                    <p>{latestWeight ? "latest entry" : "no entry yet"}</p>
                  </div>
                  {weightChange !== null && (
                    <span className={weightChange <= 0 ? "down" : "up"}>
                      {weightChange <= 0 ? "↘" : "↗"} {Math.abs(weightChange).toFixed(1)} kg
                    </span>
                  )}
                </div>
                <div className="weight-sparkline">
                  {store.weights.slice(-7).map((entry) => (
                    <span key={entry.id} title={`${entry.value} kg`} style={{ height: `${Math.max(15, entry.value)}%` }} />
                  ))}
                </div>
                <button className="text-action" onClick={() => setWeightModal(true)}>
                  <Scale size={15} /> Log today’s weight
                </button>
              </article>
            </section>

            <section className="meal-list-card">
              <div className="meal-list-heading">
                <div>
                  <span>TODAY’S MEALS</span>
                  <h2>{today.meals.length ? `${today.meals.length} ${today.meals.length === 1 ? "entry" : "entries"}` : "Nothing logged yet"}</h2>
                </div>
                <button onClick={() => openMeal()}><Plus size={16} /> Add meal</button>
              </div>
              {today.meals.length ? (
                <div className="meal-rows">
                  {today.meals.map((meal) => (
                    <div className="meal-row" key={meal.id}>
                      <div className="meal-row-icon"><Utensils size={17} /></div>
                      <div>
                        <b>{meal.name}</b>
                        <span>{meal.protein}g protein · {meal.carbs}g carbs · {meal.fat}g fat</span>
                      </div>
                      <strong>{meal.calories} kcal</strong>
                      <button onClick={() => removeMeal(meal.id)} aria-label={`Delete ${meal.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-meals">
                  <Mic size={23} />
                  <p>Say “chicken salad, 520 calories, 40 grams protein” to fill the form faster.</p>
                  <button onClick={() => openMeal()}>Log the first meal</button>
                </div>
              )}
            </section>

            <section className="evening-card">
              <div className="evening-icon"><Flame size={21} /></div>
              <div className="evening-copy">
                <span>HOME ARRIVAL PLAN</span>
                <h2>{remaining > 0 ? "Your evening still has room." : "Keep the next choice light."}</h2>
                <p>
                  {remaining > 0
                    ? `You have about ${Math.round(remaining)} kcal left. Choose a protein-led meal and eat without rushing.`
                    : "You have reached today’s target. Pause, hydrate, and choose based on hunger rather than the number."}
                </p>
              </div>
              <button onClick={() => openMeal("Dinner")}><Plus size={18} /> Log dinner</button>
            </section>

            <section className="coach-row">
              <div className="coach-orb"><Sparkles size={24} /></div>
              <div>
                <span>YOUR COACH</span>
                <h3>“One honest entry is more useful than a perfect guess.”</h3>
                <p>Log what happened, adjust if needed, and use the next choice to move forward.</p>
              </div>
              <button onClick={() => setCraving(true)}>I’m craving sweets <ChevronRight size={17} /></button>
            </section>
          </>
        )}

        {active === "Progress" && (
          <section className="view-page">
            <div className="view-title">
              <div><p className="eyebrow">YOUR PROGRESS</p><h1>Patterns, not perfection.</h1><p className="subtitle">Your most recent saved days and weigh-ins.</p></div>
              <button className="primary-button" onClick={() => setWeightModal(true)}><Scale size={17} /> Add weight</button>
            </div>
            <div className="progress-grid">
              <article>
                <div className="card-label"><TrendingDown size={18} /><span>WEIGHT HISTORY</span></div>
                {store.weights.length ? (
                  <div className="history-list">
                    {store.weights.slice(-7).reverse().map((entry) => (
                      <div key={entry.id}><span>{formatDay(entry.date)}</span><strong>{entry.value.toFixed(1)} kg</strong></div>
                    ))}
                  </div>
                ) : <p className="empty-copy">Add your first weight to begin the trend.</p>}
              </article>
              <article>
                <div className="card-label"><Target size={18} /><span>DAILY HISTORY</span></div>
                {dayHistory.length ? (
                  <div className="history-list">
                    {dayHistory.map((day) => (
                      <div key={day.date}>
                        <span>{formatDay(day.date)} · {day.meals} meals · {day.water} water</span>
                        <strong>{Math.round(day.calories)} kcal</strong>
                      </div>
                    ))}
                  </div>
                ) : <p className="empty-copy">Your logged days will appear here.</p>}
              </article>
            </div>
          </section>
        )}

        {active === "Coach" && (
          <section className="view-page">
            <div className="view-title">
              <div><p className="eyebrow">FORMA COACH</p><h1>Pause before the next choice.</h1><p className="subtitle">Simple guidance based on today’s entries.</p></div>
            </div>
            <div className="coach-panel">
              <div className="coach-orb large"><Sparkles size={28} /></div>
              <h2>{today.meals.length ? `You have ${Math.round(remaining)} kcal available.` : "Start with one honest meal entry."}</h2>
              <p>
                {today.meals.length
                  ? `You have logged ${Math.round(totals.protein)}g protein and ${today.water} glasses of water. Check whether you are physically hungry before deciding what comes next.`
                  : "Once you log a meal, your daily budget and coach guidance will adapt to the real numbers."}
              </p>
              <div className="coach-actions">
                <button onClick={() => openMeal()}><Mic size={17} /> Log by voice</button>
                <button onClick={() => setCraving(true)}>Help with a craving</button>
              </div>
            </div>
          </section>
        )}
      </section>

      <nav className="mobile-nav">
        {[
          { n: "Today", i: Home },
          { n: "Add meal", i: Plus },
          { n: "Progress", i: TrendingDown },
          { n: "Coach", i: MessageCircle },
        ].map(({ n, i: Icon }) => (
          <button
            key={n}
            className={(n === active || (n === "Add meal" && mealModal)) ? "active" : ""}
            onClick={() => n === "Add meal" ? openMeal() : setActive(n)}
          >
            <Icon size={20} /><span>{n}</span>
          </button>
        ))}
      </nav>

      {mealModal && (
        <div className="modal-backdrop" onClick={() => setMealModal(false)}>
          <form className="modal form-modal" onSubmit={addMeal} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setMealModal(false)} aria-label="Close meal form"><X size={20} /></button>
            <span className="modal-icon"><Utensils size={21} /></span>
            <p>LOG A MEAL</p>
            <h2>What did you eat?</h2>
            <span>Speak or type, then check every number before saving.</span>
            <button type="button" className="voice-button" onClick={startVoiceEntry}>
              <Mic size={18} /> Speak meal details
            </button>
            {voiceStatus && <div className="form-note">{voiceStatus}</div>}
            <label>
              Meal description
              <textarea
                value={mealDraft.name}
                onChange={(event) => setMealDraft((draft) => ({ ...draft, name: event.target.value }))}
                placeholder="e.g. Chicken salad with avocado"
                required
              />
            </label>
            <div className="form-grid">
              <label>Calories<input inputMode="decimal" type="number" min="0" value={mealDraft.calories} onChange={(event) => setMealDraft((draft) => ({ ...draft, calories: event.target.value }))} required /></label>
              <label>Protein (g)<input inputMode="decimal" type="number" min="0" value={mealDraft.protein} onChange={(event) => setMealDraft((draft) => ({ ...draft, protein: event.target.value }))} /></label>
              <label>Carbs (g)<input inputMode="decimal" type="number" min="0" value={mealDraft.carbs} onChange={(event) => setMealDraft((draft) => ({ ...draft, carbs: event.target.value }))} /></label>
              <label>Fat (g)<input inputMode="decimal" type="number" min="0" value={mealDraft.fat} onChange={(event) => setMealDraft((draft) => ({ ...draft, fat: event.target.value }))} /></label>
            </div>
            <div className="form-warning">Nutrition estimates are guidance only. Check portions before saving.</div>
            <button className="submit-button" type="submit"><Check size={17} /> Save to today</button>
          </form>
        </div>
      )}

      {weightModal && (
        <div className="modal-backdrop" onClick={() => setWeightModal(false)}>
          <form className="modal small-modal" onSubmit={saveWeight} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setWeightModal(false)} aria-label="Close weight form"><X size={20} /></button>
            <span className="modal-icon"><Scale size={21} /></span>
            <p>WEIGHT CHECK-IN</p>
            <h2>Today’s weight</h2>
            <label>Weight in kilograms<input autoFocus inputMode="decimal" type="number" min="20" max="400" step="0.1" value={weightDraft} onChange={(event) => setWeightDraft(event.target.value)} required /></label>
            <button className="submit-button" type="submit"><Check size={17} /> Save weight</button>
          </form>
        </div>
      )}

      {goalsModal && (
        <div className="modal-backdrop" onClick={() => setGoalsModal(false)}>
          <form className="modal form-modal" onSubmit={saveGoals} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={() => setGoalsModal(false)} aria-label="Close goals form"><X size={20} /></button>
            <span className="modal-icon"><Target size={21} /></span>
            <p>YOUR TARGETS</p>
            <h2>Edit daily goals</h2>
            <span>Use targets supplied by a qualified professional when appropriate.</span>
            <div className="form-grid goals-grid">
              {([
                ["calories", "Calories"],
                ["protein", "Protein (g)"],
                ["carbs", "Carbs (g)"],
                ["fat", "Fat (g)"],
                ["water", "Water glasses"],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min="1"
                    value={goalDraft[key]}
                    onChange={(event) => setGoalDraft((draft) => ({ ...draft, [key]: Number(event.target.value) }))}
                    required
                  />
                </label>
              ))}
            </div>
            <button className="submit-button" type="submit"><Check size={17} /> Save goals</button>
          </form>
        </div>
      )}

      {installHelp && (
        <div className="modal-backdrop" onClick={() => setInstallHelp(false)}>
          <div className="modal small-modal" onClick={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setInstallHelp(false)} aria-label="Close install help"><X size={20} /></button>
            <span className="modal-icon"><Download size={21} /></span>
            <p>INSTALL FORMA</p>
            <h2>Add it to your phone</h2>
            <div className="install-steps">
              <p><b>iPhone:</b> open this page in Safari, tap Share, then Add to Home Screen.</p>
              <p><b>Android:</b> open it in Chrome, tap the menu, then Install app or Add to Home screen.</p>
            </div>
            <button className="submit-button" onClick={() => setInstallHelp(false)}>Got it</button>
          </div>
        </div>
      )}

      {craving && (
        <div className="modal-backdrop" onClick={() => setCraving(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <button className="close" onClick={() => setCraving(false)} aria-label="Close craving support"><X size={20} /></button>
            <span className="modal-icon">✦</span>
            <p>TAKE A GENTLE PAUSE</p>
            <h2>What are you feeling right now?</h2>
            <span>There’s no wrong answer. Naming it helps you choose.</span>
            <div className="modal-actions">
              <button onClick={() => setCraving(false)}>I’m physically hungry</button>
              <button onClick={() => setCraving(false)}>I simply want something sweet</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
