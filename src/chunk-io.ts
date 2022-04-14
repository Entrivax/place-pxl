import Canvas from "canvas";
import QOI = require('qoijs')
import fs = require("fs/promises")
import pathM = require("path")

export interface IChunkSaver {
    save(canvas: Canvas.Canvas, ctx: Canvas.CanvasRenderingContext2D, dirPath: string, fileName: string): Promise<string>
}

export class PngChunkSaver implements IChunkSaver {
    async save(canvas: Canvas.Canvas, ctx: Canvas.CanvasRenderingContext2D, dirPath: string, fileName: string): Promise<string> {
        const buffer = canvas.toBuffer('image/png')
        const path = pathM.join(dirPath, `${fileName}.png`)
        await fs.writeFile(path, buffer)
        return path
    }
}

export class QoiChunkSaver implements IChunkSaver {
    async save(canvas: Canvas.Canvas, ctx: Canvas.CanvasRenderingContext2D, dirPath: string, fileName: string): Promise<string> {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const path = pathM.join(dirPath, `${fileName}.qoi`)
        await fs.writeFile(path, Buffer.from(QOI.encode(imageData.data, {
            width: imageData.width,
            height: imageData.height,
            channels: 4,
            colorspace: 0
        })))
        return path
    }
}

export class ChunkLoader {
    async load(path: string): Promise<Canvas.Canvas | Canvas.Image> {
        switch (pathM.extname(path)) {
            case '.png': {
                const image = await Canvas.loadImage(path)
                return image
            }
            case '.qoi': {
                const buffer = await fs.readFile(path)
                const decoded = QOI.decode(buffer)
                const canvas = Canvas.createCanvas(decoded.width, decoded.height)
                const ctx = canvas.getContext('2d')
                const imageData = ctx.createImageData(decoded.width, decoded.height)
                imageData.data.set(decoded.data)
                ctx.putImageData(imageData, 0, 0)
                return canvas
            }
        }
        throw new Error('Unsupported file type')
    }
}