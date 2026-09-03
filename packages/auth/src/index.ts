export {
  AuthConfigurationError,
  BETTER_AUTH_SECRET_MIN_LENGTH,
  loadAuthConfig,
  validateBetterAuthSecret,
} from "./config.js";
export type { AuthConfig } from "./config.js";
export { createCoreAuth } from "./core.js";
