import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Go up two levels from build/utils/ to reach the project root
const DEFAULT_CONFIG_FILE = path.join(__dirname, '..', '..', 'instances.json');
const CONFIG_FILE = process.env.GITLAB_CONFIG_PATH || DEFAULT_CONFIG_FILE;

// In test mode, we want to avoid side effects and interference between tests
// unless a specific config path is provided.
const IS_TEST = process.env.GITLAB_TEST_MODE === 'true' || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || process.env.JEST_WORKER_ID !== undefined || process.env.NODE_TEST_CONTEXT !== undefined;
const SHOULD_PERSIST = !IS_TEST || process.env.GITLAB_CONFIG_PATH !== undefined;

export interface GitLabInstance {
  url: string;
  token: string;
  description?: string;
}

export interface ConfigData {
  active_alias: string;
  instances: Record<string, GitLabInstance>;
}

class ConfigManager {
  private data: ConfigData;

  constructor() {
    this.data = this.load();
  }

  private load(): ConfigData {
    if (SHOULD_PERSIST && fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const data = JSON.parse(raw);
        
        // Migrate 'twinby' to 'default' if needed
        if (data.active_alias === 'twinby') {
          data.active_alias = 'default';
        }
        if (data.instances && data.instances['twinby']) {
          data.instances['default'] = data.instances['twinby'];
          delete data.instances['twinby'];
        }
        
        return data;
      } catch (e) {
        console.error('Error reading instances.json, using defaults', e);
      }
    }
    
    return {
      active_alias: 'default',
      instances: {}
    };
  }

  public save(): void {
    if (!SHOULD_PERSIST) return;
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving instances.json', e);
    }
  }

  public addInstance(alias: string, instance: GitLabInstance): void {
    this.data.instances[alias] = instance;
    this.save();
  }

  public selectInstance(alias: string): boolean {
    if (this.data.instances[alias]) {
      this.data.active_alias = alias;
      this.save();
      return true;
    }
    return false;
  }

  public getActiveInstance(): GitLabInstance | null {
    return this.data.instances[this.data.active_alias] || null;
  }

  public getActiveAlias(): string {
    return this.data.active_alias;
  }

  public listInstances(): Record<string, { url: string; description?: string }> {
    const list: Record<string, { url: string; description?: string }> = {};
    for (const [alias, inst] of Object.entries(this.data.instances)) {
      list[alias] = { url: inst.url, description: inst.description };
    }
    return list;
  }

  public getInstance(alias: string): GitLabInstance | null {
    return this.data.instances[alias] || null;
  }
}

export const configManager = new ConfigManager();
