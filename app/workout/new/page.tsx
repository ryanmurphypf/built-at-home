import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WorkoutWizard from "@/components/WorkoutWizard";

export default async function NewWorkoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <WorkoutWizard userId={user.id} />;
}
