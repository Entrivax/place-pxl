import fs = require('fs/promises')
import path = require('path')
import Canvas = require('canvas')
import _ = require('lodash')
import { ChunkLoader, IChunkSaver } from './chunk-io'

export const chunkSize = 64
export class RoomGraphics {
    id: string
    diffDirectory: string
    directory: string
    historyDirectory: string
    chunkX: number
    chunkY: number
    fullCanvas: Canvas.Canvas | null
    fullCtx: Canvas.CanvasRenderingContext2D | null
    drawCanvas: Canvas.Canvas | null
    drawCtx: Canvas.CanvasRenderingContext2D | null
    lastestFull: string | null
    lastestDiff: string | null
    history: { x: number; y: number; color: string; timestamp: Date }[]
    chunkSaver: IChunkSaver
    saveThrottled: () => void
    saveListeners: (() => void)[]

    constructor(imagesPath: string, historyPath: string, id: string, chunkX: number, chunkY: number, chunkSaver: IChunkSaver) {
        this.id = id
        this.diffDirectory = path.join(imagesPath, id, `d-${chunkX}-${chunkY}`)
        this.directory = path.join(imagesPath, id, `f-${chunkX}-${chunkY}`)
        this.historyDirectory = path.join(historyPath, id, `${chunkX}-${chunkY}`)
        this.chunkX = chunkX
        this.chunkY = chunkY
        this.lastestFull = null
        this.lastestDiff = null
        this.fullCanvas = null
        this.fullCtx = null
        this.drawCanvas = null
        this.drawCtx = null
        this.saveListeners = []
        this.history = []
        this.chunkSaver = chunkSaver
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

        const files = (await fs.readdir(this.directory)).filter(file => file.endsWith('.png') || file.endsWith('.qoi'))
        const latest = files.reduce((a, b) => {
            return parseInt(a) > parseInt(b) ? a : b
        }, '')

        if (!latest) {
            return
        }

        this.lastestFull = path.join(this.directory, latest)

        const image = await new ChunkLoader().load(path.join(this.directory, latest))
        this.fullCtx.drawImage(image, 0, 0)
    }

    async save() {
        if (!this.fullCanvas || !this.fullCtx || !this.drawCanvas || !this.drawCtx) {
            return
        }
        const history = this.history.slice(0)
        this.history.length = 0

        const image = Canvas.createCanvas(this.fullCanvas.width, this.fullCanvas.height)
        const imageCtx = image.getContext('2d')
        imageCtx.drawImage(this.fullCanvas, 0, 0)
        const diffImage = Canvas.createCanvas(this.drawCanvas.width, this.drawCanvas.height)
        const diffCtx = diffImage.getContext('2d')
        diffCtx.drawImage(this.drawCanvas, 0, 0)

        await fs.mkdir(this.directory, { recursive: true })
        this.lastestFull = await this.chunkSaver.save(image, imageCtx, this.directory, (+Date.now()).toString(10))

        this.drawCtx.clearRect(0, 0, chunkSize, chunkSize)
        await fs.mkdir(this.diffDirectory, { recursive: true })
        this.lastestDiff = await this.chunkSaver.save(image, imageCtx, this.diffDirectory, (+Date.now()).toString(10))

        await fs.mkdir(this.historyDirectory, { recursive: true })
        await fs.appendFile(path.join(this.historyDirectory, 'history.json'), history.map(e => JSON.stringify(e) + '\n').join(''))

        this.saveListeners.forEach(callback => {
            try {
                callback()
            } catch (e) {
                console.error(e)
            }
        })
    }

    async drawPixel(x: number, y: number, color: string) {
        if (!this.fullCanvas || !this.fullCtx || !this.drawCanvas || !this.drawCtx) {
            throw new Error('Not loaded')
        }
        this.history.push({ x, y, color, timestamp: new Date() })
        this.drawCtx.fillStyle = color
        this.drawCtx.fillRect(x, y, 1, 1)
        this.fullCtx.drawImage(this.drawCanvas, 0, 0)
        this.saveThrottled()
    }

    listenSave(callback: () => void) {
        this.saveListeners.push(callback)
    }

    unlistenSave(callback: () => void) {
        const index = this.saveListeners.indexOf(callback)
        if (index !== -1) {
            this.saveListeners.splice(index, 1)
        }
    }
}