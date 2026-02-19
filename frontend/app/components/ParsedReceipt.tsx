"use client";

import { useState } from "react";
import { User, ParsedReceiptData } from "../types";

interface ParsedReceiptProps {
  parsedData: ParsedReceiptData;
  ocrText: string;
  imageUrl: string;
  users: User[];
  saving: boolean;
  onEdit: (updated: ParsedReceiptData) => void;
  onSaveOrder: (data: ParsedReceiptData, payerId: number) => Promise<void>;
}

export default function ParsedReceipt({
  parsedData,
  ocrText,
  imageUrl,
  users,
  saving,
  onEdit,
  onSaveOrder,
}: ParsedReceiptProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ParsedReceiptData>(parsedData);
  const [showOcr, setShowOcr] = useState(false);
  const [payerId, setPayerId] = useState<number | "">("");
  const [payerError, setPayerError] = useState(false);

  const handleSaveEdits = () => {
    onEdit(editedData);
    setIsEditing(false);
  };

  const handleCancelEdits = () => {
    setEditedData(parsedData);
    setIsEditing(false);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...editedData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setEditedData({ ...editedData, items: newItems });
  };

  const addItem = () => {
    setEditedData({
      ...editedData,
      items: [...editedData.items, { name: "", quantity: 1, price: 0 }],
    });
  };

  const removeItem = (index: number) => {
    setEditedData({
      ...editedData,
      items: editedData.items.filter((_, i) => i !== index),
    });
  };

  const handleSaveOrder = async () => {
    if (!payerId) {
      setPayerError(true);
      return;
    }
    setPayerError(false);
    // Pass the latest editedData so any unsaved field edits are included
    await onSaveOrder(editedData, Number(payerId));
  };

  const displayData = isEditing ? editedData : parsedData;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-slate-800">Review Receipt</h3>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowOcr(!showOcr)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm"
            >
              {showOcr ? "Hide" : "Show"} OCR Text
            </button>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
              >
                Edit
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={handleCancelEdits}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all text-sm"
                >
                  Save Edits
                </button>
              </div>
            )}
          </div>
        </div>

        {showOcr && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl">
            <h4 className="font-semibold text-slate-700 mb-2">Raw OCR Text</h4>
            <pre className="text-sm text-slate-600 whitespace-pre-wrap font-mono">{ocrText}</pre>
          </div>
        )}

        <div className="space-y-6">
          {/* Restaurant & Total */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Restaurant</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedData.restaurant}
                  onChange={(e) => setEditedData({ ...editedData, restaurant: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-lg font-semibold text-slate-800">{displayData.restaurant}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Total</label>
              {isEditing ? (
                <input
                  type="number"
                  step="0.01"
                  value={editedData.total}
                  onChange={(e) =>
                    setEditedData({ ...editedData, total: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-lg font-semibold text-slate-800">${displayData.total.toFixed(2)}</p>
              )}
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-slate-700">Items</h4>
              {isEditing && (
                <button
                  onClick={addItem}
                  className="px-3 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm transition-colors"
                >
                  + Add Item
                </button>
              )}
            </div>
            <div className="space-y-2">
              {displayData.items.map((item, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={editedData.items[index].name}
                        onChange={(e) => updateItem(index, "name", e.target.value)}
                        placeholder="Item name"
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <input
                        type="number"
                        value={editedData.items[index].quantity}
                        onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                        className="w-16 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-center"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={editedData.items[index].price}
                        onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                      <button
                        onClick={() => removeItem(index)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-slate-800 text-sm">{item.name}</span>
                      <span className="text-slate-500 text-sm">x{item.quantity}</span>
                      <span className="text-slate-800 font-medium text-sm">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <span className="text-slate-400 text-xs">(${item.price.toFixed(2)} ea)</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fees breakdown */}
          <div className="pt-4 border-t border-slate-100">
            <div className="space-y-2">
              {(
                [
                  { label: "Subtotal", key: "subtotal" as const },
                  { label: "Tax", key: "tax" as const },
                  { label: "Delivery Fee", key: "delivery_fee" as const },
                  { label: "Tip", key: "tip" as const },
                  { label: "Discount", key: "discount" as const },
                ] as { label: string; key: keyof ParsedReceiptData }[]
              ).map(({ label, key }) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-slate-500 text-sm">{label}</span>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={(editedData[key] as number) || 0}
                      onChange={(e) =>
                        setEditedData({ ...editedData, [key]: parseFloat(e.target.value) || 0 })
                      }
                      className="w-28 px-3 py-1 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-right"
                    />
                  ) : (
                    <span className="text-slate-700 text-sm font-medium">
                      ${((displayData[key] as number) || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-800">Total</span>
                <span className="font-bold text-slate-800 text-lg">${displayData.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payer selection + save */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Who paid?</h3>
        {users.length === 0 ? (
          <div className="p-4 bg-amber-50 rounded-xl">
            <p className="text-amber-700 text-sm">
              No users found.{" "}
              <a href="/users" className="underline font-medium">
                Add users first
              </a>{" "}
              before saving.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setPayerId(user.id);
                    setPayerError(false);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all shadow-sm ${
                    payerId === user.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      payerId === user.id ? "bg-blue-500 text-white" : "bg-slate-300 text-slate-600"
                    }`}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{user.name}</span>
                </button>
              ))}
            </div>

            {payerError && (
              <p className="text-red-500 text-sm">Please select who paid before continuing.</p>
            )}

            <button
              onClick={handleSaveOrder}
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
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save & Assign Items</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
