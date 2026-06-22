import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ActiveWorkout from "@/components/ActiveWorkout";

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: workout } = await supabase
    .from("workouts")
    .select("id, created_at, completed_at, user_id")
    .eq("id", id)
    .single();

  if (!workout || workout.user_id !== user.id) notFound();

  const { data: exercises } = await supabase
    .from("workout_exercises")
    .select("id, position, block, movement_pattern, exercise_name, variation_name, equipment_level, rounds, rest_seconds")
    .eq("workout_id", id)
    .order("position");

  const { data: sets } = await supabase
    .from("workout_sets")
    .select("id, exercise_id, set_number, reps, weight_lbs, completed_at")
    .in("exercise_id", (exercises ?? []).map((e) => e.id));

  return (
    <ActiveWorkout
      workout={workout}
      exercises={exercises ?? []}
      initialSets={sets ?? []}
    />
  );
}
