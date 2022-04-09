const ColorSelector: React.FC<{
    color: string | null;
    setColor: (color: string) => void;
    colors: string[] | null;
}> = function(props) {
    return (
        <div className="color-selector">
            {
                props.colors && props.colors.map(color => (
                    <button key={color} className={"color" + (color === props.color ? ' selected' : '')} onClick={() => props.setColor(color)}>
                        <span style={{ backgroundColor: color }}></span>
                    </button>
                ))
            }
        </div>
    )
}

export default ColorSelector;