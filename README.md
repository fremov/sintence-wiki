# Sintence Wiki

**Сайт:** https://fremov.github.io/sintence-wiki/ (GitHub Pages)

Учебная вики по устройству Sintence — для тех, кто знает основы C++ и хочет
доработать приложение сам. Это **не замена** документам проекта, а путеводитель
по ним: здесь «что это и как связано», там — «почему так решили»
(`sintence-app/ARCHITECTURE.md` — главный документ, всегда главнее вики).

Снимок: приложение `0.2.31`, 2026-11-08.

## С чего начать

Читай по порядку: первые четыре страницы обязательны, остальные выбирай по задаче.

| # | Страница | О чём |
|---|---|---|
| 1 | [Обзор](content/01-obzor.md) | что делает продукт, из каких частей состоит, как они общаются |
| 2 | [Инструменты и сборка](content/02-instrumenty-i-sborka.md) | что установить, как собрать, запустить, отладить |
| 3 | [Карта кода](content/03-karta-koda.md) | слои `core/data/analysis/app`, куда класть новый код |
| 4 | [Путь данных](content/04-put-dannyh.md) | запуск `main.cpp`, живой матч, лобби, профиль, пак — шаг за шагом |
| 5 | [Локальный API](content/05-lokalny-api.md) | границы C++ ↔ интерфейс, версии контракта |
| 6 | [Окна и интерфейс](content/06-okna-i-interfeys.md) | WebView2, оверлей, трей, sintence-web |
| 7 | [Сервер](content/07-server.md) | sintence-data: что там и чем приложение от него зависит |
| 8 | [Правила Riot](content/08-pravila-riot.md) | что нельзя, даже если очень хочется |
| 9 | [C++ в проекте](content/09-cpp-v-proekte.md) | приёмы языка, которые тут встречаются, с живыми примерами |
| 10 | [Тесты](content/10-testy.md) | doctest, как писать и запускать |
| 11 | [Работа с git](content/11-rabota-s-git.md) | твоя ветка, коммиты, как не сломать чужое |
| 12 | [Первые задачи](content/12-pervye-zadachi.md) | лесенка упражнений от простого к сложному |
| 13 | [Live Client](content/13-live-client-json.md) | `allgamedata`, защитный JSON-разбор и кеш живого матча |
| 14 | [LCU и лобби](content/14-lcu-klient.md) | lockfile, фазы клиента, выбор чемпиона и экран загрузки |
| 15 | [Запись в клиент](content/15-lcu-zapis.md) | руны, заклинания и наблюдение только по клику |
| 16 | [Контракт матча и лобби](content/16-kontrakt-match-lobby-profili.md) | ответы health, live, lobby и profiles |
| 17 | [Контракт советов](content/17-kontrakt-sovety-spravochniki.md) | preferences, counters, meta, trends и badges |
| 18 | [Контракт истории](content/18-kontrakt-istoriya-ladder-prochee.md) | профиль, матчи, timeline, лестница и служебные маршруты |
| 19 | [Интерфейс и C++](content/19-interfeys-i-cpp-vzaimodeistvie.md) | запросы, poll, zod и сообщения WebView |
| 20 | [Окно оверлея](content/20-overlay-okno.md) | Win32, фокус, клавиши, bounds и lockdown |
| 21 | [Клиент сервера](content/21-klient-servera-sintence.md) | токен, heartbeat, фоновые службы и обновление |
| 22 | [Riot API через шлюз](content/22-riot-api-shlyuz.md) | методы Riot, кеш и адаптеры `riot_api_json` |
| 23 | [Пак предпочтений](content/23-pak-predpochtenij.md) | схема пака, fallback, мета, тренды и плашки |
| 24 | [История и SQLite](content/24-istoriya-i-sqlite.md) | очереди загрузки, хранилище в памяти и timeline |
| 25 | [Анализ и метрики](content/25-analiz-metriki.md) | чистые функции `analysis/`, стиль, пати и MMR |
| 27 | [sintence-web подробно](content/27-sintence-web-podrobno.md) | Vue, composable, zod, моки и профиль |
| 28 | [sintence-data подробно](content/28-sintence-data-podrobno.md) | службы, база, шлюз, краулер, пак и пульт |
| 29 | [Сборка и релиз](content/29-sborka-ci-reliz.md) | CMake, embedding, Debug, CI и публикация |
| 30 | [Каталог тестов](content/30-katalog-testov.md) | все тестовые файлы, фикстуры и приёмы |
| 32 | [Диагностика](content/32-diagnostika.md) | журнал, статусы, порты и порядок поиска сбоя |
| — | [Словарь](content/99-slovar.md) | LCU, perk, puuid, пак, оверлей… |

## Как пользоваться при работе

1. Хочешь понять общий поток — начни со страницы 4 и иди по ссылкам на файлы.
2. Перед правкой пройди чек-лист страницы 3 («Куда класть код») и страницы 8
   (правила Riot).
3. Для конкретной подсистемы используй подробные страницы 13–32; они содержат
   ссылки на символы и реальные границы кода.
4. Закончил — собери затронутую часть и прогони тесты (страницы 2, 10 и 30).
5. Нашёл расхождение вики с кодом — **верь коду**, а вики поправь (ты в этом
   репозитории хозяин).

## Где живёт

Это отдельный публичный репозиторий `fremov/sintence-wiki`, подмодуль
`sintence-workspace/sintence-wiki`. Рядом лежат остальные части проекта.

## Сайт вики

Страницы лежат в `content/*.md`, сайт собирается из них автоматически.

Стек: Vue 3, Vite, TypeScript, Tailwind CSS 4 (+ typography), Pinia, Vue Router,
markdown-it, Shiki (подсветка кода), Mermaid (диаграммы), Fuse.js (поиск по Ctrl+K).

```powershell
npm install
npm run dev       # разработка: http://localhost:5173/sintence-wiki/
npm run build     # проверка типов + сборка в dist/
npm run preview   # посмотреть собранное
```

Деплой: push в `main` запускает `.github/workflows/pages.yml` и публикует `dist/`
на GitHub Pages. Новая страница — файл `content/NN-имя.md` с заголовком `# N. Название`;
чекбоксы-задачи пишутся как `- [ ] текст` (прогресс хранится в браузере читателя).
