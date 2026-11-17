# Здания с подставками и кодами API — v10

Семь платформ `Lift deck` и их нижние цоколи перенесены в соответствующие
GLB зданий. Платформа находится внутри корня здания, поэтому перенос и
вращение группы действуют на неё вместе с моделью. У FinalContact пол и
ступени уже входят в модель. Внешние улицы, площадки и стационарные детали
шахт лифтов остаются окружением.

`building-catalog.json` содержит поле `technical_name`. То же значение
записано в `userData.technical_name` корневого узла внутри каждого GLB.
Написание сверено с публичным API 17 ноября 2026 года.

| Файл | technical_name |
|---|---|
| QuickVox.glb | quickvox |
| ArcadeGames.glb | ArcadeGames |
| EscapeFromLava.glb | EscapeFromLava |
| AppAi.glb | Appai |
| GamesM2023.glb | FlaskSite |
| TelegramBot.glb | Chtgptforpers |
| FenesyyySupport.glb | FenesyyySupport |
| FinalContact.glb | null, финальный павильон |

```js
const model = catalog.models.find(
  model => model.technical_name === project.technical_name
);
const asset = await loader.loadAsync(base + model.url);
scene.add(asset.scene);
```

Стабильные `id`, локальные `interaction` и `building-placements.json`
работают по контракту v09. Позиция корня сохранилась, платформа пересчитана
в его локальные координаты. Для готовой расстановки применяй позиции,
кватернионы и масштабы из `building-placements.json` к загруженной группе.
API управляет содержимым и видимостью проектов.

Повторная сборка из полного пакета v08 выполняется командой Blender.

```powershell
& 'C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe' --factory-startup -b --python-exit-code 1 --python work/project_buildings/export.py -- SOURCE_PACKAGE NEW_PACKAGE --with-platforms
```

Таблица соответствия кодов хранится в `work/project_buildings/project_codes.json`.
Она связывает существующие семь моделей с API. Новую модель нужно добавить
в авторскую сцену и таблицу при подготовке очередного пакета.

Проверка сравнивает все узлы и байты геометрии/текстур с исходным городом,
мировые трансформы зданий и платформ, локальные пути, свет и области клика.
Два кадра обратной сборки реальных GLB осмотрены. Браузерная приёмка ожидается
в веб-чате. Источник технических кодов — https://maserplay.ru/api/projects.json.
