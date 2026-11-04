# 2. Инструменты и сборка

## Что нужно

| Инструмент | Зачем | Заметка |
|---|---|---|
| **Visual Studio 2026** (компонент «Разработка классических приложений на C++») | компилятор MSVC, C++23, отладчик | другие компиляторы не проверялись |
| **CMake ≥ 3.20** | описание сборки (`CMakeLists.txt`) | идёт с Visual Studio |
| **vcpkg** + переменная `VCPKG_ROOT` | менеджер библиотек | ставит cpp-httplib, OpenSSL, WebView2, SQLite по `vcpkg.json` |
| **Node.js 20+** | сборка интерфейса | нужен `build.ps1`, даже если ты правишь только C++ (`-SkipWeb` обходит) |
| **Git**, **gh** | репозитории | `gh auth login` |
| **PowerShell 5.1** | `build.ps1` | |
| Редактор | Visual Studio, VS Code или CLion | CMake-проект открывается папкой |

Библиотеки, которые уже в репозитории (`third_party/`): **doctest** (тесты) и
**nlohmann/json**. Через vcpkg: **cpp-httplib** (HTTP-клиент и -сервер),
**OpenSSL**, **WebView2**, **SQLite**. Все статические — получается один `.exe`.

## Получить код

```powershell
git clone --recurse-submodules https://github.com/fremov/sintence-workspace.git
cd sintence-workspace
git submodule foreach git switch main
```

Затем в `sintence-app` переключись на свою ветку (страница 11).

## Собрать

Все команды — из `sintence-app`:

```powershell
.\build.ps1                 # интерфейс + Release -> out\Sintence.exe
.\build.ps1 -Tests          # то же и все тесты
.\build.ps1 -Debug          # Debug с ASan и тестами: build\src\Debug\sintence.exe
.\build.ps1 -SkipWeb        # не пересобирать интерфейс (если правишь только C++)
```

Что делает `build.ps1`: (1) собирает `../sintence-web` (`npm`), (2) запускает
CMake, (3) CMake вшивает папку `dist/` интерфейса и адрес сервера в `exe`
(`cmake/EmbedApp.cmake` генерирует `embedded_app.cpp`), (4) кладёт результат
в `out\Sintence.exe`.

**Для учёбы удобнее Debug:** он собирается с **AddressSanitizer** — ловит выход за
границы массива, использование после освобождения. Это лучший учитель C++.

## Мишени CMake

| Мишень | Что |
|---|---|
| `sintence_lib` | статическая библиотека: весь `src/` кроме `app/` |
| `sintence` | приложение (`app/main.cpp` + файлы `app/`) |
| `sintence_tests` | все тесты одним бинарником |

Новые файлы в `core/`, `data/`, `analysis/` и `tests/test_*.cpp` подхватываются
**глобами** автоматически (перезапусти конфигурацию CMake). Файлы в `app/`
перечисляются в `src/CMakeLists.txt` **вручную** — добавь туда.

Флаги: C++23, `/W4` (предупреждения максимум), `/permissive-` (строгий стандарт),
`/utf-8`. Предупреждения — это подсказки, а не мусор: оставляй сборку без них.

## Запустить

Рабочая копия заказчика держит порт **8777** и `out\Sintence.exe`. Свою копию
запускай на другом порту:

```powershell
$env:SINTENCE_PORT = "8778"
$env:SINTENCE_NO_UPDATE = "1"
.\build\src\Debug\sintence.exe
```

Переменные окружения:

| Переменная | Что делает |
|---|---|
| `SINTENCE_PORT` | порт локального сервера (по умолчанию 8777) |
| `SINTENCE_WEB_DIR` | брать интерфейс с диска (`sintence-web/dist`), а не из exe |
| `SINTENCE_UI_URL` | показать в окне адрес, напр. `http://localhost:5173` (живой Vite) |
| `SINTENCE_NO_PROFILE=1` | только оверлей, без окна статистики |
| `SINTENCE_NO_UPDATE=1` | не обновляться самому |
| `SINTENCE_SERVER` | адрес сервера вместо вшитого |

Приложение без консоли. **Всё, что оно «печатает», — в журнале:**
`%LOCALAPPDATA%\Sintence\logs\sintence.log` (для порта 8778 —
`sintence-8778.log`). В коде — `Log(...)` и `LogError(...)` из `data/app_log.h`,
`std::println` и `printf` в `src/` не используй.

## Без игры: интерфейс на заглушках

Чтобы смотреть интерфейс без запущенной игры и без C++:

```powershell
cd ..\sintence-web
npm install        # один раз
npm run dev:mock   # моки, переключатель сценариев
```

Чтобы смотреть интерфейс на живых данных своего exe: `npm run dev` (Vite
проксирует `/api` на `127.0.0.1:8777`).

## Отладка

- **Тесты** — первое средство (страница 10): быстро, без игры и сети.
- **Журнал** — второе.
- **Отладчик Visual Studio**: открой `build\sintence.sln` (после `-Debug`),
  выставь `sintence` стартовым проектом, переменные окружения — в свойствах
  «Отладка → Среда».
- **`curl`**: пока приложение работает, `curl http://127.0.0.1:8778/api/health`
  покажет живой ответ API. Игра не нужна для `health`; `/api/live` без матча
  вернёт 503 — это норма.
- Окна приложения — не браузер: DevTools, F5 и т. п. отключены намеренно
  (`app/webview_lockdown.cpp`). Интерфейс отлаживай в обычном браузере.

## Типичные ловушки

- `0xc0000135` при запуске Debug — нет `clang_rt.asan*.dll` рядом с exe
  (CMake копирует её сам; если нет — пересобери без `SINTENCE_SANITIZERS=OFF`).
- Не собирается интерфейс — нет Node или не сделан `npm install`; для правок C++
  добавь `-SkipWeb` (но интерфейс уже должен лежать в `../sintence-web/dist`).
- «Порт занят» — запущена другая копия; поменяй `SINTENCE_PORT`.
- Не видно сервера Sintence — не задан `SINTENCE_SERVER`/нет вшитого адреса:
  профили, история и советы тогда отвечают `501`, табло и выбор чемпиона
  работают.
- Windows-заголовки: перед `#include <windows.h>` определяй `NOMINMAX`
  (см. начало `app/main.cpp`), иначе `std::min/max` ломаются макросами.
