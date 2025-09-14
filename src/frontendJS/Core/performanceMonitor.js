const PerformanceMonitor = {
    enabled: false,
    timers: new Map(),

    start(label) {
        if (this.enabled) this.timers.set(label, performance.now());
        return this;
    },

    end(label) {
        if (!this.enabled) return 0;
        const start = this.timers.get(label);
        if (start) {
            const duration = performance.now() - start;
            this.timers.delete(label);
            console.log(`${label}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    },

    enable() { this.enabled = true; },
    disable() { this.enabled = false; }
};

export default PerformanceMonitor;