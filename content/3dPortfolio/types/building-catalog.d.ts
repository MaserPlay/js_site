// ----- домены -----
export type ProjectPointRole = "project-point";
export type ProjectPointBehavior = "enter-project";
export type SlotRole = "media-slot" | "comments-slot";

// ----- координаты -----
export interface BuildingsCatalogCoordinates {
  units: CoordinateUnits;
  up: PossibleYAxisSide;
  /** Например: "building-local". */
  space: string;
}

// ----- точка взаимодействия -----
export interface PickBox {
  min: PossibleVector3;
  max: PossibleVector3;
}

export interface InteractionSlot {
  nodeId: string;
  role: SlotRole;
}

export interface InteriorLighting {
  positions: PossibleVector3[];
  distance: number;
}

export interface InteractionPoint {
  id: string;
  nodeId: string;
  buildingId: string;
  role: ProjectPointRole;
  behavior: ProjectPointBehavior;
  routeId: string;
  pick: PickBox;
  /** Может быть пустым массивом (напр. у `FinalContact`). */
  slots: InteractionSlot[];
  interiorLighting: InteriorLighting;
}

// ----- камера -----
export interface CameraRoute {
  id: string;
  pointId: string;
  arrivalNodeId: string;
  points: PossibleVector3[];
  lookAt: PossibleVector3;
  reversible: boolean;
}

export interface BuildingInteraction {
  point: InteractionPoint;
  cameraRoute: CameraRoute;
}

// ----- модель здания -----
export interface BuildingModel {
  id: string;
  name: string;
  /** Относительный путь к GLB, напр. "buildings/QuickVox.glb". */
  url: string;
  nodeId: string;
  sha256: string;
  interaction: BuildingInteraction;
  /** `null`, если у здания нет технического имени (напр. `FinalContact`). */
  technical_name: string | null;
  /** Есть не у всех зданий (у `FinalContact` отсутствует). */
  platformNodeName?: string;
}

// ----- корневой объект -----
export interface BuildingsCatalog {
  /** Версия схемы. Сейчас — 1. */
  schemaVersion: 1;
  /** Идентификатор экспорта, напр. "actors-runtime-candidate-v13-…". */
  exportId: string;
  coordinates: BuildingsCatalogCoordinates;
  models: BuildingModel[];
}