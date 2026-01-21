"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display React errors gracefully
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Error boundary caught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-semibold text-lg mb-2">Something went wrong</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-md">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
              <Button onClick={this.handleRetry} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Props for the QueryErrorBoundary component
 * Uses a generic error type to support tRPC errors and standard Errors
 */
interface QueryErrorProps {
  error: { message: string } | null;
  isError: boolean;
  refetch: () => void;
  children: ReactNode;
  title?: string;
}

/**
 * Error display for React Query errors (not a class component boundary)
 */
export function QueryErrorDisplay({
  error,
  isError,
  refetch,
  children,
  title = "Failed to load data",
}: QueryErrorProps) {
  if (isError && error) {
    // Categorize errors for better UX
    let errorMessage = error.message || "An unexpected error occurred";
    let errorType: "network" | "auth" | "notfound" | "generic" = "generic";

    if (error.message.includes("fetch") || error.message.includes("network")) {
      errorType = "network";
      errorMessage = "Network connection failed. Please check your internet.";
    } else if (error.message.includes("UNAUTHORIZED") || error.message.includes("401")) {
      errorType = "auth";
      errorMessage = "Please sign in to continue.";
    } else if (error.message.includes("NOT_FOUND") || error.message.includes("404")) {
      errorType = "notfound";
      errorMessage = "The requested data was not found.";
    }

    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-md">
              {errorMessage}
            </p>
            {errorType !== "auth" && (
              <Button onClick={refetch} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}

/**
 * Simple inline error message
 */
export function InlineError({
  error,
  onRetry,
}: {
  error: Error | string | null;
  onRetry?: () => void;
}) {
  if (!error) return null;

  const message = typeof error === "string" ? error : error.message;

  return (
    <div className="flex items-center gap-2 text-destructive text-sm">
      <AlertTriangle className="h-4 w-4" />
      <span>{message}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-1"
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
