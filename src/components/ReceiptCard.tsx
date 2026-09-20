import { Bookmark, BookmarkCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useSaved } from "../context/SavedContext";
import { formatAmount, formatDate, formatDuration, receiptDetailLine } from "../lib/format";
import { boolLabel } from "../lib/format";
import type { Receipt } from "../lib/model";
import { Button, SourceChip } from "./UiElements";
import styles from "../styles/ReceiptCard.module.css";

export function ReceiptCard({
  receipt,
  onOpen,
  detailHref,
}: {
  receipt: Receipt;
  onOpen: () => void;
  detailHref?: string;
}) {
  const saved = useSaved();
  const bookmarked = saved.isBookmarked(receipt.id);
  return (
    <article className={`receipt-tile ${styles.tile}`}>
      <SourceChip source={receipt.source} />
      <h3>{receipt.title}</h3>
      <p className="meta">{formatDate(receipt.occurredAt, receipt.datePrecision, receipt.timezoneNote)}</p>
      <p>{receiptDetailLine(receipt)}</p>
      <div className="tile-actions">
        <Button type="button" variant="secondary" onClick={onOpen}>
          Open details
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={bookmarked}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark receipt"}
          onClick={() => saved.toggleBookmark(receipt.id)}
        >
          {bookmarked ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </Button>
        {detailHref ? (
          <Link className="btn btn-ghost" to={detailHref}>
            Connections
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function ReceiptDetail({ receipt }: { receipt: Receipt }) {
  const saved = useSaved();
  const note = saved.annotation(receipt.id);
  return (
    <div>
      <SourceChip source={receipt.source} />
      <h3 className="detail-title">{receipt.title}</h3>
      <p className="meta">
        {receipt.id} · source row {receipt.sourceRow}
      </p>
      <p className="meta">{formatDate(receipt.occurredAt, receipt.datePrecision, receipt.timezoneNote)}</p>
      <dl>
        <Row label="Category" value={receipt.category} />
        {receipt.attrs.kind === "spotify" ? (
          <>
            <Row label="Artist" value={receipt.attrs.artistName} />
            <Row label="Album" value={receipt.attrs.albumName} />
            <Row label="Platform" value={receipt.attrs.platform} />
            <Row label="Listening time" value={formatDuration(receipt.attrs.msPlayed)} />
            <Row label="Started because" value={receipt.attrs.reasonStart} />
            <Row label="Ended because" value={receipt.attrs.reasonEnd} />
            <Row label="Shuffle" value={boolLabel(receipt.attrs.shuffle)} />
            <Row label="Skipped" value={boolLabel(receipt.attrs.skipped)} />
            <Row label="Track URI as recorded" value={receipt.attrs.trackUri ?? "Not recorded"} />
          </>
        ) : null}
        {receipt.attrs.kind === "household" ? (
          <>
            <Row label="Type" value={receipt.attrs.householdKind} />
            <Row label="Subcategory" value={receipt.attrs.subcategory} />
            <Row label="Mode" value={receipt.attrs.mode} />
            <Row label="Note" value={receipt.attrs.note || "No note"} />
            <Row label="Amount" value={formatAmount(receipt.amount, receipt.currency, "household")} />
          </>
        ) : null}
        {receipt.attrs.kind === "customer" ? (
          <>
            <Row label="Merchant (readable)" value={receipt.attrs.merchantLabel} />
            <Row label="Merchant as recorded" value={receipt.attrs.merchantAsRecorded} />
            <Row
              label="Dataset prefix"
              value={
                receipt.attrs.merchantPrefixStripped
                  ? "A fraud_ prefix was removed for reading. It is not treated as a fraud finding."
                  : "No prefix removed"
              }
            />
            <Row label="Recorded customer group" value={receipt.subjectKey ?? "Unassigned"} />
            <Row label="Recorded ID string" value={receipt.attrs.recordedCustomerKey ?? "Missing — left unassigned"} />
            <Row label="Amount" value={formatAmount(receipt.amount, receipt.currency, "customer")} />
            <Row label="Transaction id as recorded" value={receipt.attrs.transId ?? "Not recorded"} />
          </>
        ) : null}
      </dl>
      <p>
        <Link className="btn btn-secondary" to={`/connections/${receipt.id}`}>
          Find connections
        </Link>
      </p>
      <Button type="button" variant="primary" onClick={() => saved.toggleBookmark(receipt.id)}>
        {saved.isBookmarked(receipt.id) ? "Saved receipt" : "Save receipt"}
      </Button>
      <label className="field note-field">
        <span>Your note (saved on this device)</span>
        <textarea
          className="saved-note"
          value={note}
          onChange={(e) => saved.setAnnotation(receipt.id, e.target.value)}
        />
      </label>
      <p className="muted">
        Only fields shown on this receipt are available. Sensitive customer details were removed before these files were
        shared.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="receipt-row">
      <dt className="muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
