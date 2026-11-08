# 21. Клиент сервера Sintence: токен, пульс, обновление

Что здесь и зачем: как C++-приложение разговаривает с сервером Sintence (`sintence-data`, служба `api`).
Один транспорт (`ServerGet`/`ServerPost`), один токен на запуск (`ServerAuth`), набор фоновых
служб поверх него: пульс, плашки, значок «S», самообновление. Обзор сервера — [7. Сервер](07-server.md),
запросы к Riot через шлюз — [22. Riot API через шлюз](22-riot-api-shlyuz.md).

## Файлы участка

| Файл (от `src/`) | Роль | Строк |
|---|---|---|
| `data/server_client.h/.cpp` | `ServerConfig`, `ServerGet/Post`, пути `/v1/*`, разбор мелких ответов | 179 / 407 |
| `data/server_auth.h/.cpp` | `ServerAuth`: токен, регистрация, 401/403 | 148 / 298 |
| `data/credential_store.h/.cpp` | `TokenVault`, диспетчер учётных данных Windows | 63 / 161 |
| `data/app_heartbeat.h/.cpp` | `AppHeartbeat`: `POST /v1/app/heartbeat` | 66 / 146 |
| `data/app_update.h/.cpp` | релиз, версии, sha256, аргументы, скачивание | 151 / 312 |
| `app/app_updater.h/.cpp` | поток самообновления, режим установщика | 107 / 535 |
| `data/active_users.h/.cpp` | значок «S»: кеш и фоновый поток | 103 / 187 |
| `data/badge_store.h/.cpp` | правила плашек `/v1/badges` (здесь — только как клиент) | 73 / 122 |
| `app/main.cpp` | проводка: кто создаётся, режим установщика | 476 |

## 1. ServerConfig и транспорт

```cpp
struct ServerConfig {
    std::string url;  // "https://203.0.113.10" — без / в конце
    std::shared_ptr<ServerAuth> auth;
};
```
(`data/server_client.h:35`; адрес в комментарии — документационный пример.)

- Адрес: переменная `SINTENCE_SERVER` главнее вшитого при сборке `BuiltInServerUrl()`
  (`data/server_client.cpp:80`, `app/main.cpp:204`). Пробелы по краям обрезаются, `/` в конце снимается
  (`NormalizeServerUrl`, `:73`). Нет ни того, ни другого — `nullopt`, сервер не задан.
- `auth` — общий `shared_ptr` на все копии `ServerConfig`: токен может появиться или смениться
  после того, как службы получили свою копию (`server_client.h:37`). `nullptr` — запрос без токена
  (только регистрация).

### ServerResponse

| Поле | Тип | Смысл | Ссылка |
|---|---|---|---|
| `status` | int | HTTP-код; 0 — сервер не ответил или токена нет | `server_client.h:57` |
| `body` | string | тело как есть | `:58` |
| `retry_after` | int | секунды из заголовка `Retry-After` | `:59`, `.cpp:125` |
| `cache_hit` | bool | заголовок `X-Sintence-Cache: hit` | `:60`, `.cpp:126` |
| `no_token` | bool | запрос не отправлялся: токена нет | `:61` |

### Как идёт один запрос (`Send`, `server_client.cpp:130`)

1. `auth == nullptr` — сразу `SendOnce` без заголовка (`:132`).
2. `auth.Blocked()` — в сеть не идём, синтетический ответ `403 {"error":"blocked"}` (`:137`).
3. `auth.Token(wait)`, где `wait = min(20 с, timeout_seconds)` (`kTokenWaitSeconds`, `:46`, `:143`).
   Нет токена — `no_token = true`, `status = 0` (`:145`).
4. `SendOnce`: заголовок `Authorization: Bearer <токен>` (`:104`), подключение `min(5, timeout)` с
   (`kConnectTimeoutSeconds`, `:22`, `:101`), чтение — `timeout_seconds` (`:102`).
5. Нет ответа и `retry_on_drop` — `client.stop()` и ровно один повтор с новым соединением (`:114`).
6. 401 и `auth.OnUnauthorized(token)` вернул true — тот же запрос ещё раз с новым токеном (`:152`).
7. Ответ `403 {"error":"blocked"}` — `auth.OnBlocked()` (`:161`).

