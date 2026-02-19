export interface User {
  id: number;
  name: string;
  phone: string;
  whatsapp_number?: string;
  payment_handle?: string;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  price: number;
  quantity: number;
  order_id: number;
}

export interface Order {
  id: number;
  restaurant: string;
  total: number;
  subtotal?: number;
  tax?: number;
  delivery_fee?: number;
  tip?: number;
  discount?: number;
  paid_by_user_id: number;
  image_url?: string;
  ocr_raw_text?: string;
  date: string;
  items: Item[];
}

export interface Split {
  id: number;
  order_id: number;
  user_id: number;
  item_ids: number[];
  amount_owed: number;
  paid_status: boolean;
  reminder_sent: boolean;
  reminder_sent_at?: string;
  message_sid?: string;
}

// The parsed receipt data returned from the LLM (before saving to DB)
export interface ParsedReceiptData {
  restaurant: string;
  items: { name: string; quantity: number; price: number }[];
  subtotal: number;
  tax?: number;
  delivery_fee?: number;
  tip?: number;
  discount?: number;
  total: number;
}
