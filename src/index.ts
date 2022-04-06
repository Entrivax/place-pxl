import ws = require('ws')
import express = require('express')
import http = require('http')
import { Room } from './room'
import { chunkSize, RoomGraphics } from './room-graphics'
import path = require('path')

const port = 3000
const app = express()
const server = http.createServer(app)
const wss = new ws.Server({ server })
const imagesPath = path.resolve('./images')

const rooms: Record<string, Room> = {}
const roomGraphics: Record<string, Record<number, Record<number, RoomGraphics>>> = {}

wss.on('connection', ws => {
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
            await putPixel(data.id, data.x, data.y, data.color)
            ws.send('{"type":"pxl","status":"ok"}')
        }
    })
})

createRoom('room1')

function createRoom(id: string) {
    const room = new Room(id, 256, 256)
    rooms[id] = room
    roomGraphics[id] = {}
}

async function putPixel(id: string, x: number, y: number, color: string) {
    const room = rooms[id]
    if (!room || x < 0 || y < 0 || x >= room.sizeX || y >= room.sizeY) {
        return
    }
    const chunkX = Math.floor(x / chunkSize)
    const chunkY = Math.floor(y / chunkSize)
    let chunk = roomGraphics[id][chunkX]
    if (!chunk) {
        chunk = roomGraphics[id][chunkX] = {}
    }
    let chunkGraphics = chunk[chunkY]
    if (!chunkGraphics) {
        chunkGraphics = chunk[chunkY] = new RoomGraphics(imagesPath, id, chunkX, chunkY)
        await chunkGraphics.load()
    }
    await chunkGraphics.drawPixel(x % chunkSize, y % chunkSize, color)
}

server.listen(3000, () => {
    console.log(`listening on *:${port}`)
})