Соединение — `thread_local httplib::Client` с keep-alive, своё у каждого потока (`ThreadClient`, `:50`).
TLS выбирается по схеме `https://`, сертификат проверяется по корням Windows (комментарий `:98`).

### Разные 403 и 404

| Функция | Условие | Значит | Ссылка |
|---|---|---|---|
| `IsBlockedResponse` | 403 и `error == "blocked"` | пользователь заблокирован в пульте | `server_client.cpp:169` |
| — | 403 иное | метод не разрешён шлюзом (или старый общий токен — см. `SetShowBadge`) | `server_client.h:86` |
| `IsErasedResponse` | 404 и `error == "erased"` | игрок попросил удалить данные: профиль закрыт | `server_client.cpp:178` |

## 2. Все пути /v1/..., которые вызывает приложение

Таймаут — аргумент `timeout_seconds` (чтение); подключение всегда `min(5, таймаут)`. Повтор при обрыве —
один, кроме отмеченных. Токен — во всех, кроме регистрации.

| Метод, путь | Тело запроса | Поля ответа, которые читаются | Кто вызывает (поток) | Таймаут | Ссылка |
|---|---|---|---|---|---|
| `POST /v1/register` | `{"appVersion":"…"}` | 201/200: `token`, `userId`; 429: `Retry-After` | поток `ServerAuth::Run` | 10 с, без повтора при обрыве, без токена | `server_auth.cpp:284` |
| `POST /v1/app/heartbeat` | `{"appVersion","state","riotId"\|null}` | только статус 204/200 | поток `AppHeartbeat` | 10 с; `closed` — 2 с без повтора | `app_heartbeat.cpp:61`, `:137` |
| `GET /v1/riot/<хост><путь>` | — | тело Riot как есть, `Retry-After`, `X-Sintence-Cache` | `RiotApiClient::Get` (страница 22) | 90 с | `riot_api_client.cpp:72` |
| `GET /v1/history?riotId=&count=` | — | `puuid`, `summoner`, `league`, `ids`, `matches` | поток `HistoryService` (снимок) | 30 с | `server_client.cpp:290` |
| `GET /v1/players?q=&limit=` | — | `players[].riotId`, `players[].games` | обработчик `/api/players` | 5 с | `server_client.cpp:243`, `app/live_api_server.cpp:2058` |
| `GET /v1/packs/index.json` | — | `file`, `sha256`, `metaFile`, `metaSha256`, `trendsFile`, `trendsSha256` | поток `PackUpdater` | 30 с | `pack_store.cpp:138`, `server_client.cpp:303` |
| `GET /v1/packs/<файл>` | — | пак / мета / тренды / матчапы | `PackUpdater`; матчапы — обработчик `/api/preferences` | 30 с; матчапы 10 с | `pack_store.cpp:156`, `:184`, `:217`, `:105` |
| `GET /v1/badges` | — | тело целиком (проверка `schema == 1`, `rules[]`, `version`) | поток `BadgeUpdater` | 30 с | `badge_store.cpp:91` |
| `GET /v1/users/active?riotIds=<csv>` | — | `active[]` | поток `ActiveUsersUpdater` | 3 с | `server_client.cpp:365` |
| `GET /v1/users/me` | — | `showBadge` | обработчик `GET /api/badge-visibility` | 10 с | `server_client.cpp:382`, `live_api_server.cpp:1196` |
| `POST /v1/users/me` | `{"showBadge":bool}` | `showBadge`; 403 не blocked — `legacy` | обработчик `POST /api/badge-visibility` | 10 с | `server_client.cpp:394`, `live_api_server.cpp:1223` |
| `GET /v1/ladder?tier=&offset=&limit=[&me=]` | — | тело как есть (прокси) | обработчик `/api/ladder` | 5 с; с `me` — 15 с | `server_client.cpp:229`, `live_api_server.cpp:1273` |
| `GET /v1/ladder/search?q=` | — | как есть | `/api/ladder/search` | 5 с | `server_client.cpp:233`, `live_api_server.cpp:1291` |
| `GET /v1/ladder/player?riotId=` | — | как есть; `LadderFriends` читает `player` | `/api/ladder/player`, поток `LadderFriends` | 15 с | `server_client.cpp:238`, `ladder_friends.cpp:155` |
| `POST /v1/ranks` | `{"puuids":[…до 200]}` | `ranks{puuid:{tier,division,lp}}`, `apex`, `scannedAt` | поток `RankService` | 15 с | `rank_service.cpp:154` |
| `GET /v1/rank-averages` | — | средние по рангу (разбор пака) | обработчик `/api/averages` (кеш 1 ч) | 15 с | `live_api_server.cpp:826` |
| `GET /v1/skins/index.json` | — | список скинов | обработчик `/api/skins` | 10 с | `live_api_server.cpp:1374` |
| `GET /v1/skins/<ключ>.webp` | — | картинка | обработчик `/api/skins/*.webp` | 10 с | `live_api_server.cpp:1405` |
| `GET /v1/app/latest` | — | `version`, `file`, `sha256`, `bytes`, `publishedAt`, `notes` | поток `AppUpdater` | 15 с; при выходе 5 с | `app_update.cpp:266` |
| `GET /v1/app/<файл>` | — | сам exe | поток `AppUpdater` | 120 с; при выходе 50 с | `app_update.cpp:277` |

