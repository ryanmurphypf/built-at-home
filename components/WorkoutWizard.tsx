"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOVEMENT_PATTERNS, EQUIPMENT_OPTIONS, filterVariations, type EquipmentLevel, type Variation } from "@/lib/exercises";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

interface SelectedExercise {
  block: string;           // original block slot (Pull, Push, Legs, Core)
  displayBlock: string;    // what movement pattern was actually chosen (may differ if swapped)
  exerciseName: string;
  variation: Variation;
  rounds: number;
  restSeconds: number;
}

type Step = "equipment" | "select" | "config" | "saving";

// Order blocks are presented in
const BLOCK_ORDER = ["Pull", "Push", "Legs", "Core"];
const SLOT_NUMBERS: Record<string, string> = { Pull: "1", Push: "2", Legs: "3", Core: "4" };

function slotLabel(slot: string, swapTargets: Record<string, string>): string {
  const num = SLOT_NUMBERS[slot];
  const pattern = swapTargets[slot] ?? slot;
  const name = pattern === "Core" ? "Core (optional)" : pattern;
  const dupes = BLOCK_ORDER.filter((s) => (swapTargets[s] ?? s) === pattern);
  if (dupes.length > 1) {
    return `${num}) ${name} #${dupes.indexOf(slot) + 1}`;
  }
  return `${num}) ${name}`;
}

const DEFAULT_ROUNDS: Record<string, number> = { Pull: 3, Push: 3, Legs: 3, Core: 1 };
const DEFAULT_REST: Record<string, number> = { Pull: 90, Push: 90, Legs: 90, Core: 60 };
const REST_OPTIONS = Array.from({ length: 13 }, (_, i) => 60 + i * 15);

// Labels shown in the exercise list per block (or swapped pattern)
const EXERCISE_LIST: Record<string, { name: string; sub?: string }[]> = {
  Pull: [
    { name: "Pull-ups" },
    { name: "Rows", sub: "If unable to do 3 or more pull-ups" },
  ],
  Push: [
    { name: "Push-ups (Horizontal)" },
    { name: "Push-ups (Vertical)" },
  ],
  Legs: [
    { name: "Squats" },
    { name: "Hinges" },
    { name: "Plyo" },
  ],
  Core: [
    { name: "Static" },
    { name: "Dynamic" },
  ],
};

const SKIP_SUBS: Record<string, string | undefined> = {
  Pull: "if prevented by injury or limited by equipment",
  Push: "if prevented by injury",
  Legs: "if prevented by injury",
  Core: undefined,
};

