"""Start lokalt med python backend/app.py, eller importer create_app i tests."""

import os
import re
from mysql.connector import Error as MySQLError
import sys
from pathlib import Path

# Gør både `python backend/app.py` og `python -m backend.app` mulige.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from flask import Blueprint, Flask, jsonify, request
from werkzeug.exceptions import HTTPException

from backend.database import close_db, execute, fetch_all, fetch_one, init_db, run_transaction
from backend.validators import (
    ApiError, boolean, color, date_range, email, integer, json_body,
    require_found, required_text,
)
from backend import auth
from backend.auth import password_hash

# Samles her, så tests kan oprette en app med deres egen database.
api = Blueprint("api", __name__, url_prefix="/api")


# Perioder

def get_period(period_id):
    return require_found(
        fetch_one("SELECT * FROM periods WHERE id = %s", (period_id,)), "Perioden"
    )


def validate_period(data, period_id=0):
    name = required_text(data, "name", "Navn")
    start_date, end_date = date_range(data)
    # Begge datoer er inklusive; næste periode kan begynde dagen efter slutdatoen.
    overlap = fetch_one(
        """SELECT id FROM periods
           WHERE id != %s AND start_date <= %s AND end_date >= %s""",
        (period_id, end_date, start_date),
    )
    if overlap:
        raise ApiError("Perioden overlapper en eksisterende periode.", 409)
    return name, start_date, end_date


@api.get("/periods")
def list_periods():
    return jsonify(fetch_all("SELECT * FROM periods ORDER BY start_date, id"))


@api.get("/periods/<int:period_id>")
def read_period(period_id):
    return jsonify(get_period(period_id))


@api.post("/periods")
def create_period():
    data = json_body()

    def save():
        values = validate_period(data)
        item_id = execute(
            "INSERT INTO periods (name, start_date, end_date) VALUES (%s, %s, %s)", values
        )
        return get_period(item_id)

    return jsonify(run_transaction(save)), 201


@api.put("/periods/<int:period_id>")
def update_period(period_id):
    data = json_body()

    def save():
        get_period(period_id)
        values = validate_period(data, period_id)
        execute(
            "UPDATE periods SET name = %s, start_date = %s, end_date = %s WHERE id = %s",
            (*values, period_id),
        )
        return get_period(period_id)

    return jsonify(run_transaction(save))


@api.delete("/periods/<int:period_id>")
def delete_period(period_id):
    def remove():
        get_period(period_id)
        execute("DELETE FROM periods WHERE id = %s", (period_id,))

    run_transaction(remove)
    return jsonify({"message": "Perioden er slettet."})


# Afsnit og personalegrupper

SECTION_SELECT = """
    SELECT sections.*,
           (SELECT COUNT(*) FROM employments WHERE section_id = sections.id) AS employment_count
    FROM sections
"""
GROUP_SELECT = """
    SELECT staff_groups.*,
           (SELECT COUNT(*) FROM employments WHERE staff_group_id = staff_groups.id) AS employment_count
    FROM staff_groups
"""


def get_section(section_id):
    return require_found(
        fetch_one(SECTION_SELECT + " WHERE sections.id = %s", (section_id,)), "Afsnittet"
    )


def get_staff_group(group_id):
    return require_found(
        fetch_one(GROUP_SELECT + " WHERE staff_groups.id = %s", (group_id,)),
        "Personalegruppen",
    )


@api.get("/sections")
def list_sections():
    return jsonify(fetch_all(SECTION_SELECT + " ORDER BY sections.name, sections.id"))


@api.get("/sections/<int:section_id>")
def read_section(section_id):
    return jsonify(get_section(section_id))


@api.post("/sections")
def create_section():
    data = json_body()
    name = required_text(data, "name", "Navn")
    section_color = color(data)

    def save():
        item_id = execute("INSERT INTO sections (name, color) VALUES (%s, %s)", (name, section_color))
        return get_section(item_id)

    return jsonify(run_transaction(save)), 201


@api.put("/sections/<int:section_id>")
def update_section(section_id):
    data = json_body()

    def save():
        get_section(section_id)
        name = required_text(data, "name", "Navn")
        section_color = color(data)
        execute("UPDATE sections SET name = %s, color = %s WHERE id = %s", (name, section_color, section_id))
        return get_section(section_id)

    return jsonify(run_transaction(save))


@api.delete("/sections/<int:section_id>")
def delete_section(section_id):
    def remove():
        section = get_section(section_id)
        if section["employment_count"]:
            raise ApiError("Afsnittet har tilknyttede ansættelser og kan derfor ikke slettes.", 409)
        execute("DELETE FROM sections WHERE id = %s", (section_id,))

    run_transaction(remove)
    return jsonify({"message": "Afsnittet er slettet."})


@api.get("/staff-groups")
def list_staff_groups():
    return jsonify(fetch_all(GROUP_SELECT + " ORDER BY staff_groups.name, staff_groups.id"))


@api.get("/staff-groups/<int:group_id>")
def read_staff_group(group_id):
    return jsonify(get_staff_group(group_id))


