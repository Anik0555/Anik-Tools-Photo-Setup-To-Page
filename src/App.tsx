import React, { useEffect, useRef, useState } from 'react';
import { 
  Upload, 
  Undo, 
  Redo, 
  BringToFront, 
  SendToBack, 
  Crop, 
  Trash2, 
  Grid3X3, 
  Download,
  Image as ImageIcon,
  Layers,
  Plus,
  Settings,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';
import CropModal from './components/CropModal';
import { PageCanvas, PageCanvasRef, PageSize, PageOrientation, PAGE_DIMENSIONS } from './components/PageCanvas';

const EXPORT_MULTIPLIER = 3.125; // 300 DPI / 96 DPI

interface PageData {
  id: string;
  size: PageSize;
  orientation: PageOrientation;
}

export default function App() {
  const [pages, setPages] = useState<PageData[]>([{ id: 'page-1', size: 'A4', orientation: 'portrait' }]);
  const [activePageId, setActivePageId] = useState<string>('page-1');
  const pageRefs = useRef<Record<string, PageCanvasRef | null>>({});
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedObjType, setSelectedObjType] = useState<string | null>(null);
  const [textProps, setTextProps] = useState<any>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  const [cropData, setCropData] = useState<{ src: string, pageId: string } | null>(null);

  // Handle responsive scaling
  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.clientWidth - 80; // 40px padding on each side
        // Find max width among all pages
        const maxWidth = Math.max(...pages.map(p => {
          const dim = PAGE_DIMENSIONS[p.size];
          return p.orientation === 'landscape' ? dim.height : dim.width;
        }));
        
        const newScale = Math.min(containerWidth / maxWidth, 1);
        setScale(newScale);
      }
    };

    window.addEventListener('resize', updateScale);
    updateScale();
    setTimeout(updateScale, 100);
    return () => window.removeEventListener('resize', updateScale);
  }, [pages]);

  const activeRef = pageRefs.current[activePageId];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !activeRef) return;
    const files = Array.from(e.target.files) as File[];
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    await activeRef.addImages(imageFiles);
    e.target.value = '';
  };

  const addPage = (size: PageSize = 'A4', orientation: PageOrientation = 'portrait') => {
    const newId = `page-${Date.now()}`;
    setPages(prev => [...prev, { id: newId, size, orientation }]);
    setActivePageId(newId);
  };

  const deletePage = (id: string) => {
    if (pages.length === 1) {
      alert("You must have at least one page.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this page?")) {
      setPages(prev => prev.filter(p => p.id !== id));
      if (activePageId === id) {
        const remaining = pages.filter(p => p.id !== id);
        setActivePageId(remaining[0].id);
      }
      delete pageRefs.current[id];
    }
  };

  const changePageSize = (id: string, newSize: PageSize) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, size: newSize } : p));
  };

  const changePageOrientation = (id: string, newOrientation: PageOrientation) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, orientation: newOrientation } : p));
  };

  const exportAll = async () => {
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const ref = pageRefs.current[page.id];
      if (ref) {
        const dataURL = ref.exportPNG(EXPORT_MULTIPLIER);
        if (dataURL) {
          const link = document.createElement('a');
          link.download = `page-${i + 1}-hd.png`;
          link.href = dataURL;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Small delay to allow browser to process downloads
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  };

  const handleCropComplete = async (croppedSrc: string) => {
    if (cropData) {
      await pageRefs.current[cropData.pageId]?.applyCrop(croppedSrc);
      setCropData(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        activeRef?.deleteSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          activeRef?.redo();
        } else {
          activeRef?.undo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        activeRef?.redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeRef]);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col font-sans">
      {/* Top Toolbar */}
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between shadow-sm z-20 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-2 rounded-xl shadow-md">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 hidden sm:block tracking-tight leading-none">
                Anik Tools
              </h1>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hidden sm:block mt-0.5">
                Professional Print Layout
              </span>
            </div>
          </div>
          
          <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block" />
          
          <button 
            onClick={() => addPage('A4')}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add A4</span>
          </button>
          <button 
            onClick={() => addPage('Legal')}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Legal</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 rounded-lg p-1 mr-2 sm:mr-4">
            <button 
              onClick={() => activeRef?.undo()} 
              disabled={!canUndo}
              className="p-1.5 sm:p-2 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              title="Undo (Ctrl+Z)"
            >
              <Undo className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button 
              onClick={() => activeRef?.redo()} 
              disabled={!canRedo}
              className="p-1.5 sm:p-2 rounded hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
              title="Redo (Ctrl+Y)"
            >
              <Redo className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          <label className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg cursor-pointer font-medium transition-colors text-sm sm:text-base">
            <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Images</span>
            <input 
              type="file" 
              multiple 
              accept="image/*" 
              className="hidden" 
              onChange={handleImageUpload} 
            />
          </label>

          <button 
            onClick={() => activeRef?.addText()}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors text-sm sm:text-base"
          >
            <Type className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Add Text</span>
          </button>

          <button 
            onClick={() => setShowGrid(!showGrid)}
            className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-medium transition-colors text-sm sm:text-base ${showGrid ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            <Grid3X3 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          <button 
            onClick={exportAll}
            className="flex items-center gap-2 px-4 py-1.5 sm:px-6 sm:py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium shadow-sm transition-colors ml-1 sm:ml-2 text-sm sm:text-base"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Export All HD</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Contextual Sidebar */}
        <aside className="w-16 sm:w-64 bg-white border-r flex flex-col items-center sm:items-stretch py-4 shadow-sm z-10 overflow-y-auto">
          <div className="px-4 pb-2 mb-2 border-b hidden sm:block">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Properties</h2>
          </div>
          
          {hasSelection ? (
            <div className="flex flex-col gap-2 px-2 sm:px-4">
              <button 
                onClick={() => activeRef?.bringForward()}
                className="flex items-center justify-center sm:justify-start gap-3 p-3 sm:px-4 sm:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Bring Forward"
              >
                <BringToFront className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Bring Forward</span>
              </button>
              
              <button 
                onClick={() => activeRef?.sendBackward()}
                className="flex items-center justify-center sm:justify-start gap-3 p-3 sm:px-4 sm:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Send Backward"
              >
                <SendToBack className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Send Backward</span>
              </button>
              
              {selectedObjType === 'image' && (
                <button 
                  onClick={() => activeRef?.startCrop()}
                  className="flex items-center justify-center sm:justify-start gap-3 p-3 sm:px-4 sm:py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Crop Image"
                >
                  <Crop className="w-5 h-5" />
                  <span className="hidden sm:inline font-medium">Crop Image</span>
                </button>
              )}

              {(selectedObjType === 'i-text' || selectedObjType === 'textbox' || selectedObjType === 'text') && textProps && (
                <div className="mt-2 space-y-3 border-t pt-3 hidden sm:block">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Text Settings</h3>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Color</label>
                    <input 
                      type="color" 
                      value={textProps.fill || '#000000'}
                      onChange={(e) => activeRef?.updateTextProperty('fill', e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Font Family</label>
                    <select 
                      value={textProps.fontFamily || 'Inter, sans-serif'}
                      onChange={(e) => activeRef?.updateTextProperty('fontFamily', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-1.5 px-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="Inter, sans-serif">Inter</option>
                      <option value="Arial">Arial</option>
                      <option value="Times New Roman">Times New Roman</option>
                      <option value="Courier New">Courier New</option>
                      <option value="Georgia">Georgia</option>
                      <option value="Verdana">Verdana</option>
                    </select>
                  </div>
                  
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button 
                      onClick={() => activeRef?.updateTextProperty('textAlign', 'left')}
                      className={`flex-1 p-1.5 rounded flex justify-center ${textProps.textAlign === 'left' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => activeRef?.updateTextProperty('textAlign', 'center')}
                      className={`flex-1 p-1.5 rounded flex justify-center ${textProps.textAlign === 'center' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => activeRef?.updateTextProperty('textAlign', 'right')}
                      className={`flex-1 p-1.5 rounded flex justify-center ${textProps.textAlign === 'right' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => activeRef?.updateTextProperty('fontWeight', textProps.fontWeight === 'bold' ? 'normal' : 'bold')}
                      className={`flex-1 py-1.5 rounded text-sm font-bold border ${textProps.fontWeight === 'bold' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      B
                    </button>
                    <button 
                      onClick={() => activeRef?.updateTextProperty('fontStyle', textProps.fontStyle === 'italic' ? 'normal' : 'italic')}
                      className={`flex-1 py-1.5 rounded text-sm italic border ${textProps.fontStyle === 'italic' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      I
                    </button>
                    <button 
                      onClick={() => activeRef?.updateTextProperty('underline', !textProps.underline)}
                      className={`flex-1 py-1.5 rounded text-sm underline border ${textProps.underline ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                    >
                      U
                    </button>
                  </div>
                </div>
              )}
              
              <div className="my-2 border-t" />
              
              <button 
                onClick={() => activeRef?.deleteSelected()}
                className="flex items-center justify-center sm:justify-start gap-3 p-3 sm:px-4 sm:py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Selected"
              >
                <Trash2 className="w-5 h-5" />
                <span className="hidden sm:inline font-medium">Delete</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 px-2 sm:px-4">
              <div className="flex flex-col items-center justify-center text-gray-400 p-4 text-center border-2 border-dashed rounded-xl">
                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm hidden sm:block">Select an image to edit properties</p>
              </div>
              
              <div className="hidden sm:block mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Page Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Page Size</label>
                    <select 
                      value={pages.find(p => p.id === activePageId)?.size || 'A4'}
                      onChange={(e) => changePageSize(activePageId, e.target.value as PageSize)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="Legal">Legal (8.5 × 14 in)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Orientation</label>
                    <select 
                      value={pages.find(p => p.id === activePageId)?.orientation || 'portrait'}
                      onChange={(e) => changePageOrientation(activePageId, e.target.value as PageOrientation)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                  
                  <button 
                    onClick={() => activeRef?.clear()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Clear Page</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Canvas Workspace */}
        <main 
          ref={containerRef} 
          className="flex-1 bg-gray-200 overflow-y-auto relative flex flex-col items-center p-8 pt-12"
        >
          {pages.map((page, index) => (
            <PageCanvas
              key={page.id}
              id={page.id}
              index={index}
              size={page.size}
              orientation={page.orientation}
              isActive={activePageId === page.id}
              showGrid={showGrid}
              scale={scale}
              ref={(el) => pageRefs.current[page.id] = el}
              onActivate={() => setActivePageId(page.id)}
              onSelectionChange={(hasSel, objType, props) => {
                setHasSelection(hasSel);
                setSelectedObjType(objType);
                setTextProps(props);
              }}
              onCropStart={(src) => setCropData({ src, pageId: page.id })}
              onHistoryChange={(undo, redo) => {
                setCanUndo(undo);
                setCanRedo(redo);
              }}
              onDelete={() => deletePage(page.id)}
            />
          ))}
        </main>
      </div>

      {/* Crop Modal */}
      {cropData && (
        <CropModal 
          imageSrc={cropData.src} 
          onCrop={handleCropComplete} 
          onClose={() => setCropData(null)} 
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t py-4 px-6 text-sm text-gray-600 flex flex-col sm:flex-row justify-between items-center z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
          <div className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded text-xs font-bold uppercase tracking-wider">
              Founder & Lead Developer
            </span>
            <span className="text-base">Md: Anik Hossain</span>
          </div>
          <div className="flex items-center gap-4 text-gray-500 font-medium">
            <a href="mailto:anikhossain333877@gmail.com" className="hover:text-blue-600 transition-colors">anikhossain333877@gmail.com</a>
            <span className="hidden sm:inline text-gray-300">•</span>
            <span>Bangladesh</span>
          </div>
        </div>
        <div className="mt-3 sm:mt-0 text-xs text-gray-400 max-w-md text-center sm:text-right leading-relaxed">
          Empowering creators with high-quality, professional design tools. Built with precision and passion for seamless printing and layout management.
        </div>
      </footer>
    </div>
  );
}
