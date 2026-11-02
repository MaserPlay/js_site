Копия исходников сада из репозитория maserplay.ru, для чтения: менять их там, пути ниже даны от него.

# 3D-сад: как устроен код (для Димы)

Сад — это страница `/Garden`. Весь код сада лежит в `Web/wwwroot/garden/`: около 120 модулей ES (`*.mjs`) на
three.js r186. Сборщик склеивает их в один файл `garden.bundle.js`, его и грузит страница `page.html`.
Данные о проектах отдаёт сервер (`GardenController`), тексты интерфейса — серверные ресурсы переводов.

Как проект из админки становится островом, описано в `garden-for-dima.md`. Здесь —
про сам код: что где лежит, что от чего зависит, где что менять и как это проверить.

## Команды

Все команды запускаются из папки `Web/`.

| Команда | Что делает |
|---|---|
| `npm ci` | ставит зависимости (один раз) |
| `npm run build:garden` | собирает `wwwroot/garden/garden.bundle.js` (`scripts/build-garden.mjs`); обычный `dotnet build` тоже его собирает |
| `npm run preview:garden` | локальный просмотр без базы и миграций (`scripts/preview-garden.mjs`), обычно на `http://localhost:3001/Garden`; подробнее — в `andrey-garden.md` |
| `npm run test:garden` | все тесты сада (`node --test scripts/test-garden*.mjs`) |
| `npm run lint:garden` | ESLint с правилами sonarjs |
| `npm run format:check:garden` | проверка оформления Prettier (`.prettierrc.json`: 110 символов, одинарные кавычки) |
| `npm run typecheck:garden` | TypeScript по JS. Шумит: без типов three.js даёт сотни сообщений, настоящих ошибок среди них не нашлось |
| `npm run check:garden` | оформление → ESLint → тесты → сборка, одной командой перед ревью |

Копия для js.maserplay.ru собирается командой `node scripts/export-garden-copy.mjs --out <папка>` при запущенном
просмотре. Рядом со страницами лежит читаемый бандл, исходники — в `src/`, а сжимает бандл уже сборка js_site
(`garden.bundle.min.js`).
Чужой код в шейдерах подписан на месте, текст лицензий лежит в `wwwroot/garden/third-party-notices.txt`.

Полезные адреса при проверке (только на локальном просмотре):
- `?audit=1` — отладочные ручки `window.__gardenDebug` (состояние, метрики, свободная камера, снимок шейдеров);
- `?perf=1` — счётчик кадров на экране, удобно на телефоне;
- `?bench=1` — встроенный бенчмарк (кнопка в настройках делает то же);
- `?time=sunset&sunset=crimson` (`fire`, `golden`, `rose`) — показать нужный вариант заката; без параметра
  вариант выбирается по дню.

## Как сад запускается и рисует кадр

1. `garden.mjs` → `boot()` загружает проекты (с фильтром из ссылки, если есть), создаёт рендерер
   (`createRenderer`) и мир (`createWorld` → `world.mjs` `buildWorld`).
2. `initialize()` ставит сезон, свет и камеру, подключает все события (`bindEvents`) и открывает место
   из ссылки (`openLinkedPlace`).
3. Каждый кадр — `render()`: темп кадров, затем `updateCamera()` (кто ведёт камеру: портал, анимация,
   поездка, обзор) и `drawScene()` (вода, небо, гуляющие, залы, сама отрисовка). `wantsNextFrame()` решает,
   нужен ли следующий кадр сразу. На iPhone в покое `scheduleIdleFrame()` раз в 17 с делает паузу на 0,22 с
   (`DRAW_BREAK`): иначе iOS через 20 с непрерывного рисования срезает частоту кадров почти вдвое.

Плашка и карточка теста лежат вне `#garden-app`, поэтому правило «на телефонах без размытия» до них не доходит: размытие в них убрано совсем, а строка плашки меняется раз в секунду. Realme 11 Pro+, зимний тест, 2026-11-01: 46 → 50,7 кадра/с, 1 % худших 11,7 → 16–19, длинных кадров 108 → 19, столько же, сколько со скрытой плашкой. iPhone 16 Pro Max: открытая карточка 30 → 56 кадров/с.

Правило «без размытия» в `garden-ui.css` держится на `(pointer: coarse)`, а не только на ширине: телефон на боку шире 740 пикселей и терял без него треть кадров (27 → 40). Экран в фокусе на телефонах рисуется 1024×600, а не 2048×1200 (`screenWidth` в `garden.mjs`).

Низкие широкие экраны (телефон боком под панелью браузера, на Realme 764×256) живут в двух блоках `garden-ui-panels.css`. До 299 пикселей по высоте: ряды плотнее, вместо карточки объявлений колокольчик, в карточке проекта всё в один ряд. До 359: описание и комментарии в две колонки, панели и портал на всю высоту. Портал здесь в телефонной раскладке, поэтому `isCompact` в `garden.mjs` следит и за высотой: меняя порог в CSS, меняйте его и там.

