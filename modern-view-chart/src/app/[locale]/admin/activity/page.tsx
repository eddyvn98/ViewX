'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { readStoredAccessToken } from '@/lib/auth/session';

type ActiveUserRow = {
  userId: string;
  username: string | null;
  role: string | null;
  stateUpdatedAt: string | null;
  lastSyncedAt: string | null;
  userCreatedAt: string | null;
  userUpdatedAt: string | null;
};

type ActivityResponse = {
  ts: string;
  timezone: string;
  hours: number;
  since: string;
  summary: {
    logged_in_users: number;
    user_sessions: number;
    guest_sessions: number;
    tradelogs: number;
  };
  users: ActiveUserRow[];
};

const HOURS_OPTIONS = [1, 6, 24];
const REFRESH_INTERVAL_MS = 15_000;

function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('vi-VN', { hour12: false });
}

export default function AdminActivityPage() {
  const [hours, setHours] = useState<number>(6);
  const [data, setData] = useState<ActivityResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const accessToken = readStoredAccessToken();
      if (!accessToken) {
        setError('Chưa đăng nhập. Vui lòng đăng nhập tài khoản admin.');
        setData(null);
        return;
      }

      const response = await fetch(`/api/metrics/user-activity?hours=${hours}`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error || `Không tải được dữ liệu (${response.status})`);
        setData(null);
        return;
      }

      const payload = (await response.json()) as ActivityResponse;
      setData(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không tải được dữ liệu';
      setError(message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [hours]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      fetchActivity();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchActivity]);

  const headerStatus = useMemo(() => {
    if (error) return error;
    if (!data?.ts) return isLoading ? 'Đang tải...' : 'Chưa có dữ liệu';
    return `Cập nhật: ${formatDateTime(data.ts)} (UTC trong DB)`;
  }, [data?.ts, error, isLoading]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">User Activity Monitor</h1>
              <p className="text-sm text-slate-300 mt-1">{headerStatus}</p>
            </div>
            <div className="flex items-center gap-2">
              {HOURS_OPTIONS.map((value) => (
                <button
                  key={value}
                  onClick={() => setHours(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    hours === value ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {value}h
                </button>
              ))}
              <button
                onClick={fetchActivity}
                className="rounded-lg bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
              >
                Refresh
              </button>
              <Link href="/" className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold hover:bg-slate-600">
                Về chart
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Logged-in users" value={data?.summary.logged_in_users ?? 0} />
          <StatCard label="User sessions" value={data?.summary.user_sessions ?? 0} />
          <StatCard label="Guest sessions (chưa login)" value={data?.summary.guest_sessions ?? 0} />
          <StatCard label="Trade logs" value={data?.summary.tradelogs ?? 0} />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-900/90 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 text-sm text-slate-300">
            Danh sách user đăng nhập hoạt động trong {hours} giờ
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-800/80 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">#</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-left px-3 py-2">State Updated</th>
                  <th className="text-left px-3 py-2">Last Synced</th>
                  <th className="text-left px-3 py-2">User Created</th>
                  <th className="text-left px-3 py-2">User Updated</th>
                </tr>
              </thead>
              <tbody>
                {data?.users?.length ? (
                  data.users.map((row, index) => (
                    <tr key={`${row.userId}-${index}`} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-400">{index + 1}</td>
                      <td className="px-3 py-2">{row.username || row.userId}</td>
                      <td className="px-3 py-2">{row.role || '-'}</td>
                      <td className="px-3 py-2">{formatDateTime(row.stateUpdatedAt)}</td>
                      <td className="px-3 py-2">{formatDateTime(row.lastSyncedAt)}</td>
                      <td className="px-3 py-2">{formatDateTime(row.userCreatedAt)}</td>
                      <td className="px-3 py-2">{formatDateTime(row.userUpdatedAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-3 py-6 text-slate-400" colSpan={7}>
                      {isLoading ? 'Đang tải dữ liệu...' : 'Không có user đăng nhập hoạt động trong khoảng thời gian này.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3">
      <div className="text-xs uppercase tracking-widest text-slate-400">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
