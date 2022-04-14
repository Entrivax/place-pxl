declare module 'qoijs' {
    export function encode(colorData: Uint8Array|Uint8ClampedArray, description: {
        width: int
        height: int
        channels: int
        colorspace: int
    }): ArrayBuffer
    export function decode(arrayBuffer: ArrayBuffer, byteOffset?: int, byteLength?: int, outputChannels?: int): {channels: number, data: Uint8Array, colorspace: number, width: number, error: boolean, height: number}
}