"use client";

/**
 * Selection Action Bar
 *
 * Floating toolbar that appears when multiple blocks are selected.
 * Provides quick actions: Save as Loop, Duplicate, Delete.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Copy, Trash2 } from "lucide-react";
import { SaveSystemModal } from "./save-system-modal";

interface SelectionActionBarProps {
  selectedCount: number;
  selectedNodeIds: string[];
  onDuplicate: () => void;
  onDelete: () => void;
  position: { x: number; y: number } | null;
}

export function SelectionActionBar({
  selectedCount,
  selectedNodeIds,
  onDuplicate,
  onDelete,
  position,
}: SelectionActionBarProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  // Capture the selection at the moment the user clicks save
  // This prevents losing nodes if selection changes during modal render
  const [capturedNodeIds, setCapturedNodeIds] = useState<string[]>([]);
  // Delay showing the bar to not interfere with box selection
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Delay visibility to prevent interfering with box selection drag
  useEffect(() => {
    if (selectedCount >= 2 && position) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, 150); // Small delay to let box selection complete
    } else {
      setIsVisible(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [selectedCount, position]);

  const handleOpenSaveModal = useCallback(() => {
    // Capture current selection before opening modal
    setCapturedNodeIds([...selectedNodeIds]);
    setShowSaveModal(true);
  }, [selectedNodeIds]);

  const handleCloseSaveModal = useCallback(() => {
    setShowSaveModal(false);
    setCapturedNodeIds([]);
  }, []);

  if (selectedCount < 2 || !position || !isVisible) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="absolute z-50 pointer-events-auto"
          style={{
            left: position.x,
            top: position.y + 20,
            transform: "translateX(-50%)",
          }}
        >
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#1a1a24]/95 backdrop-blur-md border border-white/10 shadow-xl">
            {/* Save as Loop */}
            <button
              onClick={handleOpenSaveModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-white/90 hover:bg-purple-500/20 hover:text-purple-300 transition-colors group"
              title="Save as reusable loop (Ctrl+Shift+S)"
            >
              <Save className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
              <span>Save as Loop</span>
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* Duplicate */}
            <button
              onClick={onDuplicate}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-white/90 hover:bg-blue-500/20 hover:text-blue-300 transition-colors group"
              title="Duplicate selection (Ctrl+D)"
            >
              <Copy className="w-4 h-4 group-hover:text-blue-400 transition-colors" />
              <span>Duplicate</span>
            </button>

            <div className="w-px h-5 bg-white/10" />

            {/* Delete */}
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-white/90 hover:bg-red-500/20 hover:text-red-300 transition-colors group"
              title="Delete selection (Delete)"
            >
              <Trash2 className="w-4 h-4 group-hover:text-red-400 transition-colors" />
            </button>

            {/* Selection count badge */}
            <div className="ml-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px] font-medium text-white/50">
              {selectedCount} blocks
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Save System Modal */}
      <SaveSystemModal
        isOpen={showSaveModal}
        onClose={handleCloseSaveModal}
        selectedNodeIds={capturedNodeIds}
      />
    </>
  );
}
