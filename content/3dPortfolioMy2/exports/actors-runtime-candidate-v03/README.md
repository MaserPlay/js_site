# Vehicle paths candidate v03

Derived from actors-runtime-candidate-v02. Same GLB bytes, IDs, endpoints, topology and pedestrian paths. Only vehicle polylines are reduced, separately per edge, with a 0.02 m continuous 3D correspondence error bound. Arc distances in controls, spawn intervals and demo placements are remapped piecewise; physical stop lines and signal nodes stay authored. Lengths are calculated from points, not stored in a separate field.

Full source actor contract remains in the previous stage/ACTORS_EXPORT_CANDIDATE_V1.md. This package is still partial/draft; no new runtime certification, smoothing or browser performance claim. Previews are reused from the unchanged GLBs. See path-simplification-report.json and path-verification.json for evidence.

---

## Inherited actor contract (v02 baseline)

# Кандидат: статический город и библиотеки участников

Результат: `outputs/City_Web_Export/actors-runtime-candidate-v02`.
Копия для нового клиента: `C:/small_scripts/js_site/content/3dPortfolioMy2/exports/actors-runtime-candidate-v02`.
Это кандидат для согласования, а не уже поддерживаемый новым клиентом формат.
Исходники сайта и активный пакет не переключаются.

## Файлы

| Файл | Содержимое |
| --- | --- |
| `city.glb` | Окружение без 16 явно помеченных машин трафика и 14 размеченных пешеходных акторов |
| `vehicles.glb` | Одна библиотека семи уникальных моделей транспорта |
| `pedestrians.glb` | Одна библиотека четырёх вариантов людей, одного скелета и клипов Walk/Idle |
| `scene.json` | ID объектов окружения, точки проектов, метки, камеры и материалы города |
| `vehicle-catalog.json` | ID → ресурс/корневой узел/footprint/базис автомобиля |
| `pedestrian-catalog.json` | ID → ресурс/скелет/вариант/клипы/footprint/базис человека |
| `road-network.json` | Существующие nodes/edges/controls/stopLines/signalGroups/signalHeads/junctions и два spawnSegments |
| `demo-vehicles.json` | Необязательный пресет прежних 12 машин, без обязательных городских nodeId |
| `demo-pedestrians.json` | Необязательный пресет прежних 14 пешеходов |
| `legacy-vehicle-map.json` | Справочное соответствие старых actor asset ID новым моделям |
| `candidate-manifest.json` | ID версии, URL и SHA файлов; не production manifest старого загрузчика |
| `ATTRIBUTION_people.md` | Сохранённые авторство/CC0-происхождение и ссылки ресурсов людей |

Все три GLB — без Draco/Meshopt, изображения встроены. В библиотеке людей нет
города, только четыре варианта, кости, необходимые материалы/текстуры и клипы.
Внутри libraries модели расположены в начале координат; нельзя добавлять всю
библиотеку в видимую сцену сразу — варианты будут наложены друг на друга.

## Статическое и подвижное

Машины отделяются по явной метке `traffic_instance`, `web_role=vehicle` либо
`web_vehicle_usage=moving`. Явное `web_vehicle_usage=parked` сохраняет объект как
декорацию даже при старом traffic_instance. Удаления по слову «машина» в имени нет.
В текущей сцене это 16 подвижных объектов: 12 размеченных и четыре фоновых машины
с той же меткой трафика. Неидентифицированная статическая декорация сохраняется.

У людей отделяются 14 объектов с ролью `pedestrian`. Остальные статические фигуры
окружения, включая сидящих, сохранены; это не новые подвижные акторы. Велосипеды,
самокаты и их декоративные фигуры в этот этап динамической симуляции не переводились.
Настройки количества участников, их ID экземпляров и планы движения принадлежат сайту.

## Автомобиль

Пример записи `vehicle-catalog.json.models` (числа округлены для чтения):

```json
{
  "id": "vehicle.ambulance.white.v1",
  "url": "vehicles.glb",
  "sha256": "<sha256 общей библиотеки>",
  "nodeId": "vehicle.ambulance.white.v1",
  "forwardAxis": "-Z",
  "upAxis": "+Y",
  "basisRotation": [0,0,0,1],
  "origin": "ground-center",
  "footprint": {
    "halfLengthMetres": 2.984,
    "halfWidthMetres": 1.394,
    "heightMetres": 2.95,
    "centerOffset": [0,1.475,0]
  }
}
```

URL относителен папке каталога. `nodeId` ищется в `object.userData.web_id`, а не
по имени объекта или номеру glTF-узла. Семь ID: ambulance.white, police.white,
roadster.red, sedan.electric-silver, sedan.nordic-burgundy, suv.classic-olive,
van.teal (каждый начинается `vehicle.` и заканчивается `.v1`).

Все автомобили: метры, Y вверх, перед −Z. Корневой transform единичный,
origin на земле под центром габаритного прямоугольника. Scale/поворот исходного
размещения не надо применять повторно. `footprint.centerOffset` — центр
габаритного объёма относительно origin, **не** поправка положения экземпляра.

Загрузить vehicles.glb один раз, найти семь корней и создавать клоны выбранного
корня. Эти модели без скелетов; geometry/material можно разделять между клонами.
Перекраска одного экземпляра потребует отдельно клонировать его материал.
На маршрут ставится origin; при движении вдоль −Z yaw равен нулю.

## Пешеход

