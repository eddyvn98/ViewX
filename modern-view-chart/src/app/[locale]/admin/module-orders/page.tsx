"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ModuleOrder = {
  _id: string;
  userId: string;
  moduleKey: string;
  planKey: string;
  amount: number;
  currency: string;
  status: string;
  bankRefCode?: string;
  createdAt?: string;
  paidAt?: string;
};

type ModuleStats = {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  expiredOrders: number;
  totalRevenue: number;
  activeMembers: number;
};

type ModuleAccess = {
  status?: string;
  planKey?: string;
  activatedAt?: string;
  expiresAt?: string;
};

type ModuleMember = {
  _id: string;
  username?: string;
  email?: string;
  moduleAccess?: Record<string, ModuleAccess>;
};

const MODULE_KEYS = ["mt5_trade", "telegram_notify", "telegram_control", "ai_assistant"];

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

export default function AdminModuleOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ModuleStats | null>(null);
  const [pendingOrders, setPendingOrders] = useState<ModuleOrder[]>([]);
  const [members, setMembers] = useState<ModuleMember[]>([]);
  const [error, setError] = useState<string>("");
  const [workingKey, setWorkingKey] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsRes, ordersRes, membersRes] = await Promise.all([
        fetchJson<{ data: ModuleStats }>("/api/user/admin/module-stats"),
        fetchJson<{ data: { orders: ModuleOrder[] } }>("/api/user/admin/module-orders?status=pending"),
        fetchJson<{ data: { members: ModuleMember[] } }>("/api/user/admin/module-members"),
      ]);
      setStats(statsRes.data);
      setPendingOrders(ordersRes.data.orders || []);
      setMembers(membersRes.data.members || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const statsCards = useMemo(
    () => [
      { label: "Total orders", value: stats?.totalOrders ?? 0 },
      { label: "Pending", value: stats?.pendingOrders ?? 0 },
      { label: "Paid", value: stats?.paidOrders ?? 0 },
      { label: "Expired", value: stats?.expiredOrders ?? 0 },
      { label: "Revenue (VND)", value: stats?.totalRevenue ?? 0 },
      { label: "Active members", value: stats?.activeMembers ?? 0 },
    ],
    [stats]
  );

  const confirmOrder = async (orderId: string) => {
    const adminNote = window.prompt("Admin note (optional)", "") || "";
    setWorkingKey(`confirm:${orderId}`);
    try {
      await fetchJson(`/api/user/admin/module-orders/${orderId}/confirm`, {
        method: "POST",
        body: JSON.stringify({ adminNote }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setWorkingKey("");
    }
  };

  const rejectOrder = async (orderId: string) => {
    const adminNote = window.prompt("Reason for reject", "") || "";
    setWorkingKey(`reject:${orderId}`);
    try {
      await fetchJson(`/api/user/admin/module-orders/${orderId}/reject`, {
        method: "POST",
        body: JSON.stringify({ adminNote }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setWorkingKey("");
    }
  };

  const extendModule = async (userId: string, moduleKey: string) => {
    const daysRaw = window.prompt("Extend days", "30");
    const days = Number(daysRaw || "0");
    if (!Number.isFinite(days) || days <= 0) return;

    setWorkingKey(`extend:${userId}:${moduleKey}`);
    try {
      await fetchJson(`/api/user/admin/module-members/${userId}/extend`, {
        method: "POST",
        body: JSON.stringify({ moduleKey, days }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extend failed");
    } finally {
      setWorkingKey("");
    }
  };

  const expireModule = async (userId: string, moduleKey: string) => {
    if (!window.confirm(`Expire ${moduleKey} for this user?`)) return;

    setWorkingKey(`expire:${userId}:${moduleKey}`);
    try {
      await fetchJson(`/api/user/admin/module-members/${userId}/expire`, {
        method: "POST",
        body: JSON.stringify({ moduleKey }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Expire failed");
    } finally {
      setWorkingKey("");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Module Admin</h1>
        <button className="rounded border px-3 py-2" onClick={loadData} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div> : null}

      <section className="grid gap-3 md:grid-cols-3">
        {statsCards.map((item) => (
          <div key={item.label} className="rounded border p-4">
            <div className="text-gray-500">{item.label}</div>
            <div className="text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Pending Orders</h2>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">User</th>
                <th className="p-2">Module</th>
                <th className="p-2">Plan</th>
                <th className="p-2">Amount</th>
                <th className="p-2">Ref</th>
                <th className="p-2">Created</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingOrders.map((order) => (
                <tr key={order._id} className="border-t">
                  <td className="p-2">{order.userId}</td>
                  <td className="p-2">{order.moduleKey}</td>
                  <td className="p-2">{order.planKey}</td>
                  <td className="p-2">
                    {order.amount} {order.currency}
                  </td>
                  <td className="p-2">{order.bankRefCode || "-"}</td>
                  <td className="p-2">{order.createdAt ? new Date(order.createdAt).toLocaleString() : "-"}</td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <button
                        className="rounded bg-green-600 px-2 py-1 text-white disabled:opacity-60"
                        disabled={workingKey === `confirm:${order._id}`}
                        onClick={() => confirmOrder(order._id)}
                      >
                        Confirm
                      </button>
                      <button
                        className="rounded bg-red-600 px-2 py-1 text-white disabled:opacity-60"
                        disabled={workingKey === `reject:${order._id}`}
                        onClick={() => rejectOrder(order._id)}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!pendingOrders.length && !loading ? (
                <tr>
                  <td className="p-3 text-center text-gray-500" colSpan={7}>
                    No pending orders
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Members</h2>
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="p-2">User</th>
                {MODULE_KEYS.map((m) => (
                  <th key={m} className="p-2">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member._id} className="border-t align-top">
                  <td className="p-2">
                    <div className="font-medium">{member.username || member.email || member._id}</div>
                    <div className="text-xs text-gray-500">{member._id}</div>
                  </td>
                  {MODULE_KEYS.map((moduleKey) => {
                    const access = member.moduleAccess?.[moduleKey];
                    return (
                      <td key={`${member._id}-${moduleKey}`} className="p-2">
                        <div className="space-y-1">
                          <div>Status: {access?.status || "none"}</div>
                          <div className="text-xs text-gray-600">
                            Expire: {access?.expiresAt ? new Date(access.expiresAt).toLocaleString() : "-"}
                          </div>
                          <div className="flex gap-2">
                            <button
                              className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={workingKey === `extend:${member._id}:${moduleKey}`}
                              onClick={() => extendModule(member._id, moduleKey)}
                            >
                              Extend
                            </button>
                            <button
                              className="rounded border px-2 py-1 text-xs disabled:opacity-60"
                              disabled={workingKey === `expire:${member._id}:${moduleKey}`}
                              onClick={() => expireModule(member._id, moduleKey)}
                            >
                              Expire
                            </button>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!members.length && !loading ? (
                <tr>
                  <td className="p-3 text-center text-gray-500" colSpan={MODULE_KEYS.length + 1}>
                    No member data
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}