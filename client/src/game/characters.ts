// Harborfall — playable character presets (Phase 4).
// The story always follows Rayan Kade; presets are "play-as" looks built on
// the existing humanoid outfit system. All original characters.
import type { HumanoidOptions } from "../humanoid";

export interface CharacterPreset {
  id: string;
  name: string;
  tagline: string;
  options: HumanoidOptions;
  /** 3 outfit colour variants — applied to the top via rig.setTop(). */
  variants: string[];
}

const BASE: HumanoidOptions = {
  top: "#1f7a72", sleeve: "#e8e2d4", bottom: "#23272e", skin: "#c68863",
  hair: "#241a12", shoes: "#2a2a2e", topStyle: "varsity", bottomStyle: "jeans",
  gender: "m", hairStyle: "cap", build: "average",
};

export const CHARACTERS: CharacterPreset[] = [
  {
    id: "rayan", name: "Rayan Kade", tagline: "Ex-getaway driver. Owes the city nothing.",
    options: { ...BASE },
    variants: ["#1f7a72", "#274268", "#7a2a22"],
  },
  {
    id: "maya", name: "Maya Sol", tagline: "Harbour courier who knows every alley in Port Sable.",
    options: { ...BASE, gender: "f", skin: "#8d5524", hair: "#17100b", hairStyle: "ponytail", topStyle: "crop", build: "slim", bottom: "#2c3038", sleeve: "#8d5524" },
    variants: ["#b5502e", "#1f7a72", "#e3ded2"],
  },
  {
    id: "darius", name: "Darius Cole", tagline: "Dockyard enforcer with a soft spot for strays.",
    options: { ...BASE, skin: "#6b4423", hair: "#0e0a07", hairStyle: "flat", topStyle: "tank", build: "broad", tattooSleeve: true, sleeve: "#6b4423", bottom: "#33302a" },
    variants: ["#3c4148", "#5d2020", "#274036"],
  },
  {
    id: "lena", name: "Lena Fischer", tagline: "Travel photographer chasing the golden hour.",
    options: { ...BASE, gender: "f", skin: "#ffdbac", hair: "#b5522a", hairStyle: "bun", topStyle: "hoodie", build: "average", bottom: "#3a3f4a", sleeve: "#c96f3f" },
    variants: ["#c96f3f", "#31556e", "#5d6e46"],
  },
  {
    id: "kenji", name: "Kenji Mori", tagline: "Street racer. Quiet hands, loud engine.",
    options: { ...BASE, skin: "#f1c27d", hair: "#101216", hairStyle: "flat", topStyle: "tee", build: "slim", sunglasses: true, bottom: "#22252b", sleeve: "#f1c27d" },
    variants: ["#22252b", "#7a1f3d", "#20504e"],
  },
  {
    id: "rosa", name: "Rosa Delgado", tagline: "Club singer by night, wheelman by necessity.",
    options: { ...BASE, gender: "f", skin: "#e0ac69", hair: "#2a1408", hairStyle: "bun", topStyle: "varsity", build: "average", necklace: true, bottom: "#26221f", sleeve: "#e8e2d4" },
    variants: ["#6e2434", "#1d4e4a", "#8a6d1f"],
  },
];

export function loadCharacterChoice(): { id: string; variant: number } {
  try {
    const raw = localStorage.getItem("harborfall-character");
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; variant: number };
      if (CHARACTERS.some((c) => c.id === parsed.id)) return { id: parsed.id, variant: Math.min(2, Math.max(0, parsed.variant | 0)) };
    }
  } catch { /* ignore */ }
  return { id: "rayan", variant: 0 };
}
export function persistCharacterChoice(id: string, variant: number) {
  try { localStorage.setItem("harborfall-character", JSON.stringify({ id, variant })); } catch { /* ignore */ }
}
export const presetById = (id: string): CharacterPreset => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
