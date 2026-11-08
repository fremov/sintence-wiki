# 30. Каталог тестов

Что здесь и зачем: полный перечень тестов `sintence-app/tests/` — какой файл что
проверяет, сколько в нём случаев, какие приёмы подмены используются и каких модулей
тесты не касаются. Основы doctest и порядок работы — на странице [10. Тесты](10-testy.md);
здесь справочник.

## Файлы участка

| Файл | Роль | Строк |
|---|---|---|
| `tests/CMakeLists.txt` | мишень `sintence_tests`, глоб `test_*.cpp`, макрос пути к фикстурам | 30 |
| `tests/main.cpp` | единственная точка входа: `DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN` | 14 |
| `tests/test_*.cpp` | 34 файла с тестами (таблица ниже) | 5 563 |
| `tests/data/allgamedata_practice.json` | настоящий ответ `/liveclientdata/allgamedata`, Practice Tool | 39 175 байт |
| `tests/data/allgamedata_practice_towers.json` | то же, с разрушенными башнями и ингибитором | 43 208 байт |
| `third_party/doctest.h` | doctest 2.4.12 (`third_party/doctest.h:50-52`) | — |

## Сборка и запуск

- Один бинарник: `add_executable(sintence_tests main.cpp ${SINTENCE_TEST_SOURCES})`,
  где `SINTENCE_TEST_SOURCES` — `file(GLOB ... CONFIGURE_DEPENDS "test_*.cpp")`
  (`tests/CMakeLists.txt:6-8`). Новый файл подхватывается сам — CMake править не нужно.
- Тесты линкуются с `sintence_lib` (`tests/CMakeLists.txt:9`) — это весь `src/`, кроме
  `app/` (`src/CMakeLists.txt:13-17`). Поэтому код окон из теста недоступен вовсе.
- Путь к фикстурам — макрос `SINTENCE_TEST_DATA_DIR` = `tests/data` исходников
  (`tests/CMakeLists.txt:12-13`).
- В ctest весь набор — один тест `sintence_tests` (`tests/CMakeLists.txt:24`).
- Debug: рядом с бинарником копируются `clang_rt.asan*.dll` (`tests/CMakeLists.txt:15-20`),
  иначе запуск падает с `0xc0000135` (`CMakeLists.txt:56-58`). Подробно — [32. Диагностика](32-diagnostika.md).
- `build.ps1 -Tests` или `-Debug` собирает `sintence_tests` и сразу запускает
  `build\tests\<Release|Debug>\sintence_tests.exe` (`build.ps1:76-82`).

### Запуск подмножеств (флаги doctest)

Подсказка в `tests/main.cpp:9-11`; флаги — из справки `third_party/doctest.h:6129-6201`.

```powershell
$t = "build\tests\Release\sintence_tests.exe"
& $t                                        # весь набор
& $t --list-test-cases                      # список имён (-ltc)
& $t --source-file="*playstyle*"            # один файл (-sf)
& $t --test-case="*ARAM*"                   # по имени, маска * ? (-tc)
& $t --test-case-exclude="*потоков*"        # исключить по имени (-tce)
& $t --source-file-exclude="*autostart*"    # исключить файл (-sfe)
& $t --success                              # печатать и пройденные проверки (-s)
& $t --duration                             # время каждого случая (-d)
& $t --abort-after=1                        # остановиться после первой ошибки (-aa)
```

Имена случаев — по-русски, маски работают и с кириллицей в имени, если консоль в UTF-8
(не проверено для всех консолей — см. «Не проверено»).

## Итог: сколько тестов

`grep -c '^TEST_CASE' tests/test_*.cpp` — сумма **267** случаев в 34 файлах; `SUBCASE`
и `TEST_SUITE` не используются ни разу (grep по `tests/` пуст).

Утверждение «122 шт.» встречается не в `sintence-app/CLAUDE.md` (там числа нет), а в
`.claude/skills/sintence-team/references/project.md:69` — **не совпадает** с кодом (267).

## Каталог файлов

Число `TEST_CASE` посчитано `grep -c '^TEST_CASE'`.

