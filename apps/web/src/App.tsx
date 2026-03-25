import React, { useEffect, useRef, useState } from "react";

const API = "http://localhost:8787";

// ── Types ─────────────────────────────────────────────────────────────────────

type User = { id: string; username: string; displayName: string };

type Item = {
  id: string;
  name: string;
  status: "active" | "history";
  notes: string | null;
  last_bought_at: string | null;
  snoozed_until: string | null;
  suggestion_reason?: string;
  derived_cadence_days?: number;
};

type Summary = {
  activeItems: number;
  knownItems: number;
  suggestedItems: number;
  refillDueItems: number;
  dueSoonItems: number;
  shoppingSessionToday: boolean;
};

type AutocompleteHit = {
  id: string;
  name: string;
  notes: string | null;
  status: string;
};

// ── API client ────────────────────────────────────────────────────────────────

function headers(userId: string) {
  return { "Content-Type": "application/json", "X-User-Id": userId };
}

async function apiFetch<T>(
  userId: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers(userId), ...(options?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function urgencyBadge(item: Item): React.ReactNode {
  if (item.suggestion_reason === "REFILL_DUE") {
    return <span style={badge("red")}>Due now</span>;
  }
  if (item.suggestion_reason === "REFILL_DUE_SOON") {
    return <span style={badge("orange")}>Due soon</span>;
  }
  return null;
}

function badge(color: "red" | "orange" | "green" | "gray"): React.CSSProperties {
  const colors: Record<string, string> = {
    red: "#fee2e2",
    orange: "#fff3cd",
    green: "#d1fae5",
    gray: "#f3f4f6",
  };
  const text: Record<string, string> = {
    red: "#b91c1c",
    orange: "#92400e",
    green: "#065f46",
    gray: "#6b7280",
  };
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: colors[color],
    color: text[color],
  };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    fontFamily: "system-ui, -apple-system, sans-serif",
  } as React.CSSProperties,
  inner: {
    maxWidth: 680,
    margin: "0 auto",
    padding: "24px 16px 64px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  } as React.CSSProperties,
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" } as React.CSSProperties,
  userPill: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 20,
    backgroundColor: "#e5e7eb",
    fontSize: 13,
  } as React.CSSProperties,
  section: {
    backgroundColor: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  } as React.CSSProperties,
  sectionHead: {
    padding: "12px 16px",
    borderBottom: "1px solid #f3f4f6",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fafafa",
  } as React.CSSProperties,
  sectionTitle: { margin: 0, fontSize: 15, fontWeight: 600, color: "#374151" } as React.CSSProperties,
  count: {
    fontSize: 12,
    fontWeight: 600,
    color: "#6b7280",
    padding: "2px 8px",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
  } as React.CSSProperties,
  sectionBody: { padding: "4px 0" } as React.CSSProperties,
  empty: {
    padding: "20px 16px",
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
  } as React.CSSProperties,
  loading: {
    padding: "20px 16px",
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
  } as React.CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: "1px solid #f9fafb",
    gap: 8,
  } as React.CSSProperties,
  rowName: { flex: 1, fontWeight: 500, fontSize: 14, color: "#111827" } as React.CSSProperties,
  rowNotes: { fontSize: 12, color: "#6b7280", marginTop: 2 } as React.CSSProperties,
  btn: (variant: "primary" | "ghost" | "danger" | "subtle"): React.CSSProperties => {
    const base: React.CSSProperties = {
      border: "none",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
      padding: "5px 12px",
      whiteSpace: "nowrap",
    };
    if (variant === "primary")
      return { ...base, backgroundColor: "#2563eb", color: "#fff" };
    if (variant === "danger")
      return { ...base, backgroundColor: "#fee2e2", color: "#b91c1c" };
    if (variant === "ghost")
      return { ...base, backgroundColor: "#f3f4f6", color: "#374151" };
    return { ...base, backgroundColor: "transparent", color: "#6b7280", padding: "5px 8px" };
  },
  input: {
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  } as React.CSSProperties,
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 1,
    backgroundColor: "#e5e7eb",
  } as React.CSSProperties,
  statCell: {
    padding: "12px 16px",
    backgroundColor: "#fff",
    textAlign: "center",
  } as React.CSSProperties,
  statValue: { fontSize: 20, fontWeight: 700, color: "#111827" } as React.CSSProperties,
  statLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2 } as React.CSSProperties,
};

