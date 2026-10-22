"use client";

import { useEffect, useState, type FormEvent } from "react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getPeriods, createPeriod, updatePeriod, deletePeriod, errorMessage } from "@/lib/api";
import { compareText, formatDate, today } from "@/lib/format";
import type { Period } from "@/types/app";

export default function PeriodsPage() {
  const session = useCurrentUser();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [editing, setEditing] = useState<Period | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"name" | "start_date" | "end_date">("start_date");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (session.user)
      getPeriods()
        .then(setPeriods)
        .catch((err) => setError(errorMessage(err)));
  }, [session.user]);

  function openForm(period?: Period) {
    setEditing(period ?? null);
    setFormOpen(true);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: String(form.get("name")),
      start_date: String(form.get("start_date")),
      end_date: String(form.get("end_date")),
    };
    setSaving(true);
    setError("");
    try {
      if (editing) await updatePeriod(editing.id, data);
      else await createPeriod(data);
      setPeriods(await getPeriods());
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(period: Period) {
    if (!confirm("Slet " + period.name + "?")) return;
    try {
      await deletePeriod(period.id);
      setPeriods(await getPeriods());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }

  function periodStatus(period: Period) {
    if (period.end_date < today()) return "past";
    if (period.start_date > today()) return "upcoming";
    return "current";
  }

  const visible = periods
    .filter(
      (p) => p.name.toLowerCase().includes(search.toLowerCase()) && (status === "all" || periodStatus(p) === status),
    )
    .sort((a, b) => compareText(a[sort], b[sort]) * (reverse ? -1 : 1));

  return (
    <PageLayout user={session.user} onLogout={session.signOut}>
      <h1>Perioder</h1>
      <button onClick={() => openForm()}>Opret periode</button>
      {!formOpen && error && <p role="alert">{error}</p>}
      {formOpen && (
        <form className="editor" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>{editing ? "Rediger periode" : "Opret periode"}</h2>
          <label>
            Periodens navn
            <input name="name" required defaultValue={editing?.name} />
          </label>
          <label>
            Startdato
            <input name="start_date" type="date" required defaultValue={editing?.start_date} />
          </label>
          <label>
            Slutdato
            <input name="end_date" type="date" required defaultValue={editing?.end_date} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={saving}>{editing ? "Gem ændringer" : "Opret periode"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>
            Annuller
          </button>
        </form>
      )}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter periode"
          placeholder="Søg efter periode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Alle perioder</option>
          <option value="current">Aktuelle</option>
          <option value="upcoming">Kommende</option>
          <option value="past">Afsluttede</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("name")}>Periode ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("start_date")}>Startdato ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("end_date")}>Slutdato ↕</button>
              </th>
              <th>Status</th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((period) => (
              <tr key={period.id}>
                <td>
                  <strong>{period.name}</strong>
                </td>
                <td>{formatDate(period.start_date)}</td>
                <td>{formatDate(period.end_date)}</td>
                <td>
                  {periodStatus(period) === "past"
                    ? "Afsluttet"
                    : periodStatus(period) === "upcoming"
                      ? "Kommende"
                      : "Aktuel"}
                </td>
                <td>
                  <button aria-label={"Rediger " + period.name} onClick={() => openForm(period)}>
                    Rediger
                  </button>
                  <button aria-label={"Slet " + period.name} onClick={() => remove(period)}>
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p>Ingen perioder matcher</p>}
    </PageLayout>
  );
}
