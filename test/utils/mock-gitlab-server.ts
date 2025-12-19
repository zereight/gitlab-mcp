/**
 * Mock GitLab API Server for Testing
 * Implements minimal GitLab API endpoints for testing remote authorization
 */

import express, { Request, Response, NextFunction, Handler } from 'express';
import { Server } from 'http';

export interface MockGitLabConfig {
  port: number;
  validTokens: string[];
  /** Artificial delay for all responses (ms) - useful for timeout testing */
  responseDelay?: number;
  /** Simulate rate limiting - return 429 after N requests */
  rateLimitAfter?: number;
}

interface AuthenticatedRequest extends Request {
  gitlabToken?: string;
}

export class MockGitLabServer {
  private app: express.Application;
  private server: Server | null = null;
  private config: MockGitLabConfig;
  private requestCount = 0;
  private customRouter: express.Router;
  private customHandlers = new Map<string, Handler>();

  constructor(config: MockGitLabConfig) {
    this.config = config;
    this.app = express();
    this.customRouter = express.Router();
    
    // Dynamic dispatcher for custom handlers
    this.customRouter.use((req, res, next) => {
      // Create a key from method and path (relative to /api/v4)
      // req.path is already relative to the mount point
      const key = `${req.method.toUpperCase()}:${req.path}`;
      console.log(`[CustomRouter] Checking key: '${key}'`);
      const handler = this.customHandlers.get(key);
      
      if (handler) {
        console.log(`[MockServer] Custom handler hit: ${key}`);
        return handler(req, res, next);
      } else {
        console.log(`[CustomRouter] No handler found for key: '${key}'. Available keys: ${Array.from(this.customHandlers.keys()).join(', ')}`);
      }
      next();
    });

    this.setupMiddleware();
    this.app.use('/api/v4', this.customRouter); // Mount router on API path
    this.setupRoutes();
  }

  public addMockHandler(method: 'get' | 'post' | 'put' | 'delete', path: string, handler: Handler) {
    // Note: path should be relative to /api/v4
    const key = `${method.toUpperCase()}:${path}`;
    console.log(`[MockServer] Adding custom handler: ${key}`);
    this.customHandlers.set(key, handler);
  }

  public clearCustomHandlers() {
    console.log('[MockServer] Clearing custom handlers');
    this.customHandlers.clear();
  }