| Файл | Модуль (что тестирует) | TEST_CASE | Ключевые проверки и фикстуры |
|---|---|---|---|
| `test_active_users.cpp` | `data/active_users` — кеш значка «S» | 6 | очередь один раз, пачки по 10, ответ живёт 10 мин, неудача — повтор раз в минуту, негодный Riot ID без очереди (длина в символах UTF-8), вытеснение старше 30 мин и не больше `kMaxEntries`; время — аргументом `now` |
| `test_all_game_data.cpp` | `data/live_client_json` — `ParseAllGameData`, `ChampionKeyFromRaw` | 14 | табло+статистика одним разбором, инвентарь, уровни способностей Q W E R Passive, руны без дубля keystone, наблюдатель без `activePlayer`, nullopt без `gameData`/`allPlayers`, ключ из `rawChampionName`/`rawSkinName`, экран загрузки без `GameStart`; JSON-строка `kAllGameData` (`:10`) |
| `test_app_update.cpp` | `data/app_update` — самообновление без сети | 12 | сравнение версий числами, мусор вместо версии, разбор `/v1/app/latest` (обязательные поля, sha256 из 64 hex, `bytes > 0`), `Sha256Hex` через BCrypt с нулевыми байтами, аргументы установщика с пробелами и кириллицей, `BuildCommandLine`, имя временного exe, имена состояний |
| `test_autostart.cpp` | `data/autostart` — ключ Run | 1 | включить/выключить на **своём** ключе `Software\SintenceTest\Run` HKCU, удаляется в конце (`:13`, `:23-24`) |
| `test_badge_store.cpp` | `data/badge_store` — правила плашек | 3 | `ParseBadgeConfigVersion` (schema 1, rules — массив), мусор не затирает прежнее, тело хранится как пришло |
| `test_cached_live_game_source.cpp` | `data/cached_live_game_source`, `analysis/content_debounce` | 5 | окно 900 мс, «игры нет» держится 2 с, `IsAvailable` из свежего снимка, single-flight на 8 потоках, сглаживание: в false только через 10 с подряд; `FakeSource`, `FakeClock` |
| `test_counters.cpp` | `data/counters` + чтение пака | 7 | `WilsonLower` совпадает с `wilson_lower` из `build_pack.py`, своя корзина при ≥3 оппонентах иначе ALL, только winrate > 0.5 и ≤5, `maxOrder`/`nextItemIds`, `starterItems`, `boots` |
| `test_discord.cpp` | `core/discord_activity`, `data/discord_ipc`, `data/discord_presence` | 14 | активность в матче (чемпион, роль, KDA, время), без соперников, английский, спектатор/реплей — ничего, выбор чемпиона с отсчётом, фазы клиента, вкладка Sintence при закрытом клиенте, безопасный ключ картинки, кадр IPC little-endian, рукопожатие и `SET_ACTIVITY`, `DiscordReplyError`, сравнение активностей с допуском; фикстура-функция `InGame()` (`:19`) |
| `test_game_mode.cpp` | `core/game_mode` | 2 | `ModeOfQueue(450/2400/420)`, очередь главнее `gameMode`, `KIWI` → MAYHEM |
| `test_hidden_mmr.cpp` | `analysis/hidden_mmr` | 8 | `RankScore` граничные, пример заказчика, порог 5 известных и 5 игр, вес новых игр, не-420 пропускаются, сам игрок не учитывается, апекс по порогам, below |
| `test_hotkey.cpp` | `core/hotkey` | 3 | `kDefaultPeekKey` допустим, допустимые сочетания (без Shift-only, Tab, Ctrl+Space, Ctrl+Esc), `HotkeyLabel` |
| `test_ladder_friends.cpp` | `data/ladder_friends` | 1 | порядок: тир, дивизион, LP, затем loading, затем без ранга по имени |
| `test_lcu_actions.cpp` | `data/lcu_actions` — запись в клиент | 9 | `IsCompleteRunePage`, тело `RunePageJson`, `PlanRunePage` (своя перезаписывается, свободное место, без согласия чужую не трогать, удалять нечего — impossible, битый ответ — nullopt), `ChooseSpellSlots`, коды исхода `runes_incomplete`/`spells_same` без обращения к клиенту (`:128-141`) |
| `test_lcu_json.cpp` | `data/lcu_json` (+`riot_api_json`) | 15 | `ParseLockfile` (5 полей), фаза — JSON-строка, `ParseCurrentSummoner`, `ParseChampSelectSession` (союзники, баны, таймер, скрытые, нулевой puuid, скамейка ARAM), `ParseActiveGame`, `ParseGameflowSession`, `ParseLobbyMembers`, `ParseGameflowQueueId` |
| `test_live_client_json.cpp` | `data/live_client_json` — `ParseLivePlayers`, `ParseLiveGameStats` | 14 | табло, вложенный `scores`, команды, флаги, битый игрок не ломает остальных, неизвестная команда, пустой массив ≠ nullopt, время не округляется, скрытые игроки и боты, `wardScore` дробью |
| `test_live_game.cpp` | `data/lcu_json`, `data/riot_api_json` — `ParseSpectatedGame`, `ParseFriends` | 6 | руны только ключевая и деревья, скрытый участник, `target_found`, статусы друзей и мягкий разбор |
| `test_match_detail_json.cpp` | `data/match_detail_json` | 6 | заголовок, участник со всеми полями, боты пропускаются, время создания вместо старта, неполный ответ — nullopt, поля плашек |
| `test_meta_store.cpp` | `data/meta_store` (+`server_client`) | 4 | поля меты в `index.json`, `ParseMetaFile`, `BuildMetaResponse`: 400 `bad_tier`, 503 `meta_unavailable` (`:83-96`), подмена с версией |
| `test_objectives.cpp` | `data/live_client_json` — объекты карты | 9 | **обе фикстуры** `tests/data/` (`:46`, `:81`), владелец TOrder → CHAOS, душа, меньше 4 драконов, старый формат T1/T2/Barracks, украденный дракон и бот, нет events, `respawnTimer`; генераторы `Synthetic()`, `Dragon()` |
| `test_overlay_bounds.cpp` | `core/overlay_bounds` | 5 | окно внутри монитора, видна полоса шапки 64x32, монитора нет — nullopt, min/max размера, мониторы с отрицательными координатами |
| `test_party.cpp` | `analysis/party` — `FindParties` | 9 | пати из лобби, два общих матча в одной команде, транзитивность, разные команды, скрытые не участвуют, порядок групп |
| `test_playstyle.cpp` | `analysis/playstyle` | 7 | метрики за игру, роли порознь, ремейки, участие без убийств команды, ранние смерти по timeline, серия, имена `kStyleMetricIds` |
| `test_preference_pack.cpp` | `data/preference_pack`, `data/pack_store` | 23 | страница рун числовыми id, ключ бакета, цепочки как последовательность, откаты Lookup (матчапы не скачаны, нет матчапа, нет корзины, ранг неизвестен), `MatchupFile`, чужая схема, `TierBucket`, benchmarks, режимы, `MainRole`, `EnemyClasses`, `PackStore::SetLoader` (`:346-370`) |
| `test_preference_pack_averages.cpp` | `data/preference_pack` — `rankAverages` | 7 | полная запись и null, откат на ALL, мусор вместо объекта, `RankAveragesFromJson` (`/v1/rank-averages`), порог top |
| `test_profile_summary.cpp` | `analysis/profile_summary` | 3 | итог, роли, чемпионы, KDA при нуле смертей, чужие матчи |
| `test_rank_service.cpp` | `data/rank_service` | 5 | `ParseRanksResponse` `/v1/ranks`, `RankCacheTtl` (10 мин / 6 ч), `RankSnapshotChanged`, без apex, кривой JSON, `RankService(nullptr)` → nullopt |
| `test_recent_json.cpp` | `data/recent_json` | 1 | порядок, лимит, матч без игрока пропускается, нет `puuid` в ответе |
| `test_riot_api_client.cpp` | `data/riot_api_client` — `UrlEncodePathSegment` | 5 | незарезервированные символы, пробел, `/ ? # %`, кириллица по байтам (знаковый `char` MSVC, `:28-32`), верхний регистр hex |
| `test_riot_api_json.cpp` | `data/riot_api_json` | 22 | `ParsePuuid`, `ParseRankedEntries` (rank → division), `FindQueue`, `ParseChampionMasteries` (точность), `SplitRiotId`, `ParseActiveRegion`, `PlatformHost`, `ParseSummonerInfo`, `ParseMatchIds`, `ParseActiveGame` без puuid |
| `test_server_auth.cpp` | `data/server_auth`, `credential_store`, `app_heartbeat` | 13 | имя записи `Sintence/<хост>`, формат токена и userId, ответ регистрации, пауза между попытками, 403 blocked vs 403 шлюза, тело heartbeat, порядок «окружение → диспетчер → регистрация → 401 → блокировка», имена `AccountStateName`; `FakeVault`, `FakeServer` (`:33-83`) |
| `test_server_client.cpp` | `data/server_client` (+`pack_store`) | 11 | нормализация адреса, `GatewayPath`, `ParseServerPlayers`, `ParsePackIndex`, `ParseServerHistory`, смена пака на ходу и чтение из 4 потоков (`:105-139`), `IsErasedResponse`, `ParseActiveUsers`, `ParseShowBadge`, путь лестницы |
| `test_sqlite_match_store.cpp` | `data/sqlite_match_store` | 8 | сохранение/чтение целиком, замена без дубля, страницы новые первыми, timeline отдельно, несуществующий каталог — nullptr (`:112-114`), фильтры, подсказки без учёта регистра с кириллицей, смерти до 10-й минуты; база `":memory:"` |
| `test_timeline_json.cpp` | `data/timeline_json` | 5 | золото по минутам, порядок прокачки, покупки без отменённых, мусор — nullopt, время смертей |
| `test_trends_store.cpp` | `data/trends_store` (+`server_client`) | 4 | поля трендов в `index.json`, `ParseTrendsFile`, `BuildTrendsResponse` 503 `trends_unavailable` → 200, повтор неудачи не чаще `kTrendsRetry` |

