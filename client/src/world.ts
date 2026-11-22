export interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: string;
}

export interface TreeSpot {
  x: number;
  z: number;
  scale: number;
}

const buildingColors = ["#c77d52", "#d4a373", "#748cab", "#b56576", "#8a9a5b"];
export const buildings: Building[] = [];
export const trees: TreeSpot[] = [];

for (const x of [-45, -15, 15, 45]) {
  for (const z of [-45, -15, 15, 45]) {
    const seed = Math.abs(x * 13 + z * 7);
    buildings.push({
      x,
      z,
      width: 8 + (seed % 4),
      depth: 8 + ((seed * 3) % 4),
      height: 7 + (seed % 13),
      color: buildingColors[seed % buildingColors.length],
    });
  }
}

for (const x of [-52, -38, -8, 8, 38, 52]) {
  for (const z of [-55, -35, -16, 16, 35, 55]) {
    trees.push({ x, z, scale: 0.8 + (Math.abs(x + z) % 4) * 0.08 });
  }
}

export function isBlocked(x: number, z: number, radius: number): boolean {
  if (Math.abs(x) > 66 || Math.abs(z) > 66) return true;
  return buildings.some(
    (building) =>
      Math.abs(x - building.x) < building.width / 2 + radius &&
      Math.abs(z - building.z) < building.depth / 2 + radius,
  ) || trees.some((tree) => (x - tree.x) ** 2 + (z - tree.z) ** 2 < (radius + 0.8) ** 2);
}