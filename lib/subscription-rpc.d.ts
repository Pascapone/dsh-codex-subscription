import type { ConnectionRpcResult } from '@deepseek-ai/dsh-client-connection';
import type { createCodexRpcHandler } from './login-coordinator.js';
import type { createQuotaForecastReader } from './quota-forecast.js';
import type { createCodexResetCreditService } from './reset-credits.js';
import type { createOfficialModelCatalog } from './model-catalog.js';
import type { OriginalImageStore } from './image-original-store.js';
import type { inheritedOriginalImageRef } from './image-original-contract.js';
import type { createRuntimeManagement } from './runtime-management.js';
import type { createCodexTranscriptionProvider } from './codex-transcription.js';
import type { SpeedMode } from './settings-types.js';
interface RpcHandlerOptions {
    authHandler: ReturnType<typeof createCodexRpcHandler>;
    usageReader: Pick<ReturnType<typeof createQuotaForecastReader>, 'read' | 'clearScope' | 'clear' | 'clearCache'>;
    resetCreditService: ReturnType<typeof createCodexResetCreditService>;
    preferences: {
        status(): Record<string, unknown>;
        update(patch: Record<string, unknown>): Promise<unknown>;
        setSpeed(sessionId: string, speedMode: SpeedMode): Promise<unknown>;
    };
    runtimeManagement?: ReturnType<typeof createRuntimeManagement>;
    diagnosticsReader(): unknown | Promise<unknown>;
    modelCatalog?: Pick<ReturnType<typeof createOfficialModelCatalog>, 'refresh' | 'clear'>;
    originalImages?: Pick<OriginalImageStore, 'chunk'>;
    resolveInheritedOriginal?: (sessionId: string, assetId: string) => ReturnType<typeof inheritedOriginalImageRef>;
    closeConnections?: () => void;
    transcriptionEnabled?: () => boolean;
    transcribeAudio: ReturnType<typeof createCodexTranscriptionProvider>;
}
export declare function createSubscriptionRpcHandler({ authHandler, usageReader, resetCreditService, preferences, runtimeManagement, diagnosticsReader, modelCatalog, originalImages, resolveInheritedOriginal, closeConnections, transcriptionEnabled, transcribeAudio }: RpcHandlerOptions): (endpoint: string, input: unknown, signal: AbortSignal) => Promise<ConnectionRpcResult<unknown>>;
export {};
