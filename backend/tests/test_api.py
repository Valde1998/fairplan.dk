"""Integration tests with Flask's HTTP client and separate MariaDB databases.

Run from the repository root: python -m unittest discover -s backend/tests -v
Every test gets a separate database. No SQL queries or API responses are mocked.
"""

from concurrent.futures import ThreadPoolExecutor
from backend.tests.database import test_database
from threading import Barrier
import unittest

from backend.app import create_app
from backend.seed import seed_database
from backend.auth import password_hash
from backend.database import execute, fetch_all


class FairPlanApiTests(unittest.TestCase):
    def setUp(self):
        self.config = self.enterContext(test_database())
        self.app = create_app(self.config)
        with self.app.app_context():
            # En særskilt administrator er forudsætning for CRUD-testene.
            execute("INSERT INTO users VALUES (1000000, 'Testadmin', 'testadmin@example.com', 1, 1, %s)", (password_hash("Testkode2026!"),))
        self.client = self.app.test_client()
        self.sign_in(self.client)

    def sign_in(self, client):
        response = client.post("/api/auth/login", json={
            "email": "testadmin@example.com", "password": "Testkode2026!"})
        self.assertEqual(response.status_code, 200)
        client.environ_base["HTTP_AUTHORIZATION"] = "Bearer " + response.get_json()["token"]

    def rows(self, resource):
        response = self.client.get(f"/api/{resource}")
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertIsInstance(response.get_json(), list)
        # Forretningsreglerne undersøger de oprettede data, ikke login-fixturen.
        return [row for row in response.get_json() if resource != "users" or row["id"] != 1000000]

    def create(self, resource, data):
        response = self.client.post(f"/api/{resource}", json=data)
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def update(self, resource, item_id, data):
        response = self.client.put(f"/api/{resource}/{item_id}", json=data)
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def error(self, response, status):
        self.assertEqual(response.status_code, status, response.get_json())
        body = response.get_json()
        self.assertIsInstance(body, dict)
        self.assertIsInstance(body.get("error"), str)
        self.assertTrue(body["error"].strip())

    def reject_without_changes(self, resource, data, status=400, item_id=None):
        before = self.rows(resource)
        if item_id is None:
            response = self.client.post(f"/api/{resource}", json=data)
        else:
            response = self.client.put(f"/api/{resource}/{item_id}", json=data)
        self.error(response, status)
        self.assertEqual(self.rows(resource), before)

    def period_data(self, **changes):
        return {"name": "December", "start_date": "2026-12-01",
                "end_date": "2026-12-31", **changes}

    def user_data(self, **changes):
        return {"name": "Anna Jensen", "email": "anna@example.com",
                "is_admin": False, "is_staff": True, "password": "Testkode2026!", **changes}

    def references(self):
        user = self.create("users", self.user_data())
        section = self.create("sections", {"name": "Nord", "color": "#36A"})
        group = self.create("staff-groups", {"name": "Sygeplejersker"})
        return user, section, group

    def employment_data(self, references, **changes):
        user, section, group = references
        return {"user_id": user["id"], "section_id": section["id"],
                "staff_group_id": group["id"], "hours_per_week": 32,
                "start_date": "2026-12-01", "end_date": "2026-12-31", **changes}

    def test_period_crud_trims_names_and_excludes_itself_from_overlap(self):
        period = self.create("periods", self.period_data(name="  December  "))
        self.assertEqual(period["name"], "December")
        self.assertEqual(self.rows("periods"), [period])
        detail = self.client.get(f"/api/periods/{period['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.get_json(), period)
        updated = self.update("periods", period["id"], self.period_data(name="Jul"))
        self.assertEqual(updated["name"], "Jul")
        self.assertEqual(updated["id"], period["id"])
        response = self.client.delete(f"/api/periods/{period['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["message"])
        self.assertEqual(self.rows("periods"), [])

    def test_period_overlap_covers_both_boundaries_and_enclosing_ranges(self):
        self.create("periods", self.period_data())
        overlaps = [
            ("2026-12-05", "2026-12-15"),  # inside
            ("2026-11-01", "2027-01-31"),  # encloses existing period
            ("2026-11-01", "2026-12-01"),  # same first day
            ("2026-12-31", "2027-01-31"),  # same last day
            ("2026-12-01", "2026-12-31"),  # identical
        ]
        for start, end in overlaps:
            with self.subTest(start=start, end=end):
                self.reject_without_changes("periods", self.period_data(
                    start_date=start, end_date=end), status=409)
        self.create("periods", self.period_data(
            name="November", start_date="2026-11-01", end_date="2026-11-30"))
        self.create("periods", self.period_data(
            name="Januar", start_date="2027-01-01", end_date="2027-01-31"))
        self.assertEqual(len(self.rows("periods")), 3)

    def test_period_update_cannot_overlap_another_period(self):
        self.create("periods", self.period_data())
        january = self.create("periods", self.period_data(
            name="Januar", start_date="2027-01-01", end_date="2027-01-31"))
        self.reject_without_changes("periods", self.period_data(
            name="Ændret", start_date="2026-12-31", end_date="2027-01-31"),
            status=409, item_id=january["id"])

    def test_real_iso_dates_and_strictly_increasing_date_ranges(self):
        invalid_ranges = [
            ("2026-02-30", "2026-03-31"),
            ("2026-02-29", "2026-03-31"),
            ("2026-2-01", "2026-03-31"),
            ("20260201", "2026-03-31"),
            ("2026-12-01T00:00:00", "2026-12-31"),
            ("2026-12-31", "2026-12-31"),
            ("2027-01-01", "2026-12-31"),
            (None, "2026-12-31"),
            ("2026-12-01", False),
        ]
        references = self.references()
        for start, end in invalid_ranges:
            with self.subTest(start=start, end=end):
                self.reject_without_changes("periods", self.period_data(
                    start_date=start, end_date=end))
                self.reject_without_changes("employments", self.employment_data(
                    references, start_date=start, end_date=end))
        leap_year = self.create("periods", self.period_data(
            start_date="2028-02-29", end_date="2028-03-01"))
        self.assertEqual(leap_year["start_date"], "2028-02-29")

    def test_required_names_and_fields_reject_missing_and_wrong_types(self):
        examples = {
            "periods": self.period_data(),
            "sections": {"name": "Nord", "color": "#ABCDEF"},
            "staff-groups": {"name": "Sygeplejersker"},
            "users": self.user_data(),
        }
        for resource, data in examples.items():
            for field in data:
                with self.subTest(resource=resource, missing=field):
                    incomplete = dict(data)
                    del incomplete[field]
                    self.reject_without_changes(resource, incomplete)
            for name in ("", "   ", None, 123, True, [], {}):
                with self.subTest(resource=resource, name=name):
                    self.reject_without_changes(resource, {**data, "name": name})

    def test_colors_normalize_and_reject_invalid_hex(self):
        section = self.create("sections", {"name": "  Nord  ", "color": "#3aF"})
        self.assertEqual(section["name"], "Nord")
        self.assertEqual(section["color"], "#33AAFF")
        updated = self.update("sections", section["id"],
                              {"name": "Syd", "color": "#a1b2c3"})
        self.assertEqual(updated["color"], "#A1B2C3")
        for color in ("#AB", "#ABCDE", "#GGGGGG", "red", "ABCDEF", None, 123, True):
            with self.subTest(color=color):
                self.reject_without_changes("sections", {"name": "Vest", "color": color})

    def test_email_is_normalized_unique_on_create_and_update(self):
        anna = self.create("users", self.user_data(email="  Anna@Example.COM  "))
        self.assertEqual(anna["email"], "anna@example.com")
        self.assertIs(anna["is_staff"], True)
        self.assertIs(anna["is_admin"], False)
        self.reject_without_changes("users", self.user_data(
            name="Anden Anna", email="ANNA@example.com"), status=409)
        other_data = self.user_data(name="Bo", email="bo@example.com")
        bo = self.create("users", other_data)
        self.reject_without_changes("users", {**other_data, "email": "Anna@example.com"},
                                    status=409, item_id=bo["id"])
        self.update("users", anna["id"], self.user_data(name="Anna Nielsen"))
        self.assertEqual(len(self.rows("users")), 2)

    def test_users_need_a_role_and_role_values_must_be_booleans(self):
        self.reject_without_changes("users", self.user_data(is_admin=False, is_staff=False))
        for field in ("is_admin", "is_staff"):
            for value in (None, 0, 1, "true", "false", [], {}):
                with self.subTest(field=field, value=value):
                    self.reject_without_changes("users", self.user_data(**{field: value}))
        for email in ("", "  ", None, 123, True, "anna", "anna@", "@example.com"):
            with self.subTest(email=email):
                self.reject_without_changes("users", self.user_data(email=email))
        admin = self.create("users", self.user_data(is_admin=True, is_staff=False))
        self.assertIs(admin["is_admin"], True)
        both = self.update("users", admin["id"], self.user_data(is_admin=True, is_staff=True))
        self.assertIs(both["is_staff"], True)

    def test_employment_crud_returns_joined_names_and_can_update_its_own_dates(self):
        references = self.references()
        data = self.employment_data(references)
        job = self.create("employments", data)
        self.assertEqual(job["name"], "Anna Jensen")
        self.assertEqual(job["section_name"], "Nord")
        self.assertEqual(job["section_color"], "#3366AA")
        self.assertEqual(job["staff_group_name"], "Sygeplejersker")
        updated = self.update("employments", job["id"], {**data, "hours_per_week": 37})
        self.assertEqual(updated["hours_per_week"], 37)
        for resource, row in zip(("users", "sections", "staff-groups"), references):
            response = self.client.get(f"/api/{resource}/{row['id']}")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()["employment_count"], 1)
        self.assertEqual(self.client.delete(f"/api/employments/{job['id']}").status_code, 200)
        self.assertEqual(self.rows("employments"), [])

    def test_employment_hours_are_integers_from_zero_through_thirty_seven(self):
        references = self.references()
        for hours in (-1, 38, 1.5, 0.0, True, False, "32", None):
            with self.subTest(hours=hours):
                self.reject_without_changes("employments", self.employment_data(
                    references, hours_per_week=hours))
        job = self.create("employments", self.employment_data(references, hours_per_week=0))
        self.assertEqual(job["hours_per_week"], 0)
        updated = self.update("employments", job["id"], self.employment_data(
            references, hours_per_week=37))
        self.assertEqual(updated["hours_per_week"], 37)

    def test_employment_requires_staff_person_and_existing_database_references(self):
        references = self.references()
        data = self.employment_data(references)
        admin = self.create("users", self.user_data(
            email="admin@example.com", is_admin=True, is_staff=False))
        self.reject_without_changes("employments", {**data, "user_id": admin["id"]})
        for field in ("user_id", "section_id", "staff_group_id"):
            with self.subTest(field=field, value="missing"):
                self.reject_without_changes("employments", {**data, field: 999999})
            for value in (True, False, 1.5, "1", None):
                with self.subTest(field=field, value=value):
                    self.reject_without_changes("employments", {**data, field: value})
        for field in data:
            with self.subTest(missing=field):
                incomplete = dict(data)
                del incomplete[field]
                self.reject_without_changes("employments", incomplete)

    def test_employment_overlap_is_per_person_with_inclusive_boundaries(self):
        references = self.references()
        self.create("employments", self.employment_data(references))
        for start, end in (("2026-12-05", "2026-12-15"),
                           ("2026-11-01", "2027-01-31"),
                           ("2026-11-01", "2026-12-01"),
                           ("2026-12-31", "2027-01-31")):
            with self.subTest(start=start, end=end):
                self.reject_without_changes("employments", self.employment_data(
                    references, start_date=start, end_date=end), status=409)
        self.create("employments", self.employment_data(
            references, start_date="2027-01-01", end_date="2027-01-31"))
        other = self.create("users", self.user_data(name="Bo", email="bo@example.com"))
        self.create("employments", self.employment_data(references, user_id=other["id"]))
        self.assertEqual(len(self.rows("employments")), 3)

    def test_employment_update_checks_conflicts_when_changing_dates_or_person(self):
        references = self.references()
        self.create("employments", self.employment_data(references))
        january_data = self.employment_data(
            references, start_date="2027-01-01", end_date="2027-01-31")
        january = self.create("employments", january_data)
        self.reject_without_changes("employments", {**january_data, "start_date": "2026-12-31"},
                                    status=409, item_id=january["id"])
        other = self.create("users", self.user_data(name="Bo", email="bo@example.com"))
        other_data = self.employment_data(references, user_id=other["id"])
        other_job = self.create("employments", other_data)
        self.reject_without_changes("employments", self.employment_data(references),
                                    status=409, item_id=other_job["id"])

    def test_referenced_entities_cannot_be_deleted_until_the_employment_is_removed(self):
        references = self.references()
        job = self.create("employments", self.employment_data(references))
        resources = ("users", "sections", "staff-groups")
        for resource, row in zip(resources, references):
            with self.subTest(resource=resource):
                before = self.rows(resource)
                self.error(self.client.delete(f"/api/{resource}/{row['id']}"), 409)
                self.assertEqual(self.rows(resource), before)
                self.assertEqual(len(self.rows("employments")), 1)
        self.assertEqual(self.client.delete(f"/api/employments/{job['id']}").status_code, 200)
        for resource, row in zip(resources, references):
            response = self.client.delete(f"/api/{resource}/{row['id']}")
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(self.rows(resource), [])

    def test_staff_role_cannot_be_removed_from_an_employed_person(self):
        references = self.references()
        person = references[0]
        job = self.create("employments", self.employment_data(references))
        self.reject_without_changes("users", self.user_data(is_admin=True, is_staff=False),
                                    status=409, item_id=person["id"])
        self.update("users", person["id"], self.user_data(is_admin=True, is_staff=True))
        self.client.delete(f"/api/employments/{job['id']}")
        person = self.update("users", person["id"], self.user_data(is_admin=True, is_staff=False))
        self.assertIs(person["is_staff"], False)

    def test_personnel_uses_date_overlap_and_preserves_multiple_employments_per_person(self):
        period = self.create("periods", self.period_data())
        references = self.references()
        ranges = [
            ("2026-11-01", "2026-12-01", True),   # last day touches first day
            ("2026-12-31", "2027-01-31", True),   # first day touches last day
            ("2026-11-01", "2027-01-31", True),   # covers the whole period
            ("2026-12-03", "2026-12-20", True),   # entirely within period
            ("2026-11-01", "2026-11-30", False),
            ("2027-01-01", "2027-01-31", False),
        ]
        expected_ids = set()
        for number, (start, end, included) in enumerate(ranges):
            person = self.create("users", self.user_data(
                name=f"Person {number}", email=f"person{number}@example.com"))
            job = self.create("employments", self.employment_data(
                references, user_id=person["id"], start_date=start, end_date=end))
            if included:
                expected_ids.add(job["id"])
        first = self.create("employments", self.employment_data(
            references, end_date="2026-12-10", hours_per_week=20))
        second_section = self.create("sections", {"name": "Syd", "color": "#AB12EF"})
        second = self.create("employments", self.employment_data(
            references, section_id=second_section["id"], start_date="2026-12-11",
            hours_per_week=37))
        expected_ids.update((first["id"], second["id"]))
        response = self.client.get(f"/api/personnel?period_id={period['id']}")
        self.assertEqual(response.status_code, 200, response.get_json())
        rows = response.get_json()
        self.assertEqual({row["id"] for row in rows}, expected_ids)
        self.assertEqual(len(rows), len(expected_ids))
        anna_rows = [row for row in rows if row["user_id"] == references[0]["id"]]
        self.assertEqual({(row["section_name"], row["hours_per_week"]) for row in anna_rows},
                         {("Nord", 20), ("Syd", 37)})
        empty_period = self.create("periods", self.period_data(
            name="Sommer", start_date="2027-07-01", end_date="2027-07-31"))
        empty_response = self.client.get(f"/api/personnel?period_id={empty_period['id']}")
        self.assertEqual(empty_response.status_code, 200)
        self.assertEqual(empty_response.get_json(), [])

    def test_personnel_requires_an_existing_period(self):
        for query in ("", "?period_id=", "?period_id=abc", "?period_id=1.5"):
            with self.subTest(query=query):
                self.error(self.client.get(f"/api/personnel{query}"), 400)
        self.error(self.client.get("/api/personnel?period_id=999999"), 404)

    def test_data_survives_a_new_application_instance(self):
        references = self.references()
        period = self.create("periods", self.period_data())
        job = self.create("employments", self.employment_data(references))
        restarted = create_app(self.config).test_client()
        self.sign_in(restarted)
        self.assertEqual(restarted.get("/api/periods").get_json(), [period])
        self.assertEqual(restarted.get("/api/employments").get_json(), [job])
        response = restarted.get(f"/api/personnel?period_id={period['id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [job])
        self.assertEqual(restarted.get("/api/health").get_json(), {"status": "ok"})

    def test_unknown_resource_ids_return_json_errors(self):
        examples = {
            "periods": self.period_data(),
            "sections": {"name": "Nord", "color": "#ABCDEF"},
            "staff-groups": {"name": "Sygeplejersker"},
            "users": self.user_data(),
            "employments": self.employment_data(self.references()),
        }
        for resource, data in examples.items():
            with self.subTest(resource=resource):
                url = f"/api/{resource}/999999"
                self.error(self.client.get(url), 404)
                self.error(self.client.put(url, json=data), 404)
                self.error(self.client.delete(url), 404)

    def test_malformed_json_and_non_object_bodies_do_not_write_data(self):
        for resource in ("periods", "sections", "staff-groups", "users", "employments"):
            for body in ("{", "null", "[]", '"text"', "123"):
                with self.subTest(resource=resource, body=body):
                    response = self.client.post(f"/api/{resource}", data=body,
                                                content_type="application/json")
                    self.error(response, 400)
                    self.assertEqual(self.rows(resource), [])

    def test_concurrent_period_creates_cannot_both_pass_the_overlap_rule(self):
        barrier = Barrier(2)

        def attempt(name):
            with self.app.test_client() as client:
                self.sign_in(client)
                barrier.wait(timeout=10)
                response = client.post("/api/periods", json=self.period_data(name=name))
                return response.status_code, response.get_json()

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(attempt, ("Første", "Anden")))
        self.assertEqual(sorted(status for status, _ in results), [201, 409], results)
        self.assertEqual(len(self.rows("periods")), 1)

    def test_demo_seed_is_explicit_and_does_not_repeat_or_restore_deleted_data(self):
        resources = ("employments", "users", "sections", "staff_groups", "periods")
        config = self.enterContext(test_database())
        with create_app(config).app_context():
            self.assertTrue(all(not fetch_all(f"SELECT * FROM {table}") for table in resources))
            seed_database()
            original = {table: fetch_all(f"SELECT * FROM {table}") for table in resources}
            self.assertTrue(all(original.values()))
            seed_database()
            self.assertEqual({table: fetch_all(f"SELECT * FROM {table}") for table in resources}, original)
            for table in resources:
                execute(f"DELETE FROM {table}")
        with create_app(config).app_context():
            seed_database()
            self.assertTrue(all(not fetch_all(f"SELECT * FROM {table}") for table in resources))

    def test_demo_seed_preserves_an_existing_user_database(self):
        own_period = self.create("periods", self.period_data(name="Min egen periode"))
        with self.app.app_context():
            seed_database()
        self.assertEqual(self.rows("periods"), [own_period])
        for resource in ("users", "sections", "staff-groups", "employments"):
            self.assertEqual(self.rows(resource), [])


if __name__ == "__main__":
    unittest.main()
