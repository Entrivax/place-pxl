import { useEffect, useRef } from "react"
import useWindowSize from "./useWindowResize"

export const CanvasRenderer: React.FC<{image: HTMLCanvasElement | undefined, target: {x: number, y: number}, scale: number, updateViewport: (viewport: {x: number, y: number, width: number, height: number}) => void, gridEnabled: boolean}> = function (props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [[windowWidth, windowHeight]] = useWindowSize()
    const {image, target, scale, gridEnabled, updateViewport} = props
    useEffect(() => {
        redraw(canvasRef, image, target, scale, gridEnabled)
        updateViewport(getViewport(canvasRef, target, scale))
    }, [image, target, scale, gridEnabled])
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            redraw(canvasRef, image, target, scale, gridEnabled)
            updateViewport(getViewport(canvasRef, target, scale))
        }
    }, [windowWidth, windowHeight, image, target, scale, gridEnabled])

    

    redraw(canvasRef, image, target, scale, gridEnabled)
    return (
        <canvas ref={canvasRef} id="canvas" width="500" height="500"></canvas>
    )
}

function getViewport(canvasRef: React.RefObject<HTMLCanvasElement>, target: {x: number, y: number}, scale: number) {
    const canvas = canvasRef.current
    if (!canvas) {
        return { x: 0, y: 0, width: 0, height: 0 }
    }
    return {
        x: target.x - canvas.offsetWidth / 2 / scale,
        y: target.y - canvas.offsetHeight / 2 / scale,
        width: canvas.offsetWidth / scale,
        height: canvas.offsetHeight / scale
    }
}

function redraw(canvasRef: React.RefObject<HTMLCanvasElement>, image: HTMLCanvasElement | undefined, target: {x: number, y: number}, scale: number, gridEnabled: boolean) {
    const canvas = canvasRef.current
    if (canvas) {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio
        canvas.height = canvas.offsetHeight * window.devicePixelRatio
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.fillStyle = '#222'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            const offsetX = canvas.width / 2 - (target.x * scale)
            const offsetY = canvas.height / 2 - (target.y * scale)
            ctx.imageSmoothingEnabled = false
            if (image) {
                ctx.fillStyle = '#fff'
                ctx.fillRect(offsetX, offsetY, image.width * scale, image.height * scale)
                ctx.drawImage(image, offsetX, offsetY, image.width * scale, image.height * scale)
                if (scale > 20 && gridEnabled) {
                    drawGrid(image, canvas, ctx, offsetX, offsetY, scale)
                }
            }
        }
    }
}

function drawGrid(image: HTMLCanvasElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, offsetX: number, offsetY: number, scale: number) {
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    const minX = Math.max(offsetX, offsetX % scale)
    const minY = Math.max(offsetY, offsetY % scale)
    const maxX = offsetX + image.width * scale
    const maxY = offsetY + image.height * scale
    for (let x = minX; x < canvas.width && x <= maxX; x += scale) {
        ctx.beginPath()
        ctx.moveTo(x, minY)
        ctx.lineTo(x, image.height * scale + offsetY)
        ctx.stroke()
    }
    for (let y = minY; y < canvas.height && y <= maxY; y += scale) {
        ctx.beginPath()
        ctx.moveTo(minX, y)
        ctx.lineTo(image.width * scale + offsetX, y)
        ctx.stroke()
    }
}