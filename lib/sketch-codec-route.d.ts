import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection';
export declare function registerSketchCodec(connection: Pick<HostConnectionHandle, 'fetch'>): () => Promise<void>;
