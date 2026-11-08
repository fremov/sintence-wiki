# 22. Riot API через шлюз: клиент, профили, история

Что здесь и зачем: какие методы Riot вызывает приложение, как `RiotApiClient` ходит к ним через сервер
Sintence, и как поверх него работают фоновые службы профилей лобби, истории, «Сейчас в игре» и рангов
для скрытого ММР. Транспорт и токен — [21](21-klient-servera-sintence.md), хранение матчей в SQLite —
[24](24-istoriya-i-sqlite.md), правила Riot — [8](08-pravila-riot.md).

## Файлы участка

| Файл (от `src/`) | Роль | Строк |
|---|---|---|
| `data/riot_api_client.h/.cpp` | `RiotApiClient`: методы Riot, кеши puuid и платформы, 429 | 176 / 347 |
| `data/riot_api_json.h/.cpp` | чистый разбор ответов Riot в типы `core/` | 181 / 291 |
| `data/profile_service.h/.cpp` | фоновая докачка профилей лобби и spectator-v5 | 101 / 173 |
| `data/history_service.h/.cpp` | очередь загрузки истории для окна профиля | 132 / 476 |
| `data/live_game_service.h/.cpp` | «Сейчас в игре», карточки, друзья из LCU | 128 / 181 |
| `data/rank_service.h/.cpp` | ранги ладдера для скрытого ММР (`POST /v1/ranks`, не Riot) | 79 / 189 |
| `data/ladder_friends.h/.cpp` | ранги друзей (`/v1/ladder/player`, не Riot напрямую) | 76 / 181 |
| `data/counters.h/.cpp` | контрпики из пака — к Riot не ходит | 41 / 61 |

## 1. Как запрос попадает в Riot

`RiotApiClient::Get(host, path)` (`data/riot_api_client.cpp:61`) превращает запрос в
`GET /v1/riot/<host><path>` (`GatewayPath`, `server_client.cpp:88`) с таймаутом 90 с
(`kServerTimeoutSeconds`, `:68`): лимит ключа держит сервер, запрос ждёт там очереди.

Обработка ответа (`riot_api_client.cpp:69`–`:106`):

| Ответ | Что делает клиент |
|---|---|
| `no_token` | журнал «нет токена», `nullopt` |
| `status == 0` | журнал «нет ответа», `nullopt` |
| 200 | тело как есть |
| 429 (первая попытка) | пауза `max(1, Retry-After)` с, один повтор (`:90`) |
| 404 `erased` | `t_last_erased = true` (флаг потока), `nullopt` |
| 401 | «токен не принят и после перерегистрации», `nullopt` |
| 403 blocked / 403 иное | разные строки журнала, `nullopt` |
| пустой массив `[]` | это 200: разбирается как «данных нет», не ошибка (`riot_api_json.h:52`) |

Весь `Get` и все методы держат `std::recursive_mutex` (`:65`): клиент один на все службы, поэтому
запросы к Riot из приложения выполняются строго по одному (`riot_api_client.h:165`). Рекурсивный — потому
что `LoadProfile` зовёт `ResolvePuuid`, а тот `Get`. Пауза 429 тоже идёт под этим мьютексом.

`LastStatus()` — код последнего ответа (общий). `LastErased()`/`ResetErased()` — `thread_local`, чтобы
ответ одного потока не закрыл чужого игрока (`riot_api_client.cpp:26`).

## 2. Методы Riot, которые реально вызываются

Хосты создаются в `main.cpp:212`: запасной платформенный `ru.api.riotgames.com`, региональный
`europe.api.riotgames.com`. Каждая строка — 1 запрос (при 429 — до 2).

| Метод клиента | Хост | Путь | Что разбирается | Где вызывается |
|---|---|---|---|---|
| `ResolvePuuid` | рег. | `/riot/account/v1/accounts/by-riot-id/{name}/{tag}` | `puuid` | `riot_api_client.cpp:126`; `ProfileService`, `HistoryService`, `LiveGameService` |
| `ResolvePlatformHost` | рег. | `/riot/account/v1/region/by-game/lol/by-puuid/{puuid}` | `region` → хост | `:149`; перед каждым платформенным запросом |
| `LoadProfile` (ранг) | плат. | `/lol/league/v4/entries/by-puuid/{puuid}` | соло-очередь | `:198` |
| `LoadProfile` (мастери) | плат. | `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/top?count=3` | 3 чемпиона | `:214` |
| `LoadActiveGame` | плат. | `/lol/spectator/v5/active-games/by-summoner/{puuid}` | состав (`ParseActiveGame`) | `:246`; `ProfileService::Worker` |
| `LoadSpectatedGame` | плат. | то же | `ParseSpectatedGame` | `:271`; `LiveGameService::Lookup` |
| `LoadChampionMasteries` | плат. | `/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}` | весь список | `:292`; карточки `LiveGameService` |
| `LoadSummoner` | плат. | `/lol/summoner/v4/summoners/by-puuid/{puuid}` | иконка, уровень | `:313`; `HistoryService` |
| `LoadRankedEntries` | плат. | `/lol/league/v4/entries/by-puuid/{puuid}` | все очереди | `:319`; `HistoryService`, карточки |
| `LoadMatchIds` | рег. | `/lol/match/v5/matches/by-puuid/{puuid}/ids?start=&count=[&queue=]` | массив id | `:328`; `HistoryService` |
| `LoadMatchJson` | рег. | `/lol/match/v5/matches/{id}` | сырое тело | `:339` |
| `LoadTimelineJson` | рег. | `/lol/match/v5/matches/{id}/timeline` | сырое тело | `:344` |