export default function WorkoutWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("equipment");
  const [equipment, setEquipment] = useState<EquipmentLevel[]>([1]);

  // activeBlock = which slot we're currently filling (Pull/Push/Legs/Core)
  const [activeBlock, setActiveBlock] = useState("Pull");
  // swapping = which slot is being swapped (showing replacement patterns)
  const [swapping, setSwapping] = useState<string | null>(null);
  // swapTarget = for a given slot, which pattern was chosen as replacement
  const [swapTargets, setSwapTargets] = useState<Record<string, string>>({});
  // pickingExercise = exercise name currently showing variations
  const [pickingExercise, setPickingExercise] = useState<string | null>(null);
  // skipped slots
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  // selections keyed by block slot
  const [selections, setSelections] = useState<Record<string, SelectedExercise>>({});

  function toggleEquipment(level: EquipmentLevel) {
    if (level === 1) return;
    setEquipment((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  // Which pattern is actually used for a given slot
  function patternForSlot(slot: string): string {
    return swapTargets[slot] ?? slot;
  }

  function advanceBlock(currentSlot: string) {
    setPickingExercise(null);
    setSwapping(null);
    const idx = BLOCK_ORDER.indexOf(currentSlot);
    const next = BLOCK_ORDER[idx + 1];
    if (next) {
      setActiveBlock(next);
    } else {
      setStep("config");
    }
  }

  function selectVariation(slot: string, exerciseName: string, variation: Variation) {
    const pattern = patternForSlot(slot);
    setSelections((prev) => ({
      ...prev,
      [slot]: {
        block: slot,
        displayBlock: pattern,
        exerciseName,
        variation,
        rounds: DEFAULT_ROUNDS[slot] ?? 3,
        restSeconds: DEFAULT_REST[slot] ?? 90,
      },
    }));
    setSkipped((prev) => { const n = new Set(prev); n.delete(slot); return n; });
    advanceBlock(slot);
  }

  function skipSlot(slot: string) {
    setSkipped((prev) => new Set([...prev, slot]));
    setSelections((prev) => { const n = { ...prev }; delete n[slot]; return n; });
    advanceBlock(slot);
  }

  function chooseSwapPattern(slot: string, pattern: string) {
    setSwapTargets((prev) => ({ ...prev, [slot]: pattern }));
    setSwapping(null);
    setPickingExercise(null);
    // stay on same slot, now showing the swapped pattern's exercises
  }

  function updateRounds(slot: string, rounds: number) {
    setSelections((prev) => prev[slot] ? { ...prev, [slot]: { ...prev[slot], rounds } } : prev);
  }

  function updateRest(slot: string, restSeconds: number) {
    setSelections((prev) => prev[slot] ? { ...prev, [slot]: { ...prev[slot], restSeconds } } : prev);
  }

  function editSlot(slot: string) {
    setActiveBlock(slot);
    setPickingExercise(null);
    setSwapping(null);
    setStep("select");
  }

  async function saveWorkout() {
    setStep("saving");
    const supabase = createClient();
    const { data: workout, error: wErr } = await supabase.from("workouts").insert({ user_id: userId }).select("id").single();
    if (wErr || !workout) { alert("Failed to save: " + wErr?.message); setStep("config"); return; }

    const orderedSelections = BLOCK_ORDER.flatMap((slot) => selections[slot] ? [selections[slot]] : []);
    const exercises = orderedSelections.map((s, i) => ({
      workout_id: workout.id,
      position: i,
      block: s.displayBlock,
      movement_pattern: s.displayBlock,
      exercise_name: s.exerciseName,
      variation_name: s.variation.name,
      equipment_level: s.variation.equipmentRequired,
      rounds: s.rounds,
      rest_seconds: s.restSeconds,
    }));

    const { error: eErr } = await supabase.from("workout_exercises").insert(exercises);
    if (eErr) { alert("Failed to save exercises: " + eErr.message); setStep("config"); return; }
    router.push(`/workout/${workout.id}`);
  }

  // ---- Equipment step ----
  if (step === "equipment") {
    return (
      <WizardShell>
        <StepHeader title="Equipment Available" subtitle="Select all that apply" />
        <div className="flex flex-col gap-3 mb-8">
          {EQUIPMENT_OPTIONS.map((opt) => {
            const selected = equipment.includes(opt.level);
            return (
              <button key={opt.level} onClick={() => toggleEquipment(opt.level)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm cursor-pointer"
                style={{ background: selected ? "rgba(34,197,94,0.1)" : "var(--surface)", border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}` }}>
                <span className="w-5 h-5 rounded flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: selected ? "var(--accent)" : "var(--surface-2)", color: selected ? "#000" : "var(--text-muted)" }}>
                  {selected ? "✓" : ""}
                </span>
                {opt.label}
                {opt.level === 1 && <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>Always</span>}
              </button>
            );
          })}
        </div>
        <button onClick={() => setStep("select")}
          className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: "var(--accent)", color: "#000" }}>
          Continue →
        </button>
      </WizardShell>
    );
  }

  // ---- Select step ----
  if (step === "select") {
    const currentPattern = patternForSlot(activeBlock);
    const patternData = MOVEMENT_PATTERNS.find((p) => p.name === currentPattern)!;

    // Swap screen: pick a replacement pattern
    if (swapping) {
      const otherPatterns = BLOCK_ORDER.filter((b) => b !== swapping);
      return (
        <WizardShell>
          <button onClick={() => setSwapping(null)} className="text-sm mb-4 cursor-pointer" style={{ color: "var(--text-muted)" }}>← Back</button>
          <StepHeader title="Swap Movement" subtitle="Select a replacement" />
          <div className="flex flex-col gap-2">
            {otherPatterns.map((p) => (
              <button key={p} onClick={() => chooseSwapPattern(swapping, p)}
                className="px-4 py-4 rounded-lg text-sm font-medium text-left cursor-pointer"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                {p === "Core" ? "Core (Optional)" : p}
              </button>
            ))}
          </div>
        </WizardShell>
      );
    }

    // Variation picker
    if (pickingExercise) {
      const ex = patternData.exercises.find((e) => e.name === pickingExercise)!;
      const available = filterVariations(ex.variations, equipment).sort((a, b) => a.progression - b.progression);
      return (
        <WizardShell>
          <button onClick={() => setPickingExercise(null)} className="text-sm mb-4 cursor-pointer" style={{ color: "var(--text-muted)" }}>← Back</button>
          <StepHeader title={pickingExercise} subtitle="Select a variation" />
          <div className="flex flex-col gap-2">
            {available.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No variations available with current equipment.</p>
            ) : (
              available.map((v) => (
                <button key={v.name} onClick={() => selectVariation(activeBlock, pickingExercise, v)}
                  className="px-4 py-3 rounded-lg text-sm text-left flex items-center justify-between cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span>{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full ml-3 flex-shrink-0"
                    style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    Level {v.progression}
                  </span>
                </button>
              ))
            )}
          </div>
        </WizardShell>
      );
    }

    // Exercise list
    const exercises = EXERCISE_LIST[currentPattern] ?? [];
    const skipSub = SKIP_SUBS[activeBlock];
    const isSwapped = !!swapTargets[activeBlock];

    return (
      <WizardShell>
        {/* Block tabs - stacked */}
        <div className="flex flex-col gap-2 mb-6">
          {BLOCK_ORDER.map((slot) => {
            const isActive = slot === activeBlock;
            const sel = selections[slot];
            const isSkip = skipped.has(slot);
            return (
              <button key={slot} onClick={() => { setActiveBlock(slot); setPickingExercise(null); setSwapping(null); }}
                className="px-4 py-3 rounded-lg text-sm font-semibold text-left cursor-pointer"
                style={{
                  background: isActive ? "var(--accent)" : sel || isSkip ? "rgba(34,197,94,0.1)" : "var(--surface)",
                  border: `1px solid ${isActive ? "var(--accent)" : sel || isSkip ? "var(--accent)" : "var(--border)"}`,
                  color: isActive ? "#000" : "var(--text)",
                }}>
                <div className="flex items-center justify-between">
                  <span>{slotLabel(slot, swapTargets)}</span>
                  {sel && !isActive && <span className="text-xs font-normal" style={{ color: "var(--accent)" }}>✓ {sel.variation.name}</span>}
                  {isSkip && !isActive && <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>Skipped</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Exercise options */}
        <div className="mb-2">
          <p className="text-sm font-semibold mb-3">Select an exercise:</p>
          {isSwapped && (
            <p className="text-xs mb-3" style={{ color: "var(--accent)" }}>
              Swapped → {currentPattern === "Core" ? "Core (Optional)" : currentPattern}
            </p>
          )}
          <div className="flex flex-col gap-2">
            {exercises.map((ex) => (
              <button key={ex.name} onClick={() => setPickingExercise(ex.name)}
                className="px-4 py-3 rounded-lg text-sm text-left cursor-pointer"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span className="font-medium">{ex.name}</span>
                {ex.sub && <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>({ex.sub})</span>}
              </button>
            ))}

            {/* Skip */}
            <button onClick={() => skipSlot(activeBlock)}
              className="px-4 py-3 rounded-lg text-sm text-left cursor-pointer"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <span className="font-medium">Skip</span>
              {skipSub && <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>({skipSub})</span>}
            </button>

            {/* Swap */}
            <button onClick={() => setSwapping(activeBlock)}
              className="px-4 py-3 rounded-lg text-sm text-left cursor-pointer"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <span className="font-medium">Swap</span>
              <span className="block text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>(for different movement)</span>
            </button>
          </div>
        </div>
      </WizardShell>
    );
  }

  // ---- Config step ----
  if (step === "config") {
    const orderedSelections = BLOCK_ORDER.flatMap((slot) => selections[slot] ? [{ slot, s: selections[slot] }] : []);

    return (
      <WizardShell>
        <StepHeader title="Your Workout" subtitle="Adjust sets & rest, or change any movement" />
        <div className="flex flex-col gap-4 mb-8">
          {BLOCK_ORDER.map((slot) => {
            const sel = selections[slot];
            const isSkipped = skipped.has(slot);
            return (
              <div key={slot} className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>
                      {slotLabel(slot, swapTargets).toUpperCase()}
                    </p>
                    <p className="text-sm font-medium">
                      {sel ? sel.variation.name : isSkipped ? "Skipped" : "—"}
                    </p>
                    {sel && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sel.exerciseName}</p>}
                  </div>
                  <button onClick={() => editSlot(slot)}
                    className="ml-3 text-xs px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    Change
                  </button>
                </div>

                {sel && (
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Sets</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateRounds(slot, Math.max(1, sel.rounds - 1))}
                          className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>−</button>
                        <span className="text-sm w-4 text-center">{sel.rounds}</span>
                        <button onClick={() => updateRounds(slot, Math.min(10, sel.rounds + 1))}
                          className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>+</button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Rest</label>
                      <select value={sel.restSeconds} onChange={(e) => updateRest(slot, Number(e.target.value))}
                        className="text-sm px-2 py-1 rounded cursor-pointer"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                        {REST_OPTIONS.map((sec) => {
                          const m = Math.floor(sec / 60); const ss = sec % 60;
                          return <option key={sec} value={sec}>{m}:{ss.toString().padStart(2, "0")}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {orderedSelections.length > 0 && (
          <button onClick={saveWorkout}
            className="w-full py-4 rounded-xl text-sm font-bold cursor-pointer"
            style={{ background: "var(--accent)", color: "#000" }}>
            Create Workout →
          </button>
        )}
      </WizardShell>
    );
  }

  return (
    <WizardShell>
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Setting up your workout...</p>
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh px-4 py-8 max-w-lg mx-auto w-full">
      <div className="mb-6"><Logo height={36} /></div>
      {children}
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
    </div>
  );
}
