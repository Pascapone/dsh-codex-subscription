export declare const MODEL_CONTROL_DEFAULTS: {
    readonly codexModelPicker: true;
    readonly runtimeOptions: true;
};
export declare const PREFERENCE_FIELDS: Readonly<{
    readonly codexBasePrompt: {
        readonly choices: readonly [false, true];
        readonly default: false;
        readonly error: "Invalid DSH model guidance preference";
    };
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
    readonly reviewModel: {
        readonly choices: readonly ["session", "official"];
        readonly default: "session";
        readonly error: "Invalid review model";
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
        readonly choices: readonly ["standard", "fast", "ultrafast"];
        readonly default: "standard";
        readonly error: "Invalid speed mode preference";
    };
    readonly outputVerbosity: {
        readonly choices: readonly ["default", "low", "medium", "high"];
        readonly default: "default";
        readonly error: "Invalid output verbosity preference";
    };
    readonly inputImageDetail: {
        readonly choices: readonly string[];
        readonly default: "auto";
        readonly error: "Invalid input image detail preference";
    };
    readonly streamIdleTimeoutMinutes: {
        readonly choices: readonly number[];
        readonly default: 10;
        readonly error: "Invalid stream idle timeout preference";
    };
    readonly contextMode: {
        readonly choices: readonly ["standard", "extended", "custom"];
        readonly default: "standard";
        readonly error: "Invalid context mode preference";
    };
}>;
