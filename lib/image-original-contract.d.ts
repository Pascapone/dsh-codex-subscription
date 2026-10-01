export interface OriginalImageRef {
    assetId: string;
    mediaType: 'image/png';
    bytes: number;
    width: number;
    height: number;
    name: string;
    sha256: string;
}
export declare const ORIGINAL_IMAGE_SCHEMA_VERSION = 1;
export declare const ORIGINAL_IMAGE_CHUNK_BYTES: number;
export declare const ORIGINAL_IMAGE_ID_PATTERN: RegExp;
export declare function decodeOriginalImageRef(input: unknown): OriginalImageRef | undefined;
export declare function decodeImagePresentation(input: unknown): {
    original: OriginalImageRef;
} | undefined;
export declare function originalImageRefsEqual(left: unknown, right: unknown): boolean;
/** Resolve only an exact original reference copied into a DSH fork prefix. */
export declare function inheritedOriginalImageRef(input: unknown, assetId: unknown): OriginalImageRef | undefined;
