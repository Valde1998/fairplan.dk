from datetime import date
from pathlib import Path

import mysql.connector
from flask import current_app, g


def get_db():
    if 'db' not in g:
        g.db = mysql.connector.connect(
            host=current_app.config['DB_HOST'], port=current_app.config['DB_PORT'],
            user=current_app.config['DB_USER'], password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME'], autocommit=True,
        )
    return g.db


def close_db(error=None):
    connection = g.pop('db', None)
    if connection:
        connection.close()


def fetch_all(sql, params=()):
    with get_db().cursor(dictionary=True) as cursor:
        cursor.execute(sql, params)
        return [{key: value.isoformat() if isinstance(value, date) else value
                 for key, value in row.items()} for row in cursor.fetchall()]


def fetch_one(sql, params=()):
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def execute(sql, params=()):
    with get_db().cursor() as cursor:
        cursor.execute(sql, params)
        return cursor.lastrowid


def run_transaction(work):
    connection = get_db()
    # Kontrol af overlap og gemning sker samlet, én ændring ad gangen.
    with connection.cursor() as cursor:
        cursor.execute("SELECT GET_LOCK(CONCAT(DATABASE(), '_write'), 10)")
        if cursor.fetchone()[0] != 1:
            raise RuntimeError('Databasen er optaget.')
        connection.start_transaction()
        try:
            result = work()
            connection.commit()
            return result
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.execute("SELECT RELEASE_LOCK(CONCAT(DATABASE(), '_write'))")
            cursor.fetchone()


def init_db():
    sql = (Path(__file__).resolve().parent.parent / 'database/init.sql').read_text(encoding='utf-8-sig')
    for statement in sql.split(';'):
        if statement.strip():
            execute(statement)
