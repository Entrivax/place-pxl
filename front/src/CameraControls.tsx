import React from "react";

export const CameraControls: React.FC<{ drag: (offset: { x: number; y: number }) => void; scaleChange: (delta: number) => void; clickAt: (position: { x: number; y: number }) => void }> = function (props) {
    const [moving, setMoving] = React.useState(false);
    const [totalAbsMove, setTotalAbsMove] = React.useState({ x: 0, y: 0 });
    const [relativeMove, setRelativeMove] = React.useState({ x: 0, y: 0 });
    const [lastPositions, setLastPositions] = React.useState<{ pointerId: number, x: number, y: number }[]>([])

    function isMoving() {
        return totalAbsMove.x * totalAbsMove.x + totalAbsMove.y * totalAbsMove.y > 50
    }
    function onMove(ev: React.PointerEvent<HTMLDivElement>) {
        const moveX = ev.movementX
        const moveY = ev.movementY
        if (lastPositions.length === 2) {
            const otherPosition = lastPositions.find(pos => pos.pointerId !== ev.pointerId)
            if (otherPosition) {
                const oldDistance = Math.pow(lastPositions[0].x - lastPositions[1].x, 2) + Math.pow(lastPositions[0].y - lastPositions[1].y, 2)
                const newDistance = Math.pow(ev.pageX - otherPosition.x, 2) + Math.pow(ev.pageY - otherPosition.y, 2)
                props.scaleChange(Math.sqrt(newDistance) - Math.sqrt(oldDistance))
            }
        }
        setLastPositions(lastPositions.map(pos => pos.pointerId === ev.pointerId ? { pointerId: ev.pointerId, x: ev.pageX, y: ev.pageY } : pos))
        if (moving) {
            setTotalAbsMove({ x: totalAbsMove.x + Math.abs(moveX), y: totalAbsMove.y + Math.abs(moveY) })
            if (isMoving() || lastPositions.length > 1) {
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

    function onPointerDown(ev: React.PointerEvent<HTMLDivElement>) {
        setMoving(true)
        setTotalAbsMove({ x: 0, y: 0 })
        setRelativeMove({ x: 0, y: 0 })
        setLastPositions(lastPositions.concat([{ pointerId: ev.pointerId, x: ev.pageX, y: ev.pageY }]))
    }

    function onPointerUp(ev: React.PointerEvent<HTMLDivElement>) {
        if (moving && !isMoving() && lastPositions.length === 1) {
            props.clickAt({
                x: ev.clientX - ev.currentTarget.offsetLeft - ev.currentTarget.clientWidth / 2,
                y: ev.clientY - ev.currentTarget.offsetTop - ev.currentTarget.clientHeight / 2
            })
        }
        const newPositions = lastPositions.filter(pos => pos.pointerId !== ev.pointerId)
        setLastPositions(newPositions)
        if (newPositions.length === 0) {
            setMoving(false)
        }
    }
    return (
        <div className="camera-controls" onPointerDown={onPointerDown} onPointerMove={onMove} onPointerUp={onPointerUp} onWheel={onWheel} onClick={onClick}></div>
    )
}