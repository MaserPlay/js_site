
// ----- координаты -----
export interface BuildingInstancesCoordinates {
  units: CoordinateUnits;
  up: PossibleYAxisSide;
  /** Здесь "world" — инстансы уже в мировых координатах. */
  space: string;
}

// ----- один инстанс здания в мире -----
export interface BuildingInstance {
  /** Уникальный id инстанса, напр. "building.avenue.06". */
  id: string;
  /** Ссылка на `BuildingModel.id` из buildings-catalog.json. */
  modelId: string;
  /** Позиция в world space (метры). */
  position: PossibleVector3;
  /** Кватернион [x, y, z, w]. */
  quaternion: PossibleQuaternion;
  /** Масштаб по осям. */
  scale: PossibleVector3;
}

// ----- корневой объект -----
export interface BuildingInstances {
  /** Версия схемы. Сейчас — 1. */
  schemaVersion: 1;
  exportId: string;
  coordinates: BuildingInstancesCoordinates;
  buildings: BuildingInstance[];
}