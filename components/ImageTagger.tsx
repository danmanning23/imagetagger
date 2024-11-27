"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Trash2 } from 'lucide-react';

interface BilingualText {
    en: string;
    es: string;
}

interface Hotspot {
    id: number;
    label: BilingualText;
    message: BilingualText;
    startX: number;
    startY: number;
    width: number;
    height: number;
}

interface ImportedHotspot {
    id?: number;
    label: BilingualText;
    message: BilingualText;
    position: {
        x: number;
        y: number;
        width: number;
        height: number;
    }
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
    const [sceneName, setSceneName] = useState<BilingualText>({ en: '', es: '' });
    const [sceneMessage, setSceneMessage] = useState<BilingualText>({ en: '', es: '' });
    const [sceneOrder, setSceneOrder] = useState('0');
    const [selectedHotspotId, setSelectedHotspotId] = useState<number | null>(null);
    const [imageFile, setImageFile] = useState<string>('');

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

    const handleImageUpload = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const files = evt.target.files;
        if (!files?.[0]) return;

        setImageFile(files[0].name);
        const reader = new FileReader();
        reader.onload = (event) => {
            if (!event.target?.result) return;

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
            img.src = event.target.result as string;
        };
        reader.readAsDataURL(files[0]);
    };

    const handleImportJSON = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    const data = JSON.parse(content);

                    if (!data.sceneName || !Array.isArray(data.hotspots)) {
                        throw new Error('Invalid JSON format');
                    }

                    const img = new Image();
                    img.onload = () => {
                        setImage(img);
                        if (canvasRef.current) {
                            canvasRef.current.width = data.imageWidth;
                            canvasRef.current.height = data.imageHeight;
                        }
                    };
                    img.src = '/api/placeholder/' + data.imageWidth + '/' + data.imageHeight;

                    setSceneName(data.sceneName);
                    setSceneMessage(data.sceneMessage || { en: '', es: '' });
                    setSceneOrder(data.order?.toString() || '0');
                    setImageFile(data.imageFile || '');

                    const convertedHotspots = data.hotspots.map((spot: ImportedHotspot) => ({
                        id: spot.id || Date.now(),
                        label: spot.label,
                        message: spot.message,
                        startX: Math.round(spot.position.x),
                        startY: Math.round(spot.position.y),
                        width: Math.round(spot.position.width),
                        height: Math.round(spot.position.height)
                    }));

                    setHotspots(convertedHotspots);
                } catch (error) {
                    alert('Error importing JSON: ' + (error as Error).message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
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

    const stopDrawing = () => {
        if (!isDrawing || !currentBox) return;
        setIsDrawing(false);

        if (Math.abs(currentBox.width) > 5 && Math.abs(currentBox.height) > 5) {
            const normalizedBox: Hotspot = {
                startX: currentBox.width < 0 ? currentBox.startX + currentBox.width : currentBox.startX,
                startY: currentBox.height < 0 ? currentBox.startY + currentBox.height : currentBox.startY,
                width: Math.abs(currentBox.width),
                height: Math.abs(currentBox.height),
                label: { en: `Area ${hotspots.length + 1}`, es: `Área ${hotspots.length + 1}` },
                message: { en: '', es: '' },
                id: Date.now()
            };
            setHotspots(prev => [...prev, normalizedBox]);
            setSelectedHotspotId(normalizedBox.id);
        }
        setCurrentBox(null);
    };

    const updateHotspotLabel = (id: number, lang: 'en' | 'es', value: string) => {
        setHotspots(prev => prev.map(spot =>
            spot.id === id ? {
                ...spot,
                label: { ...spot.label, [lang]: value }
            } : spot
        ));
    };

    const updateHotspotMessage = (id: number, lang: 'en' | 'es', value: string) => {
        setHotspots(prev => prev.map(spot =>
            spot.id === id ? {
                ...spot,
                message: { ...spot.message, [lang]: value }
            } : spot
        ));
    };

    const deleteHotspot = (id: number) => {
        setHotspots(prev => prev.filter(spot => spot.id !== id));
        if (selectedHotspotId === id) {
            setSelectedHotspotId(null);
        }
    };

    const exportJSON = () => {
        if (!sceneName.en || !image) {
            alert('Please enter a scene name and upload an image');
            return;
        }

        const sceneData = {
            sceneName,
            sceneMessage,
            order: parseInt(sceneOrder),
            imageFile,
            imageWidth: image.width,
            imageHeight: image.height,
            hotspots: hotspots.map(spot => ({
                id: spot.id,
                label: spot.label,
                message: spot.message,
                position: {
                    x: Math.round(spot.startX),
                    y: Math.round(spot.startY),
                    width: Math.round(spot.width),
                    height: Math.round(spot.height)
                }
            }))
        };

        const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sceneName.en}.json`;
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
            const textMetrics = ctx.measureText(spot.label.en);
            const textWidth = textMetrics.width;
            const textX = spot.startX + (spot.width / 2) - (textWidth / 2);
            let textY = spot.startY + spot.height + 40;

            if (textY > canvas.height) {
                textY = spot.startY - 10;
            }

            ctx.fillText(spot.label.en, textX, textY);
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
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Scene Name</Label>
                    <div className="space-y-2">
                        <Input
                            value={sceneName.en}
                            onChange={(e) => setSceneName(prev => ({ ...prev, en: e.target.value }))}
                            placeholder="Enter scene name (English)"
                            className="max-w-xs"
                        />
                        <Input
                            value={sceneName.es}
                            onChange={(e) => setSceneName(prev => ({ ...prev, es: e.target.value }))}
                            placeholder="Enter scene name (Spanish)"
                            className="max-w-xs"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label>Scene Message</Label>
                    <div className="space-y-2">
                        <Input
                            value={sceneMessage.en}
                            onChange={(e) => setSceneMessage(prev => ({ ...prev, en: e.target.value }))}
                            placeholder="Enter scene message (English)"
                            className="max-w-xs"
                        />
                        <Input
                            value={sceneMessage.es}
                            onChange={(e) => setSceneMessage(prev => ({ ...prev, es: e.target.value }))}
                            placeholder="Enter scene message (Spanish)"
                            className="max-w-xs"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="scene-order">Order</Label>
                    <Input
                        id="scene-order"
                        type="number"
                        value={sceneOrder}
                        onChange={(e) => setSceneOrder(e.target.value)}
                        className="max-w-xs"
                    />
                </div>
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
                    onClick={handleImportJSON}
                    className="flex items-center space-x-2"
                >
                    <Upload className="w-4 h-4" />
                    <span>Import JSON</span>
                </Button>

                <Button
                    onClick={exportJSON}
                    disabled={!image || !sceneName.en}
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
                        <h3 className="text-lg font-medium">Areas</h3>
                        <div className="space-y-2">
                            {hotspots.map(spot => (
                                <div
                                    key={spot.id}
                                    className={`p-3 border rounded-lg space-y-2 ${selectedHotspotId === spot.id ? 'border-yellow-400 bg-yellow-50' : ''
                                        }`}
                                    onClick={() => setSelectedHotspotId(spot.id)}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-grow space-y-2">
                                            <Input
                                                value={spot.label.en}
                                                onChange={(e) => updateHotspotLabel(spot.id, 'en', e.target.value)}
                                                placeholder="Area Label (English)"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <Input
                                                value={spot.label.es}
                                                onChange={(e) => updateHotspotLabel(spot.id, 'es', e.target.value)}
                                                placeholder="Area Label (Spanish)"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
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
                                    <div className="space-y-2">
                                        <Input
                                            value={spot.message.en}
                                            onChange={(e) => updateHotspotMessage(spot.id, 'en', e.target.value)}
                                            placeholder="Message (English)"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <Input
                                            value={spot.message.es}
                                            onChange={(e) => updateHotspotMessage(spot.id, 'es', e.target.value)}
                                            placeholder="Message (Spanish)"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
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