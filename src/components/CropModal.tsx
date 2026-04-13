import React, { useState, useRef, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCrop: (croppedSrc: string) => void;
  onClose: () => void;
}

export default function CropModal({ imageSrc, onCrop, onClose }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (imageRef.current) {
      const img = imageRef.current;
      const handleLoad = () => {
        setCrop({
          x: img.width * 0.1,
          y: img.height * 0.1,
          width: img.width * 0.8,
          height: img.height * 0.8,
        });
      };
      if (img.complete) handleLoad();
      else img.addEventListener('load', handleLoad);
      return () => img.removeEventListener('load', handleLoad);
    }
  }, [imageSrc]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking inside the crop box
    if (x >= crop.x && x <= crop.x + crop.width && y >= crop.y && y <= crop.y + crop.height) {
      setIsDragging(true);
      setDragStart({ x: x - crop.x, y: y - crop.y });
    } else {
      // Start new crop
      setCrop({ x, y, width: 0, height: 0 });
      setIsDragging(true);
      setDragStart({ x, y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current || !imageRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, imageRef.current.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, imageRef.current.height));

    if (crop.width === 0 && crop.height === 0) {
      // Drawing new crop
      setCrop(prev => ({
        ...prev,
        width: x - prev.x,
        height: y - prev.y,
      }));
    } else {
      // Moving existing crop
      setCrop(prev => ({
        ...prev,
        x: x - dragStart.x,
        y: y - dragStart.y,
      }));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    // Normalize crop (handle negative width/height)
    setCrop(prev => {
      let { x, y, width, height } = prev;
      if (width < 0) {
        x += width;
        width = Math.abs(width);
      }
      if (height < 0) {
        y += height;
        height = Math.abs(height);
      }
      return { x, y, width, height };
    });
  };

  const applyCrop = () => {
    if (!imageRef.current || crop.width === 0 || crop.height === 0) return;
    
    const canvas = document.createElement('canvas');
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
    
    canvas.width = crop.width * scaleX;
    canvas.height = crop.height * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(
      imageRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY
    );
    
    onCrop(canvas.toDataURL('image/png'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-4xl w-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Crop Image</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 flex-1 flex items-center justify-center bg-gray-50 overflow-hidden">
          <div 
            ref={containerRef}
            className="relative select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
              ref={imageRef}
              src={imageSrc} 
              alt="To crop" 
              className="max-w-full max-h-[60vh] object-contain pointer-events-none"
              draggable={false}
            />
            
            {/* Crop Overlay */}
            <div className="absolute inset-0 bg-black/40 pointer-events-none" />
            
            {/* Crop Area */}
            <div 
              className="absolute border-2 border-blue-500 bg-transparent pointer-events-none"
              style={{
                left: Math.min(crop.x, crop.x + crop.width),
                top: Math.min(crop.y, crop.y + crop.height),
                width: Math.abs(crop.width),
                height: Math.abs(crop.height),
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)'
              }}
            >
              {/* Grid lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-r border-b border-white/30" />
                <div className="border-b border-white/30" />
                <div className="border-r border-white/30" />
                <div className="border-r border-white/30" />
                <div className="" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={applyCrop}
            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Check className="w-4 h-4" />
            Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
