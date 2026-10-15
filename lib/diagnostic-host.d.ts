import type { SlotCore } from '@deepseek-ai/dsh-client-ui-slots';
export declare function projectHostSlots(slots?: Partial<Pick<SlotCore, 'snapshot'>>): {
    name: string;
    declared: boolean;
    truncated: boolean;
    occupants: {
        registrant: string;
        identity: string;
        active: boolean;
    }[];
}[] | undefined;
export declare function createHostDiagnostics(): {
    register(slots: Partial<Pick<SlotCore, "snapshot">>): () => void;
    collect(): Promise<{
        version: string;
        generatedAt: string;
        checks: import("./diagnostic-types.js").DiagnosticCheck[];
        topology: {
            scope: string;
            slots: NonNullable<ReturnType<typeof projectHostSlots>>;
        }[];
        truncated: boolean;
        interpretation: string;
    }>;
};
