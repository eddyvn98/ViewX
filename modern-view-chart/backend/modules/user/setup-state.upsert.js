import userStateModel from '../../model/user_state.js';
import userStateDrawingsModel from '../../model/user_state_drawings.js';
import {
  isDatabaseReadyForUserState,
  isPlainObject,
  parseBaseRevision,
  parseMaxDrawingsBytes,
  parseMaxStateBytes,
  sanitizeClientId,
} from './user-state.helpers.js';
import { fetchState, SELECT_STATE_FIELDS } from './setup-state.get.js';

const CONFLICT_STATUS = 409;
const STATE_SAVED = 'state_saved';
const CONFLICT_REVISION = 'state_conflict_revision_mismatch';
const CONFLICT_STALE = 'state_ignored_stale_client';

function buildScopeBase(scope, doc) {
  return {
    scope_type: scope.scopeType,
    scope_id: scope.scopeId,
    schema_version: doc?.schemaVersion || 1,
    revision: Number.isFinite(Number(doc?.revision)) ? Number(doc.revision) : 0,
    updated_at: doc?.updatedAt || null,
    client_updated_at: doc?.clientUpdatedAt || null,
  };
}

function buildStatePayload(doc) {
  return {
    state: isPlainObject(doc?.state) ? doc.state : {},
  };
}

function buildConflictEnvelope(scope, doc, message) {
  return {
    message,
    ...buildScopeBase(scope, doc),
    ...buildStatePayload(doc),
  };
}

function buildSavedEnvelope(scope, doc) {
  return {
    message: STATE_SAVED,
    ...buildScopeBase(scope, doc),
  };
}

function parseStatePayload(req) {
  const incomingState = req.body?.state;
  if (!isPlainObject(incomingState)) {
    return { error: { status: 400, payload: { error: 'state must be an object' } } };
  }

  const state = { ...incomingState };
  let chartDrawings = null;
  if (isPlainObject(state.chartDrawings)) {
    chartDrawings = state.chartDrawings;
  }
  delete state.chartDrawings;

  const serialized = JSON.stringify(state);
  const maxBytes = parseMaxStateBytes();
  if (Buffer.byteLength(serialized, 'utf8') > maxBytes) {
    return { error: { status: 413, payload: { error: 'state payload too large' } } };
  }

  if (chartDrawings !== null) {
    const serializedDrawings = JSON.stringify(chartDrawings);
    const maxDrawingsBytes = parseMaxDrawingsBytes();
    if (Buffer.byteLength(serializedDrawings, 'utf8') > maxDrawingsBytes) {
      return { error: { status: 413, payload: { error: 'drawings payload too large' } } };
    }
  }

  return { state, chartDrawings, serialized };
}

function resolveSchemaVersion(req) {
  const raw = Number.parseInt(String(req.body?.schema_version || '1'), 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function resolveClientUpdatedAt(req) {
  const parsed = Date.parse(String(req.body?.client_updated_at || ''));
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

async function persistState({
  scope,
  state,
  chartDrawings,
  schemaVersion,
  clientUpdatedAt,
  sourceClientId,
  baseRevision,
}) {
  const existing = await userStateModel
    .findOne({ scopeType: scope.scopeType, scopeId: scope.scopeId })
    .select(SELECT_STATE_FIELDS)
    .lean();

  const existingRevision = Number.isFinite(Number(existing?.revision)) ? Number(existing.revision) : 0;
  const existingClientUpdatedAtMs = Date.parse(String(existing?.clientUpdatedAt || ''));

  if (Number.isFinite(baseRevision) && baseRevision !== existingRevision) {
    return { conflict: true, conflictDoc: existing, message: CONFLICT_REVISION };
  }

  if (
    !Number.isFinite(baseRevision) &&
    Number.isFinite(existingClientUpdatedAtMs) &&
    existingClientUpdatedAtMs > clientUpdatedAt.getTime()
  ) {
    return { conflict: true, conflictDoc: existing, message: CONFLICT_STALE };
  }

  let doc = null;

  if (!existing) {
    try {
      doc = await userStateModel.create({
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        state,
        schemaVersion,
        revision: 1,
        clientUpdatedAt,
        lastSourceClientId: sourceClientId,
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  if (!doc) {
    const updateFilter = { scopeType: scope.scopeType, scopeId: scope.scopeId };
    if (Number.isFinite(baseRevision)) {
      updateFilter.revision = baseRevision;
    } else {
      updateFilter.$or = [
        { clientUpdatedAt: { $exists: false } },
        { clientUpdatedAt: null },
        { clientUpdatedAt: { $lte: clientUpdatedAt } },
      ];
    }

    doc = await userStateModel.findOneAndUpdate(
      updateFilter,
      {
        $set: {
          state,
          schemaVersion,
          clientUpdatedAt,
          lastSourceClientId: sourceClientId,
          lastSyncedAt: new Date(),
        },
        $inc: { revision: 1 },
      },
      {
        new: true,
      },
    );
  }

  if (!doc) {
    const latest = await fetchState(scope);
    return {
      conflict: true,
      conflictDoc: latest,
      message: Number.isFinite(baseRevision) ? CONFLICT_REVISION : CONFLICT_STALE,
    };
  }

  if (chartDrawings !== null) {
    await userStateDrawingsModel.findOneAndUpdate(
      { scopeType: scope.scopeType, scopeId: scope.scopeId },
      {
        $set: {
          chartDrawings,
          clientUpdatedAt,
          lastSourceClientId: sourceClientId,
          lastSyncedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );
  }

  return { doc };
}

export function createUpsertHandler({ resolveScope, requireDatabase = false }) {
  return async (req, res) => {
    const scope = resolveScope(req);
    if (requireDatabase && !isDatabaseReadyForUserState()) {
      return res.status(202).json({
        message: 'state_skipped_db_unavailable',
        scope_type: scope.scopeType,
        scope_id: scope.scopeId,
        schema_version: 1,
        updated_at: null,
        client_updated_at: null,
      });
    }

    const payload = parseStatePayload(req);
    if (payload.error) {
      return res.status(payload.error.status).json(payload.error.payload);
    }

    const schemaVersion = resolveSchemaVersion(req);
    const baseRevision = parseBaseRevision(req.body?.base_revision);
    const clientUpdatedAt = resolveClientUpdatedAt(req);
    const sourceClientId = sanitizeClientId(
      req.headers['x-client-id'] || req.query?.client_id || req.body?.source_client_id,
    );

    const result = await persistState({
      scope,
      state: payload.state,
      chartDrawings: payload.chartDrawings,
      schemaVersion,
      clientUpdatedAt,
      sourceClientId,
      baseRevision,
    });

    if (result.conflict) {
      return res.status(CONFLICT_STATUS).json(buildConflictEnvelope(scope, result.conflictDoc, result.message));
    }

    return res.status(200).json(buildSavedEnvelope(scope, result.doc));
  };
}