## Фикстуры

| Фикстура | Где | Что это | Кто использует |
|---|---|---|---|
| `allgamedata_practice.json` | `tests/data/` | настоящий ответ Live Client: `"gameMode": "PRACTICETOOL"`, `gameTime` 300.18, события `GameStart`, `DragonKill`×5, `BaronKill`, `HeraldKill`, `HordeKill`×3 и др. | `test_objectives.cpp:46` |
| `allgamedata_practice_towers.json` | `tests/data/` | то же через 395 с: добавлены `TurretKilled`×3, `InhibKilled`, `FirstBrick` | `test_objectives.cpp:81` |
| JSON-константы `constexpr const char* k... = R"(...)"` | в каждом `*_json`-тесте | урезанные ответы API, собранные по форме настоящих | `kAllGameData` (`test_all_game_data.cpp:10`), `kSession` (`test_lcu_json.cpp:54`), `kMatch` (`test_match_detail_json.cpp:13`), `kTimeline` (`test_timeline_json.cpp:10`), `kBase` (`test_preference_pack.cpp:20`) |
| Функции-конструкторы | в анонимном namespace | `MatchDetail`/`LivePlayer` собираются полями | `Match()` (`test_recent_json.cpp:13`), `Game()` (`test_profile_summary.cpp:13`), `InGame()` (`test_discord.cpp:19`), `Synthetic()` (`test_objectives.cpp:24`) |

