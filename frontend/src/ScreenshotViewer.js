import React, { useState } from "react";

const ScreenshotViewer = ({ screenshots, initialIndex, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragStart, setDragStart] = useState(null); // Track the starting point of a drag

    const handleWheel = (e) => {
        e.preventDefault();
        const zoomChange = e.deltaY > 0 ? -0.1 : 0.1; // Scroll up zooms in, scroll down zooms out
        setZoomLevel((prev) => Math.max(prev + zoomChange, 1)); // Clamp zoom to a minimum of 1x
    };

    const handleMouseDown = (e) => {
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e) => {
        if (!dragStart || zoomLevel === 1) return; // No dragging if not zoomed in
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        setOffset((prev) => ({
            x: prev.x + dx,
            y: prev.y + dy,
        }));

        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        setDragStart(null); // Reset dragging
    };

    const resetZoomAndPan = () => {
        setZoomLevel(1);
        setOffset({ x: 0, y: 0 });
    };

    const nextScreenshot = () => {
        setCurrentIndex((prev) => (prev + 1) % screenshots.length);
        resetZoomAndPan();
    };

    const prevScreenshot = () => {
        setCurrentIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
        resetZoomAndPan();
    };

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000,
                overflow: "hidden", // Prevent content from overflowing outside the modal
            }}
            onWheel={handleWheel}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // Stop dragging if the cursor leaves the modal
        >
            {/* Close Button */}
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    zIndex: 100,
                    background: "#fff",
                    border: "none",
                    padding: "10px",
                    borderRadius: "5px",
                    cursor: "pointer",
                }}
            >
                &times;
            </button>

            {/* Screenshot Image */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}
                onMouseDown={handleMouseDown}
            >
                <img
                    src={screenshots[currentIndex]}
                    alt={`Screenshot ${currentIndex + 1}`}
                    draggable={false} // Disable default dragging of the image
                    style={{
                        transform: `scale(${zoomLevel}) translate(${offset.x / zoomLevel}px, ${offset.y / zoomLevel}px)`,
                        transformOrigin: "center center",
                        cursor: zoomLevel > 1 ? (dragStart ? "grabbing" : "grab") : "zoom-in",
                        transition: dragStart ? "none" : "transform 0.2s ease",
                    }}
                />
            </div>

            {/* Navigation Buttons */}
            {screenshots.length > 1 && (
                <div style={{ position: "absolute", bottom: "20px", zIndex: 100, display: "flex", gap: "10px" }}>
                    <button
                        onClick={prevScreenshot}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#333",
                            color: "#fff",
                            border: "1px solid #fff",
                            borderRadius: "5px",
                            cursor: "pointer",
                        }}
                    >
                        Previous
                    </button>
                    <button
                        onClick={nextScreenshot}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#333",
                            color: "#fff",
                            border: "1px solid #fff",
                            borderRadius: "5px",
                            cursor: "pointer",
                        }}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Reset Button */}
            {zoomLevel > 1 && (
                <button
                    onClick={resetZoomAndPan}
                    style={{
                        position: "absolute",
                        bottom: "80px",
                        right: "20px",
                        zIndex: 100,
                        background: "#333",
                        color: "#fff",
                        border: "none",
                        padding: "10px",
                        borderRadius: "5px",
                        cursor: "pointer",
                    }}
                >
                    Reset
                </button>
            )}
        </div>
    );
};

export default ScreenshotViewer;