Параметры в query кодируются `UrlEncodePathSegment` (`server_client.cpp:219`, `:233`, `:244`, `:292`);
в `riotIds` запятая между Riot ID передаётся как `%2C`, не больше 10 штук (`:359`).

### Обработка статусов (общая картина)

| Статус | Транспорт (`Send`) | Типичная служба |
|---|---|---|
| 0 (нет связи) | один повтор при обрыве, затем `status = 0` | пишет «сервер не ответил»/«нет связи», повтор по своему расписанию |
| `no_token` | в сеть не уходит | heartbeat — опрос раз в 5 с; пак/плашки — `kRetry` 1 мин |
| 401 | перерегистрация раз за запуск и один повтор (`server_client.cpp:152`) | — |
| 403 blocked | `OnBlocked`, дальше в сеть не идём до перезапуска | `AppUpdater` пишет «доступ закрыт» (`app_updater.cpp:282`) |
| 403 иное | как есть | `SetShowBadge` → `legacy = true` (`server_client.cpp:395`); Riot-клиент — «метод не разрешён шлюзом» |
| 404 erased | как есть | профили и история помечают `closed` |
| 429 | `retry_after` из заголовка | регистрация — пауза ≥ `Retry-After`; `RiotApiClient` — пауза и один повтор |
| 5xx | как есть, без повторов в транспорте | каждая служба повторяет по своему таймеру |

## 3. Токен: ServerAuth и диспетчер учётных данных

Порядок поиска токена (`data/server_auth.h:19`, `MakeServerAuth` `server_auth.cpp:273`):

1. Переменная `SINTENCE_SERVER_TOKEN` (обрезка пробелов, `:21`) — сразу `kOk`, диспетчер и регистрация
   не используются, перерегистрации на 401 нет (только строка в журнале, `:212`).
2. Диспетчер учётных данных Windows, читается только в первый раз (`vault_checked_`, `:157`).
3. `POST /v1/register`; полученный токен сохраняется в диспетчер (`Resolve`, `:129`).

### Запись в диспетчере (`data/credential_store.cpp`)

| Что | Значение | Ссылка |
|---|---|---|
| Тип | `CRED_TYPE_GENERIC`, `CRED_PERSIST_LOCAL_MACHINE` | `:79`, `:85` |
| Имя записи (TargetName) | `Sintence/<хост сервера>`, хост в нижнем регистре, с портом, без `user:pass@` | `:129`, `:111` |
| Пароль (blob) | токен | `:82` |
| Имя пользователя | `userId` (после `SanitizeUserId`), пусто — `nullptr` | `:86` |
| Комментарий | «Sintence: токен приложения для сервера Sintence» | `:77` |

