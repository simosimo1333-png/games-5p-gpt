export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RectangleData extends Point {
  readonly height: number;
  readonly width: number;
}

export interface PlatformData extends RectangleData {
  readonly color: number;
  readonly id: string;
}

export interface StageData {
  readonly finish: RectangleData;
  readonly id: string;
  readonly name: string;
  readonly platforms: readonly PlatformData[];
  readonly playerSpawn: Point;
  readonly world: {
    readonly height: number;
    readonly width: number;
  };
}
