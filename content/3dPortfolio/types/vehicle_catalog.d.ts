
/**
 * Тип точки привязки модели.
 */
type OriginType = "ground-center";

/**
 * Система координат каталога.
 */
interface CatalogCoordinates {
  units: CoordinateUnits;
  up: PossibleYAxisSide;
  forward: Possible2DAxisSide;
  /** Например: "prototype-local" */
  space: string;
}

/**
 * Габариты модели и смещение центра.
 */
interface Footprint {
  /** Полудлина в метрах. */
  halfLengthMetres: number;
  /** Полуширина в метрах. */
  halfWidthMetres: number;
  /** Полная высота в метрах. */
  heightMetres: number;
  /** Смещение центра габарита относительно origin. */
  centerOffset: PossibleVector3;
}

/**
 * Одна модель транспорта в каталоге.
 */
interface VehicleModel {
  /** Например: "vehicle.ambulance.white.v1". */
  id: string;
  /** URL GLB-файла. */
  url: string;
  /** Имя узла внутри GLB. */
  nodeId: string;
  forwardAxis: Possible2DAxisSide;
  upAxis: PossibleYAxisSide;
  /** Поворот базиса модели. */
  basisRotation: PossibleQuaternion;
  origin: OriginType;
  footprint: Footprint;
  /** SHA-256 хэш GLB-файла. */
  sha256: string;
}

/**
 * Корневой объект каталога транспорта.
 */
interface VehicleCatalog {
  /** Версия схемы. Сейчас — 1. */
  schemaVersion: 1;
  /** Тип документа. */
  kind: "city-vehicle-catalog";
  /** Идентификатор экспорта. */
  exportId: string;
  coordinates: CatalogCoordinates;
  models: VehicleModel[];
}