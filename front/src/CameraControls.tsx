import React from "react";

export const CameraControls: React.FC<{ drag: (offset: { x: number; y: number }) => void; scaleChange: (delta: number) => void; clickAt: (position: { x: number; y: number }) => void }> = function (props) {
    const [moving, setMoving] = React.useState(false);
    const [totalAbsMove, setTotalAbsMove] = React.useState({ x: 0, y: 0 });
    const [relativeMove, setRelativeMove] = React.useState({ x: 0, y: 0 });

    function isMoving() {
        return totalAbsMove.x * totalAbsMove.x + totalAbsMove.y * totalAbsMove.y > 50
    }
    function onMove(ev: React.PointerEvent<HTMLDivElement>) {
        const moveX = ev.movementX / window.devicePixelRatio
        const moveY = ev.movementY / window.devicePixelRatio
        if (moving) {
            setTotalAbsMove({ x: totalAbsMove.x + Math.abs(moveX), y: totalAbsMove.y + Math.abs(moveY) })
            if (isMoving()) {
                props.drag({
                    x: relativeMove.x + -moveX,
                    y: relativeMove.y + -moveY
                })
                setRelativeMove({ x: 0, y: 0 })
            } else {
                // Store the relative movement until the total target is reached
                setRelativeMove({ x: relativeMove.x + moveX, y: relativeMove.y + moveY })
            }
        }
    }
    function onWheel(ev: React.WheelEvent<HTMLDivElement>) {
        props.scaleChange(-ev.deltaY)
    }
    function onClick(ev: React.MouseEvent<HTMLDivElement>) {
        ev.preventDefault()
        if (moving) {
            return
        }
    }

    function onPointerDown() {
        setMoving(true)
        setTotalAbsMove({ x: 0, y: 0 })
        setRelativeMove({ x: 0, y: 0 })
    }

    function onPointerUp(ev: React.PointerEvent<HTMLDivElement>) {
        if (moving && !isMoving()) {
            props.clickAt({
                x: ev.clientX - ev.currentTarget.offsetLeft - ev.currentTarget.clientWidth / 2,
                y: ev.clientY - ev.currentTarget.offsetTop - ev.currentTarget.clientHeight / 2
            })
        }
        setMoving(false)
    }
    return (
        <div className="camera-controls" onPointerDown={onPointerDown} onPointerMove={onMove} onPointerUp={onPointerUp} onWheel={onWheel} onClick={onClick}></div>
    )
}