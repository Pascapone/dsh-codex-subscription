import type { PixelData } from 'ag-psd';
export type RasterPsdLayer = {
    name: string;
    left: number;
    top: number;
    opacity: number;
    hidden: boolean;
    imageData: PixelData;
};
export type RasterPsd = {
    width: number;
    height: number;
    layers: RasterPsdLayer[];
};
