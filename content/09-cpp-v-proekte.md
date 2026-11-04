# 9. C++ в проекте

Приёмы языка, которые тут встречаются, — каждый с местом, где его увидеть.
Стандарт — **C++23**.

## 1. Интерфейс через абстрактный класс

`core/live_game.h`:

```cpp
class LiveGameSource {
public:
    virtual ~LiveGameSource() = default;
    virtual std::string Name() const = 0;
    virtual bool IsAvailable() const = 0;
    virtual std::optional<LiveGame> LoadGame() const = 0;
    LiveGameSource(const LiveGameSource&) = delete;      // копировать нельзя
    LiveGameSource& operator=(const LiveGameSource&) = delete;
protected:
    LiveGameSource() = default;
};
```

Реализации: `LiveClientSource` (настоящая игра) и `CachedLiveGameSource` (обёртка-кеш,
**декоратор** — сама реализует тот же интерфейс и держит ссылку на другой источник).
Остальной код знает только `LiveGameSource&`. Виртуальный деструктор обязателен, иначе
удаление через указатель на базу — неопределённое поведение.

## 2. `std::optional` вместо «ошибки или нуля»

`std::optional<LiveGame> LoadGame()` — «матч есть» либо `std::nullopt`. Вне матча это
нормальная ситуация, а не исключение. Проверка: `if (auto game = source.LoadGame()) { game->... }`.

## 3. Идиома pimpl / спрятанный тип

`data/live_client_source.h` объявляет `struct Connection;` без определения, а
определение (с `httplib::SSLClient`) — в `.cpp`. Заголовок не тянет `httplib.h`
в каждый файл и не пропускает тип библиотеки за границу слоя. Поэтому деструктор
объявлен в `.h`, а `= default` стоит в `.cpp`: `unique_ptr` на неполный тип
требует видеть определение там, где он удаляется.

## 4. RAII и `std::lock_guard`

```cpp
const std::lock_guard<std::mutex> lock(connection_mutex_);
```

Мьютекс освобождается при выходе из области видимости — даже при раннем `return`
или исключении. Никаких ручных `unlock`. Поле `mutable std::mutex` позволяет
блокировать внутри `const`-метода (логически объект не меняется).

## 5. Потоки и общее состояние

Приложение многопоточное: HTTP-сервер обслуживает запросы в пуле потоков, службы
(`PackUpdater` и др.) — каждая в своём потоке, окна — в главном. Правило:
**любое поле, которое читают и пишут разные потоки, защищено мьютексом**. Смотри
`CachedLiveGameSource`: `std::condition_variable` + флаг `game_loading_` — шаблон
**single-flight** (параллельные запросы ждут один настоящий).

## 6. Время как аргумент

`ContentDebounce::Update(bool raw, time_point now)` не вызывает `now()` сам. Поэтому
тест передаёт любое время, не ожидая реальных секунд. Тот же приём в
`CachedLiveGameSource` (`Clock` — `std::function`).

## 7. `std::format` и журнал

```cpp
Log("сервер данных: http://127.0.0.1:{}/api/live", server.Port());
```

`std::format` — проверка строки формата во время компиляции. `Log` — шаблонная
обёртка в `data/app_log.h`. `printf`/`std::println`/`std::cout` в `src/` не используй.

## 8. Строки и кодировки

- Внутри — UTF-8 в `std::string`. Файлы исходников — UTF-8 (`/utf-8`).
- Windows API ждёт UTF-16 (`std::wstring`, `wchar_t*`). Преобразование — на границе
  (в `app/`). Пути с кириллицей: `CommandLineToArgvW`, а не `argv`.
- `std::string_view` в параметрах — «посмотреть строку, не копируя».

## 9. Типы, а не «сырые» значения

`struct Hotkey { uint32_t vk; bool ctrl, shift, alt; }` с
`friend bool operator==(...) = default;` (C++20) — сравнение «бесплатно».
`enum class Team { Order, Chaos }` — строгий перечислимый тип, не конвертируется в int.
`inline constexpr Hotkey kDefaultPeekKey{...}` — константа времени компиляции.

## 10. `std::span`

`FitOverlayBounds(window, std::span<const ScreenRect> monitors, ...)` принимает любой
непрерывный набор (vector, массив) без копирования.

## 11. Владение

Предпочитай значение → `unique_ptr` → `shared_ptr` → сырой указатель «только
смотрит». В `main.cpp` видно все варианты: `std::make_unique` для служб,
`std::shared_ptr<RiotApiClient>`, потому что клиент делят несколько служб; сырой
`const LiveGameSource&` — «не владею, ты обязан пережить меня».

## 12. JSON

`nlohmann::json`. Разбор чужих данных — **защитный**: поле может отсутствовать, быть
`null` или другого типа. Смотри `data/live_client_json.cpp`: `value("key", default)`,
`contains`, `is_string`. Падать на неожиданном ответе игры нельзя — вернуть `nullopt`.

## 13. Предупреждения и санитайзеры как учитель

`/W4` + ASan в Debug. Типичные находки: сравнение знакового и беззнакового,
неиспользуемый параметр (`(void)port;`), выход за границу `vector`, висящая ссылка.
Читай каждое сообщение — это бесплатное ревью.

## 14. Условная компиляция и Windows

- `#ifndef NDEBUG` — код только для Debug (в `main.cpp` Debug не обновляется сам).
- `_dupenv_s` вместо `getenv` — «безопасный» вариант MSVC; `_MSC_VER` отделяет его от других компиляторов.
- `UNICODE` включает `W`-варианты WinAPI: строки там `wchar_t` (UTF-16), поэтому в `app/` есть преобразования.
- Копирование выключено у служб с потоками (`PackUpdater`): поток нельзя «скопировать» вместе с объектом.

## Книги и ресурсы (по мере необходимости)

- cppreference.com — справочник по `std::`-типам.
- «A Tour of C++» (Страуструп) — быстрый обзор современного языка.
- Core Guidelines (isocpp.github.io/CppCoreGuidelines) — когда сомневаешься «как правильно».
