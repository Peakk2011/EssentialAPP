/*
    Copyright © 2025 Mint teams

    Kavin
    The generic Node.js process watcher

    This file is part of EssentialAPP.
    EssentialAPP is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    EssentialAPP is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with EssentialAPP. If not, see <https://www.gnu.org/licenses/>.
*/

#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>
#include <string.h>
#include <signal.h>
#include <sys/wait.h>

const useconds_t FILE_INTERVAL = 100000; // 0.1s

typedef enum {
    STATE_RUNNING,
    STATE_SHUTTING_DOWN,
    STATE_FORCE_KILLING,
    STATE_RESTARTING
} WatcherState;

typedef struct {
    const char *cmd;
    const char *file_to_watch;
    pid_t process_id;
    time_t last_mtime;
    volatile sig_atomic_t running;
    WatcherState state;
    struct timespec shutdown_start_time;
    unsigned long restart_count;
} Watcher;

// Global pointer to the current watcher
static Watcher *g_watcher = NULL;

void signal_handler(int signum) {
    // async-signal-safe fn
    if (g_watcher) {
        g_watcher->running = 0;
        if (g_watcher->process_id > 0) {
            kill(-g_watcher->process_id, SIGTERM);
        }
    }
}

time_t get_mtime(const char *filepath) {
    struct stat st;
    return (stat(filepath, &st) == 0) ? st.st_mtime : 0;
}

void watcher_initiate_shutdown(Watcher *watcher) {
    if (watcher->process_id <= 0) return;
    kill(-watcher->process_id, SIGTERM);
    clock_gettime(CLOCK_MONOTONIC, &watcher->shutdown_start_time);
}

pid_t watcher_start_process(const char *process_cmd) {
    pid_t pid = fork();
    
    if (pid == 0) {
        // Child process
        setpgid(0, 0);
        execl("/bin/sh", "sh", "-c", process_cmd, (char *)NULL);
        perror("execl failed"); // If execl returns, it's an error
        exit(127); 
    } else if (pid > 0) {
        // Parent process
        setpgid(pid, pid);
    }
    return pid;
}

void watcher_restart(Watcher *watcher) {
    printf("[Watcher info] Starting application\n");
    watcher->process_id = watcher_start_process(watcher->cmd);
    
    if (watcher->process_id > 0) {
        printf("[Watcher info] Started [PID: %d]\n", watcher->process_id);
    } else {
        fprintf(stderr, "[Watcher info] Failed to start\n");
    }
}

void watcher_run(Watcher *watcher) {
    watcher->last_mtime = get_mtime(watcher->file_to_watch);
    if (watcher->last_mtime == 0) {
        fprintf(stderr, "[Watcher info] Error: %s not found\n", watcher->file_to_watch);
        return;
    }

    printf("[Watcher info] Watching: %s\n", watcher->file_to_watch);
    printf("[Watcher info] Command: %s\n", watcher->cmd);

    watcher->state = STATE_RESTARTING; // Initial start

    while (watcher->running) {
        int status;
        pid_t result;

        switch (watcher->state) {
            case STATE_RUNNING:
                // Check if child died unexpectedly
                result = waitpid(watcher->process_id, &status, WNOHANG);
                if (result == watcher->process_id) {
                    printf("[Watcher info] Process died unexpectedly. Restarting...\n");
                    watcher->state = STATE_RESTARTING;
                    // Set state and continue loop
                    continue;
                }

                // Check for file modification
                time_t current_mtime = get_mtime(watcher->file_to_watch);
                if (current_mtime != watcher->last_mtime && watcher->last_mtime != 0) {
                    printf("[Watcher info] Change detected! Restarting...\n");
                    watcher->last_mtime = current_mtime;
                    watcher_initiate_shutdown(watcher);
                    watcher->state = STATE_SHUTTING_DOWN;
                }
                break;

            case STATE_SHUTTING_DOWN:
                result = waitpid(watcher->process_id, &status, WNOHANG);
                if (result == watcher->process_id) {
                    watcher->state = STATE_RESTARTING; // Ready to restart now
                } else {
                    struct timespec now;
                    clock_gettime(CLOCK_MONOTONIC, &now);
                    if (now.tv_sec - watcher->shutdown_start_time.tv_sec >= 2) {
                        printf("[Watcher info] Process did not respond to SIGTERM, sending SIGKILL...\n");
                        kill(-watcher->process_id, SIGKILL);
                        watcher->state = STATE_FORCE_KILLING;
                    }
                }
                break;

            case STATE_FORCE_KILLING:
                result = waitpid(watcher->process_id, &status, WNOHANG);
                if (result == watcher->process_id) {
                    watcher->state = STATE_RESTARTING; // Forcefully terminated
                }
                break;

            case STATE_RESTARTING:
                if (watcher->process_id > 0) {
                    waitpid(watcher->process_id, NULL, 0);
                    watcher->process_id = 0;
                }
                watcher_restart(watcher);
                if (watcher->process_id > 0) watcher->restart_count++;
                watcher->state = STATE_RUNNING;
                break;
        }

        if (watcher->running) {
            usleep(FILE_INTERVAL);
        }
    }
}

int main(int argc, char *argv[]) {
    if (argc < 3) {
        fprintf(stderr, "Usage: %s <nodejs_command> <file_to_watch>\n", argv[0]);
        fprintf(stderr, "Example: %s \"npm start\" src/main.js\n", argv[0]);
        return 1;
    }
    
    Watcher watcher = {
        .cmd = argv[1],
        .file_to_watch = argv[2],
        .process_id = 0,
        .last_mtime = 0,
        .running = 1,
        .state = STATE_RESTARTING,
        .restart_count = 0
    };
    g_watcher = &watcher;

    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    watcher_run(&watcher);
    
    // Cleanup after the loop
    if (watcher.process_id > 0) {
        printf("\n[Watcher info] Shutting down the process (PID: %d)...\n", watcher.process_id);
        waitpid(watcher.process_id, NULL, 0);
        // Wait for the child to terminate
    }
    
    printf("\n[Watcher info] Stopped. Total restarts: %lu\n", watcher.restart_count);
    return 0;
}

/*
    gcc -O3 -march=native -flto -ffast-math -o kavin kavin.c

    Usage: ./kavin <nodejs_command> <file_to_watch>
    Example: ./kavin "npm start" src/main.js
*/