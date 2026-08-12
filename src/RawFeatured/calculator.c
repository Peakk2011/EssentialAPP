#include <emscripten/emscripten.h>
#include <math.h>
#include <stdbool.h>
#include <string.h>
#include <stdlib.h>
#include "calculator_error.c"

EMSCRIPTEN_KEEPALIVE
double add(double a, double b) { return a + b; }
EMSCRIPTEN_KEEPALIVE
double subtract(double a, double b) { return a - b; }
EMSCRIPTEN_KEEPALIVE
double multiply(double a, double b) { return a * b; }
EMSCRIPTEN_KEEPALIVE
double divide(double a, double b) { return b == 0 ? NAN : a / b; }
EMSCRIPTEN_KEEPALIVE
double percent(double a) { return a / 100.0; }
EMSCRIPTEN_KEEPALIVE
double toggle_sign(double a) { return -a; }
EMSCRIPTEN_KEEPALIVE
double floor_value(double a) { return floor(a); }
EMSCRIPTEN_KEEPALIVE
double ceil_value(double a) { return ceil(a); }
EMSCRIPTEN_KEEPALIVE
int is_zero(double a) { return a == 0.0 ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE
int is_integer(double a) { return floor(a) == a ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE
int is_negative(double a) { return a < 0 ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE
int is_positive(double a) { return a > 0 ? 1 : 0; }
EMSCRIPTEN_KEEPALIVE
double power(double base, double exp) { return pow(base, exp); }
EMSCRIPTEN_KEEPALIVE
double sqrt_value(double a) { return a < 0 ? NAN : sqrt(a); }
EMSCRIPTEN_KEEPALIVE
double reciprocal(double a) { return a == 0 ? NAN : 1.0 / a; }
EMSCRIPTEN_KEEPALIVE
double truncate_value(double a) { return (double)((long long)a); }
EMSCRIPTEN_KEEPALIVE
void *wasm_malloc(size_t size) { return malloc(size); }
EMSCRIPTEN_KEEPALIVE
void wasm_free(void *ptr) { free(ptr); }
EMSCRIPTEN_KEEPALIVE
void write_double(double *ptr, double value) { *ptr = value; }
EMSCRIPTEN_KEEPALIVE
double read_double(double *ptr) { return *ptr; }

int main() { return 0; }

// Compile using the following command:
// emcc calculator.c -o calculator.wasm -s STANDALONE_WASM -s EXPORTED_FUNCTIONS="['_add','_subtract','_multiply','_divide','_percent','_toggle_sign','_floor_value','_ceil_value','_is_zero','_is_integer','_is_negative','_is_positive','_power','_sqrt_value','_reciprocal','_truncate_value']" -s EXPORTED_RUNTIME_METHODS="['cwrap','ccall']" --no-entry