Имя и тег кодируются `UrlEncodePathSegment` (всё, кроме `A-Za-z0-9-._~`, как `%XX` верхним регистром,
`riot_api_client.cpp:38`). puuid вставляется в путь как есть.

Белый список сервера (`sintence-data/api/server.py:197`, `ROUTES`) содержит ровно эти пути плюс
`accounts/by-puuid`, который приложение сейчас не зовёт.

### Платформа по puuid

`ResolvePlatformHost` (`riot_api_client.cpp:143`): кеш `platform_cache_` (puuid → хост) на весь запуск.
Ответ `{"region":"RU"}` → `PlatformHost` → `ru.api.riotgames.com` (нижний регистр + домен,
`riot_api_json.cpp:126`). Не ответил или без региона — запасной хост, и он тоже кешируется (`:163`).
После spectator-v5 всем видимым участникам кладётся хост игры без запроса (`:257`, `:283`).

Кеш puuid: `puuid_cache_` (Riot ID → puuid), без срока; `RememberPuuid` заполняет его из spectator
(`:231`). Riot ID без `#`/с пустой частью — запроса нет (`:118`).

## 3. Сколько стоит операция (по коду)

| Операция | Запросов (холодный кеш) | Повторно | Откуда |
|---|---|---|---|
| Профиль лобби (`LoadProfile`) | 4: account, region, league, mastery/top | 2 (league, mastery) | `riot_api_client.cpp:167` |
| Лобби из 10 игроков | до 40 | 0 для уже известных в этом запуске (`known_`) | `profile_service.cpp:34` |
| Состав игры spectator-v5 | account + region + spectator = до 3; затем профили участников без account и region | — | `profile_service.cpp:115` |
| История окна профиля, 50 игр | account + region + summoner + league + 1 ids + до 50 матчей | ids + новые матчи | `history_service.cpp:269` |
| История игрока лобби (`with_account = false`) | account(кеш) + ids + до 10 матчей | раз за запуск | `history_service.cpp:295` |
| «Сейчас в игре» | account + region + spectator | 0 в течение 30 с | `live_game_service.cpp:41` |
| Карточка участника | league + mastery (полный список) | 0 на тот же gameId | `live_game_service.cpp:115` |

Документы называют профиль «три запроса» — это без запроса платформы (см. отчёт ниже, «Не проверено»).
Сервер может отдать любой из них из кеша (`X-Sintence-Cache: hit`), не тратя ключ.

## 4. Модели riot_api_json → core

### account-v1 `ParsePuuid` (`riot_api_json.cpp:11`)
`puuid` (string, обязательно, непустой) → `std::string`. Иначе `nullopt`.

### league-v4 `ParseRankedEntries` → `RankedStats` (`riot_api_json.cpp:26`, `core/player_profile.h:26`)

| JSON | Поле | Тип | Нет поля |
|---|---|---|---|
| `queueType` | `queue` | string | `""` |
| `tier` | `tier` | string | запись пропускается |
| `rank` | `division` | string | запись пропускается |
| `leaguePoints` | `league_points` | int | 0 |
| `wins` | `wins` | int | 0 |
| `losses` | `losses` | int | 0 |

`[]` → пустой вектор; не массив → `nullopt`. `FindQueue(entries, "RANKED_SOLO_5x5" / "RANKED_FLEX_SR")`.

### champion-mastery-v4 `ParseChampionMasteries` → `ChampionMastery` (`:68`, `player_profile.h:41`)

| JSON | Поле | Тип | Нет поля |
|---|---|---|---|
| `championId` | `champion_id` | int | запись пропускается |
| `championLevel` | `level` | int | 0 |
| `championPoints` | `points` | long long | 0 |
| `lastPlayTime` | `last_play_time_ms` | long long (мс) | 0 |

