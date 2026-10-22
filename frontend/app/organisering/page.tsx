"use client";

import { useEffect, useState, type FormEvent } from "react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  getStaffGroups,
  createStaffGroup,
  updateStaffGroup,
  deleteStaffGroup,
  errorMessage,
} from "@/lib/api";
import { compareText } from "@/lib/format";
import type { Section, StaffGroup } from "@/types/app";

export default function OrganizationPage() {
  const session = useCurrentUser();
  const [tab, setTab] = useState("sections");
  return (
    <PageLayout user={session.user} onLogout={session.signOut}>
      <h1>Organisering</h1>
      <nav className="tabs" aria-label="Organisering">
        <button className={tab === "sections" ? "active" : ""} onClick={() => setTab("sections")}>
          Afsnit
        </button>
        <button className={tab === "groups" ? "active" : ""} onClick={() => setTab("groups")}>
          Personalegrupper
        </button>
      </nav>
      {tab === "sections" ? <Sections /> : <Groups />}
    </PageLayout>
  );
}

function Sections() {
  const [sections, setSections] = useState<Section[]>([]);
  const [editing, setEditing] = useState<Section | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"name" | "color" | "employment_count">("name");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    getSections()
      .then(setSections)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function openForm(section?: Section) {
    setEditing(section ?? null);
    setFormOpen(true);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = { name: String(form.get("name")), color: String(form.get("color")) };
    setSaving(true);
    setError("");
    try {
      if (editing) await updateSection(editing.id, data);
      else await createSection(data);
      setSections(await getSections());
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(section: Section) {
    if (!confirm("Slet " + section.name + "?")) return;
    try {
      await deleteSection(section.id);
      setSections(await getSections());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }
  const visible = sections
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" || (filter === "used" ? s.employment_count > 0 : s.employment_count === 0)),
    )
    .sort((a, b) => compareText(String(a[sort]), String(b[sort])) * (reverse ? -1 : 1));

  return (
    <section>
      <h2>Afsnit</h2>
      <button onClick={() => openForm()}>Opret afsnit</button>
      {!formOpen && error && <p role="alert">{error}</p>}
      {formOpen && (
        <form className="editor" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>{editing ? "Rediger afsnit" : "Opret afsnit"}</h2>
          <label>
            Navn
            <input name="name" required defaultValue={editing?.name} />
          </label>
          <label>
            HEX-farve
            <input
              name="color"
              required
              pattern="#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?"
              defaultValue={editing?.color ?? "#237A57"}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={saving}>{editing ? "Gem ændringer" : "Opret afsnit"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>
            Annuller
          </button>
        </form>
      )}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter afsnit"
          placeholder="Søg efter afsnit"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrér afsnit efter ansættelser"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Alle afsnit</option>
          <option value="used">Med ansættelser</option>
          <option value="unused">Uden ansættelser</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("name")}>Navn ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("color")}>Farve ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("employment_count")}>Ansættelser ↕</button>
              </th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((section) => (
              <tr key={section.id}>
                <td>{section.name}</td>
                <td>
                  <span className="color" style={{ background: section.color }} />
                  {section.color}
                </td>
                <td>{section.employment_count}</td>
                <td>
                  <button aria-label={"Rediger " + section.name} onClick={() => openForm(section)}>
                    Rediger
                  </button>
                  <button aria-label={"Slet " + section.name} onClick={() => remove(section)}>
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Groups() {
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [editing, setEditing] = useState<StaffGroup | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"name" | "employment_count">("name");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    getStaffGroups()
      .then(setGroups)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function openForm(group?: StaffGroup) {
    setEditing(group ?? null);
    setFormOpen(true);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = { name: String(new FormData(event.currentTarget).get("name")) };
    setSaving(true);
    setError("");
    try {
      if (editing) await updateStaffGroup(editing.id, data);
      else await createStaffGroup(data);
      setGroups(await getStaffGroups());
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: StaffGroup) {
    if (!confirm("Slet " + group.name + "?")) return;
    try {
      await deleteStaffGroup(group.id);
      setGroups(await getStaffGroups());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }
  const visible = groups
    .filter(
      (g) =>
        g.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" || (filter === "used" ? g.employment_count > 0 : g.employment_count === 0)),
    )
    .sort((a, b) => compareText(String(a[sort]), String(b[sort])) * (reverse ? -1 : 1));

  return (
    <section>
      <h2>Personalegrupper</h2>
      <button onClick={() => openForm()}>Opret personalegruppe</button>
      {!formOpen && error && <p role="alert">{error}</p>}
      {formOpen && (
        <form className="editor" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>{editing ? "Rediger personalegruppe" : "Opret personalegruppe"}</h2>
          <label>
            Navn
            <input name="name" required defaultValue={editing?.name} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={saving}>{editing ? "Gem ændringer" : "Opret personalegruppe"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>
            Annuller
          </button>
        </form>
      )}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter personalegruppe"
          placeholder="Søg efter personalegruppe"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrér personalegrupper efter ansættelser"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Alle grupper</option>
          <option value="used">Med ansættelser</option>
          <option value="unused">Uden ansættelser</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => sortBy("name")}>Navn ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("employment_count")}>Ansættelser ↕</button>
              </th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((group) => (
              <tr key={group.id}>
                <td>{group.name}</td>
                <td>{group.employment_count}</td>
                <td>
                  <button aria-label={"Rediger " + group.name} onClick={() => openForm(group)}>
                    Rediger
                  </button>
                  <button aria-label={"Slet " + group.name} onClick={() => remove(group)}>
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
