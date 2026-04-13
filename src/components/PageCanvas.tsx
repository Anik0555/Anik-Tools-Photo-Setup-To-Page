import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as fabric from 'fabric';

export type PageSize = 'A4' | 'Legal';
export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_DIMENSIONS = {
  A4: { width: 794, height: 1123 },
  Legal: { width: 816, height: 1344 }
};

interface PageCanvasProps {
  id: string;
  index: number;
  size: PageSize;
  orientation: PageOrientation;
  isActive: boolean;
  showGrid: boolean;
  scale: number;
  onActivate: () => void;
  onSelectionChange: (hasSelection: boolean, objType: string | null, textProps?: any) => void;
  onCropStart: (src: string) => void;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  onDelete: () => void;
}

export interface PageCanvasRef {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  deleteSelected: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  addImages: (files: File[], clientX?: number, clientY?: number) => Promise<void>;
  addText: (text?: string) => void;
  updateTextProperty: (property: string, value: any) => void;
  exportPNG: (multiplier: number) => string | null;
  startCrop: () => void;
  applyCrop: (croppedSrc: string) => Promise<void>;
}

export const PageCanvas = forwardRef<PageCanvasRef, PageCanvasProps>(({
  id, index, size, orientation, isActive, showGrid, scale, onActivate, onSelectionChange, onCropStart, onHistoryChange, onDelete
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isHistoryAction = useRef(false);
  
  const [cropObject, setCropObject] = useState<fabric.Object | null>(null);

  const baseDim = PAGE_DIMENSIONS[size];
  const dim = orientation === 'landscape' 
    ? { width: baseDim.height, height: baseDim.width }
    : baseDim;

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const c = new fabric.Canvas(canvasRef.current, {
      width: dim.width,
      height: dim.height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
    });
    
    setCanvas(c);
    
    const initialState = JSON.stringify(c.toJSON());
    setHistory([initialState]);
    setHistoryIndex(0);

    const updateSelection = () => {
      const activeObject = c.getActiveObject();
      if (isActive) {
        let textProps = undefined;
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'text')) {
          const textObj = activeObject as fabric.IText;
          textProps = {
            fontFamily: textObj.fontFamily,
            fontSize: textObj.fontSize,
            fill: textObj.fill,
            textAlign: textObj.textAlign,
            fontWeight: textObj.fontWeight,
            fontStyle: textObj.fontStyle,
            underline: textObj.underline,
          };
        }
        onSelectionChange(!!activeObject, activeObject?.type || null, textProps);
      }
    };

    c.on('selection:created', updateSelection);
    c.on('selection:updated', updateSelection);
    c.on('selection:cleared', updateSelection);
    
    c.on('mouse:down', () => {
      onActivate();
      updateSelection();
    });

    const saveState = () => {
      if (isHistoryAction.current) return;
      const json = JSON.stringify(c.toJSON());
      
      setHistoryIndex(currentIndex => {
        setHistory(prev => {
          const newHistory = prev.slice(0, currentIndex + 1);
          newHistory.push(json);
          return newHistory;
        });
        return currentIndex + 1;
      });
    };

    c.on('object:modified', saveState);
    c.on('object:added', () => {
      if (!isHistoryAction.current) saveState();
    });
    c.on('object:removed', saveState);

    return () => {
      c.dispose();
    };
  }, []); // Run once

  // Update dimensions if size changes
  useEffect(() => {
    if (canvas) {
      canvas.setDimensions({ width: dim.width, height: dim.height });
      canvas.renderAll();
    }
  }, [size, canvas, dim.width, dim.height]);

  // Notify parent of history changes
  useEffect(() => {
    if (isActive) {
      onHistoryChange(historyIndex > 0, historyIndex < history.length - 1);
      const activeObject = canvas?.getActiveObject();
      let textProps = undefined;
      if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'text')) {
        const textObj = activeObject as fabric.IText;
        textProps = {
          fontFamily: textObj.fontFamily,
          fontSize: textObj.fontSize,
          fill: textObj.fill,
          textAlign: textObj.textAlign,
          fontWeight: textObj.fontWeight,
          fontStyle: textObj.fontStyle,
          underline: textObj.underline,
        };
      }
      onSelectionChange(!!activeObject, activeObject?.type || null, textProps);
    }
  }, [historyIndex, history.length, isActive, canvas]);

  useImperativeHandle(ref, () => ({
    undo: async () => {
      if (historyIndex > 0 && canvas) {
        isHistoryAction.current = true;
        const newIndex = historyIndex - 1;
        await canvas.loadFromJSON(JSON.parse(history[newIndex]));
        canvas.renderAll();
        setHistoryIndex(newIndex);
        
        const activeObject = canvas.getActiveObject();
        let textProps = undefined;
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'text')) {
          const textObj = activeObject as fabric.IText;
          textProps = { fontFamily: textObj.fontFamily, fontSize: textObj.fontSize, fill: textObj.fill, textAlign: textObj.textAlign, fontWeight: textObj.fontWeight, fontStyle: textObj.fontStyle, underline: textObj.underline };
        }
        onSelectionChange(!!activeObject, activeObject?.type || null, textProps);
        
        isHistoryAction.current = false;
      }
    },
    redo: async () => {
      if (historyIndex < history.length - 1 && canvas) {
        isHistoryAction.current = true;
        const newIndex = historyIndex + 1;
        await canvas.loadFromJSON(JSON.parse(history[newIndex]));
        canvas.renderAll();
        setHistoryIndex(newIndex);
        
        const activeObject = canvas.getActiveObject();
        let textProps = undefined;
        if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'text')) {
          const textObj = activeObject as fabric.IText;
          textProps = { fontFamily: textObj.fontFamily, fontSize: textObj.fontSize, fill: textObj.fill, textAlign: textObj.textAlign, fontWeight: textObj.fontWeight, fontStyle: textObj.fontStyle, underline: textObj.underline };
        }
        onSelectionChange(!!activeObject, activeObject?.type || null, textProps);
        
        isHistoryAction.current = false;
      }
    },
    clear: () => {
      if (!canvas) return;
      if (window.confirm('Are you sure you want to clear this page?')) {
        canvas.clear();
        canvas.backgroundColor = '#ffffff';
        canvas.renderAll();
        canvas.fire('object:modified');
      }
    },
    deleteSelected: () => {
      if (!canvas) return;
      const activeObjects = canvas.getActiveObjects();
      if (activeObjects.length) {
        canvas.discardActiveObject();
        activeObjects.forEach(obj => canvas.remove(obj));
      }
    },
    bringForward: () => {
      if (!canvas) return;
      const obj = canvas.getActiveObject();
      if (obj) {
        canvas.bringObjectForward(obj);
        canvas.renderAll();
        canvas.fire('object:modified');
      }
    },
    sendBackward: () => {
      if (!canvas) return;
      const obj = canvas.getActiveObject();
      if (obj) {
        canvas.sendObjectBackwards(obj);
        canvas.renderAll();
        canvas.fire('object:modified');
      }
    },
    addText: (text = 'Double click to edit') => {
      if (!canvas) return;
      const iText = new fabric.IText(text, {
        left: dim.width / 2,
        top: dim.height / 2,
        originX: 'center',
        originY: 'center',
        fontFamily: 'Inter, sans-serif',
        fontSize: 40,
        fill: '#1f2937',
        cornerStyle: 'circle',
        cornerColor: '#3b82f6',
        borderColor: '#3b82f6',
        transparentCorners: false,
      });
      canvas.add(iText);
      canvas.setActiveObject(iText);
      canvas.renderAll();
      canvas.fire('object:modified');
    },
    updateTextProperty: (property: string, value: any) => {
      if (!canvas) return;
      const activeObject = canvas.getActiveObject();
      if (activeObject && (activeObject.type === 'i-text' || activeObject.type === 'textbox' || activeObject.type === 'text')) {
        activeObject.set(property as keyof fabric.IText, value);
        canvas.renderAll();
        canvas.fire('object:modified');
      }
    },
    addImages: async (files: File[], clientX?: number, clientY?: number) => {
      if (!canvas) return;
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (f) => {
          const data = f.target?.result as string;
          try {
            const img = await fabric.FabricImage.fromURL(data);
            
            if (img.width > dim.width * 0.8 || img.height > dim.height * 0.8) {
              const imgScale = Math.min((dim.width * 0.8) / img.width, (dim.height * 0.8) / img.height);
              img.scale(imgScale);
            }
            
            let left = dim.width / 2;
            let top = dim.height / 2;
            
            if (clientX !== undefined && clientY !== undefined && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = (clientX - rect.left) / scale;
              const y = (clientY - rect.top) / scale;
              left = Math.max(0, Math.min(dim.width, x));
              top = Math.max(0, Math.min(dim.height, y));
            }

            img.set({
              left,
              top,
              originX: 'center',
              originY: 'center',
              cornerStyle: 'circle',
              cornerColor: '#3b82f6',
              borderColor: '#3b82f6',
              transparentCorners: false,
            });
            
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
          } catch (err) {
            console.error("Error loading image:", err);
          }
        };
        reader.readAsDataURL(file);
      }
    },
    exportPNG: (multiplier: number) => {
      if (!canvas) return null;
      canvas.discardActiveObject();
      canvas.renderAll();
      return canvas.toDataURL({
        format: 'png',
        multiplier,
        quality: 1
      });
    },
    startCrop: () => {
      const obj = canvas?.getActiveObject();
      if (obj && obj.type === 'image') {
        setCropObject(obj);
        onCropStart((obj as fabric.FabricImage).getSrc());
      }
    },
    applyCrop: async (croppedSrc: string) => {
      if (!canvas || !cropObject) return;
      try {
        const newImg = await fabric.FabricImage.fromURL(croppedSrc);
        newImg.set({
          left: cropObject.left,
          top: cropObject.top,
          scaleX: cropObject.scaleX,
          scaleY: cropObject.scaleY,
          angle: cropObject.angle,
          originX: cropObject.originX,
          originY: cropObject.originY,
          cornerStyle: 'circle',
          cornerColor: '#3b82f6',
          borderColor: '#3b82f6',
          transparentCorners: false,
        });
        canvas.add(newImg);
        canvas.remove(cropObject);
        canvas.setActiveObject(newImg);
        canvas.renderAll();
        setCropObject(null);
      } catch (err) {
        console.error("Error applying crop:", err);
      }
    }
  }));

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files) as File[];
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      onActivate();
      // Call addImages on self
      ref && typeof ref !== 'function' && ref.current?.addImages(imageFiles, e.clientX, e.clientY);
    }
  };

  return (
    <div 
      className="relative mb-12 transition-all duration-200 flex flex-col items-center"
      style={{ width: dim.width * scale, height: dim.height * scale }}
    >
      {/* Page Header */}
      <div className="absolute -top-8 left-0 right-0 flex justify-between items-center z-10">
        <span className="text-gray-500 font-medium text-sm capitalize">Page {index + 1} ({size} {orientation})</span>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-red-500 hover:text-red-700 text-sm font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
        >
          Delete Page
        </button>
      </div>

      <div 
        ref={containerRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={onActivate}
        className={`absolute top-0 left-0 shadow-2xl bg-white transition-all duration-200 ease-out cursor-default ${isActive ? 'ring-4 ring-blue-500' : 'ring-1 ring-gray-300'}`}
        style={{ 
          width: dim.width, 
          height: dim.height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <canvas ref={canvasRef} />
        
        {/* Grid Overlay */}
        {showGrid && (
          <div 
            className="absolute inset-0 pointer-events-none opacity-30" 
            style={{
              backgroundImage: 'linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} 
          />
        )}
        
        {/* Printable Area Border (0.5 inch margin = 48px at 96 DPI) */}
        <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-gray-400 opacity-30" style={{ margin: '48px' }} />
      </div>
    </div>
  );
});
