import fs = require('fs/promises')
import path = require('path')
import _ = require('lodash')
import { ChunkLoader, IChunkSaver } from './chunk-io'

export class RoomGraphics {
    id: string
    diffDirectory: string
    directory: string
    historyDirectory: string
    chunkX: number
    chunkY: number
    chunkSize: number
    fullCanvas: Uint8Array | null
    drawCanvas: Uint8Array | null
    lastestFull: string | null
    lastestDiff: string | null
    history: { x: number; y: number; color: string; timestamp: Date }[]
    chunkSaver: IChunkSaver
    chunkLoader: ChunkLoader
    saveThrottled: () => void
    saveListeners: (() => void)[]

    constructor(imagesPath: string, historyPath: string, id: string, chunkX: number, chunkY: number, chunkSize: number, chunkSaver: IChunkSaver, chunkLoader: ChunkLoader) {
        this.id = id
        this.diffDirectory = path.join(imagesPath, id, `d-${chunkX}-${chunkY}`)
        this.directory = path.join(imagesPath, id, `f-${chunkX}-${chunkY}`)
        this.historyDirectory = path.join(historyPath, id, `${chunkX}-${chunkY}`)
        this.chunkX = chunkX
        this.chunkY = chunkY
        this.chunkSize = chunkSize
        this.lastestFull = null
        this.lastestDiff = null
        this.fullCanvas = null
        this.drawCanvas = null
        this.saveListeners = []
        this.history = []
        this.chunkSaver = chunkSaver
        this.chunkLoader = chunkLoader
        this.saveThrottled = _.throttle(this.save.bind(this), 500)
    }

    async load() {
        this.fullCanvas = new Uint8Array(this.chunkSize * this.chunkSize * 4)
        this.drawCanvas = new Uint8Array(this.chunkSize * this.chunkSize * 4)

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

        const image = await this.chunkLoader.load(path.join(this.directory, latest))
        this.fullCanvas.set(image)
    }

    async save() {
        if (!this.fullCanvas
            || !this.drawCanvas
        ) {
            return
        }
        const history = this.history.slice(0)
        this.history.length = 0

        await fs.mkdir(this.directory, { recursive: true })
        await fs.mkdir(this.diffDirectory, { recursive: true })

        this.lastestFull = await this.chunkSaver.save(this.fullCanvas, this.chunkSize, this.directory, (+Date.now()).toString(10))

        this.lastestDiff = await this.chunkSaver.save(this.drawCanvas, this.chunkSize, this.diffDirectory, (+Date.now()).toString(10))

        this.drawCanvas.fill(0, 0, this.drawCanvas.length)

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
        if (!this.fullCanvas
            || !this.drawCanvas
        ) {
            throw new Error('Not loaded')
        }
        this.history.push({ x, y, color, timestamp: new Date() })
        const parsedColor = this._parseColor(color)
        const offset = (x + y * this.chunkSize) * 4
        this.fullCanvas.set(parsedColor, offset)
        this.drawCanvas.set(parsedColor, offset)
        this.saveThrottled()
    }

    private _parseColor(hexColor: string): Uint8Array {
        const r = parseInt(hexColor.slice(1, 3), 16)
        const g = parseInt(hexColor.slice(3, 5), 16)
        const b = parseInt(hexColor.slice(5, 7), 16)
        return new Uint8Array([r, g, b, 255])
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