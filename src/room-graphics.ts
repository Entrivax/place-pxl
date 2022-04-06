import fs = require('fs/promises')
import path = require('path')
import Canvas = require('canvas')
import _ = require('lodash')

export const chunkSize = 64
export class RoomGraphics {
    id: string
    diffDirectory: string
    directory: string
    chunkX: number
    chunkY: number
    fullCanvas: Canvas.Canvas | null
    fullCtx: Canvas.CanvasRenderingContext2D | null
    drawCanvas: Canvas.Canvas | null
    drawCtx: Canvas.CanvasRenderingContext2D | null
    lastestFull: string | null
    lastestDiff: string | null
    saveThrottled: () => void
    
    constructor(imagesPath: string, id: string, chunkX: number, chunkY: number) {
        this.id = id
        this.diffDirectory = path.join(imagesPath, id, `d-${chunkX}-${chunkY}`)
        this.directory = path.join(imagesPath, id, `f-${chunkX}-${chunkY}`)
        this.chunkX = chunkX
        this.chunkY = chunkY
        this.lastestFull = null
        this.lastestDiff = null
        this.fullCanvas = null
        this.fullCtx = null
        this.drawCanvas = null
        this.drawCtx = null
        this.saveThrottled = _.throttle(this.save.bind(this), 500)
    }

    async load() {
        this.fullCanvas = Canvas.createCanvas(chunkSize, chunkSize)
        this.fullCtx = this.fullCanvas.getContext('2d')
        this.drawCanvas = Canvas.createCanvas(chunkSize, chunkSize)
        this.drawCtx = this.drawCanvas.getContext('2d')

        const directoryExists = await fs.stat(this.directory).then(stat => stat.isDirectory()).catch(() => false)
        if (!directoryExists) {
            return
        }

        const files = await fs.readdir(this.directory)
        const latest = files.reduce((a, b) => {
            return parseInt(a) > parseInt(b) ? a : b
        }, '')

        if (!latest) {
            return
        }

        const image = await Canvas.loadImage(path.join(this.directory, latest))
        this.fullCtx.drawImage(image, 0, 0)
    }

    async save() {
        if (!this.fullCanvas || !this.fullCtx || !this.drawCanvas || !this.drawCtx) {
            return
        }
        const image = this.fullCanvas.toBuffer('image/png')
        await fs.mkdir(this.directory, { recursive: true })
        const fullPath = path.join(this.directory, `${+Date.now()}.png`)
        await fs.writeFile(fullPath, image)
        this.lastestFull = fullPath

        const diffImage = this.drawCanvas.toBuffer('image/png')
        this.drawCtx.clearRect(0, 0, chunkSize, chunkSize)
        await fs.mkdir(this.diffDirectory, { recursive: true })
        const diffPath = path.join(this.diffDirectory, `${+Date.now()}.png`)
        await fs.writeFile(diffPath, diffImage)
        this.lastestDiff = diffPath
    }

    async drawPixel(x: number, y: number, color: string) {
        if (!this.fullCanvas || !this.fullCtx || !this.drawCanvas || !this.drawCtx) {
            throw new Error('Not loaded')
        }
        this.drawCtx.fillStyle = color
        this.drawCtx.fillRect(x, y, 1, 1)
        this.fullCtx.drawImage(this.drawCanvas, 0, 0)
        this.saveThrottled()
    }
}