Проверки: `IsPlausibleToken` — 16–256 символов из `A-Za-z0-9 - _ . ~ + / =` (`:133`); испорченная запись —
`nullopt` и регистрация заново (`:67`). `SanitizeUserId` — до 32 символов, только буквы-цифры (`:145`).

### Состояния AccountState (`/api/health` → `account.state`)

| Значение | Имя | Когда |
|---|---|---|
| `kNone` | `none` | сервер не задан (ServerAuth не создаётся) |
| `kRegistering` | `registering` | ищу токен или регистрируюсь (начальное, `server_auth.h:130`) |
| `kOk` | `ok` | токен есть |
| `kBlocked` | `blocked` | пришёл 403 blocked |
| `kError` | `error` | регистрация не удалась (повторяется) или сдались после второго 401 |

### Поток регистрации (`ServerAuth::Run`, `server_auth.cpp:149`)

- Ждёт, пока `NeedsToken()`: токена нет, не заблокирован, не «сдался» (`:125`).
- Неудача — `kError` и пауза `RegisterRetryDelay`: 30, 60, 120, 300, 600 с (дальше — 600), на 429 —
  не меньше `Retry-After` (`:84`).
- `ParseRegisterResponse`: нужен правдоподобный `token`; кривой `userId` — пустой (`:68`).
- `Token(wait)` ждёт выхода из `kRegistering` не дольше `wait` (`:199`).

### 401: `OnUnauthorized` (`server_auth.cpp:209`)

- Другой поток уже регистрируется — ждать до 20 с (`kReregisterWait`, `:19`).
- Токен уже сменился, пока шёл запрос — `true`, повторить.
- Первый 401 за запуск: очистить токен, `kRegistering`, поток удалит запись в диспетчере (`:161`)
  и зарегистрируется; запрос ждёт до 20 с.
- Второй 401 после перерегистрации: `gave_up_ = true`, `kError`, до перезапуска без сервера (`:230`).

Токен не пишется в журнал и не отдаётся наружу: `Info()` возвращает только состояние и `userId` (`:268`).

## 4. Heartbeat (`data/app_heartbeat`)

Тело (`HeartbeatBody`, `app_heartbeat.cpp:29`):

| Поле | Тип | Значение |
|---|---|---|
| `appVersion` | string | `SINTENCE_VERSION_STRING` |
| `state` | string | `ingame`, `champselect`, `idle`; при выходе `closed` |
| `riotId` | string \| null | свой Riot ID; без `#`, пустой или длиннее 64 байт — `null` (`:31`) |

Не-UTF-8 в Riot ID не ломает `dump` (`error_handler_t::replace`, `:39`).

```json
{"appVersion":"0.2.2","state":"idle","riotId":null}
```
(собрано из кода: `app_heartbeat.h:31`.)

Периоды (`app_heartbeat.cpp:15`–`:24`):

| Константа | Значение | Смысл |
|---|---|---|
| `kInterval` | 60 с | обычный пульс |
| `kNoTokenPoll` | 5 с | токена ещё нет — проверять чаще |
| `kStatePoll` | 3 с | проверка смены состояния; сменилось — отправить сразу |
| `kTimeoutSeconds` | 10 | таймаут пульса |
| `kClosedTimeoutSeconds` | 2 | `closed` при выходе, без повтора при обрыве |

Откуда состояние (`app/main.cpp:312`): фаза LCU `ChampSelect` → `champselect`; `GameStart`, `InProgress`,
`Reconnect` → `ingame`; иначе, если Live Client доступен → `ingame` (Riot ID берётся у активного игрока,
если LCU не дал); иначе `idle`. Свой Riot ID — `lobby.Snapshot().self_riot_id`.

`SendClosed` вызывается после `RunOverlay` (`main.cpp:461`), только если токен уже есть
(`Token(0ms)`, `app_heartbeat.cpp:131`). Одинаковая ошибка пишется в журнал один раз (`last_error_`, `:70`).

## 5. Самообновление

### Данные и проверки (`data/app_update`)

`ParseReleaseInfo` (`app_update.cpp:131`) — ответ `/v1/app/latest`:

