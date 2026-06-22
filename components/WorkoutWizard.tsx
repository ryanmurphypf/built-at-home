"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOVEMENT_PATTERNS, EQUIPMENT_OPTIONS, filterVariations, type EquipmentLevel, type Variation } from "@/lib/exercises";
import { createClient } from "@/lib/supabase/client";

interface SelectedExercise {
  block: string;
  exerciseName: string;
  variation: Variation;
  rounds: number;
  restSeconds: number;
}

type Step = "equipment" | "select" | "config" | "saving";

const DEFAULT_ROUNDS: Record<string, number> = { Pull: 3, Push: 3, Legs: 3, Core: 1 };
const DEFAULT_REST: Record<string, number> = { Pull: 90, Push: 90, Legs: 90, Core: 60 };
const REST_OPTIONS = Array.from({ length: 13 }, (_, i) => 60 + i * 15);

const BLOCK_LABELS: Record<string, string> = { Pull: "Pull", Push: "Push", Legs: "Legs", Core: "Core*" };

export default function WorkoutWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("equipment");
  const [equipment, setEquipment] = useState<EquipmentLevel[]>([1]);
  const [activeBlock, setActiveBlock] = useState("Pull");
  const [pickingVariations, setPickingVariations] = useState<string | null>(null); // exercise name
  const [selections, setSelections] = useState<SelectedExercise[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  function toggleEquipment(level: EquipmentLevel) {
    if (level === 1) return;
    setEquipment((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  function skipExercise(exerciseName: string) {
    setSkipped((prev) => new Set([...prev, exerciseName]));
    setSelections((prev) => prev.filter((s) => s.exerciseName !== exerciseName));
  }

  function unskipExercise(exerciseName: string) {
    setSkipped((prev) => { const n = new Set(prev); n.delete(exerciseName); return n; });
  }

  function selectVariation(block: string, exerciseName: string, variation: Variation) {
    setSelections((prev) => {
      const without = prev.filter((s) => !(s.block === block && s.exerciseName === exerciseName));
      return [...without, { block, exerciseName, variation, rounds: DEFAULT_ROUNDS[block] ?? 3, restSeconds: DEFAULT_REST[block] ?? 90 }];
    });
    setSkipped((prev) => { const n = new Set(prev); n.delete(exerciseName); return n; });
    setPickingVariations(null);
  }

  function removeSelection(block: string, exerciseName: string) {
    setSelections((prev) => prev.filter((s) => !(s.block === block && s.exerciseName === exerciseName)));
  }

  function updateRounds(idx: number, rounds: number) {
    setSelections((prev) => prev.map((s, i) => i === idx ? { ...s, rounds } : s));
  }

  function updateRest(idx: number, restSeconds: number) {
    setSelections((prev) => prev.map((s, i) => i === idx ? { ...s, restSeconds } : s));
  }

  function getBlockStatus(blockName: string) {
    const count = selections.filter((s) => s.block === blockName).length;
    return count;
  }

  async function saveWorkout() {
    setStep("saving");
    const supabase = createClient();
    const { data: workout, error: wErr } = await supabase.from("workouts").insert({ user_id: userId }).select("id").single();
    if (wErr || !workout) { alert("Failed to save: " + wErr?.message); setStep("config"); return; }

    const exercises = selections.map((s, i) => ({
      workout_id: workout.id,
      position: i,
      block: s.block,
      movement_pattern: s.block,
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
    const activePattern = MOVEMENT_PATTERNS.find((p) => p.name === activeBlock)!;

    return (
      <WizardShell>
        <StepHeader title="Select Exercises" subtitle="Choose one or more per movement" />

        {/* Block tabs - 2x2 grid */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {MOVEMENT_PATTERNS.map((p) => {
            const count = getBlockStatus(p.name);
            const isActive = activeBlock === p.name;
            return (
              <button key={p.name} onClick={() => { setActiveBlock(p.name); setPickingVariations(null); }}
                className="px-3 py-3 rounded-xl text-sm font-semibold cursor-pointer text-left"
                style={{
                  background: isActive ? "var(--accent)" : count > 0 ? "rgba(34,197,94,0.1)" : "var(--surface)",
                  border: `1px solid ${isActive ? "var(--accent)" : count > 0 ? "var(--accent)" : "var(--border)"}`,
                  color: isActive ? "#000" : "var(--text)",
                }}>
                <div className="flex items-center justify-between">
                  <span>{BLOCK_LABELS[p.name]}</span>
                  {count > 0 && !isActive && <span className="text-xs" style={{ color: "var(--accent)" }}>✓ {count}</span>}
                </div>
                <div className="text-xs mt-0.5 font-normal" style={{ color: isActive ? "rgba(0,0,0,0.6)" : "var(--text-muted)" }}>
                  {p.exercises.map((e) => e.slot).join(" / ")}
                </div>
              </button>
            );
          })}
        </div>

        {/* Exercise picker for active block */}
        {!pickingVariations ? (
          <div>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>SELECT AN EXERCISE:</p>
            <div className="flex flex-col gap-2 mb-4">
              {activePattern.exercises.map((ex) => {
                const available = filterVariations(ex.variations, equipment);
                const sel = selections.find((s) => s.block === activeBlock && s.exerciseName === ex.name);
                const isSkipped = skipped.has(ex.name);

                return (
                  <div key={ex.name} className="flex gap-2">
                    <button
                      onClick={() => { if (!isSkipped) setPickingVariations(ex.name); }}
                      disabled={isSkipped}
                      className="flex-1 px-4 py-3 rounded-lg text-sm text-left cursor-pointer disabled:opacity-40"
                      style={{
                        background: sel ? "rgba(34,197,94,0.1)" : "var(--surface)",
                        border: `1px solid ${sel ? "var(--accent)" : "var(--border)"}`,
                      }}>
                      <span className="font-medium">{ex.name}</span>
                      <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>({ex.slot})</span>
                      {sel && <span className="ml-2 text-xs" style={{ color: "var(--accent)" }}>→ {sel.variation.name}</span>}
                      {available.length === 0 && !isSkipped && <span className="ml-2 text-xs text-red-400">No equipment</span>}
                    </button>
                    {isSkipped ? (
                      <button onClick={() => unskipExercise(ex.name)}
                        className="px-3 rounded-lg text-xs cursor-pointer"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        Undo
                      </button>
                    ) : (
                      <button onClick={() => { skipExercise(ex.name); }}
                        className="px-3 rounded-lg text-xs cursor-pointer"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                        Skip
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Variation picker */
          <div>
            <button onClick={() => setPickingVariations(null)} className="text-sm mb-4 cursor-pointer" style={{ color: "var(--text-muted)" }}>
              ← {activeBlock}
            </button>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
              {pickingVariations.toUpperCase()} — SELECT VARIATION:
            </p>
            <div className="flex flex-col gap-2 mb-4">
              {filterVariations(
                activePattern.exercises.find((e) => e.name === pickingVariations)?.variations ?? [],
                equipment
              ).sort((a, b) => a.progression - b.progression).map((v) => (
                <button key={v.name}
                  onClick={() => selectVariation(activeBlock, pickingVariations, v)}
                  className="px-4 py-3 rounded-lg text-sm text-left flex items-center justify-between cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <span>{v.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>L{v.progression}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selections summary */}
        {selections.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>WORKOUT SUMMARY:</p>
            <div className="flex flex-col gap-1">
              {selections.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <span><span className="font-semibold" style={{ color: "var(--accent)" }}>{s.block}</span> · {s.exerciseName} · {s.variation.name} (L{s.variation.progression})</span>
                  <button onClick={() => removeSelection(s.block, s.exerciseName)} className="ml-2 cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selections.length > 0 && (
          <button onClick={() => setStep("config")}
            className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: "var(--accent)", color: "#000" }}>
            Configure Workout →
          </button>
        )}
      </WizardShell>
    );
  }

  // ---- Config step ----
  if (step === "config") {
    return (
      <WizardShell>
        <StepHeader title="Configure" subtitle="Sets & rest time per exercise" />
        <div className="flex flex-col gap-4 mb-8">
          {selections.map((s, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>{s.block.toUpperCase()}</p>
              <p className="text-sm font-medium mb-3">{s.variation.name}</p>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Sets</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateRounds(i, Math.max(1, s.rounds - 1))}
                      className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>−</button>
                    <span className="text-sm w-4 text-center">{s.rounds}</span>
                    <button onClick={() => updateRounds(i, Math.min(10, s.rounds + 1))}
                      className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>+</button>
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Rest</label>
                  <select value={s.restSeconds} onChange={(e) => updateRest(i, Number(e.target.value))}
                    className="text-sm px-2 py-1 rounded cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                    {REST_OPTIONS.map((sec) => {
                      const m = Math.floor(sec / 60); const ss = sec % 60;
                      return <option key={sec} value={sec}>{m}:{ss.toString().padStart(2, "0")}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => setStep("select")}
            className="px-4 py-3 rounded-lg text-sm cursor-pointer"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            ← Back
          </button>
          <button onClick={saveWorkout}
            className="flex-1 py-3 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: "var(--accent)", color: "#000" }}>
            Start Workout →
          </button>
        </div>
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
  return <div className="flex flex-col min-h-dvh px-4 py-8 max-w-lg mx-auto w-full">{children}</div>;
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
    </div>
  );
}
