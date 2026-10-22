"""Fiktive eksempeldata til en tom database."""

import sys
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import create_app
from backend.database import execute, fetch_one, run_transaction
from backend.auth import password_hash

DEMO_PASSWORD = "Fairplan2026!"


def seed_database():
    def insert_examples():
        if fetch_one("SELECT value FROM app_meta WHERE name = 'demo_seed_v1'"):
            return "Eksempeldata er allerede indlæst. Ingen data er ændret."

        # Seed kun en tom database, så brugerens ændringer aldrig overskrives.
        for table in ("periods", "sections", "staff_groups", "users", "employments"):
            if fetch_one(f"SELECT id FROM {table} LIMIT 1"):
                return "Databasen indeholder allerede data. Ingen eksempeldata er tilføjet."

        for values in (
            ("Oktober 2026", "2026-10-01", "2026-10-31"),
            ("November 2026", "2026-11-01", "2026-11-30"),
            ("December 2026", "2026-12-01", "2026-12-31"),
            ("Januar 2027", "2027-01-01", "2027-01-31"),
        ):
            execute("INSERT INTO periods (name, start_date, end_date) VALUES (%s, %s, %s)", values)

        for values in (
            ("Akutmodtagelsen", "#7C6FE8"),
            ("Medicinsk afsnit", "#419C86"),
            ("Kirurgisk afsnit", "#D9914F"),
            ("Ambulatoriet", "#5E8FCB"),
        ):
            execute("INSERT INTO sections (name, color) VALUES (%s, %s)", values)

        for name in ("Overlæge", "Afdelingslæge", "Introlæge", "Hoveduddannelseslæge"):
            execute("INSERT INTO staff_groups (name) VALUES (%s)", (name,))

        for values in (
            ("Anna Møller", "anna.moller@example.com", False, True),
            ("Emil Sørensen", "emil.sorensen@example.com", False, True),
            ("Sofie Andersen", "sofie.andersen@example.com", True, True),
            ("Oliver Jensen", "oliver.jensen@example.com", False, True),
            ("Freja Nielsen", "freja.nielsen@example.com", False, True),
            ("Mikkel Hansen", "mikkel.hansen@example.com", False, True),
            ("Ida Petersen", "ida.petersen@example.com", True, False),
        ):
            hashed = password_hash(DEMO_PASSWORD) if values[1] in (
                'sofie.andersen@example.com', 'ida.petersen@example.com', 'anna.moller@example.com'
            ) else None
            execute("INSERT INTO users (name, email, is_admin, is_staff, password_hash) VALUES (%s, %s, %s, %s, %s)", (*values, hashed))

        # Forskellige datointervaller gør periodefilteret tydeligt i demoen.
        for values in (
            (1, 1, 1, 37, "2026-09-01", "2027-03-31"),
            (2, 2, 2, 32, "2026-10-01", "2026-11-30"),
            (2, 3, 2, 30, "2026-12-01", "2027-03-31"),
            (3, 1, 3, 37, "2026-09-01", "2027-06-30"),
            (4, 3, 1, 30, "2026-10-15", "2027-01-31"),
            (5, 4, 1, 28, "2026-11-01", "2027-06-30"),
            (6, 2, 4, 25, "2026-10-01", "2026-10-31"),
        ):
            execute(
                """INSERT INTO employments
                   (user_id, section_id, staff_group_id, hours_per_week, start_date, end_date)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                values,
            )

        execute("INSERT INTO app_meta (name, value) VALUES ('demo_seed_v1', 'done')")
        return "Fiktive eksempeldata er indlæst: 4 perioder, 4 afsnit, 4 grupper, 7 brugere og 7 ansættelser."

    return run_transaction(insert_examples)


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        print(seed_database())
        print("Demo-login: sofie.andersen@example.com / Fairplan2026! (begge roller).")
