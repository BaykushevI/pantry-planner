import { FormEvent, useEffect, useState } from "react";

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

type CreateItemForm = {
  name: string;
  quantity: string;
  unit: string;
  refillFrequencyDays: string;
  lowStockThreshold: string;
};

const initialFormState: CreateItemForm = {
  name: "",
  quantity: "",
  unit: "",
  refillFrequencyDays: "",
  lowStockThreshold: "",
};

export default function App() {
  const [status, setStatus] = useState("loading...");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [form, setForm] = useState<CreateItemForm>(initialFormState);
  const [creating, setCreating] = useState(false);

  async function loadItems() {
    setItemsLoading(true);

    try {
      const response = await fetch("http://localhost:8787/items");
      const data = await response.json();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  }

  useEffect(() => {
    fetch("http://localhost:8787/health")
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    loadItems();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);

    try {
      await fetch("http://localhost:8787/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          quantity: Number(form.quantity),
          unit: form.unit,
          refillFrequencyDays: form.refillFrequencyDays
            ? Number(form.refillFrequencyDays)
            : null,
          lowStockThreshold: form.lowStockThreshold
            ? Number(form.lowStockThreshold)
            : null,
        }),
      });

      setForm(initialFormState);
      await loadItems();
    } finally {
      setCreating(false);
    }
  }

  async function updateQuantity(id: string, quantity: number) {
    try {
      const response = await fetch(
        `http://localhost:8787/items/${id}/quantity`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ quantity }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to update quantity: ${response.status}`);
      }

      await loadItems();
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteItem(id: string) {
    try {
      const response = await fetch(`http://localhost:8787/items/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete item: ${response.status}`);
      }

      await loadItems();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <h1>Pantry Planner</h1>
      <p>API status: {status}</p>

      <h2>Add Item</h2>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 12 }}>
          <label>
            Name
            <br />
            <input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Quantity
            <br />
            <input
              type="number"
              step="0.1"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Unit
            <br />
            <input
              value={form.unit}
              onChange={(event) =>
                setForm((current) => ({ ...current, unit: event.target.value }))
              }
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Refill Frequency Days
            <br />
            <input
              type="number"
              value={form.refillFrequencyDays}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  refillFrequencyDays: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>
            Low Stock Threshold
            <br />
            <input
              type="number"
              step="0.1"
              value={form.lowStockThreshold}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lowStockThreshold: event.target.value,
                }))
              }
            />
          </label>
        </div>

        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Create item"}
        </button>
      </form>

      <h2>Pantry Items</h2>

      {itemsLoading ? (
        <p>Loading items...</p>
      ) : items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id} style={{ marginBottom: 8 }}>
              <strong>{item.name}</strong> — {item.quantity} {item.unit}{" "}
              <button
                type="button"
                onClick={() =>
                  updateQuantity(item.id, Math.max(0, item.quantity - 1))
                }
                style={{ marginLeft: 8 }}
                disabled={item.quantity <= 0}
              >
                -1
              </button>
              <button
                type="button"
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                style={{ marginLeft: 4 }}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => deleteItem(item.id)}
                style={{ marginLeft: 8 }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
