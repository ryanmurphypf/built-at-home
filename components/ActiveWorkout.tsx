"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MOVEMENT_PATTERNS } from "@/lib/exercises";
import Logo from "@/components/Logo";

interface Exercise {
  id: string;
  position: number;
  block: string;
  movement_pattern: string;
  exercise_name: string;
  variation_name: string;
  equipment_level: number;
  rounds: number;
  rest_seconds: number;
}

interface WorkoutSet {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  completed_at: string | null;
}

interface Workout {
  id: string;
  created_at: string;
  completed_at: string | null;
}

type SetMap = Record<string, Record<number, WorkoutSet>>;

interface ExerciseEdit {
  variation_name: string;
  rounds: number;
  rest_seconds: number;
}

function buildSetMap(sets: WorkoutSet[]): SetMap {
  const map: SetMap = {};
  for (const s of sets) {
    if (!map[s.exercise_id]) map[s.exercise_id] = {};
    map[s.exercise_id][s.set_number] = s;
  }
  return map;
}

function formatMmSs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

const REST_OPTIONS = Array.from({ length: 13 }, (_, i) => 60 + i * 15);

export default function ActiveWorkout({
  workout,
  exercises: initialExercises,
  initialSets,
}: {
  workout: Workout;
  exercises: Exercise[];
  initialSets: WorkoutSet[];
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [sets, setSets] = useState<SetMap>(buildSetMap(initialSets));
  const [restTimer, setRestTimer] = useState<{ exerciseId: string; remaining: number; total: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [weightInputs, setWeightInputs] = useState<Record<string, Record<number, string>>>({});
  const [repsInputs, setRepsInputs] = useState<Record<string, Record<number, string>>>({});
  const [completed, setCompleted] = useState(!!workout.completed_at);
  const [editMode, setEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, ExerciseEdit>>({});
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const startTimer = useCallback((exerciseId: string, seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRestTimer({ exerciseId, remaining: seconds, total: seconds });
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (!prev) return null;
        if (prev.remaining <= 1) { clearInterval(timerRef.current!); return null; }
        return { ...prev, remaining: prev.remaining - 1 };
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function enterEditMode() {
    const initial: Record<string, ExerciseEdit> = {};
    for (const ex of exercises) {
      initial[ex.id] = { variation_name: ex.variation_name, rounds: ex.rounds, rest_seconds: ex.rest_seconds };
    }
    setEdits(initial);
    setEditMode(true);
  }

  async function saveEdits() {
    setSaving(true);
    for (const ex of exercises) {
      const edit = edits[ex.id];
      if (!edit) continue;
      const changed = edit.variation_name !== ex.variation_name || edit.rounds !== ex.rounds || edit.rest_seconds !== ex.rest_seconds;
      if (!changed) continue;
      // find equipment level for new variation
      const pattern = MOVEMENT_PATTERNS.find((p) => p.block === ex.block);
      const exercise = pattern?.exercises.find((e) => e.name === ex.exercise_name);
      const variation = exercise?.variations.find((v) => v.name === edit.variation_name);
      await supabase.from("workout_exercises").update({
        variation_name: edit.variation_name,
        equipment_level: variation?.equipmentRequired ?? ex.equipment_level,
        rounds: edit.rounds,
        rest_seconds: edit.rest_seconds,
      }).eq("id", ex.id);
    }
    // refresh exercises from DB
    const { data } = await supabase
      .from("workout_exercises")
      .select("id, position, block, movement_pattern, exercise_name, variation_name, equipment_level, rounds, rest_seconds")
      .eq("workout_id", workout.id)
      .order("position");
    if (data) setExercises(data);
    setSaving(false);
    setEditMode(false);
  }

  async function logSet(exercise: Exercise, setNum: number) {
    const repsRaw = repsInputs[exercise.id]?.[setNum];
    const weightRaw = weightInputs[exercise.id]?.[setNum];
    const reps = repsRaw ? parseInt(repsRaw) : null;
    const weight = weightRaw ? parseFloat(weightRaw) : null;
    const existing = sets[exercise.id]?.[setNum];
    let updatedSet: WorkoutSet;
    if (existing) {
      const { data } = await supabase.from("workout_sets").update({ reps, weight_lbs: weight, completed_at: new Date().toISOString() }).eq("id", existing.id).select().single();
      updatedSet = data!;
    } else {
      const { data } = await supabase.from("workout_sets").insert({ exercise_id: exercise.id, set_number: setNum, reps, weight_lbs: weight, completed_at: new Date().toISOString() }).select().single();
      updatedSet = data!;
    }
    setSets((prev) => ({ ...prev, [exercise.id]: { ...(prev[exercise.id] ?? {}), [setNum]: updatedSet } }));
    startTimer(exercise.id, exercise.rest_seconds);
  }

  async function finishWorkout() {
    await supabase.from("workouts").update({ completed_at: new Date().toISOString() }).eq("id", workout.id);
    setCompleted(true);
    router.refresh();
  }

  const pullExercises = exercises.filter((e) => e.block === "Pull");
  const pushExercises = exercises.filter((e) => e.block === "Push");
  const legsExercises = exercises.filter((e) => e.block === "Legs");
  const coreExercises = exercises.filter((e) => e.block === "Core");

  return (
    <div className="flex flex-col min-h-dvh max-w-2xl mx-auto w-full px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Logo height={32} />
        <Link href="/" className="text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>← Home</Link>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {new Date(workout.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          {!completed && !editMode && (
            <button onClick={enterEditMode} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              Edit
            </button>
          )}
          {editMode && (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button onClick={saveEdits} disabled={saving} className="text-xs px-3 py-1.5 rounded-lg cursor-pointer font-semibold disabled:opacity-50"
                style={{ background: "var(--accent)", color: "#000" }}>
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2">Strength Workout</h1>
      <p className="text-xs mb-6" style={{ color: "var(--text-muted)" }}>Warm-up 5 min · Cool-down 5 min</p>

      {/* Rest Timer Banner */}
      {restTimer && !editMode && (
        <div className="mb-6 px-4 py-4 rounded-xl flex items-center justify-between"
          style={{ background: "rgba(34,197,94,0.15)", border: "2px solid var(--accent)" }}>
          <div>
            <p className="text-xs font-bold tracking-wider" style={{ color: "var(--accent)" }}>REST</p>
            <p className="text-3xl font-bold tabular-nums">{formatMmSs(restTimer.remaining)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => startTimer(restTimer.exerciseId, restTimer.total)}
              className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ background: "var(--accent)", color: "#000" }}>
              Restart
            </button>
            <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setRestTimer(null); }}
              className="px-4 py-2 rounded-lg text-sm cursor-pointer"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {(pullExercises.length > 0 || pushExercises.length > 0) && (
        <Section label="1) UPPER SUPERSET" note="Alternate Pull → Push, rest between each">
          {[...pullExercises.map((e) => ({ ex: e, label: "A) Pull" })), ...pushExercises.map((e) => ({ ex: e, label: "B) Push" }))].map(({ ex, label }) =>
            editMode ? (
              <EditCard key={ex.id} exercise={ex} blockLabel={label} edit={edits[ex.id]} onChange={(e) => setEdits((p) => ({ ...p, [ex.id]: e }))} />
            ) : (
              <ExerciseCard key={ex.id} exercise={ex} blockLabel={label}
                sets={sets[ex.id] ?? {}} repsInputs={repsInputs[ex.id] ?? {}} weightInputs={weightInputs[ex.id] ?? {}}
                onRepsChange={(n, v) => setRepsInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onWeightChange={(n, v) => setWeightInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onLog={(n) => logSet(ex, n)} isActiveRest={restTimer?.exerciseId === ex.id}
                onStartRest={() => startTimer(ex.id, ex.rest_seconds)} />
            )
          )}
        </Section>
      )}

      {legsExercises.length > 0 && (
        <Section label="2) LOWER" note="Squat / Hinge / Plyo">
          {legsExercises.map((ex) =>
            editMode ? (
              <EditCard key={ex.id} exercise={ex} blockLabel="C) Legs" edit={edits[ex.id]} onChange={(e) => setEdits((p) => ({ ...p, [ex.id]: e }))} />
            ) : (
              <ExerciseCard key={ex.id} exercise={ex} blockLabel="C) Legs"
                sets={sets[ex.id] ?? {}} repsInputs={repsInputs[ex.id] ?? {}} weightInputs={weightInputs[ex.id] ?? {}}
                onRepsChange={(n, v) => setRepsInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onWeightChange={(n, v) => setWeightInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onLog={(n) => logSet(ex, n)} isActiveRest={restTimer?.exerciseId === ex.id}
                onStartRest={() => startTimer(ex.id, ex.rest_seconds)} />
            )
          )}
        </Section>
      )}

      {coreExercises.length > 0 && (
        <Section label="3) CORE" note="Optional · Static or Dynamic">
          {coreExercises.map((ex) =>
            editMode ? (
              <EditCard key={ex.id} exercise={ex} blockLabel="D) Core" edit={edits[ex.id]} onChange={(e) => setEdits((p) => ({ ...p, [ex.id]: e }))} />
            ) : (
              <ExerciseCard key={ex.id} exercise={ex} blockLabel="D) Core"
                sets={sets[ex.id] ?? {}} repsInputs={repsInputs[ex.id] ?? {}} weightInputs={weightInputs[ex.id] ?? {}}
                onRepsChange={(n, v) => setRepsInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onWeightChange={(n, v) => setWeightInputs((p) => ({ ...p, [ex.id]: { ...(p[ex.id] ?? {}), [n]: v } }))}
                onLog={(n) => logSet(ex, n)} isActiveRest={restTimer?.exerciseId === ex.id}
                onStartRest={() => startTimer(ex.id, ex.rest_seconds)} />
            )
          )}
        </Section>
      )}

      <div className="mt-6">
        {!completed && !editMode ? (
          <button onClick={finishWorkout} className="w-full py-4 rounded-xl text-sm font-bold cursor-pointer"
            style={{ background: "var(--accent)", color: "#000" }}>
            Finish Workout ✓
          </button>
        ) : completed ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-semibold mb-1">Workout Saved</p>
            <Link href="/" className="text-sm" style={{ color: "var(--accent)" }}>Back to Home</Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ label, note, children }: { label: string; note: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-3">
        <p className="text-xs font-bold tracking-wider" style={{ color: "var(--accent)" }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{note}</p>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function EditCard({ exercise, blockLabel, edit, onChange }: {
  exercise: Exercise;
  blockLabel: string;
  edit: ExerciseEdit;
  onChange: (e: ExerciseEdit) => void;
}) {
  const pattern = MOVEMENT_PATTERNS.find((p) => p.block === exercise.block);
  const ex = pattern?.exercises.find((e) => e.name === exercise.exercise_name);
  const variations = ex?.variations ?? [];

  if (!edit) return null;

  return (
    <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}>
      <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>{blockLabel}</p>
      <p className="text-sm font-semibold mb-3">{exercise.exercise_name}</p>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Variation</label>
          <select value={edit.variation_name} onChange={(e) => onChange({ ...edit, variation_name: e.target.value })}
            className="w-full text-sm px-3 py-2 rounded-lg cursor-pointer outline-none"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
            {variations.map((v) => (
              <option key={v.name} value={v.name}>L{v.progression} — {v.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Sets</label>
            <div className="flex items-center gap-2">
              <button onClick={() => onChange({ ...edit, rounds: Math.max(1, edit.rounds - 1) })}
                className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>−</button>
              <span className="text-sm w-4 text-center">{edit.rounds}</span>
              <button onClick={() => onChange({ ...edit, rounds: Math.min(10, edit.rounds + 1) })}
                className="w-8 h-8 rounded text-sm cursor-pointer" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>+</button>
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>Rest</label>
            <select value={edit.rest_seconds} onChange={(e) => onChange({ ...edit, rest_seconds: Number(e.target.value) })}
              className="text-sm px-2 py-1 rounded cursor-pointer"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)" }}>
              {REST_OPTIONS.map((sec) => {
                const m = Math.floor(sec / 60); const s = sec % 60;
                return <option key={sec} value={sec}>{m}:{s.toString().padStart(2, "0")}</option>;
              })}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, blockLabel, sets, repsInputs, weightInputs, onRepsChange, onWeightChange, onLog, isActiveRest, onStartRest }: {
  exercise: Exercise; blockLabel: string; sets: Record<number, WorkoutSet>;
  repsInputs: Record<number, string>; weightInputs: Record<number, string>;
  onRepsChange: (n: number, v: string) => void; onWeightChange: (n: number, v: string) => void;
  onLog: (n: number) => void; isActiveRest: boolean; onStartRest: () => void;
}) {
  const setNums = Array.from({ length: exercise.rounds }, (_, i) => i + 1);

  return (
    <div className="p-4 rounded-xl" style={{ background: "var(--surface)", border: `1px solid ${isActiveRest ? "var(--accent)" : "var(--border)"}` }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-muted)" }}>{blockLabel}</p>
          <p className="text-sm font-semibold">{exercise.variation_name}</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{exercise.rounds} sets</p>
        </div>
        <button onClick={onStartRest} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold cursor-pointer"
          style={{ background: "var(--accent)", color: "#000" }}>
          ⏱ {formatMmSs(exercise.rest_seconds)}
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <div className="grid gap-2 text-xs" style={{ gridTemplateColumns: "28px 1fr 1fr 60px", color: "var(--text-muted)" }}>
          <span>Set</span><span>Reps</span><span>Weight (lbs)</span><span></span>
        </div>
        {setNums.map((setNum) => {
          const logged = sets[setNum];
          return (
            <div key={setNum} className="grid gap-2 items-center" style={{ gridTemplateColumns: "28px 1fr 1fr 60px" }}>
              <span className="text-sm font-medium">{setNum}</span>
              <input type="number" inputMode="numeric" placeholder={logged?.reps?.toString() ?? "reps"}
                value={repsInputs[setNum] ?? ""} onChange={(e) => onRepsChange(setNum, e.target.value)}
                className="px-2 py-1.5 rounded text-sm w-full outline-none"
                style={{ background: "var(--surface-2)", border: `1px solid ${logged ? "var(--accent)" : "var(--border)"}`, color: "var(--text)" }} />
              <input type="number" inputMode="decimal" placeholder={logged?.weight_lbs?.toString() ?? "—"}
                value={weightInputs[setNum] ?? ""} onChange={(e) => onWeightChange(setNum, e.target.value)}
                className="px-2 py-1.5 rounded text-sm w-full outline-none"
                style={{ background: "var(--surface-2)", border: `1px solid ${logged?.weight_lbs ? "var(--accent)" : "var(--border)"}`, color: "var(--text)" }} />
              <button onClick={() => onLog(setNum)} className="py-1.5 rounded text-xs font-semibold cursor-pointer"
                style={{ background: logged?.completed_at ? "rgba(34,197,94,0.2)" : "var(--accent)", color: logged?.completed_at ? "var(--accent)" : "#000", border: logged?.completed_at ? "1px solid var(--accent)" : "none" }}>
                {logged?.completed_at ? "✓" : "Log"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
