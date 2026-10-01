export declare const PREFERENCE_FIELDS: Readonly<{
    readonly compactionMode: {
        readonly choices: readonly ["dsh", "cloud"];
        readonly default: "dsh";
        readonly error: "Invalid compaction mode";
    };
    readonly connectionMode: {
        readonly choices: readonly ["sse", "websocket"];
        readonly default: "sse";
        readonly error: "Invalid connection mode";
    };
    readonly subagentBackend: {
        readonly choices: readonly ["dsh", "codex"];
        readonly default: "dsh";
        readonly error: "Invalid subagent backend";
    };
    readonly quickQuotaMode: {
        readonly choices: readonly ["off", "percent", "bar", "forecast"];
        readonly error: "Invalid quick quota preference";
    };
    readonly searchProvider: {
        readonly choices: readonly ["auto", "dsh", "codex"];
        readonly default: "auto";
        readonly error: "Invalid search provider preference";
    };
    readonly speedMode: {
        readonly choices: readonly ["standard", "fast"];
        readonly default: "standard";
        readonly error: "Invalid speed mode preference";
    };
    readonly outputVerbosity: {
        readonly choices: readonly ["default", "low", "medium", "high"];
        readonly default: "default";
        readonly error: "Invalid output verbosity preference";
    };
    readonly contextMode: {
        readonly choices: readonly ["standard", "extended", "custom"];
        readonly default: "standard";
        readonly error: "Invalid context mode preference";
    };
}>;