@api.post("/staff-groups")
def create_staff_group():
    data = json_body()
    name = required_text(data, "name", "Navn")

    def save():
        item_id = execute("INSERT INTO staff_groups (name) VALUES (%s)", (name,))
        return get_staff_group(item_id)

    return jsonify(run_transaction(save)), 201


@api.put("/staff-groups/<int:group_id>")
def update_staff_group(group_id):
    data = json_body()

    def save():
        get_staff_group(group_id)
        name = required_text(data, "name", "Navn")
        execute("UPDATE staff_groups SET name = %s WHERE id = %s", (name, group_id))
        return get_staff_group(group_id)

    return jsonify(run_transaction(save))


@api.delete("/staff-groups/<int:group_id>")
def delete_staff_group(group_id):
    def remove():
        group = get_staff_group(group_id)
        if group["employment_count"]:
            raise ApiError("Personalegruppen har tilknyttede ansættelser og kan derfor ikke slettes.", 409)
        execute("DELETE FROM staff_groups WHERE id = %s", (group_id,))

    run_transaction(remove)
    return jsonify({"message": "Personalegruppen er slettet."})


# Brugere

USER_SELECT = """
    SELECT users.id, users.name, users.email, users.is_admin, users.is_staff,
           (SELECT COUNT(*) FROM employments WHERE user_id = users.id) AS employment_count
    FROM users
"""


def user_json(row):
    # MariaDB gemmer roller som 0/1; frontend bruger true/false.
    return {**row, "is_admin": bool(row["is_admin"]), "is_staff": bool(row["is_staff"])}


def get_user(user_id):
    row = require_found(fetch_one(USER_SELECT + " WHERE users.id = %s", (user_id,)), "Brugeren")
    return user_json(row)


def validate_user(data, user_id=0):
    name = required_text(data, "name", "Navn")
    address = email(data)
    is_admin = boolean(data, "is_admin", "Admin")
    is_staff = boolean(data, "is_staff", "Personale")
    if not is_admin and not is_staff:
        raise ApiError("Brugeren skal have mindst én rolle: Admin eller Personale.")
    duplicate = fetch_one(
        "SELECT id FROM users WHERE lower(email) = %s AND id != %s", (address, user_id)
    )
    if duplicate:
        raise ApiError("E-mailadressen bruges allerede af en anden bruger.", 409)
    if not is_staff and fetch_one("SELECT id FROM employments WHERE user_id = %s", (user_id,)):
        raise ApiError("Personale-rollen kan ikke fjernes, mens brugeren har ansættelser.", 409)
    return name, address, is_admin, is_staff


def protect_last_admin(user_id):
    if fetch_one("SELECT id FROM users WHERE id = %s AND is_admin = 1", (user_id,)):
        if not fetch_one(
            """SELECT id FROM users WHERE is_admin = 1 AND password_hash IS NOT NULL AND id != %s""", (user_id,)
        ):
            raise ApiError("Den sidste administrator med login kan ikke fjernes.", 409)


@api.get("/users")
def list_users():
    rows = fetch_all(USER_SELECT + " ORDER BY users.name, users.id")
    return jsonify([user_json(row) for row in rows])


@api.get("/users/<int:user_id>")
def read_user(user_id):
    return jsonify(get_user(user_id))


@api.post("/users")
def create_user():
    data = json_body()

    def save():
        values = validate_user(data)
        hashed = password_hash(data.get("password"))
        item_id = execute(
            "INSERT INTO users (name, email, is_admin, is_staff, password_hash) VALUES (%s, %s, %s, %s, %s)", (*values, hashed)
        )
        return get_user(item_id)

    return jsonify(run_transaction(save)), 201


@api.put("/users/<int:user_id>")
def update_user(user_id):
    data = json_body()

    def save():
        get_user(user_id)
        values = validate_user(data, user_id)
        if not values[2]:
            protect_last_admin(user_id)
        new_password = data.get("password")
        hashed = password_hash(new_password) if new_password not in (None, "") else None
        execute(
            "UPDATE users SET name = %s, email = %s, is_admin = %s, is_staff = %s WHERE id = %s",
            (*values, user_id),
        )
        if hashed:
            execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, user_id))
            execute("DELETE FROM login_sessions WHERE user_id = %s", (user_id,))
        return get_user(user_id)

    return jsonify(run_transaction(save))


@api.delete("/users/<int:user_id>")
def delete_user(user_id):
    def remove():
        user = get_user(user_id)
        if user["employment_count"]:
            raise ApiError("Brugeren har tilknyttede ansættelser og kan derfor ikke slettes.", 409)
        protect_last_admin(user_id)
        execute("DELETE FROM users WHERE id = %s", (user_id,))

    run_transaction(remove)
    return jsonify({"message": "Brugeren er slettet."})


# Ansættelser og personale

EMPLOYMENT_SELECT = """
    SELECT employments.*, users.name,
           sections.name AS section_name, sections.color AS section_color,
           staff_groups.name AS staff_group_name
    FROM employments
    JOIN users ON users.id = employments.user_id
    JOIN sections ON sections.id = employments.section_id
    JOIN staff_groups ON staff_groups.id = employments.staff_group_id
"""


