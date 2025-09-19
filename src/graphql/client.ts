import { ExecutionResult, print } from 'graphql';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { DEFAULT_HEADERS } from '../http-client';
import { enhancedFetch } from '../utils/fetch';

export interface GraphQLClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
}

export class GraphQLClient {
  public readonly endpoint: string;
  private defaultHeaders: Record<string, string>;

  constructor(endpoint: string, options?: { headers?: Record<string, string> }) {
    this.endpoint = endpoint;
    this.defaultHeaders = options?.headers ?? {};
  }

  async request<TResult = unknown, TVariables = Record<string, unknown>>(
    document: TypedDocumentNode<TResult, TVariables>,
    variables?: TVariables,
    requestHeaders?: Record<string, string>,
  ): Promise<TResult> {
    const query = print(document);

    // Prepare headers with authentication (enhancedFetch handles cookies automatically)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...DEFAULT_HEADERS,
      ...this.defaultHeaders,
      ...requestHeaders,
    };

    const response = await enhancedFetch(this.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        variables: variables ?? {},
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const result: ExecutionResult<TResult> = (await response.json()) as ExecutionResult<TResult>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`);
    }

    if (!result.data) {
      throw new Error('GraphQL request returned no data');
    }

    return result.data;
  }

  setHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  setAuthToken(token: string): void {
    this.setHeaders({ Authorization: `Bearer ${token}` });
  }
}