| Поле JSON | Поле `ReleaseInfo` | Обязательно | Проверка |
|---|---|---|---|
| `version` | `version` | да | ровно `X.Y.Z`, каждая часть 1–6 цифр (`ParseVersion`, `:93`) |
| `file` | `file` | да | `[A-Za-z0-9._-]`, без `..` (`IsPlainFileName`, `:37`) |
| `sha256` | `sha256` | да | 64 hex, приводится к нижнему регистру |
| `bytes` | `bytes` | да | > 0 |
| `publishedAt` | `published_at` | нет | 0 |
| `notes` | `notes` | нет | `""` |

```json
{"version":"0.2.1","file":"sintence-0.2.1.exe","sha256":"<hex>","bytes":9170944,"publishedAt":1790500000,"notes":"..."}
```
(пример из комментария `app_update.h:18`.)

- `IsNewer(candidate, current)` — числовое сравнение; мусор с любой стороны — `false` (`:125`).
- `DownloadRelease` (`:274`): статус 200 → размер == `bytes` → `Sha256Hex` (BCrypt) == `sha256` → только потом
  запись в файл; не записалось — файл удаляется.

### Состояния `UpdateState` (`/api/health` → `update.state`)

`idle`, `checking`, `downloading`, `ready`, `applying`, `error`, `disabled` (`app_update.cpp:73`).

### Когда проверяется (`app/app_updater.cpp`)

| Повод | Задержка/таймауты | Ставит ли само | Ссылка |
|---|---|---|---|
| Запуск | через 5 с; latest 15 с, скачивание 120 с | да, когда `busy()` ложно (опрос раз в 10 с), кроме запуска после `--update-failed` | `:26`, `:29`, `:433`, `:447` |
| Кнопка «Проверить» (`RequestCheck`) | те же | нет — ждёт кнопки «Поставить» или выхода | `:159`, `:431` |
| Кнопка «Поставить» (`RequestApply`) | — | да, если `ready` и не `busy()`; иначе `kBusy`/`kNothing` | `:174` |
| «Выход» из трея (`OnExit`) | latest 5 с, скачивание 50 с, всего не дольше 70 с | да, `--no-restart` | `:39`–`:41`, `:196`, `:407` |

Периодической проверки нет (`app_updater.h:17`). `busy` — тот же сглаженный признак `has_content`,
что открывает оверлей: фазы `ChampSelect`, `GameStart`, `InProgress`, `Reconnect` или доступный
Live Client (`main.cpp:295`, `:347`).

Выключено (`disabled`), если нет сервера или `UpdateDisabledReason` не пуст (`main.cpp:117`): Debug-сборка;
`SINTENCE_NO_UPDATE=1`; порт не 8777 без `SINTENCE_UPDATE_TEST=1`. Выключенная копия `%TEMP%` не чистит
(`app_updater.cpp:244`).

### Аргументы командной строки (`ParseUpdateArgs`, `app_update.cpp:187`)

| Аргумент | Значение |
|---|---|
| `--apply-update --target <exe> --pid <pid>` | режим установщика; без `--target` или с плохим pid — `malformed`, выход с кодом 2 (`main.cpp:161`) |
| `--no-restart` | вместе с `--apply-update`: заменить exe, не запуская |
| `--updated-from <временный exe>` | запуск после обновления: удалить временный файл, показать уведомление |
| `--update-failed` | вместе с `--updated-from`: замена не удалась, в этом запуске само не ставить |

Аргументы читаются в UTF-16 через `CommandLineToArgvW` (`main.cpp:106`). Режим установщика проверяется
до `AcquireSingleInstance` — мьютекс порта держит обновляемая копия (`main.cpp:156`).

### Последовательность установки

