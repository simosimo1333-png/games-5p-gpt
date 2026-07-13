import type { Point, RectangleData, StageData } from "./types";

function isPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isPointInsideWorld(point: Point, stage: StageData): boolean {
  return (
    point.x >= 0 && point.x <= stage.world.width && point.y >= 0 && point.y <= stage.world.height
  );
}

function isRectangleInsideWorld(rectangle: RectangleData, stage: StageData): boolean {
  return (
    isPositive(rectangle.width) &&
    isPositive(rectangle.height) &&
    rectangle.x - rectangle.width / 2 >= 0 &&
    rectangle.x + rectangle.width / 2 <= stage.world.width &&
    rectangle.y - rectangle.height / 2 >= 0 &&
    rectangle.y + rectangle.height / 2 <= stage.world.height
  );
}

export function validateStage(stage: StageData): readonly string[] {
  const errors: string[] = [];

  if (!stage.id.trim()) errors.push("stage id is required");
  if (!stage.name.trim()) errors.push("stage name is required");
  if (!isPositive(stage.world.width) || !isPositive(stage.world.height)) {
    errors.push("world dimensions must be positive");
  }
  if (!isPointInsideWorld(stage.playerSpawn, stage))
    errors.push("player spawn must be inside the world");
  if (!isRectangleInsideWorld(stage.finish, stage)) errors.push("finish must be inside the world");
  if (!isRectangleInsideWorld(stage.mechanics.gate, stage))
    errors.push("gate must be inside the world");
  if (!isRectangleInsideWorld(stage.mechanics.pit, stage))
    errors.push("pit must be inside the world");
  if (stage.mechanics.switches.some((x) => x < 0 || x > stage.world.width))
    errors.push("switches must be inside the world");

  const ids = new Set<string>();
  for (const platform of stage.platforms) {
    if (!platform.id.trim()) errors.push("platform id is required");
    if (ids.has(platform.id)) errors.push(`duplicate platform id: ${platform.id}`);
    ids.add(platform.id);
    if (!isRectangleInsideWorld(platform, stage))
      errors.push(`platform must be inside the world: ${platform.id}`);
  }

  return errors;
}
