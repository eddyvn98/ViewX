import userStateModel from '../../model/user_state.js';
import {
  buildEmptySetupStateResponse,
  isDatabaseReadyForUserState,
  isPlainObject,
} from './user-state.helpers.js';

export const SELECT_STATE_FIELDS = 'state schemaVersion revision updatedAt clientUpdatedAt lastSourceClientId';

function formatStateResponse(scope, doc) {
  return {
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
    schema_version: doc.schemaVersion || 1,
    revision: Number.isFinite(Number(doc.revision)) ? Number(doc.revision) : 0,
    updated_at: doc.updatedAt || null,
    client_updated_at: doc.clientUpdatedAt || null,
    state: isPlainObject(doc.state) ? doc.state : {},
  };
}

export async function fetchState(scope) {
  return userStateModel
    .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
    .select(SELECT_STATE_FIELDS)
    .lean();
}

export function createGetStateHandler({ resolveScope, requireDatabase = false }) {
  return async (req, res) => {
    const scope = resolveScope(req);
    if (requireDatabase && !isDatabaseReadyForUserState()) {
      return res.status(200).json(buildEmptySetupStateResponse(scope));
    }
    const doc = await fetchState(scope);
    if (!doc) {
      return res.status(200).json(buildEmptySetupStateResponse(scope));
    }
    return res.status(200).json(formatStateResponse(scope, doc));
  };
}
