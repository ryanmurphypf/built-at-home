export type EquipmentLevel = 1 | 2 | 3;

export interface Variation {
  name: string;
  progression: number;
  equipmentRequired: EquipmentLevel;
}

export interface Exercise {
  name: string;
  slot: string;
  variations: Variation[];
}

export interface MovementPattern {
  name: string;
  block: "Pull" | "Push" | "Legs" | "Core";
  exercises: Exercise[];
}

export const EQUIPMENT_OPTIONS = [
  { level: 1 as EquipmentLevel, label: "Nothing (Towel / Object to Hang From)" },
  { level: 2 as EquipmentLevel, label: "Rings" },
  { level: 3 as EquipmentLevel, label: "Weights (Kettlebell / Dumbbell / Heavy Bag)" },
];

export const MOVEMENT_PATTERNS: MovementPattern[] = [
  {
    name: "Pull",
    block: "Pull",
    exercises: [
      {
        name: "Rows",
        slot: "1",
        variations: [
          { name: "Inverted Rows", progression: 1, equipmentRequired: 1 },
          { name: "FE Inverted Rows", progression: 2, equipmentRequired: 1 },
          { name: "Bent Over Rows", progression: 3, equipmentRequired: 3 },
        ],
      },
      {
        name: "Pull-ups",
        slot: "2",
        variations: [
          { name: "Chin-ups", progression: 1, equipmentRequired: 1 },
          { name: "Neutral Grip Pull-ups", progression: 2, equipmentRequired: 1 },
          { name: "Wide Grip Pull-ups", progression: 3, equipmentRequired: 1 },
          { name: "Sternum Pull-ups", progression: 4, equipmentRequired: 1 },
          { name: "Ring Pull-ups", progression: 4, equipmentRequired: 2 },
        ],
      },
    ],
  },
  {
    name: "Push",
    block: "Push",
    exercises: [
      {
        name: "Push-ups (Horizontal)",
        slot: "A",
        variations: [
          { name: "Knee Push-ups", progression: 1, equipmentRequired: 1 },
          { name: "Incline (HE) Push-ups", progression: 2, equipmentRequired: 1 },
          { name: "Regular Push-ups", progression: 3, equipmentRequired: 1 },
          { name: "Decline (FE) Push-ups", progression: 4, equipmentRequired: 1 },
          { name: "Deficit Push-ups", progression: 4, equipmentRequired: 1 },
          { name: "Ring Push-ups", progression: 5, equipmentRequired: 2 },
          { name: "FE Ring Push-ups", progression: 6, equipmentRequired: 2 },
          { name: "One-Arm Push-ups", progression: 7, equipmentRequired: 1 },
        ],
      },
      {
        name: "Push-ups (Vertical)",
        slot: "B",
        variations: [
          { name: "Pike Push-ups", progression: 1, equipmentRequired: 1 },
          { name: "FE Pike Push-ups", progression: 2, equipmentRequired: 1 },
          { name: "HS Push-ups (w/ wall)", progression: 3, equipmentRequired: 1 },
          { name: "HS Push-ups", progression: 4, equipmentRequired: 1 },
        ],
      },
    ],
  },
  {
    name: "Legs",
    block: "Legs",
    exercises: [
      {
        name: "Squats",
        slot: "A",
        variations: [
          { name: "Squats", progression: 1, equipmentRequired: 1 },
          { name: "Lunges", progression: 1, equipmentRequired: 1 },
          { name: "Bulgarian Split Squats", progression: 2, equipmentRequired: 1 },
          { name: "Cossack Squats", progression: 2, equipmentRequired: 1 },
          { name: "Assisted Pistol Squats", progression: 3, equipmentRequired: 1 },
          { name: "Pistol Squats", progression: 4, equipmentRequired: 1 },
        ],
      },
      {
        name: "Hinges",
        slot: "B",
        variations: [
          { name: "Glute Bridges / Hip Thrusts", progression: 1, equipmentRequired: 1 },
          { name: "SL Glute Bridges / Hip Thrusts", progression: 2, equipmentRequired: 1 },
          { name: "SL RDLs", progression: 3, equipmentRequired: 1 },
          { name: "KB Swings", progression: 4, equipmentRequired: 3 },
          { name: "KB Clean & Press", progression: 4, equipmentRequired: 3 },
        ],
      },
      {
        name: "Plyo",
        slot: "C",
        variations: [
          { name: "Jump Squats", progression: 1, equipmentRequired: 1 },
          { name: "Jump Lunges", progression: 1, equipmentRequired: 1 },
          { name: "Burpees", progression: 1, equipmentRequired: 1 },
          { name: "Box Jumps", progression: 1, equipmentRequired: 1 },
          { name: "Broad Jumps", progression: 1, equipmentRequired: 1 },
        ],
      },
    ],
  },
  {
    name: "Core",
    block: "Core",
    exercises: [
      {
        name: "Static",
        slot: "A",
        variations: [
          { name: "Plank", progression: 1, equipmentRequired: 1 },
          { name: "Awkward Plank", progression: 2, equipmentRequired: 1 },
          { name: "Hollow Body Hold", progression: 3, equipmentRequired: 1 },
          { name: "L-Sit", progression: 4, equipmentRequired: 1 },
        ],
      },
      {
        name: "Dynamic",
        slot: "B",
        variations: [
          { name: "Crunches", progression: 1, equipmentRequired: 1 },
          { name: "Hanging Knee Raises", progression: 2, equipmentRequired: 1 },
          { name: "Hanging Leg Raises", progression: 3, equipmentRequired: 1 },
          { name: "Toes-to-Bar", progression: 4, equipmentRequired: 1 },
        ],
      },
    ],
  },
];

export function filterVariations(
  variations: Variation[],
  equipmentLevels: EquipmentLevel[]
): Variation[] {
  return variations.filter((v) => equipmentLevels.includes(v.equipmentRequired));
}
