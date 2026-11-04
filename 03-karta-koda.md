# 3. Карта кода

```
sintence-app/
├─ CMakeLists.txt        корневая сборка, версия приложения
├─ build.ps1             одна команда «собрать всё»
├─ cmake/                EmbedApp.cmake — вшивание интерфейса в exe
├─ src/
│  ├─ core/              домен: типы и чистые правила
│  ├─ data/              адаптеры: сеть, LCU, файлы, SQLite, JSON
│  ├─ analysis/          метрики — чистые функции над типами core/
│  └─ app/               точка входа, HTTP-сервер, окна, трей
├─ tests/                test_*.cpp (doctest) + data/ (настоящие ответы игры)
├─ third_party/          doctest, nlohmann/json
├─ vcpkg.json            зависимости vcpkg
└─ *.md                  CLAUDE, ARCHITECTURE, POLICY, CHAMP_SELECT, SERVER
```

## Слои и правило зависимостей

```
          app
         /   \
   analysis   data
         \   /
          core
```

Стрелка «знает о»: `app` знает всех, `analysis` и `data` знают только `core`,
`core` не знает никого, `analysis` не знает `data`.

| Слой | Что можно | Что нельзя |
|---|---|---|
| `core/` | `std::`-типы, свои структуры, чистые функции | JSON, HTTP, файлы, Windows API, nlohmann, httplib |
| `analysis/` | то же + `core/`; функции «данные на входе → число на выходе» | любой ввод-вывод, сеть, время «сейчас» (время — аргументом, см. `content_debounce`) |
| `data/` | nlohmann (JSON), httplib (HTTP), SQLite, файлы, WinAPI-учётные данные | WebView2, окна |
| `app/` | всё, включая WebView2 и окна Windows | — |

**Зачем.** Чистые слои тестируются таблицей значений без сети и игры, а смена
транспорта (например, другой HTTP-клиент) не трогает бизнес-правила.

Проверка на глаз: открой файл из `core/` — нет ни одного `#include <httplib.h>`,
`json.hpp`, `<windows.h>`. Увидел — это нарушение.

## Что где лежит (по задачам)

### core/ — доменные типы
| Файл | Что |
|---|---|
| `live_game.h` | `LiveGame`, `LivePlayer`, `LiveActivePlayer`, интерфейс `LiveGameSource` |
| `lobby.h`, `spectated_game.h` | состав до матча (выбор чемпиона, экран загрузки) |
| `match_history.h`, `match_detail.h`, `match_store.h` | завершённые матчи, интерфейс хранилища |
| `player_profile.h` | ранг, мастерство |
| `game_mode.*` | режим игры по очереди/Live Client (ARAM, Хаос, обычный) |
| `hotkey.*` | валидные сочетания клавиш оверлея |
| `overlay_bounds.*` | проверка размеров/позиции окна на мониторах |
| `discord_activity.*` | текст статуса в Discord |

### data/ — адаптеры (группы)
| Группа | Файлы |
|---|---|
| Игра | `live_client_source`, `live_client_json`, `cached_live_game_source`, `live_game_service` |
| Клиент League (LCU) | `lcu_client`, `lcu_json`, `lobby_service`, `lcu_actions` (запись рун/заклинаний) |
| Сервер Sintence | `server_client`, `server_auth`, `credential_store`, `app_heartbeat`, `pack_store`, `meta_store`, `trends_store`, `badge_store`, `active_users`, `app_update` |
| Riot через шлюз | `riot_api_client`, `riot_api_json`, `profile_service`, `rank_service`, `history_service` |
| Хранилище | `sqlite_match_store`, `history_schema.sql` |
| Разбор пака | `preference_pack` (самый большой разбор) |
| Прочее | `app_log` (журнал), `json_helpers`, `autostart`, `discord_*` |

Пара-закономерность: у многих адаптеров есть пара `*_source/_client` (ходит за
данными) и `*_json` (превращает JSON в типы `core/`). Разбор отделён от сети,
потому что **разбор тестируется на готовых строках**.

### analysis/
`playstyle` (плашки стиля), `profile_summary`, `hidden_mmr` (скрытый MMR),
`party` (группы игроков), `content_debounce` (сглаживание «есть что показать»).

### app/
| Файл | Что |
|---|---|
| `main.cpp` | **только сборка частей вместе**, без логики |
| `live_api_server.*` | локальный HTTP API (2400 строк — самый большой файл) |
| `overlay_window.*` | окно оверлея поверх игры, хуки клавиатуры |
| `profile_window.*`, `stats_window.*` | окно статистики |
| `tray_icon.*` | значок в трее |
| `app_updater.*` | самообновление |
| `webview_lockdown.*` | отключение «браузерности» WebView2 |
| `ui_text.*` | тексты трея и уведомлений (ru/en) |
| `embedded_app.h` | интерфейс доступ к вшитому интерфейсу |

## Куда класть новый код — чек-лист

1. **Это правило/расчёт без ввода-вывода?** → `core/` (тип, правило) или `analysis/`
   (метрика). Пиши тест первым.
2. **Это превращение чужого JSON в наш тип?** → `data/<имя>_json.cpp` + тест на
   готовой строке (образец ответа положи в `tests/data/`).
3. **Это поход за данными (сеть, файл, LCU)?** → `data/<имя>_source` или `_client`,
   за интерфейсом из `core/`, если у источника может быть подмена.
4. **Это новый эндпоинт для интерфейса?** → `app/live_api_server.cpp` +
   zod-схема в `sintence-web/src/api/schemas.ts` + (если сломал совместимость)
   версии контракта (страница 5).
5. **Это окно/клавиши/трей?** → `app/`, остальную логику вынеси в `core/` и протестируй.
6. Новый файл в `app/` — добавь в `src/CMakeLists.txt`.

## Стиль кода (как принято в этом проекте)

- Пространство имён `sintence`, детали — в анонимном `namespace { }` в `.cpp`.
- Охранники заголовков `SINTENCE_<СЛОЙ>_<ИМЯ>_H`.
- Комментарии — **по-русски и «зачем», а не «что»**. Каждый заголовок открывается
  комментарием `// слой/файл — что это и почему так`. Читай их, они подробные.
- Журнал — `Log`/`LogError`. Исключений наружу у источников данных нет:
  «нет матча» — это `std::nullopt`, а не ошибка.
- Имена: типы `PascalCase`, функции `PascalCase`, поля `snake_case`,
  приватные члены `имя_` с подчёркиванием в конце, константы `kPascalCase`.
