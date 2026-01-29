"use client";

/**
 * Save System Modal
 *
 * Modal dialog for saving a selection of blocks as a reusable loop.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Package } from "lucide-react";
import { useStrategyStore } from "@/lib/strategy/store";

interface SaveSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeIds: string[];
}

export function SaveSystemModal({
  isOpen,
  onClose,
  selectedNodeIds,
}: SaveSystemModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveSystem = useStrategyStore((state) => state.saveSystem);
  const blocks = useStrategyStore((state) => state.blocks);

  // Get block type summary
  const selectedBlocks = blocks.filter((b) => selectedNodeIds.includes(b.id));
  const blockTypes = selectedBlocks.map((b) => b.type);
  const blockSummary = blockTypes.join(" → ");

  const handleSave = async () => {
    if (!name.trim()) return;

    setIsSaving(true);

    // Small delay for visual feedback
    await new Promise((resolve) => setTimeout(resolve, 200));

    saveSystem(name.trim(), description.trim(), selectedNodeIds);

    setIsSaving(false);
    setName("");
    setDescription("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && name.trim()) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md"
          >
            <div className="bg-[#12121a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Package className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Save as Reusable Loop
                    </h2>
                    <p className="text-sm text-white/50">
                      {selectedNodeIds.length} blocks selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5 space-y-4">
                {/* Preview */}
                <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="text-xs text-white/40 mb-1">Preview</div>
                  <div className="text-sm text-white/80 font-mono">
                    {blockSummary || "No blocks selected"}
                  </div>
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., 2x Leverage Loop"
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all"
                    autoFocus
                  />
                </div>

                {/* Description Input */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Description{" "}
                    <span className="text-white/40">(optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what this loop does..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/5 bg-white/[0.02]">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim() || isSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? "Saving..." : "Save Loop"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
