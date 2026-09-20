"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, StickyNote } from "lucide-react";
import { appConfirm } from "@/lib/app-dialog";
import styles from "./dashboard-notes.module.css";

type Note = { id: string; content: string; colour: string; updatedAt: string };
export function StickyNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Note | null>(null);
  const [content, setContent] = useState("");
  const [colour, setColour] = useState("yellow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/sticky-notes", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load your notes.");
      setNotes(body); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load your notes."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function open(note: Note | null) {
    setEditing(note); setContent(note?.content || ""); setColour(note?.colour || "yellow");
    setEditorError(""); dialog.current?.showModal();
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setEditorError("");
    try {
      const response = await fetch("/api/sticky-notes", {
        method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, colour, ...(editing ? { id: editing.id, updatedAt: editing.updatedAt } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save your note.");
      dialog.current?.close(); await load();
    } catch (caught) { setEditorError(caught instanceof Error ? caught.message : "Unable to save your note."); }
    finally { setBusy(false); }
  }
  async function remove(note: Note) {
    if (!await appConfirm("Delete this sticky note?")) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sticky-notes", {
        method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: note.id, updatedAt: note.updatedAt }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Unable to delete your note.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete your note."); }
    finally { setBusy(false); }
  }
  return <section className={`card ${styles.board}`} aria-labelledby="sticky-notes-title">
    <div className={styles.heading}><h2 id="sticky-notes-title"><StickyNote size={21}/> Sticky notes</h2><button className="btn primary" disabled={busy} onClick={() => open(null)}><Plus size={16}/>Add note</button></div>
    <p className="muted">Your personal notes. Only your account can see and edit them.</p>
    {error && <p role="alert">{error} <button className="btn ghost" onClick={() => void load()}>Reload notes</button></p>}
    {loading ? <p>Loading your notes…</p> : !notes.length ? <p className="empty">Leave yourself a reminder or a note for next time.</p> :
      <div className={styles.notes}>{notes.map(note => <article key={note.id} className={`${styles.note} ${styles[note.colour]}`}>
        <p className={styles.content}>{note.content}</p><div className={styles.actions}>
          <button className="btn ghost" disabled={busy} onClick={() => open(note)}>Edit</button>
          <button className="btn ghost" disabled={busy} onClick={() => void remove(note)}>Delete</button>
        </div>
      </article>)}</div>}
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="note-editor-title" onCancel={event => { if (busy) event.preventDefault(); }}>
      <form onSubmit={save}><h2 id="note-editor-title">{editing ? "Edit note" : "New sticky note"}</h2>
        {editorError && <p role="alert">{editorError}</p>}
        <label className="form-label">Note<textarea autoFocus className="field" rows={7} required maxLength={4000} value={content} onChange={event => setContent(event.target.value)} disabled={busy}/></label>
        <label className="form-label">Colour<select className="field" value={colour} onChange={event => setColour(event.target.value)} disabled={busy}>{["yellow", "pink", "blue", "green"].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
        <div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button className="btn primary" disabled={busy || !content.trim()}>{busy ? "Saving…" : "Save note"}</button></div>
      </form>
    </dialog>
  </section>;
}
