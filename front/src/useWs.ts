import { useEffect, useRef } from "react";

const chunkSize = 64
export function useWs(room: string, viewport: { x: number, y: number, width: number, height: number }, setImage: React.Dispatch<React.SetStateAction<HTMLCanvasElement | undefined>>, setColors: React.Dispatch<React.SetStateAction<string[] | null>>) {
    const ws = useRef<WebSocket | null>(null)
    const image = useRef<HTMLCanvasElement | undefined>()
    const size = useRef<{width: number; height: number} | null>(null)
    const subbedChunks = useRef<{[chunk: string]: boolean}>({})
    if (ws.current && ws.current.readyState === WebSocket.OPEN && size.current) {
        for (let x = Math.floor(Math.max(viewport.x / chunkSize, 0)); x < Math.max(viewport.width + viewport.x, size.current.width) / chunkSize; x++) {
            for (let y = Math.floor(Math.max(viewport.y / chunkSize, 0)); y < Math.max(viewport.height + viewport.y, size.current.height) / chunkSize; y++) {
                const key = `${x};${y}`
                if (subbedChunks.current[key]) {
                    continue
                }
                subbedChunks.current[key] = true
                ws.current?.send(JSON.stringify({
                    type: 'sub',
                    x,
                    y
                }))
            }
        }
    }
    useEffect(() => {
        ws.current = new WebSocket(`ws${window.location.protocol === "https:" ? "s" : ""}://${window.location.host}/websocket?id=${room}`);
        ws.current.addEventListener('message', async (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'init': {
                    setColors(data.colors)
                    size.current = {
                        width: data.sizeX,
                        height: data.sizeY
                    }
                    if (!image.current) {
                        const canvas = document.createElement('canvas')
                        canvas.width = size.current?.width ?? 1
                        canvas.height = size.current?.height ?? 1
                        image.current = canvas
                        setImage(canvas)
                    }
                    break
                }
                case 'full': {
                    const x = data.x * chunkSize
                    const y = data.y * chunkSize
                    const canvas = document.createElement('canvas')
                    canvas.width = size.current?.width ?? 1
                    canvas.height = size.current?.height ?? 1
                    const ctx = canvas.getContext('2d')
                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const img = new Image()
                        img.addEventListener('load', () => {
                            resolve(img)
                        })
                        img.addEventListener('error', (e) => {
                            reject(e)
                        })
                        img.src = data.data
                    })
                    if (image.current) {
                        ctx?.drawImage(image.current, 0, 0)
                    }
                    ctx?.clearRect(x, y, chunkSize, chunkSize)
                    ctx?.drawImage(img, x, y)
                    image.current = canvas
                    setImage(canvas)
                    break
                }
                case 'diff': {
                    const x = data.x * chunkSize
                    const y = data.y * chunkSize
                    const canvas = document.createElement('canvas')
                    canvas.width = size.current?.width ?? 1
                    canvas.height = size.current?.height ?? 1
                    const ctx = canvas.getContext('2d')
                    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                        const img = new Image()
                        img.addEventListener('load', () => {
                            resolve(img)
                        })
                        img.addEventListener('error', (e) => {
                            reject(e)
                        })
                        img.src = data.data
                    })
                    if (image.current) {
                        ctx?.drawImage(image.current, 0, 0)
                    }
                    ctx?.drawImage(img, x, y)
                    image.current = canvas
                    setImage(canvas)
                }
            }
        })
        return () => {
            ws.current?.close()
            ws.current = null
        }
    }, [])
    return [
        function setPixel(x: number, y: number, color: string) {
            ws.current?.send(JSON.stringify({
                type: 'pxl',
                x,
                y,
                color
            }))
        }
    ]
}