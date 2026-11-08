# 29. Сборка, вшивание интерфейса и релиз

В результате получается один portable `out\\Sintence.exe`: интерфейс Vue, адрес сервера
и зависимости вшиты в exe. `sintence-web` отдельно не выкладывается пользователю.

## Локальная сборка

Из `sintence-app`:

```powershell
.\build.ps1                 # web + Release + exe
.\build.ps1 -Tests          # web + Release + тесты
.\build.ps1 -Debug          # Debug + ASan + тесты
.\build.ps1 -SkipWeb        # только C++, dist уже должен существовать
```

`build.ps1`:

1. находит соседний `../sintence-web`;
2. при необходимости выполняет `npm ci`;
3. выполняет `npm run build`;
4. конфигурирует/собирает CMake;
5. запускает тестовый exe для `-Tests` или `-Debug`;
6. копирует `build\\src\\<config>\\sintence.exe` в `out\\Sintence.exe`.

Если рабочий `out\\Sintence.exe` запущен, Windows не даст его перезаписать. Сборка всё
равно заканчивается, но запустить нужно файл прямо из `build\\src\\...`.

## CMake и цели

Главная версия находится в:

```cmake
project(Sintence VERSION 0.2.31 LANGUAGES CXX)
```

Основные цели:

| Цель | Содержимое |
|---|---|
| `sintence_lib` | `core`, `data`, `analysis` |
| `sintence` | `app` и Windows/WebView2 |
| `sintence_tests` | doctest и тесты |
| `sintence_embed` | генерация встроенных файлов интерфейса |

Новые `.cpp` в `core`, `data`, `analysis` и `tests/test_*.cpp` подхватываются глобами.
Новый `.cpp` в `src/app` нужно добавить вручную в `src/CMakeLists.txt`.

Сборка использует C++23, `/W4`, `/permissive-`, `/utf-8`, статический CRT и триплет
`x64-windows-static`. Debug включает AddressSanitizer; рядом с Debug exe должны быть
`clang_rt.asan*.dll`.

## Как интерфейс попадает в exe

`cmake/EmbedApp.cmake` получает каталог `sintence-web/dist` и генерирует
`build/src/generated/embedded_app.cpp`:

- каждый файл становится массивом байтов;
- таблица хранит имя, MIME и содержимое;
- адрес `SINTENCE_SERVER` берётся из окружения сборки;
- токен пользователя не вшивается никогда.

Порядок источников интерфейса:

1. `SINTENCE_WEB_DIR`, если задан для разработки;
2. соседний `../sintence-web/dist`;
3. пустой встроенный интерфейс, если `index.html` не найден — приложение покажет
   ошибку сборки без страницы.

Для быстрой работы над Vue можно запускать `sintence.exe` с `SINTENCE_UI_URL` или
`SINTENCE_WEB_DIR`, не перелинковывая встроенные файлы после каждого изменения.

## Отладочная копия

Рабочее приложение заказчика обычно занимает порт 8777. Отладку запускай отдельно:

```powershell
$env:SINTENCE_PORT = '8778'
$env:SINTENCE_NO_UPDATE = '1'
$env:SINTENCE_NO_PROFILE = '1'
.\build\src\Debug\sintence.exe
```

Проверка локального API:

```powershell
Invoke-RestMethod 'http://127.0.0.1:8778/api/health'
Invoke-RestMethod 'http://127.0.0.1:8778/api/live'
```

Без игры `/api/live` обычно отвечает `503`. После проверки останови только отладочную
копию. Не печатай значения `SINTENCE_SERVER_TOKEN` и других секретных переменных.

## Релиз через CI

Обычный релиз приложения не делается `build.ps1 -Publish` вместе с Git-тегом:

1. добавь запись в `sintence-web/src/data/changelog.ts`;
2. подними `VERSION` в `sintence-app/CMakeLists.txt`;
3. закоммить приложение и интерфейс;
4. создай аннотированный тег `vX.Y.Z` с заметками;
5. отправь main и тег по договорённости с заказчиком.

Workflow `.github/workflows/release.yml`:

- собирается на Windows с Visual Studio;
- проверяет, что тег совпадает с `VERSION`;
- выполняет сборку и тесты;
- вычисляет sha256 и размер exe;
- публикует exe на сервер Sintence через ограниченный SSH-ключ.

Сервер получает `latest.json` и файл релиза. Приложение проверяет версию, размер и
sha256, затем обновляется при запуске, выходе или по кнопке, когда `busy()` ложно.

## Ручная публикация

`build.ps1 -Publish` существует как аварийный путь, если CI недоступен. Он:

- запрещает Debug;
- проверяет, что версия новее серверной;
- вычисляет sha256 и размер;
- загружает exe во временное имя `.part`;
- переименовывает его после передачи;
- вызывает серверный `publish-release.sh`.

Не используй `-Publish` и затем тот же тег: CI увидит уже опубликованную версию и
упадёт. Push в `sintence-app` и `sintence-web` выполняется только по просьбе заказчика.

## Где посмотреть результат

| Что проверяем | Где |
|---|---|
| типы интерфейса | `npx vue-tsc --noEmit` |
| Vue-сборку | `npm run build` |
| C++ и тесты | `build.ps1 -Tests` |
| один тестовый файл | `sintence_tests.exe --source-file="*name*"` |
| локальный API | порт 8778 и `/api/health` |
| журнал exe | `%LOCALAPPDATA%\\Sintence\\logs\\sintence-8778.log` |
| опубликованную версию | `/v1/app/latest` и пульт |

## Частые ошибки

- `0xc0000135` у Debug — отсутствует ASan DLL;
- `SINTENCE_SERVER не задан` — профиль, история, пак и обновление недоступны;
- порт занят — работает другая копия, используй 8778;
- интерфейс старый — WebView2 уже загрузил старый dist, перезапусти exe;
- exe не копируется в `out` — рабочая копия ещё запущена;
- CI отверг тег — `VERSION` и `vX.Y.Z` расходятся или версия уже опубликована.
