import { FormEvent, useEffect, useState } from "react";

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  last_bought_at: string | null;
  snoozed_until?: string | null;
  created_at: string;
  updated_at: string;
  suggestion_reason?: string;
  derived_cadence_days?: number;
};

type DailySummary = {
  totalItems: number;
  refillDueItems: number;
  dueSoonItems: number;
  suggestedItems: number;
};

type CreateItemForm = {
  name: string;
  quantity: string;
};

const initialFormState: CreateItemForm = {
  name: "",
  quantity: "",
};

function getSuggestionReason(item: PantryItem): string {
  if (item.suggestion_reason === "REFILL_DUE") {
    return "Refill due";
  }

  if (item.suggestion_reason === "REFILL_DUE_SOON") {
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

  async function markItemAsBought(id: string) {
    try {
      const response = await fetch(`http://localhost:8787/items/${id}/bought`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Failed to mark item as bought: ${response.status}`);
      }

      await loadItems();
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
              <strong>{item.name}</strong> — {item.quantity}
              <span style={{ marginLeft: 8, color: "#666" }}>
                ({getSuggestionReason(item)})
              </span>
              <button
                type="button"
                onClick={() => markItemAsBought(item.id)}
                style={{ marginLeft: 8 }}
              >
                Bought today
              </button>
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
              }}
            >
              <strong>{item.name}</strong> — {item.quantity}
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