Порядок Riot сохраняется.

### region `ParseActiveRegion` (`:113`) — `region` непустой, иначе `nullopt`.

### summoner-v4 `ParseSummonerInfo` → `SummonerInfo` (`:264`, `core/match_history.h:16`)
`profileIconId` → `profile_icon_id`, `summonerLevel` → `level`; нет обоих — `nullopt`, одного — 0.

### match-v5 ids `ParseMatchIds` (`:277`) — массив строк; не строки пропускаются.

### spectator-v5 `ParseActiveGame` → `LobbyMember` (`:141`, `core/lobby.h:26`)

| JSON участника | Поле | Нет поля |
|---|---|---|
| `puuid` | `puuid`; пусто/null/нет → `hidden = true` | скрытый |
| `riotId` | `riot_id` — только у видимых | `""` |
| `teamId` | `side`: как у себя → `Ally`, иначе `Enemy` | -1 → `Enemy` |
| `championId`, `spell1Id`, `spell2Id` | одноимённые | 0 |
| — | `cell_id` = порядковый номер, `is_self` = puuid совпал | — |

Нет себя среди участников — `nullopt`. `perks` не читаются.

### spectator-v5 `ParseSpectatedGame` → `SpectatedGame` (`:192`, `core/spectated_game.h:42`)

| JSON | Поле | Нет поля |
|---|---|---|
| `gameId` | `game_id` | 0 |
| `gameQueueConfigId` | `queue_id` | 0 |
| `mapId` | `map_id` | 0 |
| `gameStartTime` | `start_time_ms` (<0 → 0) | 0 |
| `bannedChampions[].championId/teamId/pickTurn` | `bans` | пусто |
| `participants[].teamId/bot/championId/spell1Id/spell2Id` | одноимённые | 0/false |
| `participants[].puuid` | пусто и не бот → `hidden`, дальше ничего не читается | — |
| `riotId`, `profileIconId` | только у видимых | `""`/0 |
| `perks.perkIds[0]`, `perks.perkStyle`, `perks.perkSubStyle` | `keystone_id`, `primary_style_id`, `sub_style_id` | 0 |

`target_found` — искомый puuid есть среди видимых. Скрытые подсчитываются в журнал без имён
(`LogHiddenPlayers`, `:260`).

## 5. Службы

### ProfileService (`data/profile_service`)

| Метод | Что | Поток |
|---|---|---|
| `Request(riot_ids)` | в очередь тех, кого ещё нет; без `#` — пропуск | любой (под `mutex_`) |
| `RequestActiveGame(self_riot_id)` | заказать spectator-v5; повтор того же ID — ничего | любой |
| `LastActiveGame()` / `ResetActiveGame()` | результат spectator / сброс при смене фазы | любой |
| `Ready()` | копия готовых профилей в порядке прихода | любой |
| `Status()` | `done` = готовых, `total` = заказанных, `running` | любой |

Один поток `Worker` (`profile_service.cpp:88`): spectator важнее очередного профиля (`:102`); сеть — вне
мьютекса. Неудача профиля уменьшает `total`, иначе прогресс застрял бы на «9 из 10» (`:164`); закрытый
(erased) кладётся в `ready_` с `closed`. Кто заказывает: `LobbyService` (союзники в выборе, состав игры
из LCU, spectator) — `lobby_service.cpp:196`, `:216`, `:235`, `:274`; обработчик `/api/profiles` —
`live_api_server.cpp:1492`. Кеш профилей — на весь запуск, без TTL.

### HistoryService (`data/history_service`)

`Request(riot_id, depth, with_account, force, ids_queue)`:
- повтор того же или меньшего `depth` чаще раза в минуту ничего не делает (`kRefreshInterval`,
  `history_service.cpp:19`); `with_account = false` — раз за запуск, повтор только после ошибки (`:82`);
  `force` (кнопка «Обновить») — пропускает паузу, но не дублирует идущую загрузку;
- `ids_queue > 0` — отдельный статус `riot_id|q<очередь>` без снимка с сервера (`:59`).

Очереди одного потока по приоритету (`Worker`, `:174`): снимок с сервера (`/v1/history`) → timeline →
(если `ProfileService` занят — ждать 300 мс) → игрок → матч → фоновый timeline.

| Константа | Значение |
|---|---|
| `kIdsPerRequest` | 100 id за запрос (`:22`) |
| `kMaxAttempts` | 3 попытки на матч/timeline (`:27`) |
| 404 | не повторяется (`:30`) |

