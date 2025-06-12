// Pagination utilities for GitLab API
import fetch from 'node-fetch';
import { handleGitLabError } from './errors.js';
import { DEFAULT_FETCH_CONFIG } from '../config/gitlab.js';

/**
 * Fetch all pages of results from a GitLab API endpoint
 * @param baseUrl - The base URL without pagination parameters
 * @param parseFunction - Function to parse and validate the response data
 * @param maxPages - Maximum number of pages to fetch (safety limit)
 * @returns Array of all items from all pages
 */
export async function fetchAllPages<T>(
  baseUrl: string,
  parseFunction: (data: any) => T[],
  maxPages: number = 100
): Promise<T[]> {
  const allItems: T[] = [];
  let page = 1;
  const perPage = 100; // Maximum allowed by GitLab API

  while (page <= maxPages) {
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}page=${page}&per_page=${perPage}`;
    
    const response = await fetch(url, DEFAULT_FETCH_CONFIG);
    await handleGitLabError(response);
    const data = await response.json();

    const items = parseFunction(data);
    
    if (items.length === 0) {
      break; // No more items
    }
    
    allItems.push(...items);
    
    // Check if we got fewer results than requested (last page)
    if (items.length < perPage) {
      break;
    }
    
    page++;
  }

  if (page > maxPages) {
    console.warn(`Reached pagination safety limit (${maxPages} pages) for URL: ${baseUrl}`);
  }

  return allItems;
}

/**
 * Parse Link header for pagination information
 * @param linkHeader - The Link header value from GitLab API response
 * @returns Object with pagination links
 */
export function parseLinkHeader(linkHeader: string | null): {
  next?: string;
  prev?: string;
  first?: string;
  last?: string;
} {
  if (!linkHeader) {
    return {};
  }

  const links: Record<string, string> = {};
  const parts = linkHeader.split(',');

  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match) {
      const [, url, rel] = match;
      links[rel] = url.trim();
    }
  }

  return links;
}

/**
 * Extract total count from GitLab API headers
 * @param headers - Response headers from GitLab API
 * @returns Total count if available, null otherwise
 */
export function getTotalCount(headers: Headers): number | null {
  const totalHeader = headers.get('X-Total');
  return totalHeader ? parseInt(totalHeader, 10) : null;
}

/**
 * Extract total pages from GitLab API headers
 * @param headers - Response headers from GitLab API
 * @returns Total pages if available, null otherwise
 */
export function getTotalPages(headers: Headers): number | null {
  const totalPagesHeader = headers.get('X-Total-Pages');
  return totalPagesHeader ? parseInt(totalPagesHeader, 10) : null;
} 