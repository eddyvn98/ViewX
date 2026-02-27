'use client';

import { useStrategyRunner } from '@/features/strategy/hooks/use-strategy-runner';

export function StrategyRunnerBootstrap() {
  useStrategyRunner();
  return null;
}

