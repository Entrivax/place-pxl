import ws = require('ws')
import express = require('express')
import http = require('http')
import { Room } from './room'
import { chunkSize, RoomGraphics } from './room-graphics'
import path = require('path')
import fs = require('fs/promises')
import { IChunkSaver, PngChunkSaver, QoiChunkSaver } from './chunk-io'

const port = 3000
const app = express()
const server = http.createServer(app)
const wss = new ws.Server({ server })
const imagesPath = path.resolve('./images')
const historyPath = path.resolve('./history')
let chunkSaver: IChunkSaver

const rooms: Record<string, Room> = {}
const roomGraphics: Record<string, Record<number, Record<number, RoomGraphics>>> = {}

app.use('/images', express.static('images'))

wss.on('connection', (ws, req) => {
    const roomId = new URLSearchParams(req.url.slice(req.url.indexOf('?'))).get('id')
    if (!roomId || !rooms[roomId]) {
        ws.close()
        return
    }
    const listeners: { chunkGraphics: RoomGraphics, listener: () => void }[] = []
    const room = rooms[roomId]
    ws.send(JSON.stringify({
        type: 'init',
        sizeX: room.sizeX,
        sizeY: room.sizeY,
        colors: room.colors
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
            listeners.push({ chunkGraphics, listener })
            chunkGraphics.listenSave(listener)
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
            chunkGraphics.unlistenSave(listener)
        })
        listeners.length = 0
    }
})

app.use('/', express.static('front/build'))

async function main() {
    let config = {
        saveFormat: 'qoi',
        rooms: {
            'room1': {
                sizeX: 256,
                sizeY: 256,
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

    switch (config.saveFormat) {
        case 'qoi':
            chunkSaver = new QoiChunkSaver()
            break
        case 'png':
            chunkSaver = new PngChunkSaver()
            break
        default:
            throw new Error('Unknown save format')
    }

    for (const [id, roomData] of Object.entries(config.rooms)) {
        createRoom(id, roomData.sizeX, roomData.sizeY, roomData.colors)
    }

    server.listen(3000, () => {
        console.log(`listening on *:${port}`)
    })
}

function createRoom(id: string, sizeX: number, sizeY: number, colors: string[]) {
    const room = new Room(id, sizeX, sizeY, colors)
    rooms[id] = room
    roomGraphics[id] = {}
}

async function putPixel(id: string, x: number, y: number, color: string) {
    const room = rooms[id]
    if (!room || x < 0 || y < 0 || x >= room.sizeX || y >= room.sizeY || room.colors.indexOf(color) === -1) {
        return
    }
    const chunkX = Math.floor(x / chunkSize)
    const chunkY = Math.floor(y / chunkSize)
    let chunkGraphics = await getRoomGraphics(id, chunkX, chunkY)
    if (!chunkGraphics) {
        return
    }
    await chunkGraphics.drawPixel(x % chunkSize, y % chunkSize, color)
}

async function getRoomGraphics(id: string, chunkX: number, chunkY: number) {
    const room = rooms[id]
    if (!room || chunkX < 0 || chunkX < 0 || chunkX >= room.sizeX / chunkSize || chunkX >= room.sizeY / chunkSize) {
        return null
    }
    let chunk = roomGraphics[id][chunkX]
    if (!chunk) {
        chunk = roomGraphics[id][chunkX] = {}
    }
    let chunkGraphics = chunk[chunkY]
    if (!chunkGraphics) {
        chunkGraphics = chunk[chunkY] = new RoomGraphics(imagesPath, historyPath, id, chunkX, chunkY, chunkSaver)
        await chunkGraphics.load()
    }
    return chunkGraphics
}

function getImageUrl(absolutePath: string) {
    const lastIndexOf = absolutePath.lastIndexOf('images')
    return absolutePath.slice(lastIndexOf).replace(/\\/g, '/')
}

main()