Чтение файловой фикстуры — так (`test_objectives.cpp:14-19`):

```cpp
std::string ReadFixture(const char* name) {
    std::ifstream in(std::string(SINTENCE_TEST_DATA_DIR) + "/" + name, std::ios::binary);
    std::ostringstream text;
    text << in.rdbuf();
    return text.str();
}
```

После чтения — `REQUIRE_FALSE(text.empty())` (`test_objectives.cpp:48`): иначе неверный
путь дал бы невнятные падения дальше.

## Приёмы тестирования (из реальных файлов)

### Подмена источника наследником интерфейса

`LiveGameSource` объявлен в `core/live_game.h:180`. Тест реализует его счётчиками
(`test_cached_live_game_source.cpp:20-42`):

```cpp
class FakeSource : public LiveGameSource {
public:
    std::string Name() const override { return "fake"; }
    bool IsAvailable() const override {
        ++available_calls;
        return has_game.load();
    }
    std::optional<LiveGame> LoadGame() const override {
        ++load_calls;
        // ... задержка delay для проверки single-flight
    }
    mutable std::atomic<int> load_calls{0};
    // ...
};
```

Так же `FakeVault : sintence::TokenVault` подменяет диспетчер учётных данных Windows
(`test_server_auth.cpp:41-63`), а общее состояние `VaultState` с mutex оставлено у теста,
хотя сам объект уходит в `ServerAuth` через `unique_ptr`.

