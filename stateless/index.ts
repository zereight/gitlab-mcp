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

export {
  looksLikeStatelessClientId,
  mintClientId,
  openClientId,
} from "./client-id.js";
export type { ClientIdPayload, MintClientIdInput } from "./client-id.js";

export {
  looksLikeStatelessState,
  mintPendingAuthState,
  openPendingAuthState,
} from "./pending-auth.js";
export type {
  MintPendingAuthInput,
  PendingAuthPayload,
} from "./pending-auth.js";

export {
  looksLikeStatelessStoredTokensCode,
  mintStoredTokensCode,
  openStoredTokensCode,
} from "./stored-tokens.js";
export type {
  MintStoredTokensInput,
  StoredTokensPayload,
} from "./stored-tokens.js";

export {
  looksLikeStatelessSessionId,
  mintSessionId,
  openSessionId,
} from "./session-id.js";
export type {
  MintSessionIdInput,
  SessionAuthHeader,
  SessionIdPayload,
} from "./session-id.js";
