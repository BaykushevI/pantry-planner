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

type DailySummary = {
  totalItems: number;
  lowStockItems: number;
  refillDueItems: number;
  dueSoonItems: number;
  suggestedItems: number;
};

type CreateItemForm = {
  name: string;
  quantity: string;
  unit: string;
  lastBoughtAt: string;
  refillFrequencyDays: string;
  lowStockThreshold: string;
};

const initialFormState: CreateItemForm = {
  name: "",
  quantity: "",
  unit: "",
  lastBoughtAt: "",
  refillFrequencyDays: "",
  lowStockThreshold: "",
};

function isLowStock(item: PantryItem): boolean {
  if (item.low_stock_threshold === null) {
    return false;
  }

  return item.quantity <= item.low_stock_threshold;
}

function isRefillDue(item: PantryItem): boolean {
  if (item.last_bought_at === null || item.refill_frequency_days === null) {
    return false;
  }

  const lastBought = new Date(item.last_bought_at);
  const now = new Date();
  const diffMs = now.getTime() - lastBought.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays >= item.refill_frequency_days;
}

function isRefillDueSoon(item: PantryItem): boolean {
  if (item.last_bought_at === null || item.refill_frequency_days === null) {
    return false;
  }

  const lastBought = new Date(item.last_bought_at);
  const now = new Date();
  const diffMs = now.getTime() - lastBought.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return diffDays === item.refill_frequency_days - 1;
}

function getSuggestionReason(item: PantryItem): string {
  const lowStock = isLowStock(item);
  const refillDue = isRefillDue(item);
  const refillDueSoon = isRefillDueSoon(item);

  if (lowStock && refillDue) {
    return "Low stock and refill due";
  }

  if (lowStock) {
    return "Low stock";
  }

  if (refillDue) {
    return "Refill due";
  }

  if (refillDueSoon) {
    return "Refill due soon";
  }

  return "Suggested";
}

export default function App() {
  const [status, setStatus] = useState("loading...");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [form, setForm] = useState<CreateItemForm>(initialFormState);
  const [creating, setCreating] = useState(false);
  const [suggestedItems, setSuggestedItems] = useState<PantryItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

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

  async function loadSuggestions() {
    setSuggestionsLoading(true);

    try {
      const response = await fetch("http://localhost:8787/suggestions");
      const data = await response.json();
      setSuggestedItems(data);
    } catch {
      setSuggestedItems([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function loadSummary() {
    setSummaryLoading(true);

    try {
      const response = await fetch("http://localhost:8787/summary/daily");
      const data = await response.json();
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
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
    loadSuggestions();
    loadSummary();
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
          lastBoughtAt: form.lastBoughtAt
            ? new Date(form.lastBoughtAt).toISOString()
            : null,
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
      await loadSuggestions();
      await loadSummary();
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
      await loadSuggestions();
      await loadSummary();
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
      await loadSuggestions();
      await loadSummary();
    } catch (error) {
      console.error(error);
    }
  }

  async function snoozeItem(id: string) {
    try {
      const response = await fetch(`http://localhost:8787/items/${id}/snooze`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to snooze item: ${response.status}`);
      }

      await loadSuggestions();
      await loadSummary();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <h1>Pantry Planner</h1>
      <p>API status: {status}</p>

      <h2>Daily Summary</h2>

      {summaryLoading ? (
        <p>Loading summary...</p>
      ) : summary === null ? (
        <p>Summary unavailable.</p>
      ) : (
        <ul>
          <li>Total items: {summary.totalItems}</li>
          <li>Low stock items: {summary.lowStockItems}</li>
          <li>Refill due items: {summary.refillDueItems}</li>
          <li>Due soon items: {summary.dueSoonItems}</li>
          <li>Suggested items: {summary.suggestedItems}</li>
        </ul>
      )}

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
            Last Bought At
            <br />
            <input
              type="date"
              value={form.lastBoughtAt}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  lastBoughtAt: event.target.value,
                }))
              }
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

      <h2>Suggested Shopping List</h2>

      {suggestionsLoading ? (
        <p>Loading suggestions...</p>
      ) : suggestedItems.length === 0 ? (
        <p>No suggested items right now.</p>
      ) : (
        <ul>
          {suggestedItems.map((item) => (
            <li key={`suggested-${item.id}`} style={{ marginBottom: 8 }}>
              <strong>{item.name}</strong> — {item.quantity} {item.unit}
              <span style={{ marginLeft: 8, color: "#666" }}>
                ({getSuggestionReason(item)})
              </span>
              <button
                type="button"
                onClick={() => snoozeItem(item.id)}
                style={{ marginLeft: 8 }}
              >
                Dismiss today
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2>Pantry Items</h2>

      {itemsLoading ? (
        <p>Loading items...</p>
      ) : items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              style={{
                marginBottom: 8,
                padding: 8,
                borderRadius: 6,
                backgroundColor: isLowStock(item) ? "#ffe5e5" : "transparent",
                border: isLowStock(item)
                  ? "1px solid #ffb3b3"
                  : "1px solid transparent",
              }}
            >
              <strong>{item.name}</strong> — {item.quantity} {item.unit}{" "}
              {isLowStock(item) && (
                <span
                  style={{
                    color: "#b00020",
                    fontWeight: "bold",
                    marginLeft: 8,
                  }}
                >
                  Low stock
                </span>
              )}
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
