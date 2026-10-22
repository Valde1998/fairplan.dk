"use client";

import { useEffect, useState, type FormEvent } from "react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getEmployments,
  createEmployment,
  updateEmployment,
  deleteEmployment,
  getSections,
  getStaffGroups,
  errorMessage,
} from "@/lib/api";
import { compareText, formatDate } from "@/lib/format";
import type { User, SessionUser, Employment, Section, StaffGroup } from "@/types/app";

export default function AccessPage() {
  const session = useCurrentUser();
  const [tab, setTab] = useState("users");
  return (
    <PageLayout user={session.user} onLogout={session.signOut}>
      <h1>Adgangsstyring</h1>
      <nav className="tabs" aria-label="Adgangsstyring">
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Adgange
        </button>
        <button className={tab === "jobs" ? "active" : ""} onClick={() => setTab("jobs")}>
          Ansættelser
        </button>
      </nav>
      {tab === "users" ? (
        <Users user={session.user} setUser={session.setUser} logout={session.signOut} />
      ) : (
        <Employments />
      )}
    </PageLayout>
  );
}

function Users({
  user,
  setUser,
  logout,
}: {
  user: SessionUser | null;
  setUser: (user: SessionUser) => void;
  logout: () => Promise<void>;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [sort, setSort] = useState<"name" | "email" | "is_admin" | "is_staff">("name");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    getUsers()
      .then(setUsers)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function openForm(person?: User) {
    setEditing(person ?? null);
    setFormOpen(true);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      is_admin: form.has("is_admin"),
      is_staff: form.has("is_staff"),
    };
    setSaving(true);
    setError("");
    try {
      const saved = editing ? await updateUser(editing.id, data) : await createUser(data);
      if (saved.id === user?.id) {
        if (data.password || !saved.is_admin) {
          await logout();
          return;
        }
        setUser(saved);
      }
      setUsers(await getUsers());
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(person: User) {
    if (!confirm("Slet " + person.name + "?")) return;
    try {
      await deleteUser(person.id);
      if (person.id === user?.id) {
        await logout();
        return;
      }
      setUsers(await getUsers());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }
  const visible = users
    .filter(
      (u) =>
        (u.name + u.email).toLowerCase().includes(search.toLowerCase()) &&
        (role === "all" ||
          (role === "admin" && u.is_admin) ||
          (role === "staff" && u.is_staff) ||
          (role === "both" && u.is_admin && u.is_staff)),
    )
    .sort((a, b) => compareText(String(a[sort]), String(b[sort])) * (reverse ? -1 : 1));

  return (
    <section>
      <h2>Adgange</h2>
      <button onClick={() => openForm()}>Opret bruger</button>
      {!formOpen && error && <p role="alert">{error}</p>}
      {formOpen && (
        <form className="editor" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>{editing ? "Rediger bruger" : "Opret bruger"}</h2>
          <label>
            Navn
            <input name="name" required defaultValue={editing?.name} />
          </label>
          <label>
            E-mail
            <input name="email" type="email" required defaultValue={editing?.email} />
          </label>
          <label>
            {editing ? "Ny adgangskode (valgfri)" : "Adgangskode"}
            <input name="password" type="password" autoComplete="new-password" minLength={8} required={!editing} />
          </label>
          <label className="checkbox">
            <input name="is_admin" type="checkbox" defaultChecked={editing?.is_admin ?? false} />
            Admin
          </label>
          <label className="checkbox">
            <input name="is_staff" type="checkbox" defaultChecked={editing?.is_staff ?? true} />
            Personale
          </label>
          {error && <p role="alert">{error}</p>}
          <button disabled={saving}>{editing ? "Gem ændringer" : "Opret bruger"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>
            Annuller
          </button>
        </form>
      )}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter bruger"
          placeholder="Søg efter bruger"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filtrér efter rolle" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="all">Alle roller</option>
          <option value="admin">Admin</option>
          <option value="staff">Personale</option>
          <option value="both">Begge roller</option>
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
                <button onClick={() => sortBy("email")}>E-mail ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("is_admin")}>Admin ↕</button>
              </th>
              <th>
                <button onClick={() => sortBy("is_staff")}>Personale ↕</button>
              </th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.email}</td>
                <td>{person.is_admin ? "Ja" : "Nej"}</td>
                <td>{person.is_staff ? "Ja" : "Nej"}</td>
                <td>
                  <button aria-label={"Rediger " + person.name} onClick={() => openForm(person)}>
                    Rediger
                  </button>
                  <button aria-label={"Slet " + person.name} onClick={() => remove(person)}>
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

function Employments() {
  const [jobs, setJobs] = useState<Employment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [editing, setEditing] = useState<Employment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [sort, setSort] = useState<
    "name" | "section_name" | "staff_group_name" | "hours_per_week" | "start_date" | "end_date"
  >("name");
  const [reverse, setReverse] = useState(false);

  useEffect(() => {
    Promise.all([getEmployments(), getUsers(), getSections(), getStaffGroups()])
      .then(([jobs, users, sections, groups]) => {
        setJobs(jobs);
        setUsers(users);
        setSections(sections);
        setGroups(groups);
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function openForm(job?: Employment) {
    setEditing(job ?? null);
    setFormOpen(true);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const data = {
      user_id: Number(form.get("user_id")),
      section_id: Number(form.get("section_id")),
      staff_group_id: Number(form.get("staff_group_id")),
      hours_per_week: Number(form.get("hours_per_week")),
      start_date: String(form.get("start_date")),
      end_date: String(form.get("end_date")),
    };
    setSaving(true);
    setError("");
    try {
      if (editing) await updateEmployment(editing.id, data);
      else await createEmployment(data);
      setJobs(await getEmployments());
      setFormOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(job: Employment) {
    if (!confirm("Slet ansættelsen for " + job.name + "?")) return;
    try {
      await deleteEmployment(job.id);
      setJobs(await getEmployments());
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function sortBy(key: typeof sort) {
    setReverse(key === sort && !reverse);
    setSort(key);
  }
  const visible = jobs
    .filter(
      (j) =>
        (j.name + j.section_name + j.staff_group_name).toLowerCase().includes(search.toLowerCase()) &&
        (!sectionId || j.section_id === Number(sectionId)) &&
        (!groupId || j.staff_group_id === Number(groupId)),
    )
    .sort((a, b) => compareText(String(a[sort]), String(b[sort])) * (reverse ? -1 : 1));

  return (
    <section>
      <h2>Ansættelser</h2>
      <button onClick={() => openForm()}>Opret ansættelse</button>
      {!formOpen && error && <p role="alert">{error}</p>}
      {formOpen && (
        <form className="editor" key={editing?.id ?? "new"} onSubmit={save}>
          <h2>{editing ? "Rediger ansættelse" : "Opret ansættelse"}</h2>
          <label>
            Person
            <select name="user_id" required defaultValue={editing?.user_id ?? ""}>
              <option value="" disabled>
                Vælg person
              </option>
              {users
                .filter((u) => u.is_staff)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Afsnit
            <select name="section_id" required defaultValue={editing?.section_id ?? ""}>
              <option value="" disabled>
                Vælg afsnit
              </option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Personalegruppe
            <select name="staff_group_id" required defaultValue={editing?.staff_group_id ?? ""}>
              <option value="" disabled>
                Vælg personalegruppe
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Timer pr. uge
            <input
              name="hours_per_week"
              type="number"
              min={0}
              max={37}
              step={1}
              required
              defaultValue={editing?.hours_per_week ?? 37}
            />
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
          <button disabled={saving}>{editing ? "Gem ændringer" : "Opret ansættelse"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>
            Annuller
          </button>
        </form>
      )}
      <div className="filters">
        <input
          type="search"
          aria-label="Søg efter ansættelse"
          placeholder="Søg efter ansættelse"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Filtrér efter afsnit" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
          <option value="">Alle afsnit</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select aria-label="Filtrér efter personalegruppe" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Alle personalegrupper</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
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
                  ["name", "Person"],
                  ["section_name", "Afsnit"],
                  ["staff_group_name", "Personalegruppe"],
                  ["hours_per_week", "Timer/uge"],
                  ["start_date", "Startdato"],
                  ["end_date", "Slutdato"],
                ] as const
              ).map(([key, label]) => (
                <th key={key}>
                  <button onClick={() => sortBy(key)}>{label} ↕</button>
                </th>
              ))}
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((job) => (
              <tr key={job.id}>
                <td>{job.name}</td>
                <td>{job.section_name}</td>
                <td>{job.staff_group_name}</td>
                <td>{job.hours_per_week}</td>
                <td>{formatDate(job.start_date)}</td>
                <td>{formatDate(job.end_date)}</td>
                <td>
                  <button aria-label={"Rediger " + job.name} onClick={() => openForm(job)}>
                    Rediger
                  </button>
                  <button aria-label={"Slet " + job.name} onClick={() => remove(job)}>
                    Slet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length && <p>Ingen ansættelser matcher</p>}
    </section>
  );
}
