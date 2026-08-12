#include <emscripten/emscripten.h>
#include <math.h>
#include <string.h>
#include <stdlib.h>

EMSCRIPTEN_KEEPALIVE
const char* check_result(double value) {
    if (isnan(value)) return "NaN";
    if (isinf(value)) return value > 0 ? "Infinity" : "-Infinity";
    return NULL;
}

EMSCRIPTEN_KEEPALIVE
double safe_divide(double a, double b, char* err, size_t err_len) {
    if (b == 0) {
        strncpy(err, "Divide by zero", err_len - 1);
        err[err_len - 1] = 0;
        return NAN;
    }
    double result = a / b;
    const char* msg = check_result(result);
    if (msg) {
        strncpy(err, msg, err_len - 1);
        err[err_len - 1] = 0;
    } else {
        err[0] = 0;
    }
    return result;
}

EMSCRIPTEN_KEEPALIVE
double safe_sqrt(double a, char* err, size_t err_len) {
    if (a < 0) {
        strncpy(err, "Negative sqrt", err_len - 1);
        err[err_len - 1] = 0;
        return NAN;
    }
    double result = sqrt(a);
    const char* msg = check_result(result);
    if (msg) {
        strncpy(err, msg, err_len - 1);
        err[err_len - 1] = 0;
    } else {
        err[0] = 0;
    }
    return result;
}
