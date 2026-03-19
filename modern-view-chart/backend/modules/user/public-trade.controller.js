import tradeLogModel from '../../model/trade_log.js';
import {
  buildEmptyTradeStats,
  computeTradeStats,
  sanitizeTradeLogPayload,
} from './trade-log.service.js';
import { sanitizeStrategyId } from './user-state.helpers.js';

export const createPublicTradeLog = async (req, res) => {
  try {
    const payload = sanitizeTradeLogPayload(req.body);
    if (!payload.strategy_id || !payload.symbol || !payload.entry_price || payload.lot_size <= 0) {
      return res.status(400).json({ error: 'invalid_trade_log_payload' });
    }

    const created = await tradeLogModel.create(payload);
    return res.status(201).json(created.toObject());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicTradeStats = async (req, res) => {
  try {
    const strategyId = sanitizeStrategyId(req.query?.strategy_id);
    if (!strategyId) return res.status(200).json(buildEmptyTradeStats());

    const stats = await computeTradeStats(strategyId);
    return res.status(200).json(stats);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export const updatePublicTradeExit = async (req, res) => {
  try {
    const strategyId = sanitizeStrategyId(req.body?.strategy_id);
    const symbol = String(req.body?.symbol || '').trim();
    const exitPrice = Number(req.body?.exit_price);
    if (!strategyId || !symbol || !Number.isFinite(exitPrice)) {
      return res.status(400).json({ error: 'invalid_trade_exit_payload' });
    }

    const entry = await tradeLogModel
      .findOne({
        strategy_id: strategyId,
        symbol,
        exit_price: null,
      })
      .sort({ timestamp: -1 });

    if (!entry) {
      return res.status(404).json({ error: 'trade_log_not_found' });
    }

    const side = entry.type === 'BUY' ? 1 : -1;
    const pnl = (exitPrice - Number(entry.entry_price || 0)) * side * (Number(entry.lot_size || 0) * 100000);
    entry.exit_price = exitPrice;
    entry.pnl = pnl;
    entry.mae = req.body?.metadata?.mae ?? entry.mae;
    entry.mfe = req.body?.metadata?.mfe ?? entry.mfe;
    entry.exit_reason = req.body?.metadata?.exit_reason || entry.exit_reason || 'SIGNAL';

    await entry.save();
    return res.status(200).json(entry.toObject());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
