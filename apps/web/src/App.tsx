import { useEffect, useState } from "react";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  last_bought_at: string | null;
  refill_frequency_days: number | null;
  low_stock_threshold: number | null;
  created_at: string;
  updated_at: string;
};

export default function App() {
  const [status, setStatus] = useState("loading...");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8787/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    fetch("http://localhost:8787/items")
      .then((res) => res.json())
      .then((data) => setItems(data))
      .catch(() => setItems([]))
      .finally(() => setItemsLoading(false));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Pantry Planner</h1>
      <p>API status: {status}</p>

      <h2>Pantry Items</h2>

      {itemsLoading ? (
        <p>Loading items...</p>
      ) : items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> — {item.quantity} {item.unit}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
