#include <emscripten/emscripten.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define MAX_LAPS 100

typedef struct {
    uint8_t running;
    uint64_t elapsed;
    uint64_t last_tick;
    uint64_t *laps;
    uint32_t lap_count;
} Stopwatch;

static Stopwatch *sw = NULL;

EMSCRIPTEN_KEEPALIVE
Stopwatch* stopwatch_create() {
    if (sw) free(sw->laps), free(sw);
    sw = (Stopwatch*)malloc(sizeof(Stopwatch));
    sw->running = 0;
    sw->elapsed = 0;
    sw->last_tick = 0;
    sw->lap_count = 0;
    sw->laps = (uint64_t*)calloc(MAX_LAPS, sizeof(uint64_t));
    return sw;
}

// free memory
EMSCRIPTEN_KEEPALIVE
void stopwatch_destroy() {
    if (sw) {
        free(sw->laps);
        free(sw);
        sw = NULL;
    }
}

EMSCRIPTEN_KEEPALIVE
void stopwatch_tick(uint64_t now_ms) {
    if (sw && sw->running) {
        sw->elapsed += (now_ms - sw->last_tick);
        sw->last_tick = now_ms;
    }
}

EMSCRIPTEN_KEEPALIVE
void stopwatch_start(uint64_t now_ms) {
    if (sw && !sw->running) {
        sw->running = 1;
        sw->last_tick = now_ms;
    }
}

EMSCRIPTEN_KEEPALIVE
void stopwatch_stop(uint64_t now_ms) {
    if (sw && sw->running) {
        stopwatch_tick(now_ms);
        sw->running = 0;
    }
}

EMSCRIPTEN_KEEPALIVE
void stopwatch_reset() {
    if (sw) {
        sw->running = 0;
        sw->elapsed = 0;
        sw->last_tick = 0;
        sw->lap_count = 0;
        memset(sw->laps, 0, MAX_LAPS * sizeof(uint64_t));
    }
}

EMSCRIPTEN_KEEPALIVE
void stopwatch_lap() {
    if (sw && sw->lap_count < MAX_LAPS) {
        sw->laps[sw->lap_count++] = sw->elapsed;
    }
}

EMSCRIPTEN_KEEPALIVE
uint64_t stopwatch_get_elapsed() {
    return sw ? sw->elapsed : 0;
}

EMSCRIPTEN_KEEPALIVE
uint32_t stopwatch_get_lap_count() {
    return sw ? sw->lap_count : 0;
}

EMSCRIPTEN_KEEPALIVE
uint64_t stopwatch_get_lap(uint32_t idx) {
    if (sw && idx < sw->lap_count) {
        return sw->laps[idx];
    }
    return 0;
}

int main() {
    stopwatch_create();
    return 0;
}

// emsdk_env.bat
// emcc clockstopwatch.c -O3 -s WASM=1 -s STANDALONE_WASM -s EXPORTED_FUNCTIONS="['_stopwatch_create','_stopwatch_destroy','_stopwatch_tick','_stopwatch_start','_stopwatch_stop','_stopwatch_reset','_stopwatch_lap','_stopwatch_get_elapsed','_stopwatch_get_lap_count','_stopwatch_get_lap']" -s EXPORTED_RUNTIME_METHODS="['cwrap','ccall']" --no-entry -o clockstopwatch.wasm