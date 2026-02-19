"use client";

import { useState, useEffect } from "react";
import ReceiptUpload from "./components/ReceiptUpload";
import ParsedReceipt from "./components/ParsedReceipt";
import ItemAssignment from "./components/ItemAssignment";
import SplitReview from "./components/SplitReview";
import { User, Order, Split, ParsedReceiptData } from "./types";

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { number: 1, label: "Upload" },
  { number: 2, label: "Review" },
  { number: 3, label: "Assign" },
  { number: 4, label: "Send" },
];

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center">
      {STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step.number < current
                  ? "bg-emerald-500 text-white shadow-md"
                  : step.number === current
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              {step.number < current ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                step.number
              )}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                step.number === current ? "text-blue-600" : "text-slate-400"
              }`}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`h-0.5 w-16 mx-2 mb-4 transition-all ${
                step.number < current ? "bg-emerald-400" : "bg-slate-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [users, setUsers] = useState<User[]>([]);

  // Step 1 → 2
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  // Step 2 → 3
  const [order, setOrder] = useState<Order | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // Step 3 → 4
  const [splits, setSplits] = useState<Split[]>([]);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/`)
      .then((r) => r.json())
      .then((data: User[]) => setUsers(data))
      .catch(() => {});
  }, []);

  const handleUploadComplete = (data: {
    parsed_data: ParsedReceiptData;
    ocr_raw_text: string;
    image_url: string;
  }) => {
    setParsedData(data.parsed_data);
    setOcrText(data.ocr_raw_text);
    setImageUrl(data.image_url);
    setStep(2);
  };

  const handleSaveOrder = async (data: ParsedReceiptData, payerId: number) => {
    setSavingOrder(true);
    try {
      const payload = {
        restaurant: data.restaurant,
        total: data.total,
        subtotal: data.subtotal ?? null,
        tax: data.tax ?? null,
        delivery_fee: data.delivery_fee ?? null,
        tip: data.tip ?? null,
        discount: data.discount ?? 0,
        paid_by_user_id: payerId,
        image_url: imageUrl || null,
        ocr_raw_text: ocrText || null,
        items: data.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save order");
      }

      const savedOrder: Order = await res.json();
      setOrder(savedOrder);
      setStep(3);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSaveSplits = (newSplits: Split[]) => {
    setSplits(newSplits);
    setStep(4);
  };

  const handleDone = () => {
    setStep(1);
    setParsedData(null);
    setOcrText("");
    setImageUrl("");
    setOrder(null);
    setSplits([]);
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Page header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-800 mb-1">Split a Bill</h2>
        <p className="text-slate-500">Upload a receipt, assign items, and send reminders.</p>
      </div>

      {/* Step indicator */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex justify-center">
        <StepIndicator current={step} />
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <ReceiptUpload onUploadComplete={handleUploadComplete} />
      )}

      {/* Step 2: Review & correct + select payer */}
      {step === 2 && parsedData && (
        <ParsedReceipt
          parsedData={parsedData}
          ocrText={ocrText}
          imageUrl={imageUrl}
          users={users}
          saving={savingOrder}
          onEdit={(updated) => setParsedData(updated)}
          onSaveOrder={handleSaveOrder}
        />
      )}

      {/* Step 3: Assign items to people */}
      {step === 3 && order && (
        <ItemAssignment
          order={order}
          users={users}
          onSaveSplits={handleSaveSplits}
        />
      )}

      {/* Step 4: Review & send reminders */}
      {step === 4 && order && (
        <SplitReview
          order={order}
          splits={splits}
          users={users}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