Ошибки статуса: `player_not_found` (puuid не найден), `riot_error` с кодом (список игр не пришёл с первой
страницы, `:316`). Вызывают: `/api/profiles` (10 игр игроков лобби, `kLobbyStyleDepth = 10`,
`live_api_server.cpp:695`, `:1510`), `/api/profile` (depth 1–300, по умолчанию 50, `:1960`, `:1967`;
и 20 соло для ММР, `:1974`), timeline — `:2109`.

### LiveGameService (`data/live_game_service`)

- `Lookup(riot_id)` синхронно в обработчике: `ingame`/`none` (404)/`hidden` (`target_found == false`)/`error`;
  кеш любого ответа 30 с (`kLookupTtl`, `live_game_service.cpp:12`).
- `RequestCards(game)` — один набор на `gameId`, только видимые не-боты; в памяти 8 наборов (`kKeptGames`).
  Свой поток: league + полный mastery, выбирается мастерство на текущем чемпионе.
- `LoadFriends()` — только LCU `/lol-chat/v1/friends`, к Riot ни одного запроса.

### RankService и LadderFriends (сервер, не Riot)

`RankService::Get` только читает кеш; пачки до 200 puuid в `POST /v1/ranks`; найден или скан был — 6 ч,
иначе 10 мин; неудача — повтор той же пачки через 60 с; больше 50 000 записей — чистка просроченных;
смена `scannedAt` — кеш сбрасывается (`rank_service.cpp:13`–`:18`, `:168`).
`LadderFriends` — по одному `/v1/ladder/player`, удача 1 ч, неудача 5 мин (`ladder_friends.cpp:14`).

## 6. Скрытые игроки

- Скрытый в spectator — пустой puuid; имя не берётся, даже если `riotId` пришёл
  (`riot_api_json.cpp:169`, `:232`); профилей, карточек и `RememberPuuid` для него нет
  (`riot_api_client.cpp:279`, `live_game_service.cpp:71`).
- `ProfileService::Request` пропускает ID без `#` (`profile_service.cpp:34`).
- Связывать скрытого с видимым запрещено (POLICY.md, «Скрытые игроки»).
- Erased: профиль `closed`, данные пустые, без повторов (`riot_api_client.cpp:187`, `history_service.cpp:257`).

## Тесты

| Файл | Что |
|---|---|
| `tests/test_riot_api_client.cpp` | только `UrlEncodePathSegment` (пробел, кириллица, верхний hex) |
| `tests/test_riot_api_json.cpp` | все `Parse*`, `FindQueue`, `SplitRiotId`, `PlatformHost`, скрытые в `ParseActiveGame` |
| `tests/test_live_game.cpp` | `ParseSpectatedGame` (руны, скрытый, `target_found`, мусор), `ParseFriends` |
| `tests/test_rank_service.cpp` | `ParseRanksResponse`, `RankCacheTtl`, `RankSnapshotChanged`, без сервера |
| `tests/test_ladder_friends.cpp` | `SortLadderFriends` |
| `tests/test_counters.cpp` | `WilsonLower`, `CounterPicks` |

Не покрыто: `RiotApiClient::Get` (429, erased), кеши puuid/платформы, потоки `ProfileService`,
`HistoryService` и `LiveGameService`.

## Как менять: новый метод Riot end-to-end

1. Сервер: строка в `ROUTES` (`sintence-data/api/server.py:197`) — регулярка пути, срок кеша, имя;
   в том же заходе, иначе шлюз ответит 403.
2. Клиент: метод в `RiotApiClient` под `recursive_mutex`, хост — `regional_host_` или
   `ResolvePlatformHost(puuid)`, через `Get`.
3. Разбор: чистая функция в `riot_api_json` (битый JSON → `nullopt`, `[]` → пустой вектор), тип — в `core/`.
4. Тест разбора в `test_riot_api_json.cpp` на фикстуре настоящего ответа.
5. Вызов — только из фонового потока службы (сеть может ждать до 90 с и держит общий мьютекс).
6. Проверить POLICY.md: не скрытые данные противника, не скрытые игроки.

## Подводные камни

- Перепутанный хост даёт 404 или `[]`, похожий на «ранга нет» (`riot_api_client.h:27`).
- Запасная платформа кешируется на весь запуск даже после сбоя `region/by-game` (`riot_api_client.cpp:163`).
- Пауза 429 держит общий мьютекс: в это время стоят все службы (`:65`, `:93`).
- `LastStatus()` общий для потоков — читать сразу после своего вызова; `LastErased()` — потоковый.
- Puuid из LCU (UUID) Riot API не принимает — нужен Riot ID и account-v1 (`profile_service.h:58`).

## Не проверено

- Сколько профилей реально уходит в Riot, а сколько отдаёт кеш сервера (зависит от сервера).
- Поведение сервера при 429 (отдаёт ли `Retry-After` всегда).
