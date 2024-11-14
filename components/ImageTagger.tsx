"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Trash2 } from 'lucide-react';

interface Hotspot {
    id: number;
    label: string;
    startX: number;
    startY: number;
    width: number;
    height: number;
}

interface Box {
    startX: number;
    startY: number;
    width: number;
    height: number;
}

const ImageTagger = () => {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [hotspots, setHotspots] = useState<Hotspot[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentBox, setCurrentBox] = useState<Box | null>(null);
    const [sceneName, setSceneName] = useState('');
    const [selectedHotspotId, setSelectedHotspotId] = useState<number | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const getScaledCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;
        return { x, y };
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const aspectRatio = img.width / img.height;
                    if (Math.abs(aspectRatio - 2) > 0.1) {
                        alert('Please upload an image with approximately 2:1 aspect ratio');
                        return;
                    }
                    setImage(img);
                    if (canvasRef.current) {
                        canvasRef.current.width = img.width;
                        canvasRef.current.height = img.height;
                    }
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const startDrawing = (e: React.MouseEvent) => {
        const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
        setIsDrawing(true);
        setCurrentBox({
            startX: x,
            startY: y,
            width: 0,
            height: 0
        });
    };

    const draw = (e: React.MouseEvent) => {
        if (!isDrawing || !currentBox) return;
        const { x, y } = getScaledCoordinates(e.clientX, e.clientY);
        setCurrentBox(prev => {
            if (!prev) return null;
            return {
                ...prev,
                width: x - prev.startX,
                height: y - prev.startY
            };
        });
    };

    const stopDrawing = (e: React.MouseEvent) => {
        if (!isDrawing || !currentBox) return;
        setIsDrawing(false);

        if (Math.abs(currentBox.width) > 5 && Math.abs(currentBox.height) > 5) {
            const normalizedBox: Hotspot = {
                startX: currentBox.width < 0 ? currentBox.startX + currentBox.width : currentBox.startX,
                startY: currentBox.height < 0 ? currentBox.startY + currentBox.height : currentBox.startY,
                width: Math.abs(currentBox.width),
                height: Math.abs(currentBox.height),
                label: `Hotspot ${hotspots.length + 1}`,
                id: Date.now()
            };
            setHotspots(prev => [...prev, normalizedBox]);
            setSelectedHotspotId(normalizedBox.id);
        }
        setCurrentBox(null);
    };

    const updateHotspotLabel = (id: number, newLabel: string) => {
        setHotspots(prev => prev.map(spot =>
            spot.id === id ? { ...spot, label: newLabel } : spot
        ));
    };

    const deleteHotspot = (id: number) => {
        setHotspots(prev => prev.filter(spot => spot.id !== id));
        if (selectedHotspotId === id) {
            setSelectedHotspotId(null);
        }
    };

    const exportJSON = () => {
        if (!sceneName || !image) {
            alert('Please enter a scene name and upload an image');
            return;
        }

        const sceneData = {
            sceneName,
            imageWidth: image.width,
            imageHeight: image.height,
            hotspots: hotspots.map(spot => ({
                id: spot.id,
                label: spot.label,
                position: {
                    x: Math.round(spot.startX),
                    y: Math.round(image.height - (spot.startY + spot.height)),
                    width: Math.round(spot.width),
                    height: Math.round(spot.height)
                }
            }))
        };

        const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sceneName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => {
        if (!canvasRef.current || !image) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        hotspots.forEach(spot => {
            ctx.strokeStyle = spot.id === selectedHotspotId ? '#FFD700' : '#ADFD6F';
            ctx.lineWidth = 16;
            ctx.strokeRect(spot.startX, spot.startY, spot.width, spot.height);

            ctx.font = '34px Poppins';
            ctx.fillStyle = spot.id === selectedHotspotId ? '#FFD700' : '#ADFD6F';
            const textMetrics = ctx.measureText(spot.label);
            const textWidth = textMetrics.width;

            let textX = spot.startX + (spot.width / 2) - (textWidth / 2);
            let textY = spot.startY + spot.height + 40;

            if (textY > canvas.height) {
                textY = spot.startY - 10;
            }

            ctx.fillText(spot.label, textX, textY);
        });

        if (currentBox) {
            ctx.strokeStyle = '#ADFD6F';
            ctx.lineWidth = 16;
            ctx.strokeRect(
                currentBox.startX,
                currentBox.startY,
                currentBox.width,
                currentBox.height
            );
        }
    }, [image, hotspots, currentBox, selectedHotspotId]);

    return (
        <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="scene-name">Scene Name</Label>
                <Input
                    id="scene-name"
                    value={sceneName}
                    onChange={(e) => setSceneName(e.target.value)}
                    placeholder="Enter scene name"
                    className="max-w-xs"
                />
            </div>

            <div className="flex items-center space-x-4">
                <Button
                    onClick={() => document.getElementById('image-upload')?.click()}
                    className="flex items-center space-x-2"
                >
                    <Upload className="w-4 h-4" />
                    <span>Upload Image (2:1)</span>
                </Button>

                <Button
                    onClick={exportJSON}
                    disabled={!image || !sceneName}
                    className="flex items-center space-x-2"
                >
                    <Download className="w-4 h-4" />
                    <span>Export JSON</span>
                </Button>
            </div>

            <input
                type="file"
                id="image-upload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
            />

            {image && (
                <>
                    <div ref={containerRef} className="relative border rounded-lg overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            width={image.width}
                            height={image.height}
                            className="w-full h-full"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                        />
                        <img
                            ref={imageRef}
                            src={image.src}
                            className="hidden"
                            alt="Original"
                        />
                    </div>

                    <div className="mt-4 space-y-2">
                        <h3 className="text-lg font-medium">Hotspots</h3>
                        <div className="space-y-2">
                            {hotspots.map(spot => (
                                <div
                                    key={spot.id}
                                    className={`p-3 border rounded-lg flex items-center space-x-4 ${selectedHotspotId === spot.id ? 'border-yellow-400 bg-yellow-50' : ''
                                        }`}
                                    onClick={() => setSelectedHotspotId(spot.id)}
                                >
                                    <Input
                                        value={spot.label}
                                        onChange={(e) => updateHotspotLabel(spot.id, e.target.value)}
                                        className="flex-grow"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteHotspot(spot.id);
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ImageTagger;