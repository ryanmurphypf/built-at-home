-- Run this in your Supabase SQL editor

create table workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  completed_at timestamptz
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid references workouts(id) on delete cascade not null,
  position int not null,
  block text not null,
  movement_pattern text not null,
  exercise_name text not null,
  variation_name text not null,
  equipment_level int not null,
  rounds int not null default 3,
  rest_seconds int not null default 90
);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid references workout_exercises(id) on delete cascade not null,
  set_number int not null,
  reps int,
  weight_lbs numeric(6,2),
  completed_at timestamptz
);

-- Row-level security
alter table workouts enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets enable row level security;

create policy "Users own their workouts"
  on workouts for all using (auth.uid() = user_id);

create policy "Users own their exercises"
  on workout_exercises for all
  using (exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "Users own their sets"
  on workout_sets for all
  using (exists (
    select 1 from workout_exercises we
    join workouts w on w.id = we.workout_id
    where we.id = exercise_id and w.user_id = auth.uid()
  ));
