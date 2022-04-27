import { useState } from "react";
import './App.css';
import { CameraControls } from './CameraControls';
import { CanvasRenderer } from './CanvasRenderer';
import ColorSelector from './ColorSelector';
import TemplateTool from "./TemplateTool";
import { useWs } from './useWs';

function App() {
  const [colors, setColors] = useState<string[] | null>(null);
  const [color, setColor] = useState<string | null>(null)
  const [image, setImage] = useState<HTMLCanvasElement | undefined>()
  const [target, setTarget] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 0, height: 0 })
  const [gridEnabled, setGridEnabled] = useState(true)
  const room = new URLSearchParams(window.location.search).get('room') || 'room1'
  const [setPixel] = useWs(room, viewport, setImage, setColors)
  const [templateToolExpanded, setTemplateToolExanded] = useState<boolean>(false)
  const [templatePosition, setTemplatePosition] = useState({ x: 0, y: 0 })
  const [templateSize, setTemplateSize] = useState({ width: 0, height: 0 })
  const [templateAlpha, setTemplateAlpha] = useState(0.5)
  const [templateData, setTemplate] = useState<ImageData | null>(null)

  function drag(offset: {x: number; y: number}) {
    setTarget({
      x: target.x + offset.x / scale,
      y: target.y + offset.y / scale
    })
  }
  function scaleChange(delta: number) {
    const newScale = Math.max(Math.min(scale + delta / 100, 60), 1)
    setScale(newScale)
  }

  function clickAt(position: {x: number; y: number}) {
    if (!color) {
      return
    }
    const localPosition = {
      x: Math.floor(position.x / scale * window.devicePixelRatio + target.x),
      y: Math.floor(position.y / scale * window.devicePixelRatio + target.y)
    }
    
    setPixel(localPosition.x, localPosition.y, color)
  }

  function updateViewport(viewport: {x: number; y: number; width: number; height: number}) {
    setViewport(viewport)
  }

  return (
    <div className="app">
      <div className="viewer">
        <CanvasRenderer image={image} target={target} scale={scale} gridEnabled={gridEnabled} updateViewport={updateViewport} templateData={templateData} templatePosition={templatePosition} templateAlpha={templateAlpha} />

        <CameraControls drag={drag} scaleChange={scaleChange} clickAt={clickAt} />
      </div>

      <div className="position-viewer">
        <div className="position">
          {Math.floor(target.x)} ; {Math.floor(target.y)}
        </div>
      </div>

      <div className="tools">
        <button className={"tool" + (gridEnabled ? ' activated' : '')} title="Grid toggle" onClick={() => setGridEnabled(!gridEnabled)}>
          Grid
        </button>
        <TemplateTool expanded={templateToolExpanded} setExpanded={setTemplateToolExanded} templatePosition={templatePosition} setTemplatePosition={setTemplatePosition} colors={colors} setTemplate={setTemplate} alpha={templateAlpha} setAlpha={setTemplateAlpha} size={templateSize} setSize={setTemplateSize} />
      </div>

      <ColorSelector color={color} setColor={setColor} colors={colors} />
    </div>
  );
}


export default App;