```json
{
  "id": "city-people.daniel.tint0.high",
  "url": "pedestrians.glb",
  "sha256": "<sha256 общей библиотеки>",
  "nodeId": "city-people.rig.v1",
  "meshNodeId": "city-people.daniel.tint0.high",
  "forwardAxis": "+Z",
  "upAxis": "+Y",
  "basisRotation": [0,1,0,0],
  "origin": "rig-root",
  "footprint": {
    "halfLengthMetres": 0.429,
    "halfWidthMetres": 0.341,
    "heightMetres": 1.744,
    "centerOffset": [0.00034,0.87156,0.03692]
  },
  "animations": {"walk": "Walk", "idle": "Idle"}
}
```

Четыре стабильных ID: `city-people.amara.default.high`,
`city-people.daniel.tint0.high`, `.tint1.high`, `.tint2.high`.
Сохранён исходный базис скелета +Z; `basisRotation` — quaternion **[x,y,z,w]**,
поворот на 180° вокруг Y, переводящий модель в стандартный перед −Z. Его нужно
применить один раз внутри обёртки экземпляра. Поворот движения применяется к
внешней обёртке после этой коррекции.

Для каждого человека:

1. Загрузить pedestrians.glb один раз, найти общий root по `userData.web_id=nodeId`.
2. `SkeletonUtils.clone(root)` — клонировать **всё дерево скелета**, не одну Mesh.
3. В клоне найти четыре узла вариантов по `userData.web_id`. Оставить видимым
   `meshNodeId`, скрыть остальные три. Узел варианта может быть **Group из нескольких
   SkinnedMesh**, а не одним SkinnedMesh. Кости не скрывать/не удалять.
4. Создать отдельный `AnimationMixer` на корне этого клона. Клип выбрать по
   `animations.walk` или `animations.idle` из общих `gltf.animations`.
5. Добавить клон во внутреннюю обёртку с basisRotation. Экземпляром в мире
   управляет внешняя обёртка; она не связана с прежним городским actor nodeId.

Геометрия, веса и бинарные данные клипов оставлены без изменения. `Idle` —
удерживаемая нейтральная поза 2.5 с, без дыхания. Новый скульптинг/походка/перевесовка
Amara здесь не выполнялись. Текущие художественные ограничения моделей сохраняются.

Footprint — огибающий объём ходьбы относительно неизменённого rig-origin **после
basisRotation**. Он проверен на 31 позе Walk и двух позах Idle, допуск 2 см.
Rig-origin близок к земле, но не принудительно перемещён: для точной постановки
нижняя точка имеет Y = centerOffset[1] − heightMetres/2. При необходимости подними
внешнюю обёртку на минус это значение относительно поверхности маршрута.

## Дорожная сеть и появление

Имена nodes/edges/from/to, points, widthMetres, stopLines, signalGroups,
signalHeads, controls, junctions/conflicts и approaches сохранены из источника.
ID и координаты существующих таблиц сравнены без изменений. Контроли светофоров
ссылаются на прежние реальные узлы корпуса/линз city.glb.
Новый `kind=city-road-network` явно отличает файл от старого city-mobility с
обязательными actorAssets/actorSpawns. Их в новой сети нет. Новый клиент должен
сам согласовать чтение этого кандидата; старый валидатор не объявляется совместимым.

```json
"spawnSegments": [{
  "id": "spawn.avenue.north.interior",
  "edgeId": "edge.avenue.vehicle.north.2",
  "minDistanceMetres": 4,
  "maxDistanceMetres": 10
}]
```

Расстояния — длина вдоль направленной POLY-линии от её начала, не доля и не
мировая координата. Второй участок — south.2, от 4 до 6.5 м. Для всех семи
моделей ширина входит в полосу; проверены 30 точек опоры на асфальт для максимального
footprint. Это места-кандидаты, не гарантированно свободные позиции.
Клиент выбирает точку, проверяет расстояния до текущих машин и только затем
создаёт новый экземпляр. Количество/распределение/маршрут экспорт не навязывает.

Покрытие сети остаётся **частичным и draft**. Основной контур содержит полосы
и два разворота. Боковые проезды Y55 пока имеют прямые движения, без полной
поворотной связности с продольной улицей. Старый runtime-proof к изменённой схеме
не прикладывается. Проверка экспорта не подтверждает безопасную симуляцию.
Пешеходные области в рамках этой задачи не дорабатывались и не экспортировались.

## Проекты

`scene.json.projectPoints` — независимые точки с постоянными ID и связью со
зданием. Назначение `pointId → проект из API`, видимость, сортировка и фильтры
принадлежат сайту. В новом пакете не вводится обязательный projectId. Каждое
здание в отдельный GLB этим этапом не выносилось.

## Повторный экспорт

В отдельном Blender:

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --background --factory-startup --python work/export_vehicle_runtime_candidate.py -- 'путь/исходник.blend' 'путь/НОВАЯ_папка'
```

Запускать из корня fk-x20. Каталог назначения должен отсутствовать. Для своей
новой машины назначь `web_vehicle_model_id` и явное использование; готовые семь
моделей уже имеют стабильный реестр. CLI пока читает ориентацию машины из
исходного actorAssets: для совершенно нового типа нужна и эта запись.
Это отдельный CLI-кандидат. Установленная
панель аддона и существующий штатный production-export не переключались.
Редактируемый снимок с ID сохраняется в source_snapshot.blend рядом с экспортом.

Проверки: tests/check_vehicle_runtime_candidate.py (Blender и реальные GLB),
tests/check_pedestrian_library.mjs (настоящие GLTFLoader/SkeletonUtils/Mixer,
материалы исключены только из копии в памяти CPU-теста),
tests/check_vehicle_classification.py. Текстуры отдельно проверяются импортом
Blender. Браузерный рендер, FPS и дорожная/пешеходная симуляция не проверялись.
Кадры vehicles-preview.png и city-without-moving-cars.png — геометрические
превью Workbench; они не подтверждают вид материалов в браузере.
