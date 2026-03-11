import { fetchTradeStats } from './trade-log-api';
import { SignalStats } from '../types';

export class StatsService {
    static async compute(strategyId: string): Promise<SignalStats> {
        return fetchTradeStats(strategyId);
    }
}
