import nearestColor from 'nearest-color';
import { useEffect, useState } from 'react';

const TemplateTool: React.FC<{
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
    templatePosition: { x: number; y: number };
    setTemplatePosition: (templatePosition: { x: number; y: number }) => void;
    colors: string[] | null;
    setTemplate: (template: ImageData | null) => void;
    size: { width: number; height: number };
    setSize: (size: { width: number; height: number }) => void;
    alpha: number;
    setAlpha: (alpha: number) => void;
}> = function(props) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const { size } = props
    useEffect(() => {
        if (!image) {
            props.setTemplate(null)
            return
        }
        const canvas = document.createElement('canvas')
        const reductionRatio = Math.max(props.size.width <= 0 ? 1 : image.naturalWidth / props.size.width, props.size.height <= 0 ? 1 : image.naturalHeight / props.size.height)
        canvas.width = Math.floor(image.naturalWidth / reductionRatio)
        canvas.height = Math.floor(image.naturalHeight / reductionRatio)
        const ctx = canvas.getContext('2d')
        if (ctx) {
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            if (props.colors) {
                const colorMap: Record<string, {r: number, g: number, b: number}> = {}
                {
                    const tmpCanvas = document.createElement('canvas')
                    tmpCanvas.width = 1
                    tmpCanvas.height = 1
                    const tmpCtx = tmpCanvas.getContext('2d')
                    if (!tmpCtx) {
                        throw new Error('Failed to initialize canvas context')
                    }
                    props.colors.forEach(color => {
                        tmpCtx.fillStyle = color
                        tmpCtx.fillRect(0, 0, 1, 1)
                        const data = tmpCtx.getImageData(0, 0, 1, 1).data
                        colorMap[`rgb(${data[0]},${data[1]},${data[2]})`] = {r: data[0], g: data[1], b: data[2]}
                    })
                }
                const colors = nearestColor.from(colorMap)
                const cacheColor: Record<number, {r: number, g: number, b: number}> = {}
                for (let x = 0; x < imageData.width; x++) {
                    for (let y = 0; y < imageData.height; y++) {
                        const i = (y * imageData.width + x) * 4
                        const color = (imageData.data[i] << 16) | (imageData.data[i + 1] << 8) | (imageData.data[i + 2])
                        let nearest = cacheColor[color]
                        if (!nearest) {
                            nearest = cacheColor[color] = colors({r: imageData.data[i], g: imageData.data[i + 1], b: imageData.data[i + 2]}).rgb
                        }
                        imageData.data[i] = nearest.r
                        imageData.data[i + 1] = nearest.g
                        imageData.data[i + 2] = nearest.b
                    }
                }
                ctx.putImageData(imageData, 0, 0)
            }
            props.setTemplate(imageData)
        }
    }, [image, size])
    function importTemplate(files: FileList | null) {
        if (!files) {
            return
        }
        if (files.length !== 1) {
            setImage(null)
            return
        }
        const reader = new FileReader()
        reader.onload = function() {
            const image = new Image()
            image.onload = function() {
                setImage(image)
            }
            image.src = reader.result as string
        }
        reader.readAsDataURL(files[0])
    }
    return (
        props.expanded ? (
            <div className="tool">
                <div className="flex">
                    <div className="flex-grow-1">Template</div>
                    <button className="close-cross-btn" onClick={() => props.setExpanded(false)}>X</button>
                </div>
                <div>
                    <input type="file" onChange={ev => importTemplate(ev.target.files)} />
                </div>
                <div>
                    <label>X: </label><input type="number" value={props.templatePosition.x} onChange={(ev) => props.setTemplatePosition({ x: +ev.target.value, y: props.templatePosition.y })} />
                </div>
                <div>
                    <label>Y: </label><input type="number" value={props.templatePosition.y} onChange={(ev) => props.setTemplatePosition({ x: props.templatePosition.x, y: +ev.target.value })} />
                </div>
                <div>
                    <label>Width: </label><input type="number" value={props.size.width} onChange={(ev) => props.setSize({ width: +ev.target.value, height: props.size.height })} />
                </div>
                <div>
                    <label>Height: </label><input type="number" value={props.size.height} onChange={(ev) => props.setSize({ width: props.size.width, height: +ev.target.value })} />
                </div>
                <div><label>Alpha: </label><input type="range" min="0" max="100" value={props.alpha * 100} className="slider" onChange={(ev) => props.setAlpha(+ev.target.value / 100)} /></div>
            </div>
        ) : (
            <button className={"tool"} title="Grid toggle" onClick={() => props.setExpanded(true)}>
                Template
            </button>
        )
    )
}

export default TemplateTool;