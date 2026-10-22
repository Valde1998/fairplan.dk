"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Hospital } from "lucide-react";
import type { SessionUser } from "@/types/app";

export function Logo() {
  return (
    <span className="brand">
      <Hospital size={24} /> Fairplan.dk
    </span>
  );
}

export default function PageLayout({
  user,
  onLogout,
  children,
}: {
  user: SessionUser | null;
  onLogout: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (!user) return <p>Henter…</p>;

  const links = user.is_admin
    ? [
        ["/perioder", "Perioder"],
        ["/organisering", "Organisering"],
        ["/adgangsstyring", "Adgangsstyring"],
        ["/personale", "Personale"],
      ]
    : [["/personale", "Personale"]];

  return (
    <div className="app">
      <aside>
        <Logo />
        <nav aria-label="Hovednavigation">
          {links.map(([href, title]) => (
            <Link key={href} href={href} className={pathname === href ? "active" : ""}>
              {title}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          <span className="signed-in">
            {user.name} · {[user.is_admin && "Admin", user.is_staff && "Personale"].filter(Boolean).join(" · ")}
          </span>
          <button onClick={onLogout}>Log ud</button>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
