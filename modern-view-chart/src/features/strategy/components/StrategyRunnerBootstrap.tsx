'use client';

import { useStrategyRunner } from '@/features/strategy/hooks/use-strategy-runner';
import { useStrategyMatrixMonitor } from '@/features/strategy/dashboard/use-strategy-matrix-monitor';

export function StrategyRunnerBootstrap() {
  useStrategyMatrixMonitor();
  useStrategyRunner();
  return null;
}