def get_employment(employment_id):
    return require_found(
        fetch_one(EMPLOYMENT_SELECT + " WHERE employments.id = %s", (employment_id,)),
        "Ansættelsen",
    )


def validate_employment(data, employment_id=0):
    user_id = integer(data, "user_id", "Person", 1)
    section_id = integer(data, "section_id", "Afsnit", 1)
    group_id = integer(data, "staff_group_id", "Personalegruppe", 1)
    hours = integer(data, "hours_per_week", "Timer pr. uge", 0, 37)
    start_date, end_date = date_range(data)

    person = fetch_one("SELECT id, is_staff FROM users WHERE id = %s", (user_id,))
    if not person:
        raise ApiError("Vælg en person, som findes i adgangsstyringen.")
    if not person["is_staff"]:
        raise ApiError("Personen skal have rollen Personale for at kunne ansættes.")
    if not fetch_one("SELECT id FROM sections WHERE id = %s", (section_id,)):
        raise ApiError("Vælg et afsnit, som findes i organiseringen.")
    if not fetch_one("SELECT id FROM staff_groups WHERE id = %s", (group_id,)):
        raise ApiError("Vælg en personalegruppe, som findes i organiseringen.")

    overlap = fetch_one(
        """SELECT id FROM employments
           WHERE user_id = %s AND id != %s AND start_date <= %s AND end_date >= %s""",
        (user_id, employment_id, end_date, start_date),
    )
    if overlap:
        raise ApiError("Ansættelsen overlapper en anden ansættelse for den samme person.", 409)
    return user_id, section_id, group_id, hours, start_date, end_date


@api.get("/employments")
def list_employments():
    return jsonify(fetch_all(EMPLOYMENT_SELECT + " ORDER BY users.name, employments.start_date, employments.id"))


@api.get("/employments/<int:employment_id>")
def read_employment(employment_id):
    return jsonify(get_employment(employment_id))


@api.post("/employments")
def create_employment():
    data = json_body()

    def save():
        values = validate_employment(data)
        item_id = execute(
            """INSERT INTO employments
               (user_id, section_id, staff_group_id, hours_per_week, start_date, end_date)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            values,
        )
        return get_employment(item_id)

    return jsonify(run_transaction(save)), 201


@api.put("/employments/<int:employment_id>")
def update_employment(employment_id):
    data = json_body()

    def save():
        get_employment(employment_id)
        values = validate_employment(data, employment_id)
        execute(
            """UPDATE employments SET user_id = %s, section_id = %s, staff_group_id = %s,
               hours_per_week = %s, start_date = %s, end_date = %s WHERE id = %s""",
            (*values, employment_id),
        )
        return get_employment(employment_id)

    return jsonify(run_transaction(save))


@api.delete("/employments/<int:employment_id>")
def delete_employment(employment_id):
    def remove():
        get_employment(employment_id)
        execute("DELETE FROM employments WHERE id = %s", (employment_id,))

    run_transaction(remove)
    return jsonify({"message": "Ansættelsen er slettet."})


@api.get("/personnel")
def list_personnel():
    period_id = request.args.get("period_id", "")
    if not re.fullmatch(r"[1-9][0-9]{0,18}", period_id):
        raise ApiError("Vælg en periode med et gyldigt period_id.")
    period = get_period(int(period_id))
    # En ansættelse skal blot overlappe perioden, ikke dække hele perioden.
    rows = fetch_all(
        EMPLOYMENT_SELECT
        + """ WHERE employments.start_date <= %s AND employments.end_date >= %s
              ORDER BY users.name, employments.start_date, employments.id""",
        (period["end_date"], period["start_date"]),
    )
    return jsonify(rows)


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        DB_HOST=os.environ.get('DB_HOST', '127.0.0.1'),
        DB_PORT=int(os.environ.get('DB_PORT', 3307)),
        DB_USER=os.environ.get('DB_USER', 'root'),
        DB_PASSWORD=os.environ.get('DB_PASSWORD', 'password'),
        DB_NAME=os.environ.get('DB_NAME', 'fairplan'),
    )
    if test_config:
        app.config.update(test_config)
    app.json.ensure_ascii = False
    app.teardown_appcontext(close_db)
    app.register_blueprint(auth.bp)
    app.register_blueprint(api)
    app.before_request(auth.protect_api)

    @app.get('/api/health')
    def health():
        fetch_one('SELECT COUNT(*) AS count FROM periods')
        return jsonify({'status': 'ok'})

    @app.errorhandler(ApiError)
    def api_error(error):
        return jsonify({'error': error.message}), error.status

    @app.errorhandler(MySQLError)
    def database_error(error):
        app.logger.error('Databasefejl: %s', error)
        return jsonify({'error': 'Ændringen kunne ikke gemmes i databasen.'}), 409

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify({'error': error.description}), error.code

    with app.app_context():
        init_db()
    return app


if __name__ == '__main__':
    from waitress import serve
    serve(create_app(), host='127.0.0.1', port=5002)
