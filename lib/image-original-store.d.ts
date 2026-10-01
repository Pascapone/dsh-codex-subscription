import type { OriginalImageRef } from './image-original-contract.js';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
export declare const ORIGINAL_IMAGE_DIRECTORY = "dsh-codex-subscription/images/v1";
export declare function pngDimensions(data: unknown): {
    width: number;
    height: number;
};
export declare class OriginalImageStore {
    root: string;
    constructor(dshHome?: Parameters<typeof resolveDshHome>[0]);
    directory(assetId: string): string;
    originalPath(assetId: string): string;
    save(sessionId: unknown, data: unknown, name?: string): Promise<OriginalImageRef>;
    remove(ref: Pick<OriginalImageRef, 'assetId'> | undefined): Promise<void>;
    read(sessionId: unknown, assetId: string, inherited?: unknown): Promise<{
        ref: OriginalImageRef;
        data: Uint8Array<ArrayBuffer>;
    } | undefined>;
    chunk(sessionId: unknown, assetId: string, offset: number, inherited?: unknown): Promise<{
        ref: OriginalImageRef;
        offset: number;
        encoded: string;
        done: boolean;
    } | undefined>;
}
