"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOVEMENT_PATTERNS, EQUIPMENT_OPTIONS, filterVariations, type EquipmentLevel, type Variation } from "@/lib/exercises";
import { createClient } from "@/lib/supabase/client";

interface SelectedExercise {
  block: string;
  movementPattern: string;
  exerciseName: string;
  variation: Variation;
  rounds: number;
  restSeconds: number;
}

type Step =
  | { id: "equipment" }
  | { id: "pull" }
  | { id: "push" }
  | { id: "legs" }
  | { id: "core-gate" }
  | { id: "core" }
  | { id: "config" }
  | { id: "saving" };

const DEFAULT_ROUNDS: Record<string, number> = {
  Pull: 3, Push: 3, Legs: 3, Core: 1,
};
const DEFAULT_REST: Record<string, number> = {
  Pull: 90, Push: 90, Legs: 90, Core: 60, // 1:30 and 1:00
};

export default function WorkoutWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ id: "equipment" });
  const [equipment, setEquipment] = useState<EquipmentLevel[]>([1]);
  const [includeCore, setIncludeCore] = useState(true);

  // selections: block -> list of SelectedExercise
  const [selections, setSelections] = useState<SelectedExercise[]>([]);

  // sub-state for multi-step exercise picking
  const [pickingBlock, setPickingBlock] = useState<string | null>(null);
  const [pickingExercise, setPickingExercise] = useState<string | null>(null);

  function toggleEquipment(level: EquipmentLevel) {
    if (level === 1) return; // always included
    setEquipment((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  function getPattern(name: string) {
    return MOVEMENT_PATTERNS.find((p) => p.name === name)!;
  }

  function addExercise(block: string, movementPattern: string, exerciseName: string, variation: Variation) {
    setSelections((prev) => [
      ...prev,
      {
        block,
        movementPattern,
        exerciseName,
        variation,
        rounds: DEFAULT_ROUNDS[block] ?? 3,
        restSeconds: DEFAULT_REST[block] ?? 90,
      },
    ]);
    setPickingBlock(null);
    setPickingExercise(null);
  }

  function removeExercise(index: number) {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRounds(index: number, rounds: number) {
    setSelections((prev) => prev.map((s, i) => i === index ? { ...s, rounds } : s));
  }

  function updateRest(index: number, restSeconds: number) {
    setSelections((prev) => prev.map((s, i) => i === index ? { ...s, restSeconds } : s));
  }

  async function saveWorkout() {
    setStep({ id: "saving" });
    const supabase = createClient();

    const { data: workout, error: wErr } = await supabase
      .from("workouts")
      .insert({ user_id: userId })
      .select("id")
      .single();

    if (wErr || !workout) {
      alert("Failed to save workout: " + wErr?.message);
      setStep({ id: "config" });
      return;
    }

    const exercises = selections.map((s, i) => ({
      workout_id: workout.id,
      position: i,
      block: s.block,
      movement_pattern: s.movementPattern,
      exercise_name: s.exerciseName,
      variation_name: s.variation.name,
      equipment_level: s.variation.equipmentRequired,
      rounds: s.rounds,
      rest_seconds: s.restSeconds,
    }));

    const { error: eErr } = await supabase.from("workout_exercises").insert(exercises);
    if (eErr) {
      alert("Failed to save exercises: " + eErr.message);
      setStep({ id: "config" });
      return;
    }

    router.push(`/workout/${workout.id}`);
  }

  // ---- Render helpers ----

  function ExercisePicker({ blockName, onDone }: { blockName: string; onDone: () => void }) {
    const pattern = getPattern(blockName);
    const blockSelections = selections.filter((s) => s.block === blockName);

    if (!pickingExercise) {
      return (
        <div>
          <StepHeader title={blockName} subtitle="Select movement" />
          <div className="flex flex-col gap-2 mb-6">
            {pattern.exercises.map((ex) => {
              const available = filterVariations(ex.variations, equipment);
              if (available.length === 0) return null;
              return (
                <button
                  key={ex.name}
                  onClick={() => setPickingExercise(ex.name)}
                  className="px-4 py-3 rounded-lg text-sm text-left cursor-pointer"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  {ex.name}
                </button>
              );
            })}
          </div>
          {blockSelections.length > 0 && (
            <div className="mb-6">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>ADDED</p>
              {blockSelections.map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg mb-1 text-sm"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid var(--accent)" }}>
                  <span>{s.variation.name}</span>
                  <button onClick={() => removeExercise(selections.indexOf(s))} className="text-xs cursor-pointer" style={{ color: "var(--text-muted)" }}>✕</button>
                </div>
              ))}
              <button
                onClick={onDone}
                className="w-full mt-3 py-3 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ background: "var(--accent)", color: "#000" }}
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      );
    }

    const ex = pattern.exercises.find((e) => e.name === pickingExercise)!;
    const available = filterVariations(ex.variations, equipment).sort((a, b) => a.progression - b.progression);

    return (
      <div>
        <button onClick={() => setPickingExercise(null)} className="text-sm mb-4 cursor-pointer" style={{ color: "var(--text-muted)" }}>
          ← {blockName}
        </button>
        <StepHeader title={ex.name} subtitle="Select variation" />
        <div className="flex flex-col gap-2 mb-6">
          {available.map((v) => (
            <button
              key={v.name}
              onClick={() => addExercise(blockName, blockName, ex.name, v)}
              className="px-4 py-3 rounded-lg text-sm text-left flex items-center justify-between cursor-pointer"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <span>{v.name}</span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>L{v.progression}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---- Step renders ----

  if (step.id === "equipment") {
    return (
      <WizardShell>
        <StepHeader title="Equipment Available" subtitle="Select all that apply" />
        <div className="flex flex-col gap-3 mb-8">
          {EQUIPMENT_OPTIONS.map((opt) => {
            const selected = equipment.includes(opt.level);
            return (
              <button
                key={opt.level}
                onClick={() => toggleEquipment(opt.level)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm cursor-pointer"
                style={{
                  background: selected ? "rgba(34,197,94,0.1)" : "var(--surface)",
                  border: `1px solid ${selected ? "var(--accent)" : "var(--border)"}`,
                }}
              >
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
        <button
          onClick={() => { setPickingBlock("Pull"); setStep({ id: "pull" }); }}
          className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Continue →
        </button>
      </WizardShell>
    );
  }

  if (step.id === "pull") {
    return (
      <WizardShell>
        <ExercisePicker
          blockName="Pull"
          onDone={() => { setPickingBlock("Push"); setPickingExercise(null); setStep({ id: "push" }); }}
        />
      </WizardShell>
    );
  }

  if (step.id === "push") {
    return (
      <WizardShell>
        <ExercisePicker
          blockName="Push"
          onDone={() => { setPickingBlock("Legs"); setPickingExercise(null); setStep({ id: "legs" }); }}
        />
      </WizardShell>
    );
  }

  if (step.id === "legs") {
    return (
      <WizardShell>
        <ExercisePicker
          blockName="Legs"
          onDone={() => { setPickingExercise(null); setStep({ id: "core-gate" }); }}
        />
      </WizardShell>
    );
  }

  if (step.id === "core-gate") {
    return (
      <WizardShell>
        <StepHeader title="Core" subtitle="Optional block" />
        <div className="flex flex-col gap-3 mb-8">
          <button
            onClick={() => { setIncludeCore(true); setPickingBlock("Core"); setStep({ id: "core" }); }}
            className="px-4 py-4 rounded-lg text-sm font-medium cursor-pointer"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            Include Core
          </button>
          <button
            onClick={() => { setIncludeCore(false); setStep({ id: "config" }); }}
            className="px-4 py-4 rounded-lg text-sm cursor-pointer"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            Skip Core
          </button>
        </div>
      </WizardShell>
    );
  }

  if (step.id === "core") {
    return (
      <WizardShell>
        <ExercisePicker
          blockName="Core"
          onDone={() => { setPickingExercise(null); setStep({ id: "config" }); }}
        />
      </WizardShell>
    );
  }

  if (step.id === "config") {
    return (
      <WizardShell>
        <StepHeader title="Configure" subtitle="Rounds & rest time per exercise" />
        <div className="flex flex-col gap-4 mb-8">
          {selections.map((s, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-muted)" }}>{s.block.toUpperCase()}</p>
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
                  <select
                    value={s.restSeconds}
                    onChange={(e) => updateRest(i, Number(e.target.value))}
                    className="text-sm px-2 py-1 rounded cursor-pointer"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    {Array.from({ length: 13 }, (_, i) => 60 + i * 15).map((sec) => {
                      const m = Math.floor(sec / 60);
                      const s = sec % 60;
                      return <option key={sec} value={sec}>{m}:{s.toString().padStart(2, "0")}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={saveWorkout}
          className="w-full py-3 rounded-lg text-sm font-semibold cursor-pointer"
          style={{ background: "var(--accent)", color: "#000" }}
        >
          Start Workout →
        </button>
      </WizardShell>
    );
  }

  return (
    <WizardShell>
      <div className="flex flex-col items-center justify-center py-20">
        <div className="text-2xl mb-3">⏳</div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Setting up your workout...</p>
      </div>
    </WizardShell>
  );
}

function WizardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh px-4 py-8 max-w-lg mx-auto w-full">
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
