"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionPreview } from "./transaction-preview";
import { SimulationResults } from "./simulation-results";
import type { useTransactionExecution } from "@/hooks/use-transaction-execution";

// ============================================================================
// Props
// ============================================================================

interface ExecutionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  execution: ReturnType<typeof useTransactionExecution>;
}

// ============================================================================
// Component
// ============================================================================

export function ExecutionModal({
  open,
  onOpenChange,
  execution,
}: ExecutionModalProps) {
  const {
    phase,
    plan,
    simulationResult,
    error,
    stepDescriptions,
    isBuilding,
    isSimulating,
    isExecuting,
    simulate,
    execute,
    reset,
  } = execution;

  const handleClose = () => {
    if (!isBuilding && !isSimulating && !isExecuting) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Execute Strategy</DialogTitle>
          <DialogDescription>
            Preview and simulate your transactions before execution
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <AnimatePresence mode="wait">
            {/* Building State */}
            {phase === "building" && (
              <motion.div
                key="building"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="h-12 w-12 animate-spin text-purple-500 mb-4" />
                <p className="text-lg font-medium">Building Transaction Plan</p>
                <p className="text-sm text-muted-foreground">
                  Converting your strategy into executable transactions...
                </p>
              </motion.div>
            )}

            {/* Preview State */}
            {(phase === "preview" || phase === "simulating") && plan && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TransactionPreview
                  plan={plan}
                  isSimulating={isSimulating}
                  onSimulate={simulate}
                  onExecute={execute}
                  simulationComplete={false}
                />
              </motion.div>
            )}

            {/* Simulation Results */}
            {(phase === "ready" || phase === "error") &&
              simulationResult && (
                <motion.div
                  key="simulation"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <SimulationResults
                    result={simulationResult}
                    stepDescriptions={stepDescriptions}
                  />

                  {simulationResult.success && plan && (
                    <TransactionPreview
                      plan={plan}
                      isSimulating={false}
                      onSimulate={simulate}
                      onExecute={execute}
                      simulationComplete={true}
                    />
                  )}

                  {!simulationResult.success && (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={reset} className="flex-1">
                        Go Back
                      </Button>
                      <Button onClick={simulate} className="flex-1">
                        Retry Simulation
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

            {/* Executing State */}
            {phase === "executing" && (
              <motion.div
                key="executing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <Loader2 className="h-12 w-12 animate-spin text-green-500 mb-4" />
                <p className="text-lg font-medium">Executing Transactions</p>
                <p className="text-sm text-muted-foreground">
                  Please confirm each transaction in your wallet...
                </p>
              </motion.div>
            )}

            {/* Complete State */}
            {phase === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                  >
                    <svg
                      className="h-8 w-8 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                </div>
                <p className="text-lg font-medium text-green-500">
                  Strategy Executed Successfully!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your transactions have been confirmed on-chain
                </p>
                <Button onClick={handleClose} className="mt-6">
                  Close
                </Button>
              </motion.div>
            )}

            {/* Error State (without simulation result) */}
            {phase === "error" && !simulationResult && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <X className="h-8 w-8 text-red-500" />
                </div>
                <p className="text-lg font-medium text-red-500">Error</p>
                <p className="text-sm text-muted-foreground mt-1 text-center max-w-md">
                  {error ?? "An unexpected error occurred"}
                </p>
                <div className="flex gap-2 mt-6">
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button onClick={reset}>Try Again</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
