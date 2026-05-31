import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Go up two levels from build/utils/ to reach the project root
const CONFIG_FILE = path.join(__dirname, '..', '..', 'instances.json');

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
    this.migrateIfNeeded();
  }

  private load(): ConfigData {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
        return JSON.parse(raw);
      } catch (e) {
        console.error('Error reading instances.json, using defaults', e);
      }
    }
    
    return {
      active_alias: 'twinby',
      instances: {}
    };
  }

  private migrateIfNeeded(): void {
    if (Object.keys(this.data.instances).length === 0) {
      // Simple normalization: ensure /api/v4 suffix
      const normalize = (url: string) => {
        let u = url.trim().replace(/\/$/, "");
        if (!u.endsWith("/api/v4")) {
          u += "/api/v4";
        }
        return u;
      };

      const envToken = process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
      const envUrl = process.env.GITLAB_API_URL || "https://gitlab.com/api/v4";
      const cloudToken = process.env.GITLAB_CLOUD_TOKEN;

      if (envToken) {
        this.addInstance("twinby", {
          url: normalize(envUrl),
          token: envToken,
          description: "Default instance from environment",
        });
        this.data.active_alias = "twinby";
      }

      if (cloudToken) {
        this.addInstance("cloud", {
          url: normalize(process.env.GITLAB_CLOUD_API_URL || "https://gitlab.com/api/v4"),
          token: cloudToken,
          description: "Cloud instance from .env",
        });
      }
      this.save();
    }
  }

  public save(): void {
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