## Карта модулей

### Ядро

| Модуль | Что в нём | От чего зависит |
|---|---|---|
| `garden.mjs` | точка входа: запуск, цикл кадра, камера и поездки, интерфейс, настройки, клавиатура и касания, перестройка сада при смене порядка | почти все модули ниже; мир — через `world.mjs` |
| `world.mjs` | `buildWorld` / `buildWorldSteps`: строит весь сад (острова, мосты, павильоны, растения, вода, свет) и возвращает объект мира с методами (`setSeason`, `setEconomy`, `setShadows`, `updateWater`…); `lighting()` — освещение по времени суток | модули `world-*.mjs`, строители зданий, растений, гор, воды |
| `path.mjs` | маршрут камеры и мостов: замкнутое кольцо, спицы к порталу | — |

### Что `world.mjs` отдаёт в отдельные модули

Каждый такой модуль экспортирует одну функцию `create…(world)`. `world.mjs` вызывает её во время
построения и передаёт нужные ей части сцены (их список видно прямо в вызове).

| Модуль | Что в нём |
|---|---|
| `season-colours.mjs` | цвета листвы и цветов, размер крон по сезонам (`leafColour`, `flowerColour`, `crownScale`) |
| `world-water.mjs` | пруды (`lakeBasin`) и водопады (`waterfall`) |
| `world-conifers.mjs` | сосна и итальянский кипарис |
| `world-islands.mjs` | тело летающего острова: скала, дёрн, снег, лианы с края |
| `world-lamps.mjs` | садовый фонарь у воды и у дорожек |
| `world-halls.mjs` | залы при движении камеры: двери, таблички, загрузка картин, растворение входа |
| `world-zones.mjs` | где стоит камера в каждом разделе проекта и как она туда идёт |
| `world-screens.mjs` | где экраны и доски проекта на странице |
| `world-decks.mjs` | сплошной настил мостов |
| `world-clearance.mjs` | насколько близко камера или фигура подходят к твёрдым предметам |
| `world-audits.mjs` | только для отладки и тестов: снег, маршрут, мосты, посадки, водные пелены |

### Небо, свет и вода

| Модуль | Что в нём |
|---|---|
| `backdrop.mjs` + `shaders/sky.mjs` | небесный купол (день, закат, рассвет, ночь со звёздами и сиянием), солнце, луна, облака, кольцо гор |
| `solar-clock.mjs`, `moon-phase.mjs` | положение солнца и фаза луны по дате и городу |
| `sun-rays.mjs` | лучи и блик низкого солнца на небе |
| `water-effects.mjs` + `shaders/water.mjs` | материал воды: течение, водопады, отражение (на «Ультра») |
| `cloud-sea.mjs` | море облаков под островами; его туман подменяет `fog_fragment` у всех материалов (волны считаются только ниже `SEA.top`) |
| `practical-lighting.mjs` | свет фонарей и ламп (пятна на земле и несколько настоящих источников); `installLightReach`: точечный свет не считается там, куда не достаёт |

### Графика и эффекты

| Модуль | Что в нём |
|---|---|
| `garden-bloom.mjs` | цепочка постобработки: свечение, FXAA, затенение в углах (AO), лучи |
| `ultra-effects.mjs` | что включает «Ультра»: тени, лампы, отражение прудов, лучи |
| `sun-shafts.mjs` | лучи солнца сквозь деревья на «Ультра» (`SUN_SHAFT_LOOKS` — сила и тёплый оттенок) |
| `adaptive-resolution.mjs` | автокачество: снижает разрешение, когда кадры не успевают; шаг вниз, после которого кадры не стали чаще, отменяет |
| `magic-effects.mjs`, `black-hole-lens.mjs`, `pocket-portal.mjs`, `portal-gate.mjs` | порталы и переходы |

### Здания, растения, горы

| Модуль | Что в нём |
|---|---|
| `pavilion-hall.mjs`, `greenhouse.mjs`, `east-shell.mjs`, `pavilion-glass.mjs`, `building-variants.mjs` | павильоны, теплицы, восточные дома и выбор здания для проекта |
| `tree-structure.mjs`, `tree-foliage.mjs`, `realistic-foliage.mjs`, `plant-forms.mjs`, `vine-plant.mjs`, `winter-firs.mjs`, `xmas-tree.mjs` | деревья, листва, лианы, ёлки |
| `mountains-b.mjs` (по умолчанию), `mountains-a.mjs` | кольцо гор; камень считается только там, где доходит до экрана сквозь дымку и туман (`HIDDEN_ROCK_B`) |
| `bridge-structure.mjs`, `stairs.mjs` | мосты, перила, лестницы |

