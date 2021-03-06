import { useEffect, useRef } from "react"
import useWindowSize from "./useWindowResize"

export const CanvasRenderer: React.FC<{
    image: HTMLCanvasElement | undefined,
    target: {x: number, y: number},
    scale: number,
    updateViewport: (viewport: {x: number, y: number, width: number, height: number}) => void,
    gridEnabled: boolean,
    templateData: ImageData | null,
    templatePosition: {x: number, y: number},
    templateAlpha: number
}> = function (props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [[windowWidth, windowHeight]] = useWindowSize()
    const {image, target, scale, gridEnabled, updateViewport, templateData, templatePosition, templateAlpha} = props
    useEffect(() => {
        const viewport = getViewport(canvasRef, target, scale)
        redraw(canvasRef, image, target, scale, gridEnabled, templateData, templatePosition, templateAlpha, viewport)
        updateViewport(viewport)
    }, [image, target, scale, gridEnabled, templateData, templatePosition, templateAlpha])
    useEffect(() => {
        const canvas = canvasRef.current
        if (canvas) {
            const viewport = getViewport(canvasRef, target, scale)
            redraw(canvasRef, image, target, scale, gridEnabled, templateData, templatePosition, templateAlpha, viewport)
            updateViewport(viewport)
        }
    }, [windowWidth, windowHeight, image, target, scale, gridEnabled, templateData, templatePosition, templateAlpha])

    const viewport = getViewport(canvasRef, target, scale)
    redraw(canvasRef, image, target, scale, gridEnabled, templateData, templatePosition, templateAlpha, viewport)
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

function redraw(canvasRef: React.RefObject<HTMLCanvasElement>, image: HTMLCanvasElement | undefined, target: {x: number, y: number}, scale: number, gridEnabled: boolean, templateData: ImageData | null, templatePosition: {x: number, y: number}, templateAlpha: number, viewport: {x: number, y: number, width: number, height: number}) {
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
                if (templateData) {
                    const templateCanvas = document.createElement('canvas')
                    templateCanvas.width = templateData.width
                    templateCanvas.height = templateData.height
                    const templateCtx = templateCanvas.getContext('2d')
                    if (templateCtx) {
                        templateCtx.putImageData(templateData, 0, 0)
                        ctx.globalAlpha = templateAlpha
                        if (scale > 20) {
                            const viewportX = Math.floor(viewport.x)
                            const viewportY = Math.floor(viewport.y)
                            const viewportWidth = Math.ceil(viewport.width)
                            const viewportHeight = Math.ceil(viewport.height)
                            const templateCutData = templateCtx.getImageData(viewportX - templatePosition.x, viewportY - templatePosition.y, viewportWidth, viewportHeight)
                            const imageCtx = image.getContext('2d')
                            if (imageCtx) {
                                const imageData = imageCtx.getImageData(viewportX, viewportY, viewportWidth, viewportHeight)
                                for (let x = 0; x < viewportWidth; x++) {
                                    for (let y = 0; y < viewportHeight; y++) {
                                        const index = (y * viewportWidth + x) * 4
                                        if (templateCutData.data[index + 3] > 0) {
                                            if (templateCutData.data[index] === imageData.data[index] && templateCutData.data[index + 1] === imageData.data[index + 1] && templateCutData.data[index + 2] === imageData.data[index + 2] && imageData.data[index + 3] === 255) {
                                                ctx.fillStyle = '#0f0'
                                            } else {
                                                ctx.fillStyle = '#f00'
                                            }
                                            ctx.fillRect(offsetX + (viewportX + x) * scale + scale / 2, offsetY + (viewportY + y) * scale + scale / 2, scale / 2, scale / 2)
                                            ctx.fillStyle = `rgb(${templateCutData.data[index]}, ${templateCutData.data[index + 1]}, ${templateCutData.data[index + 2]})`
                                            ctx.fillRect(offsetX + (viewportX + x) * scale + 5 * scale / 8, offsetY + (viewportY + y) * scale + 5 * scale / 8, scale / 4, scale / 4)
                                        }
                                    }
                                }
                            }
                        } else {
                            ctx.drawImage(templateCanvas, templatePosition.x * scale + offsetX, templatePosition.y * scale + offsetY, templateData.width * scale, templateData.height * scale)
                        }
                        ctx.globalAlpha = 1
                    }
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