// ── Login Screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Login failed");
        return;
      }
      const user = (await res.json()) as User;
      onLogin(user);
    } catch {
      setError("Could not reach server. Make sure the API is running.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f9fafb",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: 340,
          backgroundColor: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Pantry Planner</h1>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280" }}>
          Your personal shopping memory
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              Username
            </label>
            <input
              style={S.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="alice"
              autoFocus
              required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
              Password
            </label>
            <input
              style={S.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{ ...S.btn("primary"), width: "100%", padding: "10px" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 20, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          Demo accounts: alice / alice123 · bob / bob123
        </p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) return <LoginScreen onLogin={setUser} />;
  return <MainApp user={user} onLogout={() => setUser(null)} />;
}

// ── MainApp ───────────────────────────────────────────────────────────────────

function MainApp({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [activeItems, setActiveItems] = useState<Item[]>([]);
  const [suggestedItems, setSuggestedItems] = useState<Item[]>([]);
  const [knownItems, setKnownItems] = useState<Item[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  function setPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  }

  async function reload() {
    try {
      const [active, suggested, history, sum] = await Promise.all([
        apiFetch<Item[]>(user.id, "/items?status=active"),
        apiFetch<Item[]>(user.id, "/suggestions"),
        apiFetch<Item[]>(user.id, "/items?status=history"),
        apiFetch<Summary>(user.id, "/summary/daily"),
      ]);
      setActiveItems(active);
      setSuggestedItems(suggested);
      // Known items = history items not currently in suggestions
      const suggestedIds = new Set(suggested.map((i) => i.id));
      setKnownItems(history.filter((i) => !suggestedIds.has(i.id)));
      setSummary(sum);
    } catch (e) {
      console.error("Reload failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function itemAction(id: string, path: string, method = "POST") {
    if (pendingIds.has(id)) return;
    setPending(id, true);
    try {
      await apiFetch(user.id, path, { method });
      await reload();
    } catch (e) {
      console.error(`Action failed (${path}):`, e);
    } finally {
      setPending(id, false);
    }
  }

  async function reAddItem(item: Item) {
    if (pendingIds.has(item.id)) return;
    setPending(item.id, true);
    try {
      await apiFetch(user.id, "/items", {
        method: "POST",
        body: JSON.stringify({ name: item.name, notes: item.notes ?? undefined }),
      });
      await reload();
    } catch (e) {
      console.error("Re-add failed:", e);
    } finally {
      setPending(item.id, false);
    }
  }

  return (
    <div style={S.page}>
      <div style={S.inner}>
        {/* Header */}
        <div style={S.header}>
          <h1 style={S.title}>Pantry Planner</h1>
          <div style={S.userPill}>
            <span style={{ fontWeight: 600 }}>{user.displayName}</span>
            <button
              onClick={onLogout}
              style={{ ...S.btn("subtle"), fontSize: 12, padding: "2px 6px" }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{ ...S.section, marginBottom: 20 }}>
            <div style={S.summaryGrid}>
              <div style={S.statCell}>
                <div style={S.statValue}>{summary.activeItems}</div>
                <div style={S.statLabel}>On list</div>
              </div>
              <div style={S.statCell}>
                <div style={{ ...S.statValue, color: summary.suggestedItems > 0 ? "#b45309" : "#111827" }}>
                  {summary.suggestedItems}
                </div>
                <div style={S.statLabel}>Suggested</div>
              </div>
              <div style={S.statCell}>
                <div style={S.statValue}>{summary.knownItems}</div>
                <div style={S.statLabel}>Known items</div>
              </div>
            </div>
            {summary.shoppingSessionToday && (
              <div
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#d1fae5",
                  color: "#065f46",
                  fontSize: 13,
                  fontWeight: 500,
                  borderTop: "1px solid #a7f3d0",
                }}
              >
                Shopping session active today
              </div>
            )}
          </div>
        )}

        {/* Add to List */}
        <AddItemForm userId={user.id} onAdded={reload} />

        {/* Current Shopping List */}
        <Section title="Current Shopping List" count={activeItems.length}>
          {loading ? (
            <p style={S.loading}>Loading…</p>
          ) : activeItems.length === 0 ? (
            <p style={S.empty}>Your shopping list is empty. Add items above.</p>
          ) : (
            <div style={S.sectionBody}>
              {activeItems.map((item) => (
                <div key={item.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowName}>{item.name}</div>
                    {item.notes && <div style={S.rowNotes}>{item.notes}</div>}
                  </div>
                  <button
                    style={S.btn("primary")}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => itemAction(item.id, `/items/${item.id}/bought`)}
                  >
                    {pendingIds.has(item.id) ? "…" : "Bought"}
                  </button>
                  <button
                    style={S.btn("ghost")}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => itemAction(item.id, `/items/${item.id}/remove`)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Suggested Items */}
        <Section title="Suggested Items" count={suggestedItems.length}>
          {loading ? (
            <p style={S.loading}>Loading…</p>
          ) : suggestedItems.length === 0 ? (
            <p style={S.empty}>
              No suggestions yet. Buy items a few times to build your cadence.
            </p>
          ) : (
            <div style={S.sectionBody}>
              {suggestedItems.map((item) => (
                <div key={item.id} style={S.row}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={S.rowName}>{item.name}</span>
                      {urgencyBadge(item)}
                    </div>
                    <div style={S.rowNotes}>
                      {item.derived_cadence_days && `Every ~${item.derived_cadence_days}d`}
                      {item.last_bought_at &&
                        ` · last bought ${formatDate(item.last_bought_at)}`}
                      {daysSince(item.last_bought_at) !== null &&
                        ` (${daysSince(item.last_bought_at)}d ago)`}
                    </div>
                  </div>
                  <button
                    style={S.btn("primary")}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => itemAction(item.id, `/items/${item.id}/bought`)}
                  >
                    {pendingIds.has(item.id) ? "…" : "Bought"}
                  </button>
                  <button
                    style={S.btn("ghost")}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => itemAction(item.id, `/items/${item.id}/snooze`)}
                  >
                    Snooze
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Known Items */}
        <Section title="Known Items" count={knownItems.length}>
          {loading ? (
            <p style={S.loading}>Loading…</p>
          ) : knownItems.length === 0 ? (
            <p style={S.empty}>
              Items you've bought before appear here for quick re-adding.
            </p>
          ) : (
            <div style={S.sectionBody}>
              {knownItems.map((item) => (
                <div key={item.id} style={{ ...S.row, opacity: 0.85 }}>
                  <div style={{ flex: 1 }}>
                    <div style={S.rowName}>{item.name}</div>
                    <div style={S.rowNotes}>
                      {item.notes && `${item.notes} · `}
                      {item.last_bought_at
                        ? `Last bought ${formatDate(item.last_bought_at)}`
                        : "Never bought"}
                    </div>
                  </div>
                  <button
                    style={S.btn("ghost")}
                    disabled={pendingIds.has(item.id)}
                    onClick={() => reAddItem(item)}
                  >
                    {pendingIds.has(item.id) ? "…" : "Add to list"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={S.section}>
      <div style={S.sectionHead}>
        <h2 style={S.sectionTitle}>{title}</h2>
        <span style={S.count}>{count}</span>
      </div>
      {children}
    </div>
  );
}

// ── Add Item Form with autocomplete ──────────────────────────────────────────

function AddItemForm({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearFeedback() {
    setTimeout(() => setFeedback(null), 2500);
  }

  function onNameChange(value: string) {
    setName(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setHits([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await apiFetch<AutocompleteHit[]>(
          userId,
          `/items/autocomplete?q=${encodeURIComponent(value.trim())}`,
        );
        setHits(results);
        setShowDropdown(results.length > 0);
      } catch {
        setHits([]);
      }
    }, 200);
  }

  function selectHit(hit: AutocompleteHit) {
    setName(hit.name);
    setNotes(hit.notes ?? "");
    setHits([]);
    setShowDropdown(false);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setFeedback(null);
    try {
      const result = await apiFetch<{ id: string; message: string; reactivated: boolean }>(
        userId,
        "/items",
        {
          method: "POST",
          body: JSON.stringify({ name: name.trim(), notes: notes.trim() || undefined }),
        },
      );
      setName("");
      setNotes("");
      setFeedback(result.reactivated ? "Re-added to your list." : "Added to your list.");
      clearFeedback();
      await onAdded();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Something went wrong.");
      clearFeedback();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ ...S.section, marginBottom: 16 }}>
      <div style={S.sectionHead}>
        <h2 style={S.sectionTitle}>Add to Shopping List</h2>
      </div>
      <div style={{ padding: 16 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <input
              style={S.input}
              placeholder="Item name (e.g. Milk)"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onFocus={() => hits.length > 0 && setShowDropdown(true)}
              autoComplete="off"
              required
            />
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 10,
                  marginTop: 2,
                }}
              >
                {hits.map((hit) => (
                  <div
                    key={hit.id}
                    onMouseDown={() => selectHit(hit)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 14,
                      borderBottom: "1px solid #f3f4f6",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#f9fafb")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.backgroundColor = "#fff")
                    }
                  >
                    <span style={{ fontWeight: 500 }}>{hit.name}</span>
                    {hit.notes && (
                      <span style={{ color: "#9ca3af", marginLeft: 6, fontSize: 12 }}>
                        {hit.notes}
                      </span>
                    )}
                    {hit.status === "history" && (
                      <span style={{ ...badge("gray"), marginLeft: 6 }}>known</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <input
              style={S.input}
              placeholder="Notes (e.g. 2 litres, organic)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="submit"
              disabled={creating}
              style={{ ...S.btn("primary"), padding: "8px 20px" }}
            >
              {creating ? "Adding…" : "Add to list"}
            </button>
            {feedback && (
              <span style={{ fontSize: 13, color: "#065f46" }}>{feedback}</span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
