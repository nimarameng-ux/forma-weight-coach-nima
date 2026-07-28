"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type FoodAnalysis = {
  confidence: "low" | "medium" | "high";
  sourceType: "meal" | "package" | "nutrition_label" | "unknown";
  servingLabel: string;
  servingsInPackage: number;
  perServing: NutritionNumbers;
  wholePackage: NutritionNumbers;
  caloriesLow: number;
  caloriesHigh: number;
  assumptions: string[];
};

type NutritionNumbers = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
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

function resizeFoodPhoto(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We could not read that photo."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Please choose a clear food photo."));
      image.onload = () => {
        const maxSide = 1440;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("This browser could not prepare the photo."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

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

function draftFromNutrition(name: string, nutrition: NutritionNumbers): MealDraft {
  return {
    name,
    calories: String(Math.max(0, Math.round(nutrition.calories))),
    protein: String(Math.max(0, Math.round(nutrition.protein))),
    carbs: String(Math.max(0, Math.round(nutrition.carbs))),
    fat: String(Math.max(0, Math.round(nutrition.fat))),
  };
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [store, setStore] = useState<TrackerStore>(DEFAULT_STORE);
  const [ready, setReady] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
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
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoStatus, setPhotoStatus] = useState("");
  const [photoAnalysis, setPhotoAnalysis] = useState<FoodAnalysis | null>(null);
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false);
  const [mealEntryMode, setMealEntryMode] = useState<"photo" | "manual">("manual");
  const [portionChoice, setPortionChoice] = useState<"serving" | "half" | "whole">("serving");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setCurrentDate(new Date());
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

  const todayKey = currentDate ? localDateKey(currentDate) : "";
  const today = store.days[todayKey] ?? { water: 0, meals: [] };
  const yesterdayDate = currentDate ? new Date(currentDate) : null;
  yesterdayDate?.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = yesterdayDate ? localDateKey(yesterdayDate) : "";
  const yesterday = store.days[yesterdayKey] ?? { water: 0, meals: [] };

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
  const yesterdayCalories = yesterday.meals.reduce((sum, meal) => sum + meal.calories, 0);
  const proposedMealCalories = safeNumber(mealDraft.calories);
  const remainingAfterProposedMeal = store.goals.calories - totals.calories - proposedMealCalories;
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
    setPhotoPreview("");
    setPhotoStatus("");
    setPhotoAnalysis(null);
    setPortionChoice("serving");
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

  const closeMeal = () => {
    setMealModal(false);
    setMealDraft(EMPTY_MEAL);
    setVoiceStatus("");
    setPhotoPreview("");
    setPhotoStatus("");
    setPhotoAnalysis(null);
    setAnalyzingPhoto(false);
    setMealEntryMode("manual");
    setPortionChoice("serving");
  };

  const openPhotoPicker = () => {
    photoInputRef.current?.click();
  };

  const analyzeFoodPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setMealEntryMode("photo");
    setMealDraft(EMPTY_MEAL);
    setVoiceStatus("");
    setPhotoAnalysis(null);
    setPortionChoice("serving");
    setPhotoStatus("Preparing your photo…");
    setAnalyzingPhoto(true);
    setMealModal(true);

    try {
      const image = await resizeFoodPhoto(file);
      setPhotoPreview(image);
      setPhotoStatus("Estimating the meal and portion…");

      const response = await fetch("/api/analyze-food", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result?.code === "AI_SETUP_REQUIRED"
            ? "Photo analysis needs the AI connection to be activated."
            : result?.error || "We could not analyse that photo.",
        );
      }

      const analysis: FoodAnalysis = {
        confidence: result.confidence,
        sourceType: result.sourceType,
        servingLabel: result.servingLabel,
        servingsInPackage: result.servingsInPackage,
        perServing: {
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fat: result.fat,
        },
        wholePackage: {
          calories: result.packageCalories,
          protein: result.packageProtein,
          carbs: result.packageCarbs,
          fat: result.packageFat,
        },
        caloriesLow: result.caloriesLow,
        caloriesHigh: result.caloriesHigh,
        assumptions: result.assumptions,
      };
      setMealDraft(draftFromNutrition(result.name, analysis.perServing));
      setPhotoAnalysis(analysis);
      setPortionChoice("serving");
      setPhotoStatus("Estimate ready — check it, then save.");
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "We could not analyse that photo.");
    } finally {
      setAnalyzingPhoto(false);
    }
  };

  const choosePackagePortion = (choice: "serving" | "half" | "whole") => {
    if (!photoAnalysis) return;

    let nutrition = photoAnalysis.perServing;
    if (choice === "half") {
      nutrition = {
        calories: photoAnalysis.wholePackage.calories / 2,
        protein: photoAnalysis.wholePackage.protein / 2,
        carbs: photoAnalysis.wholePackage.carbs / 2,
        fat: photoAnalysis.wholePackage.fat / 2,
      };
    } else if (choice === "whole") {
      nutrition = photoAnalysis.wholePackage;
    }

    setPortionChoice(choice);
    setMealDraft((draft) => draftFromNutrition(draft.name, nutrition));
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
    setMealEntryMode("manual");
    setMealDraft({ ...EMPTY_MEAL, name: starter });
    setVoiceStatus("");
    setPhotoPreview("");
    setPhotoStatus("");
    setPhotoAnalysis(null);
    setPortionChoice("serving");
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

  if (!ready || !currentDate) {
    return (
      <main className="app-loading" aria-label="Loading Forma">
        <span className="brand-mark"><Sparkles size={18} /></span>
        <strong>forma</strong>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <input
        ref={photoInputRef}
        className="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={analyzeFoodPhoto}
        aria-label="Take or choose a food photo"
      />
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
          <span>Meals stay on this device · photos are not saved in your history</span>
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
                  }).format(currentDate).toUpperCase()}
                </p>
                <h1>Good afternoon, Nima.</h1>
                <p className="subtitle">Snap your meal. Check the estimate. Done.</p>
              </div>
              <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
            </header>

            <section className="hero-card">
              <div className="hero-action">
                <div className="meal-icon"><ScanLine size={32} /><Camera size={25} /></div>
                <div>
                  <span className="quick-label">FAST FOOD LOG</span>
                  <h2>Take a photo of food or the package</h2>
                  <p>Forma reads a meal, biscuit box or nutrition label, then works out the likely calories.</p>
                </div>
                <div className="hero-buttons">
                  <button className="camera-button" onClick={openPhotoPicker}>
                    <Camera size={20} /> Scan food or package
                  </button>
                  <button className="secondary-hero-button" onClick={() => openMeal()}>
                    <Mic size={18} /> Use voice instead
                  </button>
                </div>
                <small>Estimates are approximate. Hidden oils and exact portion weight may change the result.</small>
              </div>
              <div className="hero-copy">
                <span className="status-pill"><span /> {totals.calories <= store.goals.calories ? "ON TRACK" : "OVER TARGET"}</span>
                <p>Your remaining budget</p>
                <div className="calories"><strong>{Math.round(remaining)}</strong><span>kcal</span></div>
                <p className="after">after {Math.round(totals.calories).toLocaleString()} kcal logged</p>
                <div className="budget-bar"><span style={{ width: `${calorieProgress}%` }} /></div>
                <div className="bar-labels"><span>0</span><span>Daily target · {store.goals.calories.toLocaleString()}</span></div>
              </div>
            </section>

            <section className="day-review-card">
              <div className="day-review-heading">
                <div>
                  <span>DAY-BY-DAY CHECK</span>
                  <h2>Yesterday and today</h2>
                </div>
                <TrendingDown size={20} />
              </div>
              <div className="day-review-numbers">
                <div>
                  <span>YESTERDAY</span>
                  <strong>{Math.round(yesterdayCalories)}</strong>
                  <small>kcal · {yesterday.meals.length} {yesterday.meals.length === 1 ? "meal" : "meals"}</small>
                </div>
                <div className="day-review-divider">→</div>
                <div className="today-number">
                  <span>TODAY SO FAR</span>
                  <strong>{Math.round(totals.calories)}</strong>
                  <small>kcal · {today.meals.length} {today.meals.length === 1 ? "meal" : "meals"}</small>
                </div>
              </div>
              <p>
                {yesterday.meals.length
                  ? `Yesterday you logged ${Math.round(yesterdayCalories)} kcal. Today you have logged ${Math.round(totals.calories)} kcal and have about ${Math.round(remaining)} kcal remaining.`
                  : `There is no food record for yesterday yet. Today you have logged ${Math.round(totals.calories)} kcal and have about ${Math.round(remaining)} kcal remaining.`}
              </p>
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
                <button onClick={openPhotoPicker}><Camera size={16} /> Scan food</button>
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
                  <Camera size={25} />
                  <p>Photograph the food, package, or nutrition label. Confirm once and it is logged.</p>
                  <button onClick={openPhotoPicker}>Scan your first food</button>
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
              <button onClick={openPhotoPicker}><Camera size={18} /> Snap dinner</button>
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
                <button onClick={openPhotoPicker}><Camera size={17} /> Log by photo</button>
                <button onClick={() => setCraving(true)}>Help with a craving</button>
              </div>
            </div>
          </section>
        )}
      </section>

      <nav className="mobile-nav">
        {[
          { n: "Today", i: Home },
          { n: "Scan food", i: Camera },
          { n: "Progress", i: TrendingDown },
          { n: "Coach", i: MessageCircle },
        ].map(({ n, i: Icon }) => (
          <button
            key={n}
            className={(n === active || (n === "Scan food" && mealModal)) ? "active" : ""}
            onClick={() => n === "Scan food" ? openPhotoPicker() : setActive(n)}
          >
            <Icon size={20} /><span>{n}</span>
          </button>
        ))}
      </nav>

      {mealModal && (
        <div className="modal-backdrop" onClick={closeMeal}>
          <form className="modal form-modal meal-capture-modal" onSubmit={addMeal} onClick={(event) => event.stopPropagation()}>
            <button type="button" className="close" onClick={closeMeal} aria-label="Close meal form"><X size={20} /></button>
            <span className="modal-icon">{mealEntryMode === "photo" ? <Camera size={21} /> : <Utensils size={21} />}</span>
            <p>{mealEntryMode === "photo" ? "PHOTO FOOD LOG" : "QUICK MANUAL LOG"}</p>
            <h2>{mealEntryMode === "photo" ? "Check the estimate" : "Tell Forma what you ate"}</h2>
            <span>
              {mealEntryMode === "photo"
                ? "One confirmation saves the meal."
                : "Use voice for the fastest manual entry."}
            </span>

            {mealEntryMode === "photo" && (
              <>
                {photoPreview ? (
                  <div className="food-photo-preview">
                    {/* The selected photo is intentionally not written to meal history. */}
                    <img src={photoPreview} alt="Selected meal" />
                    {analyzingPhoto && <div className="photo-scanning"><ScanLine size={27} /><span>Analysing…</span></div>}
                  </div>
                ) : (
                  <div className="food-photo-placeholder"><Camera size={28} /></div>
                )}

                {photoStatus && (
                  <div className={`photo-status ${analyzingPhoto ? "working" : ""}`}>
                    {analyzingPhoto && <span className="status-spinner" />}
                    {photoStatus}
                  </div>
                )}

                {photoAnalysis && (
                  <div className="estimate-card">
                    <div className="estimate-heading">
                      <div>
                        <span>
                          {photoAnalysis.sourceType === "package" || photoAnalysis.sourceType === "nutrition_label"
                            ? "PACKAGED FOOD"
                            : "FORMA ESTIMATE"}
                        </span>
                        <h3>{mealDraft.name}</h3>
                      </div>
                      <span className={`confidence ${photoAnalysis.confidence}`}>
                        {photoAnalysis.confidence} confidence
                      </span>
                    </div>
                    <div className="estimate-calories">
                      <strong>{mealDraft.calories}</strong>
                      <span>kcal</span>
                      <small>
                        {portionChoice === "serving"
                          ? `likely ${photoAnalysis.caloriesLow}–${photoAnalysis.caloriesHigh}`
                          : "selected amount"}
                      </small>
                    </div>
                    <div className="estimate-macros">
                      <span><b>{mealDraft.protein}g</b> protein</span>
                      <span><b>{mealDraft.carbs}g</b> carbs</span>
                      <span><b>{mealDraft.fat}g</b> fat</span>
                    </div>
                    <div className="serving-line">
                      <span>{portionChoice === "serving" ? photoAnalysis.servingLabel : portionChoice === "half" ? "Half the package" : "Whole package"}</span>
                      {(photoAnalysis.sourceType === "package" || photoAnalysis.sourceType === "nutrition_label") && (
                        <small>{photoAnalysis.servingsInPackage.toFixed(photoAnalysis.servingsInPackage % 1 ? 1 : 0)} servings in pack</small>
                      )}
                    </div>
                    {photoAnalysis.assumptions.length > 0 && (
                      <p>{photoAnalysis.assumptions.slice(0, 2).join(" · ")}</p>
                    )}
                  </div>
                )}

                {photoAnalysis &&
                  (photoAnalysis.sourceType === "package" || photoAnalysis.sourceType === "nutrition_label") &&
                  photoAnalysis.servingsInPackage > 1 && (
                    <div className="portion-selector">
                      <span>How much are you thinking of eating?</span>
                      <div>
                        <button
                          type="button"
                          className={portionChoice === "serving" ? "active" : ""}
                          onClick={() => choosePackagePortion("serving")}
                        >
                          One serving
                        </button>
                        <button
                          type="button"
                          className={portionChoice === "half" ? "active" : ""}
                          onClick={() => choosePackagePortion("half")}
                        >
                          Half pack
                        </button>
                        <button
                          type="button"
                          className={portionChoice === "whole" ? "active" : ""}
                          onClick={() => choosePackagePortion("whole")}
                        >
                          Whole pack
                        </button>
                      </div>
                    </div>
                  )}

                {photoAnalysis && (
                  <div className={`meal-impact ${remainingAfterProposedMeal < 0 ? "over" : ""}`}>
                    {remainingAfterProposedMeal >= 0
                      ? `If you eat this, you will have about ${Math.round(remainingAfterProposedMeal)} kcal remaining today.`
                      : `This amount is about ${Math.round(Math.abs(remainingAfterProposedMeal))} kcal over today’s target. You can still save it honestly.`}
                  </div>
                )}

                {!analyzingPhoto && !photoAnalysis && (
                  <div className="photo-retry">
                    <button type="button" onClick={openPhotoPicker}><Camera size={17} /> Try another photo</button>
                    <button type="button" onClick={() => openMeal()}><Mic size={17} /> Use voice instead</button>
                  </div>
                )}
              </>
            )}

            {mealEntryMode === "manual" && (
              <>
                <button type="button" className="voice-button" onClick={startVoiceEntry}>
                  <Mic size={18} /> Speak meal details
                </button>
                {voiceStatus && <div className="form-note">{voiceStatus}</div>}
              </>
            )}

            {(mealEntryMode === "manual" || photoAnalysis) && (
              <details className="correction-fields" open={mealEntryMode === "manual"}>
                <summary>{mealEntryMode === "photo" ? "Adjust the estimate" : "Meal details"}</summary>
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
              </details>
            )}

            <div className="form-warning">
              Food-photo calories are estimates, not medical measurements. Sauces, oils and portion size can change the total.
            </div>
            <button
              className="submit-button"
              type="submit"
              disabled={analyzingPhoto || !mealDraft.name.trim() || !mealDraft.calories}
            >
              <Check size={17} /> {mealEntryMode === "photo" ? "Looks right — save meal" : "Save to today"}
            </button>
            {mealEntryMode === "photo" && photoAnalysis && (
              <button className="take-another-button" type="button" onClick={openPhotoPicker}>
                Retake photo
              </button>
            )}
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
