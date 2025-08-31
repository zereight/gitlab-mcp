// Shared utility functions for GitLab MCP Extension handlers

import { HandlerResponse, SuccessResponse, ErrorResponse } from './types.js';

/**
 * Parse duration string (e.g., "2h 30m", "1d 4h") to seconds
 */
export function parseDurationToSeconds(duration: string): number {
  const regex = /(\d+)([dhm])/g;
  let totalSeconds = 0;
  let match;
  
  while ((match = regex.exec(duration)) !== null) {
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'd': totalSeconds += value * 24 * 60 * 60; break;
      case 'h': totalSeconds += value * 60 * 60; break;
      case 'm': totalSeconds += value * 60; break;
    }
  }
  
  return totalSeconds;
}

/**
 * Format seconds to human-readable duration (e.g., "2h 30m", "1d 4h")
 */
export function formatSecondsToHumanDuration(seconds: number): string {
  if (seconds === 0) return '0m';
  
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}

/**
 * Format successful response with data
 */
export function formatSuccessResponse(data: any): SuccessResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Format error response with message
 */
export function formatErrorResponse(message: string): ErrorResponse {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: message }, null, 2),
      },
    ],
  };
}

/**
 * Format simple text response
 */
export function formatTextResponse(text: string): HandlerResponse {
  return {
    content: [
      {
        type: "text",
        text: text,
      },
    ],
  };
}

/**
 * Build query string from parameters
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => searchParams.append(key, String(v)));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Safely encode URI component for GitLab API paths
 */
export function encodeProjectId(projectId: string): string {
  return encodeURIComponent(projectId);
}

/**
 * Create request body for API calls
 */
export function createRequestBody(data: Record<string, any>): string {
  // Filter out undefined values
  const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);
  
  return JSON.stringify(cleanData);
}

/**
 * Handle array parameters (like labels) for API requests
 */
export function formatArrayParam(value: string[] | undefined): string | undefined {
  return value && value.length > 0 ? value.join(',') : undefined;
}

/**
 * Calculate accuracy percentage for time estimates
 */
export function calculateAccuracyPercentage(estimated: number, actual: number): number {
  if (estimated === 0) return 0;
  return Math.round((estimated / actual) * 100);
}

/**
 * Calculate variance percentage for time estimates
 */
export function calculateVariancePercentage(estimated: number, actual: number): number {
  if (estimated === 0) return 0;
  const difference = Math.abs(actual - estimated);
  return Math.round((difference / estimated) * 100);
}

/**
 * Determine time tracking status based on estimate vs actual
 */
export function getTimeTrackingStatus(estimated: number, actual: number): 'exact' | 'over_estimate' | 'under_estimate' {
  const difference = actual - estimated;
  if (difference === 0) return 'exact';
  return difference > 0 ? 'over_estimate' : 'under_estimate';
}

/**
 * Batch process items with error handling
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: { concurrency?: number } = {}
): Promise<Array<{ item: T; result?: R; error?: string }>> {
  const { concurrency = 5 } = options;
  const results: Array<{ item: T; result?: R; error?: string }> = [];
  
  // Process items in batches to avoid overwhelming the API
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchPromises = batch.map(async (item) => {
      try {
        const result = await processor(item);
        return { item, result };
      } catch (error) {
        return { 
          item, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Create summary for bulk operations
 */
export function createBulkOperationSummary<T>(
  results: Array<{ item: T; result?: any; error?: string }>,
  operation: string,
  additionalData?: Record<string, any>
): any {
  const successful = results.filter(r => !r.error).length;
  const failed = results.filter(r => r.error).length;
  
  return {
    total_items: results.length,
    successful,
    failed,
    operation,
    results: results.map(r => ({
      item: r.item,
      status: r.error ? 'error' : 'success',
      ...(r.result && { result: r.result }),
      ...(r.error && { error: r.error })
    })),
    ...additionalData
  };
}