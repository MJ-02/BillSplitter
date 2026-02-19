"use client";

import { useState, useEffect } from "react";

interface Order {
  id: number;
  restaurant: string;
  total: number;
  date: string;
  paid_by_user_id: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Orders</h2>
        <p className="text-slate-600 mt-1">View all processed orders</p>
      </div>

      <div className="grid gap-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-slate-800">{order.restaurant}</h3>
                <p className="text-slate-600 text-sm mt-1">
                  {new Date(order.date).toLocaleDateString()} at{" "}
                  {new Date(order.date).toLocaleTimeString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">
                  ${order.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-600">
            No orders yet. Upload a receipt to create your first order!
          </p>
        </div>
      )}
    </div>
  );
}
