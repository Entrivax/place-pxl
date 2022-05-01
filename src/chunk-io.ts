import QOI = require('qoijs')
import fs = require("fs/promises")
import pathM = require("path")

export interface IChunkSaver {
    save(chunkData: Uint8Array, chunkSize: number, dirPath: string, fileName: string): Promise<string>
}

export class PngChunkSaver implements IChunkSaver {
    save(chunkData: Uint8Array, chunkSize: number, dirPath: string, fileName: string): Promise<string> {
        throw new Error("Method not implemented.");
    }
}

export class QoiChunkSaver implements IChunkSaver {
    async save(chunkData: Uint8Array, chunkSize: number, dirPath: string, fileName: string): Promise<string> {
        const path = pathM.join(dirPath, `${fileName}.qoi`)
        await fs.writeFile(path, Buffer.from(QOI.encode(chunkData, {
            width: chunkSize,
            height: chunkSize,
            channels: 4,
            colorspace: 0
        })))
        return path
    }
}

export class ChunkLoader {
    async load(path: string): Promise<Uint8Array> {
        switch (pathM.extname(path)) {
            case '.qoi': {
                const buffer = await fs.readFile(path)
                const decoded = QOI.decode(buffer)
                return decoded.data
            }
        }
        throw new Error('Unsupported file type')
    }
}