  /**
   * Setup middleware including auth validation
   */
  private setupMiddleware() {
    // Request counter for rate limiting tests - Place this FIRST to log everything
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[MockServer] ${req.method} ${req.originalUrl}`);
      this.requestCount++;
      next();
    });

    this.app.use(express.json());

    // Artificial delay middleware (for timeout testing)
    if (this.config.responseDelay) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        setTimeout(next, this.config.responseDelay);
      });
    }

    // Rate limiting middleware
    if (this.config.rateLimitAfter) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (this.requestCount > this.config.rateLimitAfter!) {
          res.status(429).json({
            message: 'Rate limit exceeded',
            retry_after: 60
          });
          return;
        }
        next();
      });
    }

    // Authentication middleware - applies to all /api/v4/* routes
    this.app.use('/api/v4', (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const authHeader = req.headers['authorization'] as string | undefined;
      const privateToken = req.headers['private-token'] as string | undefined;

      let token: string | null = null;

      if (authHeader) {
        // Extract token from "Bearer <token>"
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        token = match ? match[1].trim() : null;
      } else if (privateToken) {
        token = privateToken.trim();
      }

      if (!token) {
        res.status(401).json({
          message: 'Unauthorized',
          error: 'Missing authentication token'
        });
        return;
      }

      if (!this.config.validTokens.includes(token)) {
        res.status(401).json({
          message: 'Unauthorized',
          error: 'Invalid authentication token'
        });
        return;
      }

      // Store validated token in request
      req.gitlabToken = token;
      next();
    });
  }

  private setupRoutes() {
    // GET /api/v4/user - Get current user
    this.app.get('/api/v4/user', (req: AuthenticatedRequest, res: Response) => {
      const token = req.gitlabToken || 'unknown';
      res.json({
        id: 1,
        username: `user_${token.substring(0, 8)}`,
        name: 'Test User',
        email: 'test@example.com',
        state: 'active'
      });
    });

    // GET /api/v4/projects/:projectId - Get project
    this.app.get('/api/v4/projects/:projectId', (req: AuthenticatedRequest, res: Response) => {
      const projectId = req.params.projectId;
      res.json({
        id: parseInt(projectId) || 123,
        name: 'Test Project',
        path: 'test-project',
        path_with_namespace: 'test-group/test-project',
        description: 'A mock test project',
        visibility: 'private',
        created_at: '2024-01-01T00:00:00Z',
        web_url: `https://gitlab.mock/project/${projectId}`,
        namespace: {
          id: 1,
          name: 'Test Group',
          path: 'test-group',
          kind: 'group',
          full_path: 'test-group'
        }
      });
    });

    // GET /api/v4/projects/:projectId/merge_requests - List merge requests
    this.app.get('/api/v4/projects/:projectId/merge_requests', (req: AuthenticatedRequest, res: Response) => {
      res.json([
        {
          id: 1,
          iid: 1,
          title: 'Test MR 1',
          state: 'opened',
          created_at: '2024-01-01T00:00:00Z',
          author: {
            id: 1,
            username: 'test-user',
            name: 'Test User'
          }
        },
        {
          id: 2,
          iid: 2,
          title: 'Test MR 2',
          state: 'merged',
          created_at: '2024-01-02T00:00:00Z',
          author: {
            id: 1,
            username: 'test-user',
            name: 'Test User'
          }
        }
      ]);
    });

    // GET /api/v4/projects/:projectId/merge_requests/:mr_iid - Get single MR
    this.app.get('/api/v4/projects/:projectId/merge_requests/:mr_iid', (req: AuthenticatedRequest, res: Response) => {
      const mrIid = parseInt(req.params.mr_iid);
      res.json({
        id: mrIid,
        iid: mrIid,
        title: `Test MR ${mrIid}`,
        state: 'opened',
        created_at: '2024-01-01T00:00:00Z',
        author: {
          id: 1,
          username: 'test-user',
          name: 'Test User'
        },
        source_branch: 'feature-branch',
        target_branch: 'main',
        merge_status: 'can_be_merged'
      });
    });

    // GET /api/v4/projects/:projectId/issues - List issues
    this.app.get('/api/v4/projects/:projectId/issues', (req: AuthenticatedRequest, res: Response) => {
      const projectId = req.params.projectId;
      res.json([
        {
          id: 1,
          iid: 1,
          project_id: projectId,
          title: 'Test Issue 1',
          description: 'Test issue description',
          state: 'opened',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          closed_at: null,
          web_url: `https://gitlab.mock/project/${projectId}/issues/1`,
          author: {
            id: 1,
            username: 'test-user',
            name: 'Test User',
            avatar_url: null,
            web_url: 'https://gitlab.mock/test-user'
          },
          assignees: [],
          labels: [],
          milestone: null
        }
      ]);
    });

    // GET /api/v4/projects/:projectId/issues/:issue_iid - Get single issue
    this.app.get('/api/v4/projects/:projectId/issues/:issue_iid', (req: AuthenticatedRequest, res: Response) => {
      const issueIid = parseInt(req.params.issue_iid);
      const projectId = req.params.projectId;
      res.json({
        id: issueIid,
        iid: issueIid,
        project_id: projectId,
        title: `Test Issue ${issueIid}`,
        description: `Description for issue ${issueIid}`,
        state: 'opened',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        closed_at: null,
        web_url: `https://gitlab.mock/project/${projectId}/issues/${issueIid}`,
        author: {
          id: 1,
          username: 'test-user',
          name: 'Test User',
          avatar_url: null,
          web_url: 'https://gitlab.mock/test-user'
        },
        assignees: [],
        labels: [],
        milestone: null
      });
    });

    // GET /api/v4/projects - List projects
    this.app.get('/api/v4/projects', (req: AuthenticatedRequest, res: Response) => {
      res.json([
        {
          id: 123,
          name: 'Test Project',
          path: 'test-project',
          path_with_namespace: 'test-group/test-project',
          description: 'A mock test project',
          visibility: 'private',
          namespace: {
            id: 1,
            name: 'Test Group',
            path: 'test-group',
            kind: 'group',
            full_path: 'test-group'
          }
        }
      ]);
    });

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', message: 'Mock GitLab API is running' });
    });

    // Catch-all for unimplemented endpoints
    this.app.use((req: Request, res: Response) => {
      console.log(`Mock GitLab: Unimplemented endpoint: ${req.method} ${req.path}`);
      res.status(404).json({
        message: '404 Not Found',
        error: 'Endpoint not implemented in mock server'
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, '127.0.0.1', () => {
        console.log(`Mock GitLab API listening on http://127.0.0.1:${this.config.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err) => {
          if (err) reject(err);
          else {
            console.log('Mock GitLab API stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.config.port}`;
  }
}

/**
 * Helper to find available port for mock server
 */
export async function findMockServerPort(
  basePort: number = 9000, 
  maxAttempts: number = 10
): Promise<number> {
  const net = await import('net');
  
  const tryPort = async (port: number, attemptsLeft: number): Promise<number> => {
    if (attemptsLeft === 0) {
      throw new Error(`Could not find available port after ${maxAttempts} attempts starting from ${basePort}`);
    }

    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.unref();
      
      server.on('error', async () => {
        try {
          const nextPort = await tryPort(port + 1, attemptsLeft - 1);
          resolve(nextPort);
        } catch (err) {
          reject(err);
        }
      });
      
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        server.close(() => {
          resolve(actualPort);
        });
      });
    });
  };

  return tryPort(basePort, maxAttempts);
}

/**
 * Reset request counter (useful for rate limit testing)
 */
export function resetMockServerState(server: MockGitLabServer) {
  (server as any).requestCount = 0;
}

