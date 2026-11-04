# 10. Тесты

**doctest** (`third_party/doctest.h`). Все тесты — один бинарник `sintence_tests`,
файлы `tests/test_*.cpp` подхватываются сами. Тесты **не ходят в сеть, не требуют
сервера и запущенной игры**: данные — JSON прямо в коде или в `tests/data/`.

## Запуск

```powershell
.\build.ps1 -Tests                                         # собрать и прогнать
build\tests\Release\sintence_tests.exe                     # весь набор
build\tests\Release\sintence_tests.exe --source-file="*hotkey*"      # один файл
build\tests\Release\sintence_tests.exe --test-case="*ARAM*"          # по имени
build\tests\Release\sintence_tests.exe --list-test-cases             # список
```

В Debug (`-Debug`) путь `build\tests\Debug\...` и включён ASan.

## Как выглядит тест

`tests/test_game_mode.cpp`:

```cpp
#include "doctest.h"
#include "game_mode.h"

using sintence::ModeOfQueue;

TEST_CASE("ModeOfQueue: ARAM, MAYHEM, остальное CLASSIC") {
    CHECK(ModeOfQueue(450) == "ARAM");
    CHECK(ModeOfQueue(2400) == "MAYHEM");
    CHECK(ModeOfQueue(420) == "CLASSIC");
}
```

- `TEST_CASE("имя")` — один сценарий, имя по-русски описывает правило.
- `CHECK(...)` — проверка, продолжает при провале; `REQUIRE(...)` — останавливает
  тест (нужно, когда дальше разыменование).
- `CHECK_FALSE(x)` — ожидаю ложь.

## Что тестировать и как

| Слой | Как |
|---|---|
| `core/`, `analysis/` | таблица «вход → выход», граничные значения |
| `data/*_json` | настоящий ответ в `tests/data/` или строка прямо в тесте; проверь **отсутствующие поля** и `null` |
| Сервис с источником | подмени источник своим классом, реализующим интерфейс из `core/` |
| Время | передай часы/время аргументом (см. `test_cached_live_game_source.cpp`) |
| `app/` (окна) | не тестируется — потому логику выносят в `core/` |

Фикстуры: `tests/data/allgamedata_practice.json` — **настоящий** ответ Live Client из
Practice Tool; рядом `allgamedata_practice_towers.json` (с объектами карты). Путь в тестах — макрос `SINTENCE_TEST_DATA_DIR`.

## Порядок работы (TDD в малом)

1. Пиши тест на желаемое поведение — он красный.
2. Минимальный код — зелёный.
3. Рефакторинг — тест остаётся зелёным.
4. Перед коммитом — **весь** набор (`sintence_tests.exe`), а не только свой файл.

## Чего не делать

- Не вызывай реальную сеть и реальную игру в тестах.
- Не подгоняй ожидаемое значение под вывод, не поняв, почему так.
- Не отключай упавший тест «на время».
