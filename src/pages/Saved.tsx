import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ReceiptCard } from "../components/receipts";
import { Button, EmptyState, Field } from "../components/ui";
import { useAppData } from "../context/app-context";
import { useSaved } from "../context/saved-context";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { SOURCES } from "../lib/model";

export function SavedPage() {
  const saved = useSaved();
  const { getReceipt, ensureSources } = useAppData();
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  useDocumentTitle("Saved");

  useEffect(() => {
    void ensureSources([...SOURCES]);
  }, [ensureSources]);

  const bookmarked = saved.state.bookmarks.map((id) => getReceipt(id)).filter((r) => r != null);

  return (
    <main id="main" className="page">
      <h1>Saved</h1>
      <p>Bookmarks and notes stay on this device. They are yours — not part of the original records.</p>
      {saved.warning ? <p role="status">{saved.warning}</p> : null}
      {saved.persistError ? <p role="alert">{saved.persistError}</p> : null}

      <section>
        <h2>Bookmarks</h2>
        {bookmarked.length === 0 ? (
          <EmptyState title="No bookmarks yet" action={<Link className="btn btn-primary" to="/explore">Explore receipts</Link>}>
            Bookmark a card, a detail panel, or a story evidence row.
          </EmptyState>
        ) : (
          <div className="card-grid">
            {bookmarked.map((r) => (
              <ReceiptCard key={r.id} receipt={r} onOpen={() => { window.location.hash = `#/explore?receipt=${r.id}`; }} detailHref={`/connections/${r.id}`} />
            ))}
          </div>
        )}
      </section>

      <section className="saved-block">
        <h2>Collections</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saved.createCollection(name);
            setName("");
          }}
          className="filters-row"
        >
          <Field label="New collection name">
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary">
            Create collection
          </Button>
        </form>

        {saved.state.collections.map((collection) => (
          <article className="panel saved-collection" key={collection.id}>
            <h3>{collection.name}</h3>
            <p className="meta">Created {collection.createdAt.slice(0, 10)} · {collection.receiptIds.length} receipts</p>
            <div className="filters-row">
              <Field label="Add a bookmarked receipt">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) saved.addToCollection(collection.id, e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose…</option>
                  {saved.state.bookmarks.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                type="button"
                onClick={() => {
                  const json = saved.exportJson(collection.id);
                  if (!json) return;
                  const blob = new Blob([json], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${collection.name.replace(/\s+/g, "-")}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export JSON
              </Button>
              {confirmId === collection.id ? (
                <>
                  <Button type="button" variant="primary" onClick={() => { saved.clearCollection(collection.id); setConfirmId(null); }}>
                    Confirm clear
                  </Button>
                  <Button type="button" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setConfirmId(collection.id)}>
                  Clear collection
                </Button>
              )}
            </div>
            <ul>
              {collection.receiptIds.map((id) => {
                const receipt = getReceipt(id);
                return (
                  <li key={id}>
                    {receipt ? receipt.title : id}{" "}
                    <Link to={`/explore?receipt=${id}`}>Open</Link>{" "}
                    <Button type="button" variant="ghost" onClick={() => saved.removeFromCollection(collection.id, id)}>
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>

      {saved.pendingUndo ? (
        <p role="status">
          Removed a receipt.{" "}
          <Button type="button" onClick={saved.undoRemove}>
            Undo
          </Button>
        </p>
      ) : null}
    </main>
  );
}
