import { resolvePublicStateScope, resolveStateScope } from './user-state.helpers.js';
import { createGetStateHandler } from './setup-state.get.js';
import { createUpsertHandler } from './setup-state.upsert.js';

export const getUserSetupState = createGetStateHandler({ resolveScope: resolveStateScope });
export const getPublicUserSetupState = createGetStateHandler({
  resolveScope: resolvePublicStateScope,
  requireDatabase: true,
});
export const upsertUserSetupState = createUpsertHandler({ resolveScope: resolveStateScope });
export const upsertPublicUserSetupState = createUpsertHandler({
  resolveScope: resolvePublicStateScope,
  requireDatabase: true,
});