### Подмена функции (лямбда вместо сети)

- `FakeServer::Registrar()` возвращает лямбду `sintence::Registrar`, которая выдаёт по
  очереди `kTokenB`, `kTokenC`, а статус ≠ 201 — отказ (`test_server_auth.cpp:66-81`).
- `PackStore::SetLoader(...)` получает лямбду, записывающую запрошенные пути
  (`test_preference_pack.cpp:348-352`) — так проверено «качается один раз».
- Конструктор с `nullptr` вместо сервера: `RankService service(nullptr)` →
  `Get(...)` возвращает nullopt (`test_rank_service.cpp:56-59`); `ServerAuth(kTokenA, nullptr, ...)`
  — токен из окружения без диспетчера (`test_server_auth.cpp:158-168`).

### Часы

Три варианта, все в коде:

| Приём | Пример |
|---|---|
| Функция-часы в конструктор | `FakeClock::Fn()` возвращает `[this] { return now; }` для `CachedLiveGameSource(fake, clock.Fn())` (`test_cached_live_game_source.cpp:44-56`) |
| Время аргументом метода | `cache.Lookup("A#1", now + std::chrono::minutes(9), &active)` (`test_active_users.cpp:39`); `debounce.Update(false, t += 1s)` (`test_cached_live_game_source.cpp:138`); `store.ShouldFetch("cc", t0 + kTrendsRetry)` (`test_trends_store.cpp:76`) |
| Константа «сейчас» во входных данных | `constexpr long long kNow = 1'800'000'000'000;` в `DiscordPresenceInput::now_ms` (`test_discord.cpp:15`) |

Начало отсчёта — `time_point{} + 1h`, а не ноль (`test_cached_live_game_source.cpp:45`,
`test_trends_store.cpp:70`): у нулевого времени «минус окно» ушло бы в отрицательное.

Единственный тест с настоящим временем — single-flight: «окно 900 мс заведомо длиннее
запроса» 200 мс (`test_cached_live_game_source.cpp:110-112`).

### JSON в строке

Raw-строки `R"(...)"`; для параметров — склейка (`test_objectives.cpp:24-36`) или
`std::format` с удвоенными скобками (`test_counters.cpp:17`). Ответ ошибки сверяется
дословно:

```cpp
const auto none = BuildMetaResponse(nullptr, "ALL");
CHECK(none.status == 503);
CHECK(none.body == R"({"error":"meta_unavailable"})");
```
(`test_meta_store.cpp:91-93`)

Байты UTF-8 там, где важна кодировка, пишутся явно: `"\xD0\x81\xD0\xB6"`
(`test_riot_api_client.cpp:32`), `"\xD0\xB0"` (`test_active_users.cpp:75`) — чтобы тест не
зависел от кодировки исходника.

### Прочее

- **SQLite в памяти**: `SqliteMatchStore::Open(":memory:")` (`test_sqlite_match_store.cpp:46`).
- **Потоки**: 8 потоков на один снимок (`test_cached_live_game_source.cpp:116-127`),
  4 читателя пака против 20 подмен (`test_server_client.cpp:120-139`) — особенно полезны
  под ASan в Debug.
- **Реальный ресурс ОС, но свой**: реестр HKCU на ключе `Software\SintenceTest\Run`
  (`test_autostart.cpp:13`), хеш через BCrypt (`test_app_update.cpp:105-112`).
- **Чистые функции HTTP-ответов**: `BuildMetaResponse`, `BuildTrendsResponse` возвращают
  `{status, body}` — тестируются без `httplib` (`test_meta_store.cpp:83`, `test_trends_store.cpp:50`).

## Покрытие: модули без тестового файла

Метод: имена `#include "x.h"` во всех `tests/*.cpp` сверены с `src/{core,data,analysis}/*.cpp`.
Файла теста по теме нет у:

| Файл | Строк | Почему, вероятно, нет (по коду) |
|---|---|---|
| `core/match_detail.cpp` | 14 | маленький; косвенно через `MatchDetail` в анализе |
| `data/app_log.cpp` | 102 | журнал; в тестах строки идут в stderr (`data/app_log.h:21`) |
| `data/hidden_log.cpp` | 55 | косвенно: зовут разборщики `lcu_json`, `live_client_json`, `riot_api_json` |
| `data/history_service.cpp` | 476 | фоновый поток + `RiotApiClient`; нет теста |
| `data/json_helpers.cpp` | 44 | только косвенно через разборщики |
| `data/lcu_client.cpp` | 202 | lockfile, процессы, HTTPS к клиенту; `ParseLockfile` из `lcu_json` тестируется |
| `data/live_client_source.cpp` | 61 | HTTPS к 2999 (`live_client_source.cpp:8-16`) |
| `data/live_game_service.cpp` | 181 | нет теста; разбор друзей — в `test_live_game.cpp` |
| `data/lobby_service.cpp` | 286 | поток опроса LCU; нет теста |
| `data/profile_service.cpp` | 173 | очередь профилей; нет теста |

Плюс весь `app/` (сервер API, окна, обновлятор) — не в `sintence_lib`, см. ниже.
Заголовок в include не значит полного покрытия файла: например, `test_lcu_actions.cpp`
проверяет планирование и коды исхода, но не HTTP-запись в клиент (`:128-141`).

## Как написать новый тест

1. Создай `tests/test_<модуль>.cpp` — CMake подхватит сам (`tests/CMakeLists.txt:6`);
   если CMake не перенастроился, `build.ps1` вызовет `cmake --build`, а `CONFIGURE_DEPENDS`
   перезапустит глоб.
2. Шаблон (по образцу `test_rank_service.cpp:1-22`):

```cpp
#include "doctest.h"

#include "rank_service.h"

using namespace sintence;

TEST_CASE("rank service: полный ответ /v1/ranks") {
    LadderRanks ranks;
    REQUIRE(ParseRanksResponse(
        R"({"ranks":{"p1":{"tier":"EMERALD","division":"II","lp":40}}, "scannedAt":1793000000})",
        ranks));
    CHECK(ranks.by_puuid["p1"].tier == "EMERALD");
}
```
   (JSON сокращён против оригинала.)
3. Имя случая — «модуль: правило» по-русски, как во всех файлах.
4. Для разборщика добавь случаи «нет поля», «null», «битый JSON», «не та форма» — так
   устроен каждый `*_json`-тест (например `test_riot_api_json.cpp:103-108`).
5. Нужен файл-фикстура — положи в `tests/data/`, читай через `SINTENCE_TEST_DATA_DIR`.
6. Прогон: `.\build.ps1 -Tests -SkipWeb`, затем свой файл `--source-file="*<модуль>*"`.

## Что нельзя тестировать и почему

- **`app/`**: файлы перечислены руками в мишени `sintence` (`src/CMakeLists.txt:74-90`),
  а `sintence_tests` линкуется только с `sintence_lib` (`tests/CMakeLists.txt:9`). Окна
  требуют цикла сообщений Win32 и WebView2. Поэтому логику выносят в `core/`/`data/`
  чистыми функциями: `BuildMetaResponse`, `BuildTrendsResponse`, `UpdateStateName`,
  `ClampOverlayBounds`-подобные расчёты в `core/overlay_bounds`.
- **Сеть, игра, клиент League**: правило проекта — тесты не ходят в сеть
  (`sintence-app/CLAUDE.md:58-59`). Классы с сокетом (`LiveClientSource`, `LcuClient`)
  подменяются через интерфейс или не тестируются.

## Подводные камни

- `char` в MSVC знаковый: без `static_cast<unsigned char>` кодирование даст `%FFFFFFD0`
  (`test_riot_api_client.cpp:28-30`).
- Тест автозапуска пишет в настоящий HKCU (свой ключ) — при аварии посреди теста ключ
  `Software\SintenceTest` может остаться (`test_autostart.cpp:23-24` удаляет его только в конце).
- `--source-file` фильтрует по пути файла, `--test-case` — по имени; путать их — частая
  причина «0 test cases» (поведение doctest, `doctest.h:6643-6651`).

## Не проверено

- Работа масок `--test-case` с кириллицей в разных консолях Windows (не запускалось).
- Время полного прогона набора — не измерялось.
