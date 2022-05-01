import { User } from "./users"

export class Room {
    id: string
    users: User[]
    sizeX: number
    sizeY: number
    colors: string[] | null
    chunkSize: number
    
    constructor(id: string, sizeX: number, sizeY: number, colors: string[] | null, chunkSize: number) {
        this.id = id
        this.users = []
        this.sizeX = sizeX
        this.sizeY = sizeY
        this.colors = colors
        this.chunkSize = chunkSize
    }

    configureRoom(options: RoomOptions) {
        if (options.sizeX) {
            this.sizeX = options.sizeX
        }
        if (options.sizeY) {
            this.sizeY = options.sizeY
        }
    }

    connectUser(user: User) {
        this.users.push(user)
    }

    disconnectUser(user: User) {
        this.users = this.users.filter(u => u !== user)
    }
}

export type RoomOptions = {
    sizeX: number
    sizeY: number
}