"use client";

import { useState, useEffect } from "react";

interface Order {
  id: number;
  restaurant: string;
  total: number;
  date: string;
  paid_by_user_id: number;
  tax?: number;
  delivery_fee?: number;
  subtotal?: number;
}

interface Item {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

interface OrderDetails extends Order {
  items: Item[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

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

  const fetchOrderDetails = async (orderId: number) => {
    setOrderLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/${orderId}`);
      const data = await response.json();
      setSelectedOrder(data);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    fetchOrderDetails(order.id);
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
          <button
            key={order.id}
            onClick={() => handleOrderClick(order)}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all hover:scale-[1.02] cursor-pointer text-left"
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
          </button>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-600">
            No orders yet. Upload a receipt to create your first order!
          </p>
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-3xl font-bold text-slate-800">
                  {selectedOrder.restaurant}
                </h3>
                <p className="text-slate-600 mt-2">
                  {new Date(selectedOrder.date).toLocaleDateString()} at{" "}
                  {new Date(selectedOrder.date).toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {orderLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  <h4 className="font-semibold text-slate-800 mb-3">Items</h4>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <div className="space-y-2">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center py-2 border-b border-slate-200"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{item.name}</p>
                            <p className="text-sm text-slate-600">
                              Qty: {item.quantity}
                            </p>
                          </div>
                          <p className="font-semibold text-slate-800">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-600">No items found</p>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  {selectedOrder.subtotal !== undefined && (
                    <div className="flex justify-between text-slate-700">
                      <span>Subtotal</span>
                      <span>${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.tax !== undefined && selectedOrder.tax > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Tax</span>
                      <span>${selectedOrder.tax.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_fee !== undefined && selectedOrder.delivery_fee > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Delivery Fee</span>
                      <span>${selectedOrder.delivery_fee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-slate-800 pt-2 border-t border-slate-300">
                    <span>Total</span>
                    <span>${selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-6 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
