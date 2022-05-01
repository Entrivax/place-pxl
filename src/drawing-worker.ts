import path = require('path');
import { Config } from 'src';
import workerThreads = require('worker_threads');
import { ChunkLoader, IChunkSaver, PngChunkSaver, QoiChunkSaver } from './chunk-io';
import { Room } from './room';
import { RoomGraphics } from './room-graphics';

export class DrawingWorker {
    private _worker: workerThreads.Worker | null = null
    private _requests: { id: string, resolve: (data: any) => void, reject: (err: any) => void }[] = []
    async init(config: any, onEvent: (data: any) => void) {
        return new Promise<void>((resolve, reject) => {
            this._worker = new workerThreads.Worker(__filename)
            this._worker.on('message', async (data) => {
                if (data.type === 'init') {
                    await this._sendRequest({ type: 'setConfig', config })
                    resolve()
                }
                if (data.id) {
                    const index = this._requests.findIndex(request => request.id === data.id)
                    if (index !== -1) {
                        const request = this._requests[index]
                        this._requests.splice(index, 1)
                        request.resolve(data)
                    }
                } else {
                    onEvent(data)
                }
            })
            this._worker.on('error', reject)
        })
    }

    async putPixel(roomId: string, x: number, y: number, color: string) {
        await this._sendRequest({ type: 'putPixel', roomId, x, y, color })
    }

    async getChunkPaths(roomId: string, chunkX: number, chunkY: number) {
        return await this._sendRequest<{full: string; diff: string}>({ type: 'getLastestPaths', roomId, chunkX, chunkY })
    }

    private async _sendRequest<T>(data: any): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            if (!this._worker) {
                reject(new Error('Worker not initialized'))
                return
            }
            const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            this._requests.push({ id, resolve, reject })
            this._worker.postMessage({ ...data, id })
        })
    }
}

export class DrawingWorkersMap {
    workers: {
        [room: string]: {
            [chunk: string]: DrawingWorker
        }
    } = {}

    workersPool: DrawingWorker[] = []
    _currentworker: number = 0

    constructor(private config: any, private _onChunkUpdate: (roomId: string, chunkX: number, chunkY: number, lastestFull: string, lastestDiff: string) => void) {}

    async createWorker() {
        const worker = new DrawingWorker()
        this.workersPool.push(worker)
        await worker.init(this.config, this._onEvent.bind(this))
        return worker
    }

    private async _onEvent(data: any) {
        if (data.type === 'updateChunk') {
            this._onChunkUpdate(data.roomId, data.chunkX, data.chunkY, data.lastestFull, data.lastestDiff)
        }
    }

    getWorker(room: string, chunkX: number, chunkY: number): DrawingWorker {
        const chunk = `${chunkX};${chunkY}`
        if (!this.workers[room]) {
            this.workers[room] = {}
        }
        if (!this.workers[room][chunk]) {
            this.workers[room][chunk] = this.workersPool[this._currentworker++]
            this._currentworker %= this.workersPool.length
        }
        return this.workers[room][chunk]
    }
}

class DrawingWorkerInstance {
    config: any
    rooms: Record<string, Room> = {}
    roomGraphics: Record<string, Record<number, Record<number, RoomGraphics>>> = {}
    imagesPath: string
    historyPath: string
    chunkSaver!: IChunkSaver
    chunkLoader!: ChunkLoader

    constructor() {
        this.imagesPath = path.resolve('./images')
        this.historyPath = path.resolve('./history')
    }
    async init() {
        workerThreads.parentPort?.on('message', this.processMessage.bind(this))

        workerThreads.parentPort?.postMessage({ type: 'init' })
    }

    async processMessage(data: any) {
        try {
            if (data.type === 'setConfig') {
                this._setConfig(data.config)
                workerThreads.parentPort?.postMessage({ id: data.id })
            } else if (data.type === 'putPixel') {
                await this.putPixel(data.roomId, data.x, data.y, data.color)
                workerThreads.parentPort?.postMessage({ id: data.id })
            } else if (data.type === 'getLastestPaths') {
                workerThreads.parentPort?.postMessage({ ...await this.getLastestPaths(data.roomId, data.chunkX, data.chunkY), id: data.id })
            }
        } catch (e) {
            console.error(e)
            throw e
        }
    }

    private async _setConfig(config: Config) {
        for (const [id, roomData] of Object.entries(config.rooms)) {
            this.createRoom(id, roomData.sizeX, roomData.sizeY, roomData.colors, roomData.chunkSize)
        }

        switch (config.saveFormat) {
            case 'qoi':
                this.chunkSaver = new QoiChunkSaver()
                break
            case 'png':
                this.chunkSaver = new PngChunkSaver()
                break
            default:
                throw new Error('Unknown save format')
        }

        this.chunkLoader = new ChunkLoader()
    }

    private createRoom(id: string, sizeX: number, sizeY: number, colors: string[], chunkSize: number) {
        const room = new Room(id, sizeX, sizeY, colors, chunkSize)
        this.rooms[id] = room
        this.roomGraphics[id] = {}
    }

    private async getRoomGraphics(roomId: string, chunkX: number, chunkY: number) {
        const room = this.rooms[roomId]
        const chunkSize = room.chunkSize
        if (!room || chunkX < 0 || chunkX < 0 || chunkX >= room.sizeX / chunkSize || chunkX >= room.sizeY / chunkSize) {
            return null
        }
        let chunk = this.roomGraphics[roomId][chunkX]
        if (!chunk) {
            chunk = this.roomGraphics[roomId][chunkX] = {}
        }
        let chunkGraphics = chunk[chunkY]
        if (!chunkGraphics) {
            chunkGraphics = chunk[chunkY] = new RoomGraphics(this.imagesPath, this.historyPath, roomId, chunkX, chunkY, chunkSize, this.chunkSaver, this.chunkLoader)
            await chunkGraphics.load()
            chunkGraphics.listenSave(() => {
                workerThreads.parentPort?.postMessage({ type: 'updateChunk', roomId, chunkX, chunkY, lastestFull: chunkGraphics.lastestFull, lastestDiff: chunkGraphics.lastestDiff })
            })
            await chunkGraphics.load()
        }
        return chunkGraphics
    }

    private async getLastestPaths(roomId: string, chunkX: number, chunkY: number) {
        let chunkGraphics = await this.getRoomGraphics(roomId, chunkX, chunkY)
        if (!chunkGraphics) {
            return null
        }
        return {
            full: chunkGraphics.lastestFull,
            diff: chunkGraphics.lastestDiff
        }
    }

    private async putPixel(roomId: string, x: number, y: number, color: string) {
        const room = this.rooms[roomId]
        const chunkSize = room.chunkSize
        const chunkX = Math.floor(x / chunkSize)
        const chunkY = Math.floor(y / chunkSize)
        let chunkGraphics = await this.getRoomGraphics(roomId, chunkX, chunkY)
        if (!chunkGraphics) {
            return
        }
        await chunkGraphics.drawPixel(x % chunkSize, y % chunkSize, color)
    }
}

if (!workerThreads.isMainThread) {
    new DrawingWorkerInstance().init()
}