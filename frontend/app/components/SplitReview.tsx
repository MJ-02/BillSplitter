"use client";

import { useState } from "react";
import { User, Item, Order, Split } from "../types";

interface SplitReviewProps {
  order: Order;
  splits: Split[];
  users: User[];
  onDone: () => void;
}

const USER_COLORS = [
  "bg-blue-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-rose-500",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function SplitReview({ order, splits, users, onDone }: SplitReviewProps) {
  const [splitStates, setSplitStates] = useState<Split[]>(splits);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  const userMap = Object.fromEntries(users.map((u, i) => [u.id, { ...u, colorIdx: i }]));
  const itemMap = Object.fromEntries(order.items.map((item) => [item.id, item]));

  // For each item, count how many splits include it (to show per-person share)
  const itemShareCount: Record<number, number> = {};
  order.items.forEach((item) => {
    itemShareCount[item.id] = splitStates.filter((s) => s.item_ids.includes(item.id)).length;
  });

  const payer = userMap[order.paid_by_user_id];

  const togglePaid = async (splitId: number, current: boolean) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/splits/${splitId}/paid?paid=${!current}`,
        { method: "PUT" }
      );
      if (!res.ok) throw new Error("Failed to update");
      const updated: Split = await res.json();
      setSplitStates((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      showToast("Failed to update payment status");
    }
  };

  const sendReminder = async (splitId: number) => {
    setSendingId(splitId);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/splits/${splitId}/send-reminder`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      const updatedSplit: Split = data.split;
      setSplitStates((prev) => prev.map((s) => (s.id === updatedSplit.id ? updatedSplit : s)));
      showToast("Reminder sent!");
    } catch {
      showToast("Failed to send reminder");
    } finally {
      setSendingId(null);
    }
  };

  const sendAllReminders = async () => {
    setSendingAll(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/splits/order/${order.id}/send-all-reminders`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to send reminders");
      // Refresh all splits
      const splitsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/splits/order/${order.id}`
      );
      if (splitsRes.ok) {
        const refreshed: Split[] = await splitsRes.json();
        setSplitStates(refreshed);
      }
      showToast("All reminders sent!");
    } catch {
      showToast("Failed to send reminders");
    } finally {
      setSendingAll(false);
    }
  };

  const unpaidSplits = splitStates.filter((s) => !s.paid_status);
  const paidSplits = splitStates.filter((s) => s.paid_status);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm z-50 transition-all">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">{order.restaurant}</h3>
            <p className="text-slate-500 text-sm mt-1">
              {new Date(order.date).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
            {payer && (
              <p className="text-sm text-slate-600 mt-1">
                Paid by{" "}
                <span className="font-semibold text-slate-800">{payer.name}</span>
                {payer.payment_handle && (
                  <span className="ml-1 text-slate-500">({payer.payment_handle})</span>
                )}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-slate-800">${order.total.toFixed(2)}</p>
            <p className="text-sm text-slate-500 mt-1">total</p>
          </div>
        </div>

        {/* Fee breakdown summary */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
          {order.subtotal !== undefined && order.subtotal !== null && (
            <>
              <span className="text-slate-500">Subtotal</span>
              <span className="text-right font-medium text-slate-700">${order.subtotal.toFixed(2)}</span>
            </>
          )}
          {!!order.tax && (
            <>
              <span className="text-slate-500">Tax</span>
              <span className="text-right font-medium text-slate-700">${order.tax.toFixed(2)}</span>
            </>
          )}
          {!!order.delivery_fee && (
            <>
              <span className="text-slate-500">Delivery Fee</span>
              <span className="text-right font-medium text-slate-700">${order.delivery_fee.toFixed(2)}</span>
            </>
          )}
          {!!order.tip && (
            <>
              <span className="text-slate-500">Tip</span>
              <span className="text-right font-medium text-slate-700">${order.tip.toFixed(2)}</span>
            </>
          )}
          {!!order.discount && (
            <>
              <span className="text-slate-500">Discount</span>
              <span className="text-right font-medium text-emerald-600">-${order.discount.toFixed(2)}</span>
            </>
          )}
        </div>
      </div>

      {/* Send all button */}
      {unpaidSplits.length > 0 && (
        <button
          onClick={sendAllReminders}
          disabled={sendingAll}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3.5 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {sendingAll ? (
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
              <span>Sending reminders...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
              <span>Send All Reminders ({unpaidSplits.length})</span>
            </>
          )}
        </button>
      )}

      {/* Unpaid splits */}
      {unpaidSplits.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-1">
            Outstanding ({unpaidSplits.length})
          </h4>
          {unpaidSplits.map((split) => {
            const user = userMap[split.user_id];
            if (!user) return null;
            const colorClass = USER_COLORS[user.colorIdx % USER_COLORS.length];

            // Build item breakdown
            const assignedItems = split.item_ids
              .map((id) => itemMap[id])
              .filter(Boolean) as Item[];

            return (
              <div key={split.id} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${colorClass}`}
                    >
                      {initials(user.name)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{user.name}</p>
                      {user.phone && (
                        <p className="text-xs text-slate-400">{user.phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-800">
                      ${split.amount_owed.toFixed(2)}
                    </p>
                    {split.reminder_sent && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Reminded {split.reminder_sent_at
                          ? new Date(split.reminder_sent_at).toLocaleDateString()
                          : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5 mb-4">
                  {assignedItems.map((item) => {
                    const shareCount = itemShareCount[item.id] || 1;
                    const share = (item.price * item.quantity) / shareCount;
                    return (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-slate-600">
                          {item.name}
                          {shareCount > 1 && (
                            <span className="text-slate-400 ml-1">(÷{shareCount})</span>
                          )}
                        </span>
                        <span className="text-slate-700 font-medium">${share.toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between text-sm text-slate-400 pt-1 border-t border-slate-100">
                    <span>Tax, fees & tip (proportional)</span>
                    <span>
                      $
                      {Math.max(
                        0,
                        split.amount_owed -
                          assignedItems.reduce((sum, item) => {
                            const sc = itemShareCount[item.id] || 1;
                            return sum + (item.price * item.quantity) / sc;
                          }, 0)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex space-x-2">
                  <button
                    onClick={() => sendReminder(split.id)}
                    disabled={sendingId === split.id}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {sendingId === split.id ? (
                      <svg
                        className="animate-spin h-4 w-4"
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
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                        />
                      </svg>
                    )}
                    <span>Send Reminder</span>
                  </button>
                  <button
                    onClick={() => togglePaid(split.id, split.paid_status)}
                    className="flex-1 flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Mark Paid</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paid splits */}
      {paidSplits.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide px-1">
            Settled ({paidSplits.length})
          </h4>
          {paidSplits.map((split) => {
            const user = userMap[split.user_id];
            if (!user) return null;
            const colorClass = USER_COLORS[user.colorIdx % USER_COLORS.length];
            return (
              <div key={split.id} className="bg-white rounded-2xl shadow-md p-5 opacity-75">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${colorClass}`}
                    >
                      {initials(user.name)}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700">{user.name}</p>
                      <p className="text-xs text-emerald-600 font-medium">Paid</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <p className="text-xl font-bold text-slate-600">${split.amount_owed.toFixed(2)}</p>
                    <button
                      onClick={() => togglePaid(split.id, split.paid_status)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg text-xs transition-colors"
                    >
                      Undo
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All settled */}
      {unpaidSplits.length === 0 && splitStates.length > 0 && (
        <div className="bg-emerald-50 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-semibold text-emerald-800 text-lg">All settled up!</p>
          <p className="text-emerald-600 text-sm mt-1">Everyone has paid their share.</p>
        </div>
      )}

      {/* Done */}
      <button
        onClick={onDone}
        className="w-full py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
      >
        Start a New Order
      </button>
    </div>
  );
}
