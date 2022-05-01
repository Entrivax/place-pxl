import ws = require('ws')
import express = require('express')
import http = require('http')
import { Room } from './room'
import fs = require('fs/promises')
import { DrawingWorkersMap } from './drawing-worker'

const port = 3000
const app = express()
const server = http.createServer(app)
const wss = new ws.Server({ server })

const rooms: Record<string, Room> = {}
let drawingWorkersMap: DrawingWorkersMap | null = null
type RoomGraphicsInfo = { lastestFull: string, lastestDiff: string, listeners: (() => void)[] }
const roomGraphics: Record<string, Record<number, Record<number, RoomGraphicsInfo>>> = {}

app.use('/images', express.static('images'))

wss.on('connection', (ws, req) => {
    if (!req.url) {
        return
    }
    const roomId = new URLSearchParams(req.url.slice(req.url.indexOf('?'))).get('id')
    if (!roomId || !rooms[roomId]) {
        ws.close()
        return
    }
    const listeners: { chunkGraphics: RoomGraphicsInfo, listener: () => void }[] = []
    const room = rooms[roomId]
    ws.send(JSON.stringify({
        type: 'init',
        sizeX: room.sizeX,
        sizeY: room.sizeY,
        colors: room.colors,
        chunkSize: room.chunkSize
    }))
    ws.on('message', async message => {
        let data = null
        try {
            data = JSON.parse(message.toString('utf8'))
        } catch (e) {
            console.log('Failed to parse message')
        }
        if (!data) {
            return
        }
        if (data.type === 'pxl') {
            await putPixel(roomId, data.x, data.y, data.color)
            ws.send('{"type":"pxl","status":"ok"}')
        } else if (data.type === 'sub') {
            const chunkX = data.x
            const chunkY = data.y
            const chunkGraphics = await getRoomGraphics(roomId, chunkX, chunkY)
            if (!chunkGraphics) {
                return
            }
            const listener = () => {
                if (!chunkGraphics.lastestDiff) {
                    return
                }
                ws.send(JSON.stringify({
                    type: 'diff',
                    x: chunkX,
                    y: chunkY,
                    data: getImageUrl(chunkGraphics.lastestDiff)
                }))
            }
            if (chunkGraphics.lastestFull) {
                ws.send(JSON.stringify({
                    type: 'full',
                    x: chunkX,
                    y: chunkY,
                    data: getImageUrl(chunkGraphics.lastestFull)
                }))
            }
            chunkGraphics.listeners.push(listener)
            listeners.push({ chunkGraphics, listener })
        } else if (data.type === 'ping') {
            ws.send('{"type":"pong"}')
        }
    })

    ws.on('error', () => {
        unlisten()
    })
    ws.on('close', () => {
        unlisten()
    })

    function unlisten() {
        listeners.forEach(({ chunkGraphics, listener }) => {
            const index = chunkGraphics.listeners.indexOf(listener)
            if (index !== -1) {
                chunkGraphics.listeners.splice(index, 1)
            }
        })
        listeners.length = 0
    }
})

app.use('/', express.static('front/build'))

async function main() {
    let config = {
        saveFormat: 'qoi',
        workersCount: 4,
        rooms: {
            'room1': {
                sizeX: 256,
                sizeY: 256,
                chunkSize: 64,
                colors: [
                    '#6d001a',
                    '#be0039',
                    '#ff4500',
                    '#ffa800',
                    '#ffd635',
                    '#fff8b8',
                    '#00a368',
                    '#00cc78',
                    '#7eed56',
                    '#00756f',
                    '#009eaa',
                    '#00ccc0',
                    '#2450a4',
                    '#3690ea',
                    '#51e9f4',
                    '#493ac1',
                    '#6a5cff',
                    '#94b3ff',
                    '#811e9f',
                    '#b44ac0',
                    '#e4abff',
                    '#de107f',
                    '#ff3881',
                    '#ff99aa',
                    '#6d482f',
                    '#9c6926',
                    '#ffb470',
                    '#000000',
                    '#515252',
                    '#898d90',
                    '#d4d7d9',
                    '#ffffff'
                ]
            }
        }
    }
    try {
        const content = await fs.readFile('./config.json', 'utf8')
        config = JSON.parse(content)
    } catch (e) {
        console.error('Failed to read config.json, using default config')
    }

    for (const [id, roomData] of Object.entries(config.rooms)) {
        createRoom(id, roomData.sizeX, roomData.sizeY, roomData.colors, roomData.chunkSize)
    }

    drawingWorkersMap = new DrawingWorkersMap(config, async (roomId, chunkX, chunkY, lastestFull, lastestDiff) => {
        let chunkGraphics = await getRoomGraphics(roomId, chunkX, chunkY)
        if (!chunkGraphics) {
            return
        }
        chunkGraphics.lastestDiff = lastestDiff
        chunkGraphics.lastestFull = lastestFull

        for (const listener of chunkGraphics.listeners) {
            listener()
        }
    })

    for (let i = 0; i < config.workersCount; i++) {
        await drawingWorkersMap.createWorker()
    }

    server.listen(3000, () => {
        console.log(`listening on *:${port}`)
    })
}

function createRoom(id: string, sizeX: number, sizeY: number, colors: string[], chunkSize: number) {
    const room = new Room(id, sizeX, sizeY, colors, chunkSize)
    rooms[id] = room
    roomGraphics[id] = {}
}

async function putPixel(id: string, x: number, y: number, color: string) {
    const room = rooms[id]
    if (!room || x < 0 || y < 0 || x >= room.sizeX || y >= room.sizeY || (room.colors && room.colors.indexOf(color) === -1)) {
        return
    }
    const chunkSize = room.chunkSize
    const chunkX = Math.floor(x / chunkSize)
    const chunkY = Math.floor(y / chunkSize)
    await drawingWorkersMap?.getWorker(id, chunkX, chunkY).putPixel(id, x, y, color)
}

async function getRoomGraphics(id: string, chunkX: number, chunkY: number) {
    const room = rooms[id]
    const chunkSize = room.chunkSize
    if (!room || chunkX < 0 || chunkX < 0 || chunkX >= room.sizeX / chunkSize || chunkX >= room.sizeY / chunkSize) {
        return null
    }
    let chunk = roomGraphics[id][chunkX]
    if (!chunk) {
        chunk = roomGraphics[id][chunkX] = {}
    }
    let chunkGraphics = chunk[chunkY]
    if (!chunkGraphics) {
        let data = await drawingWorkersMap?.getWorker(id, chunkX, chunkY).getChunkPaths(id, chunkX, chunkY)
        if (!data) {
            return null
        }
        chunkGraphics = chunk[chunkY] = {
            lastestDiff: data?.diff,
            lastestFull: data?.full,
            listeners: []
        }
    }
    return chunkGraphics
}

function getImageUrl(absolutePath: string) {
    const lastIndexOf = absolutePath.lastIndexOf('images')
    return absolutePath.slice(lastIndexOf).replace(/\\/g, '/')
}

main()

export type Config = {
    saveFormat: string;
    rooms: {
        room1: {
            sizeX: number;
            sizeY: number;
            chunkSize: number;
            colors: string[];
        };
    };
}