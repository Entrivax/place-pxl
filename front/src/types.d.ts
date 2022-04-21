declare module 'qoijs' {
    export function encode(colorData: Uint8Array | Uint8ClampedArray, description: {
        width: number
        height: number
        channels: number
        colorspace: number
    }): ArrayBuffer
    export function decode(arrayBuffer: ArrayBuffer, byteOffset?: number, byteLength?: number, outputChannels?: number): { channels: number, data: Uint8Array, colorspace: number, width: number, error: boolean, height: number }
}

declare module 'nearest-color' {
    export function from(color: any): any
}