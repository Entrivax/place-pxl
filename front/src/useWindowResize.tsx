import { useLayoutEffect, useState } from 'react';

export default function useWindowSize(): [[number, number], number] {
    const [size, setSize] = useState<[number, number]>([0, 0]);
    const [updateCounter, setUpdateCounter] = useState(0);
    useLayoutEffect(() => {
        function updateSize() {
            setSize([window.innerWidth, window.innerHeight]);
            setUpdateCounter(updateCounter + 1);
        }
        window.addEventListener('resize', updateSize);
        const interval = setInterval(updateSize, 1000);
        updateSize();
        return () => {
            window.removeEventListener('resize', updateSize);
            clearInterval(interval);
        }
    }, []);
    return [size, updateCounter];
}