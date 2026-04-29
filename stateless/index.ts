/**
 * Public surface of the stateless token codec.
 *
 * Higher-level callers (oauth-proxy, streamable HTTP) should import from this
 * module only, so future refactors inside `stateless/` remain non-breaking.
 */

export { StatelessCodecError, StatelessConfigError } from "./errors.js";
export type { StatelessErrorReason } from "./errors.js";

export {
  STATELESS_PURPOSES,
  STATELESS_VERSION,
} from "./types.js";
export type {
  StatelessBasePayload,
  StatelessKeyMaterial,
  StatelessKeySlot,
  StatelessPurpose,
} from "./types.js";

export {
  decodeSecret,
  deriveSubkey,
  deriveSubkeys,
  hmacSha256,
  loadKeyMaterialFromEnv,
} from "./secret.js";

export {
  open,
  seal,
  sign,
  verify,
} from "./codec.js";
export type {
  SealedVerifyOptions,
  SignedVerifyOptions,
} from "./codec.js";
