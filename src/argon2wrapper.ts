import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { randomBytes } from 'crypto';

// Default options similar to @node-rs/argon2
const DEFAULT_OPTIONS = {
  t: 3,        // iterations
  m: 65536,    // 64MB memory
  p: 4,        // parallelism
  maxmem: 2 ** 32 - 1
};

interface Argon2Options {
  salt?: Uint8Array;
}

/**
 * Hash a password using argon2id
 */
export async function hash(password: string, options?: Argon2Options): Promise<string> {
  const salt = options?.salt || randomBytes(16);
  const passwordBytes = utf8ToBytes(password);
  
  const hashBytes = argon2id(passwordBytes, salt, DEFAULT_OPTIONS);
  
  // Store salt and hash together for verification later
  // Format: salt:hash (both as hex)
  return `${bytesToHex(salt)}:${bytesToHex(hashBytes)}`;
}

/**
 * Synchronous version of hash
 */
export function hashSync(password: string, options?: Argon2Options): string {
  const salt = options?.salt || randomBytes(16);
  const passwordBytes = utf8ToBytes(password);
  
  const hashBytes = argon2id(passwordBytes, salt, DEFAULT_OPTIONS);
  
  // Store salt and hash together for verification later
  // Format: salt:hash (both as hex)
  return `${bytesToHex(salt)}:${bytesToHex(hashBytes)}`;
}

/**
 * Verify a password against a hash
 */
export async function verify(storedHash: string, password: string, options?: Argon2Options): Promise<boolean> {
  try {
    // If options.salt is provided, it means we're using the old format
    // where salt was provided separately
    if (options?.salt) {
      const passwordBytes = utf8ToBytes(password);
      const hashBytes = argon2id(passwordBytes, options.salt, DEFAULT_OPTIONS);
      const newHash = bytesToHex(hashBytes);
      
      // storedHash might be just the hash part without salt prefix
      const hashPart = storedHash.includes(':') ? storedHash.split(':')[1] : storedHash;
      return newHash === hashPart;
    }
    
    // New format: salt:hash
    const [saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) {
      return false;
    }
    
    const salt = hexToBytes(saltHex);
    const passwordBytes = utf8ToBytes(password);
    
    const computedHashBytes = argon2id(passwordBytes, salt, DEFAULT_OPTIONS);
    const computedHashHex = bytesToHex(computedHashBytes);
    
    return computedHashHex === hashHex;
  } catch (error) {
    return false;
  }
}

// Export as default object to match @node-rs/argon2 interface
export default {
  hash,
  hashSync,
  verify
};