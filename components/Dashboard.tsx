"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function StructureRow({ label, detail, accent, children }: { label: string; detail: string; accent?: boolean; children?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium" style={{ color: accent ? "var(--text)" : "var(--text-muted)" }}>{label}</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{detail}</span>
      </div>
      {children && <div className="ml-4 border-l pl-3 flex flex-col gap-1 mb-1" style={{ borderColor: "var(--border)" }}>{children}</div>}
    </div>
  );
}

function StructureSubRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{detail}</span>
    </div>
  );
}

interface Workout {
  id: string;
  created_at: string;
  completed_at: string | null;
}

export default function Dashboard({ workouts: initial }: { workouts: Workout[] }) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>(initial);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function deleteWorkout(id: string) {
    setDeleting(id);
    const supabase = createClient();
    await supabase.from("workouts").delete().eq("id", id);
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    setDeleting(null);
    setConfirmId(null);
  }

  return (
    <div className="flex flex-col min-h-dvh px-4 py-8 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold">Workout Tracker</h1>
        <button onClick={signOut} className="text-sm cursor-pointer" style={{ color: "var(--text-muted)" }}>
          Sign out
        </button>
      </div>

      <Link
        href="/workout/new"
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl font-semibold text-sm mb-6 cursor-pointer"
        style={{ background: "var(--accent)", color: "#000" }}
      >
        + Start Strength Workout
      </Link>

      {/* Workout structure template */}
      <div className="mb-8 p-4 rounded-xl text-sm" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-bold tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>STRENGTH TEMPLATE · 3×/week · 30–45 min</p>
        <div className="flex flex-col gap-2">
          <StructureRow label="Warm-up" detail="5 min" />
          <StructureRow label="1) Upper Superset" detail="3 rounds" accent>
            <StructureSubRow label="A) Pull" detail="Rest 1:00–2:00" />
            <StructureSubRow label="B) Push" detail="Rest 1:00–2:00" />
          </StructureRow>
          <StructureRow label="2) Lower" detail="3 rounds" accent>
            <StructureSubRow label="C) Squat / Hinge / Plyo" detail="Rest 1:00–2:00" />
          </StructureRow>
          <StructureRow label="3) Core" detail="0–3 rounds · optional" accent>
            <StructureSubRow label="D) Static / Dynamic" detail="Rest 1:00–2:00" />
          </StructureRow>
          <StructureRow label="Cool-down" detail="5 min" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-muted)" }}>RECENT WORKOUTS</h2>
        {workouts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No workouts yet. Start your first one above.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {workouts.map((w) => (
              <div key={w.id}>
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-lg"
                  style={{ background: "var(--surface)", border: `1px solid ${confirmId === w.id ? "#ef4444" : "var(--border)"}` }}
                >
                  <Link href={`/workout/${w.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Strength Workout</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {new Date(w.created_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                  </Link>

                  <div className="flex items-center gap-2 ml-3">
                    <span
                      className="text-xs px-2 py-1 rounded-full"
                      style={{
                        background: w.completed_at ? "rgba(34,197,94,0.15)" : "rgba(255,200,0,0.15)",
                        color: w.completed_at ? "var(--accent)" : "#fbbf24",
                      }}
                    >
                      {w.completed_at ? "Done" : "In Progress"}
                    </span>

                    {confirmId === w.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => deleteWorkout(w.id)}
                          disabled={deleting === w.id}
                          className="text-xs px-2 py-1 rounded cursor-pointer font-semibold disabled:opacity-50"
                          style={{ background: "#ef4444", color: "#fff" }}
                        >
                          {deleting === w.id ? "..." : "Delete"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-xs px-2 py-1 rounded cursor-pointer"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmId(w.id)}
                        className="text-xs px-2 py-1 rounded cursor-pointer"
                        style={{ color: "var(--text-muted)" }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
