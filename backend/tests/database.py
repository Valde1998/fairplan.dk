"""Hver test får sin egen MariaDB-database og fjerner kun denne bagefter."""
import os
from contextlib import contextmanager
from uuid import uuid4

import mysql.connector


@contextmanager
def test_database():
    name = 'fairplan_test_' + uuid4().hex
    connection = mysql.connector.connect(
        host=os.environ.get('DB_HOST', '127.0.0.1'),
        port=int(os.environ.get('DB_PORT', 3307)),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', 'password'),
        autocommit=True,
    )
    with connection.cursor() as cursor:
        cursor.execute(f'CREATE DATABASE {name}')
        try:
            yield {'TESTING': True, 'DB_NAME': name}
        finally:
            cursor.execute(f'DROP DATABASE {name}')
    connection.close()
