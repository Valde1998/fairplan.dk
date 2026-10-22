"use client";

import { useEffect, useState } from "react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getPeriods, getPersonnel, errorMessage } from "@/lib/api";
import { compareText, today } from "@/lib/format";
import type { Period, Employment } from "@/types/app";

export default function PersonnelPage() {
  const session = useCurrentUser();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<Employment[]>([]);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [sort, setSort] = useState<"name" | "section_name" | "staff_group_name" | "hours_per_week">("name");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    if (!session.user) return;
    getPeriods()
      .then((periods) => {
        setPeriods(periods);
        const current = periods.find((p) => p.start_date <= today() && p.end_date >= today()) ?? periods[0];
        if (current) setPeriodId(String(current.id));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [session.user]);

  useEffect(() => {
    if (!periodId) return;
    let active = true;
    setRows([]);
    setError("");
    getPersonnel(Number(periodId))
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    // Et gammelt svar må ikke overskrive en ny valgt periode.
    return () => {
      active = false;
    };
  }, [periodId]);

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }
  const sections = [...new Map(rows.map((r) => [r.section_id, r.section_name]))];
  const groups = [...new Map(rows.map((r) => [r.staff_group_id, r.staff_group_name]))];
  const visible = rows
    .filter(
      (r) =>
        (r.name + r.section_name + r.staff_group_name).toLowerCase().includes(search.toLowerCase()) &&
        (!sectionId || r.section_id === Number(sectionId)) &&
        (!groupId || r.staff_group_id === Number(groupId)),
    )
    .sort((a, b) => compareText(String(a[sort]), String(b[sort])) * (reverse ? -1 : 1));

  return (
    <PageLayout user={session.user} onLogout={session.signOut}>
      <h1>Personale</h1>
      <label>
        Planperiode
        <select
          aria-label="Vælg planperiode"
          value={periodId}
          onChange={(e) => {
            setPeriodId(e.target.value);
            setSectionId("");
            setGroupId("");
          }}
        >
          <option value="" disabled>
            Vælg periode
          </option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter personale"
          placeholder="Søg efter personale"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filtrer efter afsnit" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Alle afsnit</option>
          {sections.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label="Filtrer efter personalegruppe" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Alle personalegrupper</option>
          {groups.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {(
                [
                  ["name", "Navn"],
                  ["section_name", "Afsnit"],
                  ["staff_group_name", "Personalegruppe"],
                  ["hours_per_week", "Timer pr. uge"],
                ] as const
              ).map(([key, label]) => (
                <th key={key}>
                  <button onClick={() => sortBy(key)}>{label} ↕</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>
                  <span className="color" style={{ background: row.section_color }} />
                  {row.section_name}
                </td>
                <td>{row.staff_group_name}</td>
                <td>{row.hours_per_week}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p>Ingen medarbejdere matcher</p>}
    </PageLayout>
  );
}