### Жизнь сада и звук

| Модуль | Что в нём |
|---|---|
| `character.mjs` | гуляющие по мостам (`createCrowd` — их движение, `createVisitor` — модель и позы) |
| `sky-life.mjs` | воздушные шары и стаи птиц |
| `sky-island.mjs` | обсерватория над садом и полёт на шаре |
| `celebrations.mjs`, `celebration-stage.mjs`, `project-birthdays.mjs` | праздники: фейерверки, день рождения сайта и проектов |
| `ambient-music.mjs`, `music-pieces.mjs`, `nature-sounds.mjs`, `portal-sounds.mjs` | музыка и звуки |

### Интерфейс и данные

| Модуль | Что в нём |
|---|---|
| `api-catalog.mjs` | запросы к `/api/projects.json`, фильтры и сортировка |
| `garden-transition.mjs`, `garden-owners.mjs`, `arrange-showcase.mjs` | перестройка островов при смене порядка |
| `overview-orbit.mjs`, `camera-clearance.mjs`, `near-plane.mjs` | обзорная камера и её просвет |
| `settings-tabs.mjs`, `segmented-choice.mjs`, `city-picker.mjs`, `control-strip.mjs`, `portal-dial.mjs` | элементы интерфейса |
| `garden-bench.mjs`, `perf-hud.mjs`, `frame-probe.mjs`, `shader-snapshot.mjs` | бенчмарк и отладка |

Мелкие общие помощники: `seeded-random.mjs` (детерминированные случайные числа — сад выглядит одинаково
при каждой сборке), `paint-canvas.mjs`, `garden-paths.mjs`, `content-level.mjs`.

## Где что менять

| Хочу изменить | Где |
|---|---|
| уровни графики (низкое…ультра) | `garden.mjs`: `bindGraphicsQuality`, `levelRatioCap` и `drawRatio` (разрешение), `levelMsaa` (MSAA или FXAA), `handheld` (телефон или планшет); `world.mjs`: `setEconomy` (упрощённые модели); `ultra-effects.mjs` |
| время суток, цвета неба и света | `world.mjs` `lighting()` и палитры `times`, `backdrop.mjs` (`setLight`), `shaders/sky.mjs`; переключатель — `garden.mjs` `setLighting` |
| закаты и их варианты | `world.mjs`: `SUNSET_VARIANTS` (цвета), `sunsetVariant` (какой вариант в какой день), `SKY_TONES` (красное небо у солнца по умолчанию); рассветы — `DAWN_VARIANTS` |
| лучи солнца на «Ультра» | `sun-shafts.mjs`: `SUN_SHAFT_LOOKS` (сила), `SHAFT_CORE` (насколько лучи приглушены у самого диска) |
| цвета деревьев по сезонам | `season-colours.mjs`; включение сезона — `world.mjs` `setSeason` |
| вода | вид — `shaders/water.mjs`; материал — `water-effects.mjs`; форма прудов и водопадов — `world-water.mjs`, `pond-shape.mjs` |
| поездки камеры между проектами | `garden.mjs`: `goTo`, `stepTravel`, `step`; маршрут — `path.mjs` |
| разделы проекта (описание, комментарии, галерея) | `garden.mjs` `updateSection`; позиции камеры — `world-zones.mjs` |
| клавиши и касания | `garden.mjs`: `bindKeyboard` (`onKey`), `bindPointer` (`startGesture`, `moveGesture`, `endGesture`) |
| настройки | `garden.mjs` `bindSettingsEvents` и функции рядом (`bindGraphicsQuality`, `bindLanguageChoice`, `bindLightStyleChoice`) |
| перестройка при смене порядка | `garden.mjs`: `startRelayout`, `stepRelayout` (`relayoutPhaseA`, `relayoutPhaseB`), `rebuildWorld` |
| гуляющие | `character.mjs` |
| птицы и шары | `sky-life.mjs` |

## Как проверять изменения

- `npm run check:garden` перед ревью. Тестов около 800, каждый файл `scripts/test-garden-*.mjs` проверяет
  свою часть сада.
- Часть тестов ищет код по тексту, без учёта пробелов (`scripts/garden-source.mjs`: `locate`, `between`,
  `containsCode`). Если перенести функцию в другой модуль, такой тест подскажет, какую метку поправить.
- Сад строится детерминированно: одинаковые проекты дают ту же геометрию. Значит, перестройку кода можно
  проверить сравнением построенного мира до и после.
- Смотреть глазами — на локальном просмотре, на «Среднем» и «Высоком». Сравнивая кадры двух сборок,
  снимайте их подряд: часть ночного неба идёт по настоящему времени.
