"use client";

import { useState } from "react";
import { User, Item, Order, Split } from "../types";

interface ItemAssignmentProps {
  order: Order;
  users: User[];
  onSaveSplits: (splits: Split[]) => void;
}

// Palette of colours cycled through for each user badge
const USER_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-700", selected: "bg-blue-500 text-white" },
  { bg: "bg-purple-500", light: "bg-purple-100", text: "text-purple-700", selected: "bg-purple-500 text-white" },
  { bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-700", selected: "bg-emerald-500 text-white" },
  { bg: "bg-orange-500", light: "bg-orange-100", text: "text-orange-700", selected: "bg-orange-500 text-white" },
  { bg: "bg-pink-500", light: "bg-pink-100", text: "text-pink-700", selected: "bg-pink-500 text-white" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-700", selected: "bg-cyan-500 text-white" },
  { bg: "bg-yellow-500", light: "bg-yellow-100", text: "text-yellow-700", selected: "bg-yellow-500 text-white" },
  { bg: "bg-rose-500", light: "bg-rose-100", text: "text-rose-700", selected: "bg-rose-500 text-white" },
];

function userColor(index: number) {
  return USER_COLORS[index % USER_COLORS.length];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ItemAssignment({ order, users, onSaveSplits }: ItemAssignmentProps) {
  // assignments[itemId] = Set of userIds assigned to that item
  const [assignments, setAssignments] = useState<Record<number, Set<number>>>(() => {
    const init: Record<number, Set<number>> = {};
    order.items.forEach((item) => {
      init[item.id] = new Set();
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (itemId: number, userId: number) => {
    setAssignments((prev) => {
      const current = new Set(prev[itemId]);
      if (current.has(userId)) {
        current.delete(userId);
      } else {
        current.add(userId);
      }
      return { ...prev, [itemId]: current };
    });
  };

  const evenSplit = () => {
    const allUserIds = users.map((u) => u.id);
    const next: Record<number, Set<number>> = {};
    order.items.forEach((item) => {
      next[item.id] = new Set(allUserIds);
    });
    setAssignments(next);
  };

  const clearAll = () => {
    const next: Record<number, Set<number>> = {};
    order.items.forEach((item) => {
      next[item.id] = new Set();
    });
    setAssignments(next);
  };

  // Compute the preview of each user's subtotal
  const userSubtotals: Record<number, number> = {};
  users.forEach((u) => {
    userSubtotals[u.id] = 0;
  });
  order.items.forEach((item) => {
    const assignedUsers = Array.from(assignments[item.id] || []);
    if (assignedUsers.length === 0) return;
    const perUser = (item.price * item.quantity) / assignedUsers.length;
    assignedUsers.forEach((uid) => {
      userSubtotals[uid] = (userSubtotals[uid] || 0) + perUser;
    });
  });

  const fees =
    (order.tax || 0) + (order.delivery_fee || 0) + (order.tip || 0) - (order.discount || 0);
  const totalSubtotal = Object.values(userSubtotals).reduce((a, b) => a + b, 0);

  const handleSave = async () => {
    // Validate: every item must have at least one person
    const unassigned = order.items.filter(
      (item) => assignments[item.id].size === 0
    );
    if (unassigned.length > 0) {
      setError(
        `Please assign all items before continuing. Unassigned: ${unassigned
          .map((i) => i.name)
          .join(", ")}`
      );
      return;
    }
    setError("");
    setSaving(true);

    try {
      const payload = {
        order_id: order.id,
        assignments: order.items.map((item) => ({
          item_id: item.id,
          user_ids: Array.from(assignments[item.id]),
        })),
      };

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/splits/bulk`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to save splits");
      }

      const splits: Split[] = await res.json();
      onSaveSplits(splits);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save splits");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-slate-800">Assign Items</h3>
          <div className="flex space-x-2">
            <button
              onClick={evenSplit}
              className="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors text-sm font-medium"
            >
              Even Split
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors text-sm"
            >
              Clear All
            </button>
          </div>
        </div>
        <p className="text-slate-500 text-sm">
          Tap the people who shared each item. Items can be split between multiple people.
        </p>
      </div>

      {/* User legend */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <p className="text-sm font-medium text-slate-500 mb-3">People</p>
        <div className="flex flex-wrap gap-3">
          {users.map((user, idx) => {
            const color = userColor(idx);
            const sub = userSubtotals[user.id] || 0;
            const propFees = totalSubtotal > 0 ? fees * (sub / totalSubtotal) : 0;
            return (
              <div key={user.id} className="flex items-center space-x-2 px-3 py-2 bg-slate-50 rounded-xl">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${color.bg}`}
                >
                  {initials(user.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">${(sub + propFees).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {order.items.map((item) => {
          const assignedCount = assignments[item.id].size;
          const perPersonCost =
            assignedCount > 0 ? (item.price * item.quantity) / assignedCount : null;

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold text-slate-800">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    {item.quantity} × ${item.price.toFixed(2)} ={" "}
                    <span className="font-medium text-slate-700">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                  </p>
                </div>
                {perPersonCost !== null && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">per person</p>
                    <p className="text-sm font-semibold text-slate-700">
                      ${perPersonCost.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {users.map((user, idx) => {
                  const color = userColor(idx);
                  const selected = assignments[item.id].has(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() => toggle(item.id, user.id)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selected
                          ? `${color.bg} text-white shadow-sm`
                          : `${color.light} ${color.text} hover:opacity-80`
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          selected ? "bg-white/25 text-white" : color.bg + " text-white"
                        }`}
                      >
                        {initials(user.name)}
                      </div>
                      <span>{user.name}</span>
                      {selected && (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              {assignments[item.id].size === 0 && (
                <p className="mt-2 text-xs text-amber-600">Not assigned to anyone</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Save */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {saving ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>Calculating...</span>
            </>
          ) : (
            <>
              <span>Review & Send Reminders</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