```mermaid
sequenceDiagram
    participant A as "Sintence.exe (старый)"
    participant S as "Сервер /v1/app"
    participant T as "%TEMP%\sintence-update-X.exe"
    A->>S: "GET /v1/app/latest"
    S-->>A: "version, file, sha256, bytes"
    A->>S: "GET /v1/app/<file>"
    S-->>A: "exe"
    A->>A: "проверка bytes и sha256, запись в %TEMP%"
    A->>A: "ждать: busy() == false (раз в 10 с)"
    A->>T: "CreateProcess --apply-update --target <путь> --pid <pid>"
    A->>A: "RequestOverlayExit; не вышел за 10 с — std::_Exit"
    T->>T: "WaitForSingleObject(pid, 30 с)"
    T->>T: "CopyFileW поверх target (20 попыток по 250 мс)"
    alt "скопировалось"
        T->>A: "запуск target --updated-from <себя>"
    else "не скопировалось"
        T->>A: "запуск старого target --updated-from <себя> --update-failed"
    end
    A->>A: "Cleanup: удалить временный exe (40 попыток по 250 мс), уведомление у значка"
```

Числа: `kExitGrace` 10 с (`app_updater.cpp:45`), `kWaitOldProcessMs` 30 000 (`:52`), `kCopyAttempts` 20 и
`kCopyPauseMs` 250 (`:53`), `kDeleteAttempts` 40 и `kDeletePause` 250 мс (`:48`).

Откат: при неудаче копирования запускается старый exe с `--update-failed` (`:522`) — пользователь не остаётся
без приложения, а `previous_failed` выключает автоустановку в этом запуске (`app_updater.h:42`).
Цель должна быть абсолютным путём к существующему `.exe`, не самим установщиком (`:489`).
Уведомление: `startup_notice_title/text` из `ui_text` (`main.cpp:445`).

`Cleanup` удаляет `--updated-from`, только если имя — `sintence-update-<цифры и точки>.exe` и файл лежит
во `%TEMP%` (`app_updater.cpp:219`, `IsUpdateFileName` `app_update.cpp:241`); затем все такие файлы во `%TEMP%`,
кроме себя (`:249`).

## 6. Значок «S» (`data/active_users`)

- Обработчик `/api/profiles` зовёт `ActiveUsersUpdater::IsActive` — только кеш, без сети
  (`live_api_server.cpp:1523`, `active_users.cpp:140`).
- Неизвестный или устаревший Riot ID ставится в очередь, ответ — `false` до прихода данных.
- Фоновый поток берёт пачки по 10 и зовёт `GET /v1/users/active` (`active_users.cpp:163`).

| Константа | Значение | Ссылка |
|---|---|---|
| `kTtl` | 10 мин — сколько живёт ответ | `active_users.h:31` |
| `kRetry` | 1 мин — повтор после неудачи | `:32` |
| `kBatch` | 10 | `:33` |
| `kForget` | 30 мин — запись удаляется | `:34` |
| `kMaxEntries` | 500 | `:35` |

`ValidRiotId` повторяет проверку сервера: не пустой после обрезки, с `#`, без запятой, не длиннее
64 символов UTF-8 (`active_users.cpp:9`). Негодный — сразу неактивен, без запроса: один плохой ID дал бы
400 на всю пачку. Таймаут 3 с — потому что деструктор ждёт `join` текущего запроса (`server_client.cpp:323`).

Видимость своего значка: `GetShowBadge`/`SetShowBadge` (`/v1/users/me`); 403 не blocked у старого общего
токена → `legacy` (`server_client.cpp:395`).

## 7. Плашки как клиент сервера (`data/badge_store`)

`BadgeUpdater` качает `/v1/badges` сразу, затем раз в 10 мин; пока конфигурации нет или ошибка — раз в 1 мин
(`badge_store.cpp:16`). Тело принимается, если это объект с `schema == 1` и массивом `rules`; `version` — 0,
если нет (`:25`). Хранится только в памяти; не принято — прежнее остаётся.

## 8. Проводка в main.cpp

| Объект | Создаётся, если | Ссылка |
|---|---|---|
| `ServerAuth` + `Start()` | адрес сервера задан | `main.cpp:204` |
| `RiotApiClient` (`ru`, `europe`), `ProfileService` | есть сервер | `:211` |
| `PackUpdater`, `BadgeUpdater`, `AppHeartbeat`, `ActiveUsersUpdater` | есть сервер | `:228`, `:237`, `:311`, `:359` |
| `AppUpdater` | всегда (иначе `disabled`) | `:349` |

Выход — `std::_Exit(code)` без деструкторов служб (`main.cpp:475`): история может спать в ожидании Riot
до двух минут.

