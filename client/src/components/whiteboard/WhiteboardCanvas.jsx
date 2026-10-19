import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MousePointer,
  Edit2,
  Square,
  Circle,
  Diamond,
  Minus,
  ArrowRight,
  Type,
  StickyNote,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Trash2,
  Save,
  CheckCircle,
  Move
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { api } from '../../utils/api.js';

const GRAYSCALE_COLORS = [
  { label: 'Black', value: '#111111' },
  { label: 'Charcoal', value: '#333333' },
  { label: 'Slate', value: '#666666' },
  { label: 'Neutral Gray', value: '#999999' },
  { label: 'Light Gray', value: '#e0e0e0' },
  { label: 'White', value: '#ffffff' }
];

export default function WhiteboardCanvas({ whiteboardId, initialElements = [], title = 'Whiteboard' }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [elements, setElements] = useState(initialElements);
  const [selectedTool, setSelectedTool] = useState('select'); // select, pen, rectangle, circle, diamond, line, arrow, text, sticky, eraser
  const [activeColor, setActiveColor] = useState('#111111');
  const [activeFill, setActiveFill] = useState('transparent');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [selectedElementId, setSelectedElementId] = useState(null);

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Undo / Redo history
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');

  // Multi-user remote cursors: userId -> { userName, avatarColor, x, y }
  const [remoteCursors, setRemoteCursors] = useState(new Map());

  // Interaction refs
  const svgRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentShapeRef = useRef(null);
  const isDraggingElementRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const saveTimeoutRef = useRef(null);

  // Load initial elements
  useEffect(() => {
    if (initialElements && initialElements.length > 0) {
      setElements(initialElements);
    }
  }, [initialElements]);

  // Socket.IO real-time collaboration
  useEffect(() => {
    if (!socket || !whiteboardId) return;

    socket.emit('join_whiteboard', { whiteboardId });

    const handleRemoteCursor = (data) => {
      if (data.userId !== user?.id) {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(data.userId, {
            userName: data.userName,
            avatarColor: data.avatarColor,
            x: data.x,
            y: data.y,
            lastSeen: Date.now()
          });
          return next;
        });
      }
    };

    const handleElementAdded = ({ whiteboardId: wbId, element }) => {
      if (wbId === whiteboardId) {
        setElements((prev) => [...prev.filter((el) => el.id !== element.id), element]);
      }
    };

    const handleElementUpdated = ({ whiteboardId: wbId, element }) => {
      if (wbId === whiteboardId) {
        setElements((prev) => prev.map((el) => (el.id === element.id ? element : el)));
      }
    };

    const handleElementDeleted = ({ whiteboardId: wbId, elementId }) => {
      if (wbId === whiteboardId) {
        setElements((prev) => prev.filter((el) => el.id !== elementId));
      }
    };

    const handleWhiteboardSynced = ({ whiteboardId: wbId, elements: syncElements }) => {
      if (wbId === whiteboardId) {
        setElements(syncElements);
      }
    };

    socket.on('whiteboard_cursor_update', handleRemoteCursor);
    socket.on('whiteboard_element_added', handleElementAdded);
    socket.on('whiteboard_element_updated', handleElementUpdated);
    socket.on('whiteboard_element_deleted', handleElementDeleted);
    socket.on('whiteboard_synced', handleWhiteboardSynced);

    return () => {
      socket.emit('leave_whiteboard', { whiteboardId });
      socket.off('whiteboard_cursor_update', handleRemoteCursor);
      socket.off('whiteboard_element_added', handleElementAdded);
      socket.off('whiteboard_element_updated', handleElementUpdated);
      socket.off('whiteboard_element_deleted', handleElementDeleted);
      socket.off('whiteboard_synced', handleWhiteboardSynced);
    };
  }, [socket, whiteboardId, user?.id]);

  // Clean stale remote cursors (older than 10s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setRemoteCursors((prev) => {
        let changed = false;
        const next = new Map();
        for (const [k, v] of prev.entries()) {
          if (now - v.lastSeen < 10000) {
            next.set(k, v);
          } else {
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Debounced auto-save
  const triggerSave = useCallback(
    (newElements) => {
      setSaveStatus('saving');
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          if (socket) {
            socket.emit('whiteboard_elements_bulk_sync', { whiteboardId, elements: newElements });
          }
          await api.put(`/whiteboards/${whiteboardId}`, { canvasElements: newElements });
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to save whiteboard:', err);
          setSaveStatus('error');
        }
      }, 800);
    },
    [whiteboardId, socket]
  );

  const pushHistory = (newElements) => {
    setUndoStack((prev) => [...prev.slice(-25), elements]);
    setRedoStack([]);
    setElements(newElements);
    triggerSave(newElements);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, elements]);
    setElements(previous);
    triggerSave(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, elements]);
    setElements(next);
    triggerSave(next);
  };

  // Screen to Canvas coordinate conversion (factoring Pan and Zoom)
  const getCanvasCoords = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom
    };
  };

  // Pointer Down
  const handlePointerDown = (e) => {
    // If middle click or spacebar held, start panning
    if (e.button === 1 || e.spaceKey || selectedTool === 'move') {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    if (e.button !== 0) return; // Only primary mouse button

    const coords = getCanvasCoords(e);

    // Eraser Tool
    if (selectedTool === 'eraser') {
      // Find element clicked
      const clickedEl = [...elements].reverse().find((el) => isPointInElement(coords, el));
      if (clickedEl) {
        const next = elements.filter((el) => el.id !== clickedEl.id);
        pushHistory(next);
        if (socket) socket.emit('whiteboard_element_delete', { whiteboardId, elementId: clickedEl.id });
      }
      return;
    }

    // Select Tool: check if clicked on existing element
    if (selectedTool === 'select') {
      const clickedEl = [...elements].reverse().find((el) => isPointInElement(coords, el));
      if (clickedEl) {
        setSelectedElementId(clickedEl.id);
        isDraggingElementRef.current = true;
        dragOffsetRef.current = {
          x: coords.x - (clickedEl.x || 0),
          y: coords.y - (clickedEl.y || 0)
        };
      } else {
        setSelectedElementId(null);
      }
      return;
    }

    // Drawing Tools
    isDrawingRef.current = true;
    const id = `el_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    let newEl = null;

    if (selectedTool === 'pen') {
      newEl = {
        id,
        type: 'pen',
        points: [{ x: coords.x, y: coords.y }],
        strokeColor: activeColor,
        strokeWidth
      };
    } else if (selectedTool === 'rectangle') {
      newEl = {
        id,
        type: 'rectangle',
        x: coords.x,
        y: coords.y,
        width: 1,
        height: 1,
        strokeColor: activeColor,
        fillColor: activeFill,
        strokeWidth
      };
    } else if (selectedTool === 'circle') {
      newEl = {
        id,
        type: 'circle',
        x: coords.x,
        y: coords.y,
        width: 1,
        height: 1,
        strokeColor: activeColor,
        fillColor: activeFill,
        strokeWidth
      };
    } else if (selectedTool === 'diamond') {
      newEl = {
        id,
        type: 'diamond',
        x: coords.x,
        y: coords.y,
        width: 1,
        height: 1,
        strokeColor: activeColor,
        fillColor: activeFill,
        strokeWidth
      };
    } else if (selectedTool === 'line') {
      newEl = {
        id,
        type: 'line',
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
        strokeColor: activeColor,
        strokeWidth
      };
    } else if (selectedTool === 'arrow') {
      newEl = {
        id,
        type: 'arrow',
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
        strokeColor: activeColor,
        strokeWidth
      };
    } else if (selectedTool === 'text') {
      const textVal = window.prompt('Enter text note:');
      if (textVal) {
        newEl = {
          id,
          type: 'text',
          x: coords.x,
          y: coords.y,
          text: textVal,
          strokeColor: activeColor,
          fontSize: 16
        };
        const next = [...elements, newEl];
        pushHistory(next);
        if (socket) socket.emit('whiteboard_element_add', { whiteboardId, element: newEl });
      }
      isDrawingRef.current = false;
      return;
    } else if (selectedTool === 'sticky') {
      const noteVal = window.prompt('Enter sticky note content:');
      if (noteVal !== null) {
        newEl = {
          id,
          type: 'sticky',
          x: coords.x - 90,
          y: coords.y - 70,
          width: 180,
          height: 140,
          text: noteVal || 'New Note',
          color: activeFill === 'transparent' ? '#f5f5f5' : activeFill,
          strokeColor: activeColor
        };
        const next = [...elements, newEl];
        pushHistory(next);
        if (socket) socket.emit('whiteboard_element_add', { whiteboardId, element: newEl });
      }
      isDrawingRef.current = false;
      return;
    }

    if (newEl) {
      currentShapeRef.current = newEl;
      setElements((prev) => [...prev, newEl]);
    }
  };

  // Pointer Move
  const handlePointerMove = (e) => {
    // Panning
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
      });
      return;
    }

    const coords = getCanvasCoords(e);

    // Broadcast local cursor
    if (socket) {
      socket.emit('whiteboard_cursor_move', { whiteboardId, x: coords.x, y: coords.y });
    }

    // Dragging selected element
    if (isDraggingElementRef.current && selectedElementId) {
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedElementId) return el;
          const newX = coords.x - dragOffsetRef.current.x;
          const newY = coords.y - dragOffsetRef.current.y;
          const dx = newX - (el.x || 0);
          const dy = newY - (el.y || 0);

          if (el.type === 'line' || el.type === 'arrow') {
            return {
              ...el,
              startX: el.startX + dx,
              startY: el.startY + dy,
              endX: el.endX + dx,
              endY: el.endY + dy,
              x: newX,
              y: newY
            };
          }
          return { ...el, x: newX, y: newY };
        })
      );
      return;
    }

    // Active Drawing
    if (!isDrawingRef.current || !currentShapeRef.current) return;

    const shape = currentShapeRef.current;

    if (shape.type === 'pen') {
      shape.points.push({ x: coords.x, y: coords.y });
      setElements((prev) => prev.map((el) => (el.id === shape.id ? { ...shape } : el)));
    } else if (['rectangle', 'circle', 'diamond'].includes(shape.type)) {
      const width = coords.x - shape.x;
      const height = coords.y - shape.y;
      shape.width = width;
      shape.height = height;
      setElements((prev) => prev.map((el) => (el.id === shape.id ? { ...shape } : el)));
    } else if (shape.type === 'line' || shape.type === 'arrow') {
      shape.endX = coords.x;
      shape.endY = coords.y;
      setElements((prev) => prev.map((el) => (el.id === shape.id ? { ...shape } : el)));
    }
  };

  // Pointer Up
  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isDraggingElementRef.current) {
      isDraggingElementRef.current = false;
      const movedEl = elements.find((el) => el.id === selectedElementId);
      if (movedEl) {
        pushHistory(elements);
        if (socket) socket.emit('whiteboard_element_update', { whiteboardId, element: movedEl });
      }
      return;
    }

    if (isDrawingRef.current && currentShapeRef.current) {
      isDrawingRef.current = false;
      const completedShape = { ...currentShapeRef.current };
      currentShapeRef.current = null;

      // Normalize negative width/height for boxes
      if (['rectangle', 'circle', 'diamond'].includes(completedShape.type)) {
        if (completedShape.width < 0) {
          completedShape.x += completedShape.width;
          completedShape.width = Math.abs(completedShape.width);
        }
        if (completedShape.height < 0) {
          completedShape.y += completedShape.height;
          completedShape.height = Math.abs(completedShape.height);
        }
      }

      const nextElements = elements.map((el) => (el.id === completedShape.id ? completedShape : el));
      pushHistory(nextElements);

      if (socket) {
        socket.emit('whiteboard_element_add', { whiteboardId, element: completedShape });
      }
    }
  };

  // Delete selected element
  const handleDeleteSelected = () => {
    if (!selectedElementId) return;
    const next = elements.filter((el) => el.id !== selectedElementId);
    pushHistory(next);
    if (socket) socket.emit('whiteboard_element_delete', { whiteboardId, elementId: selectedElementId });
    setSelectedElementId(null);
  };

  // Check if point hits element (simple bounding box collision)
  function isPointInElement(point, el) {
    if (el.type === 'rectangle' || el.type === 'circle' || el.type === 'diamond' || el.type === 'sticky') {
      const minX = Math.min(el.x, el.x + (el.width || 0));
      const maxX = Math.max(el.x, el.x + (el.width || 0));
      const minY = Math.min(el.y, el.y + (el.height || 0));
      const maxY = Math.max(el.y, el.y + (el.height || 0));
      return point.x >= minX - 5 && point.x <= maxX + 5 && point.y >= minY - 5 && point.y <= maxY + 5;
    }
    if (el.type === 'text') {
      return point.x >= el.x - 10 && point.x <= el.x + 200 && point.y >= el.y - 20 && point.y <= el.y + 40;
    }
    if (el.type === 'line' || el.type === 'arrow') {
      const minX = Math.min(el.startX, el.endX) - 10;
      const maxX = Math.max(el.startX, el.endX) + 10;
      const minY = Math.min(el.startY, el.endY) - 10;
      const maxY = Math.max(el.startY, el.endY) + 10;
      return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }
    if (el.type === 'pen' && el.points) {
      return el.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 12);
    }
    return false;
  }

  // Helper to render SVG paths from points
  const pointsToSvgPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }
    return d;
  };

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.15, 0.35));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      setZoom((prev) => Math.min(Math.max(prev + delta, 0.35), 2.5));
    } else {
      setPan((prev) => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  // Export to SVG
  const handleExportSVG = () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgEl);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '-')}-collabspace.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#fafafa',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* Floating Top Collaboration & Toolbar Strip */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '4px 8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
        }}
      >
        {/* Tool Buttons */}
        <button
          onClick={() => setSelectedTool('select')}
          className={`toolbar-btn ${selectedTool === 'select' ? 'active' : ''}`}
          title="Select & Move (V)"
        >
          <MousePointer size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('move')}
          className={`toolbar-btn ${selectedTool === 'move' ? 'active' : ''}`}
          title="Pan Hand Tool (H)"
        >
          <Move size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('pen')}
          className={`toolbar-btn ${selectedTool === 'pen' ? 'active' : ''}`}
          title="Freehand Pen (P)"
        >
          <Edit2 size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('rectangle')}
          className={`toolbar-btn ${selectedTool === 'rectangle' ? 'active' : ''}`}
          title="Rectangle (R)"
        >
          <Square size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('circle')}
          className={`toolbar-btn ${selectedTool === 'circle' ? 'active' : ''}`}
          title="Circle (C)"
        >
          <Circle size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('diamond')}
          className={`toolbar-btn ${selectedTool === 'diamond' ? 'active' : ''}`}
          title="Diamond (D)"
        >
          <Diamond size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('line')}
          className={`toolbar-btn ${selectedTool === 'line' ? 'active' : ''}`}
          title="Straight Line (L)"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('arrow')}
          className={`toolbar-btn ${selectedTool === 'arrow' ? 'active' : ''}`}
          title="Connecting Arrow (A)"
        >
          <ArrowRight size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('text')}
          className={`toolbar-btn ${selectedTool === 'text' ? 'active' : ''}`}
          title="Text Box (T)"
        >
          <Type size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('sticky')}
          className={`toolbar-btn ${selectedTool === 'sticky' ? 'active' : ''}`}
          title="Sticky Note (S)"
        >
          <StickyNote size={15} />
        </button>
        <button
          onClick={() => setSelectedTool('eraser')}
          className={`toolbar-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
          title="Eraser (E)"
        >
          <Eraser size={15} />
        </button>

        <div className="toolbar-divider" />

        {/* Grayscale Color Palette */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {GRAYSCALE_COLORS.map((c) => (
            <div
              key={c.value}
              onClick={() => setActiveColor(c.value)}
              style={{
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                backgroundColor: c.value,
                border: activeColor === c.value ? '2px solid #000000' : '1px solid #cccccc',
                boxShadow: activeColor === c.value ? '0 0 0 1px #ffffff inset' : 'none',
                cursor: 'pointer'
              }}
              title={c.label}
            />
          ))}
        </div>

        <div className="toolbar-divider" />

        {/* Stroke width selector */}
        <select
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          style={{ fontSize: '11.5px', padding: '2px 4px', height: '24px' }}
        >
          <option value="1">Thin (1px)</option>
          <option value="2">Normal (2px)</option>
          <option value="4">Thick (4px)</option>
          <option value="6">Bold (6px)</option>
        </select>

        <div className="toolbar-divider" />

        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="toolbar-btn"
          title="Undo (⌘Z)"
          style={{ opacity: undoStack.length === 0 ? 0.3 : 1 }}
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="toolbar-btn"
          title="Redo (⌘Y)"
          style={{ opacity: redoStack.length === 0 ? 0.3 : 1 }}
        >
          <Redo2 size={15} />
        </button>

        {selectedElementId && (
          <>
            <div className="toolbar-divider" />
            <button onClick={handleDeleteSelected} className="toolbar-btn" title="Delete Selected">
              <Trash2 size={15} color="#111111" />
            </button>
          </>
        )}
      </div>

      {/* Floating Bottom Left: Zoom Controls & Pan */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '16px',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          padding: '4px 8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}
      >
        <button onClick={handleZoomOut} className="toolbar-btn" title="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={handleZoomIn} className="toolbar-btn" title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleResetZoom} className="toolbar-btn" title="Reset Zoom & Pan">
          <Maximize2 size={14} />
        </button>

        <div className="toolbar-divider" />

        <button onClick={handleExportSVG} className="toolbar-btn" title="Export as SVG">
          <Download size={14} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px', fontSize: '11px', color: '#888888' }}>
          {saveStatus === 'saving' && 'Saving...'}
          {saveStatus === 'saved' && <CheckCircle size={12} color="#111111" />}
        </div>
      </div>

      {/* Interactive SVG Whiteboard Canvas */}
      <svg
        ref={svgRef}
        className="whiteboard-container"
        style={{
          width: '100%',
          height: '100%',
          cursor: selectedTool === 'move' || isPanning ? 'grab' : selectedTool === 'select' ? 'default' : 'crosshair'
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#111111" />
          </marker>
        </defs>

        {/* Canvas World Transform Group */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {elements.map((el) => {
            const isSelected = el.id === selectedElementId;

            if (el.type === 'pen') {
              return (
                <path
                  key={el.id}
                  d={pointsToSvgPath(el.points)}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: isSelected ? 'drop-shadow(0 0 3px #111111)' : 'none' }}
                />
              );
            }

            if (el.type === 'rectangle') {
              const x = Math.min(el.x, el.x + (el.width || 0));
              const y = Math.min(el.y, el.y + (el.height || 0));
              const w = Math.abs(el.width || 0);
              const h = Math.abs(el.height || 0);
              return (
                <rect
                  key={el.id}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  fill={el.fillColor || 'transparent'}
                  strokeDasharray={isSelected ? '4 4' : 'none'}
                  rx="4"
                />
              );
            }

            if (el.type === 'circle') {
              const x = Math.min(el.x, el.x + (el.width || 0));
              const y = Math.min(el.y, el.y + (el.height || 0));
              const w = Math.abs(el.width || 0);
              const h = Math.abs(el.height || 0);
              return (
                <ellipse
                  key={el.id}
                  cx={x + w / 2}
                  cy={y + h / 2}
                  rx={w / 2}
                  ry={h / 2}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  fill={el.fillColor || 'transparent'}
                  strokeDasharray={isSelected ? '4 4' : 'none'}
                />
              );
            }

            if (el.type === 'diamond') {
              const x = Math.min(el.x, el.x + (el.width || 0));
              const y = Math.min(el.y, el.y + (el.height || 0));
              const w = Math.abs(el.width || 0);
              const h = Math.abs(el.height || 0);
              const pts = `${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`;
              return (
                <polygon
                  key={el.id}
                  points={pts}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  fill={el.fillColor || 'transparent'}
                  strokeDasharray={isSelected ? '4 4' : 'none'}
                />
              );
            }

            if (el.type === 'line') {
              return (
                <line
                  key={el.id}
                  x1={el.startX}
                  y1={el.startY}
                  x2={el.endX}
                  y2={el.endY}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  strokeDasharray={isSelected ? '4 4' : 'none'}
                />
              );
            }

            if (el.type === 'arrow') {
              return (
                <line
                  key={el.id}
                  x1={el.startX}
                  y1={el.startY}
                  x2={el.endX}
                  y2={el.endY}
                  stroke={el.strokeColor || '#111111'}
                  strokeWidth={el.strokeWidth || 2}
                  markerEnd="url(#arrowhead)"
                  strokeDasharray={isSelected ? '4 4' : 'none'}
                />
              );
            }

            if (el.type === 'text') {
              return (
                <text
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  fill={el.strokeColor || '#111111'}
                  fontSize={el.fontSize || 16}
                  fontFamily="var(--font-sans)"
                  fontWeight="500"
                  style={{ userSelect: 'none' }}
                >
                  {el.text}
                </text>
              );
            }

            if (el.type === 'sticky') {
              return (
                <g key={el.id} transform={`translate(${el.x}, ${el.y})`}>
                  <rect
                    width={el.width || 180}
                    height={el.height || 140}
                    fill={el.color || '#f5f5f5'}
                    stroke={isSelected ? '#111111' : '#dcdcdc'}
                    strokeWidth={isSelected ? 2 : 1}
                    rx="6"
                    style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
                  />
                  <foreignObject width={el.width || 180} height={el.height || 140} style={{ padding: '10px' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '12.5px',
                        lineHeight: 1.4,
                        color: '#111111',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        height: '100%',
                        overflow: 'hidden'
                      }}
                    >
                      {el.text}
                    </div>
                  </foreignObject>
                </g>
              );
            }

            return null;
          })}

          {/* Render Multi-User Live Collaborator Cursors */}
          {Array.from(remoteCursors.values()).map((rc, idx) => (
            <g key={idx} transform={`translate(${rc.x}, ${rc.y})`}>
              <path
                d="M 0 0 L 0 16 L 4 12 L 8 20 L 11 19 L 7 11 L 13 11 Z"
                fill="#111111"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              <foreignObject x="12" y="12" width="140" height="26">
                <span className="cursor-pill">{rc.userName}</span>
              </foreignObject>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