## Тесты

| Файл | Что проверяет |
|---|---|
| `tests/test_server_client.cpp` | нормализация адреса, `GatewayPath`, `ParseServerPlayers`, `ParsePackIndex`, `ParseServerHistory`, `IsErasedResponse`/`IsBlockedResponse`, `ParseActiveUsers`/`ParseShowBadge`, `LadderPath`; потокобезопасность `PackStore` |
| `tests/test_server_auth.cpp` | `CredentialTarget`, `IsPlausibleToken`, `SanitizeUserId`, ответ регистрации, паузы, тело heartbeat, сценарии `ServerAuth` с подменным `TokenVault`/`Registrar`: env-токен, токен из хранилища, регистрация, ошибка, 401 дважды, 403 blocked, имена состояний |
| `tests/test_app_update.cpp` | сравнение версий, `ParseReleaseInfo`, `Sha256Hex`, `ParseUpdateArgs` (пробелы, кириллица, неполные), `BuildCommandLine`, `IsUpdateFileName`, имена состояний |
| `tests/test_active_users.cpp` | `ActiveUsersCache`: очередь, пачки, TTL, повтор, негодный ID, вытеснение |
| `tests/test_badge_store.cpp` | `ParseBadgeConfigVersion`, `BadgeStore::Set` |

Не покрыто тестами: сетевой `Send` (401-повтор, обрыв) вживую, `CredentialVault` (настоящий диспетчер),
поток `AppHeartbeat`, `AppUpdater::Run`/`Apply`, `RunApplyUpdate`, `DownloadRelease`.

## Как менять

Новый вызов сервера:
1. Сначала маршрут на сервере (`sintence-data/api/server.py`) и контракт — см. [28](28-sintence-data-podrobno.md).
2. Функция в `data/server_client.h/.cpp`: путь через `ServerGet`/`ServerPost`, параметры через
   `UrlEncodePathSegment`, свой таймаут-константа с комментарием «почему столько».
3. Разбор ответа — отдельной чистой функцией `Parse...` (кривой JSON → `nullopt`), тест в `test_server_client.cpp`.
4. Если вызывать из фона — свой поток с `condition_variable` и `stop_` по образцу `BadgeUpdater`; помнить,
   что деструктор ждёт `join` запроса (таймаут короткий).
5. Отличать `no_token`, `status == 0` и коды в журнале, одинаковую ошибку писать один раз.
6. Новое поле в `/api/health` или `/api/*` — по правилам [5. Локальный API](05-lokalny-api.md).

## Подводные камни

- `ServerResponse.status == 0` бывает и при `no_token` — различать по флагу (`server_client.h:57`, `:61`).
- Регистрация не идемпотентна: повтор POST при обрыве создал бы второго пользователя
  (`retry_on_drop = false`, `server_auth.cpp:280`).
- После 403 blocked все запросы до перезапуска получают синтетический 403 без сети (`server_client.cpp:137`).
- С `SINTENCE_SERVER_TOKEN` на 401 нет перерегистрации (`server_auth.cpp:212`); пока переменная задана,
  свой токен не получить (SERVER.md).
- `AppUpdater::Apply(true)` при незакрывшемся окне делает `std::_Exit(0)` через 10 с (`app_updater.cpp:386`).
- Обновление найденное кнопкой само не ставится (`app_updater.cpp:431`).
- `HeartbeatBody` ограничивает `riotId` 64 байтами (`size()`), а `ValidRiotId` — 64 символами UTF-8
  (`app_heartbeat.cpp:33`, `active_users.cpp:18`): длинный кириллический ник в heartbeat станет `null`.

## Не проверено

- Что сервер отвечает именно 204 на heartbeat (код принимает 204 и 200, `app_heartbeat.cpp:63`).
- Поведение сервера на `/v1/history`, `/v1/ladder*`, `/v1/skins*` — смотрел только клиент.
- Комментарий `SanitizeUserId` обещает «u и латиница/цифры», код проверяет только буквы-цифры без префикса
  (`credential_store.h:54` против `.cpp:145`) — что выдаёт сервер, не сверял.
