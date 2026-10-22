"""Login, roller og adgangskoder mod en separat MariaDB-database."""
import unittest

from backend.app import create_app
from backend.database import execute, fetch_one
from backend.seed import seed_database
from backend.tests.database import test_database


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.config = self.enterContext(test_database())
        self.app = create_app(self.config)
        with self.app.app_context():
            seed_database()
        self.client = self.app.test_client()

    def login(self, address='sofie.andersen@example.com', password='Fairplan2026!', client=None):
        client = client or self.client
        response = client.post('/api/auth/login', json={'email': address, 'password': password})
        self.assertEqual(response.status_code, 200, response.get_json())
        token = response.get_json()['token']
        client.environ_base['HTTP_AUTHORIZATION'] = 'Bearer ' + token
        return token

    def test_password_token_logout_and_no_leaked_hash(self):
        self.assertEqual(self.client.get('/api/users').status_code, 401)
        for email in ('sofie.andersen@example.com', 'unknown@example.com'):
            response = self.client.post('/api/auth/login', json={'email': email, 'password': 'Wrong!'})
            self.assertEqual(response.status_code, 401)
        self.login(' SOFIE.Andersen@EXAMPLE.com ')
        with self.app.app_context():
            self.assertNotEqual(fetch_one('SELECT password_hash FROM users WHERE id = 3')['password_hash'], 'Fairplan2026!')
        for url in ('/api/auth/me', '/api/users', '/api/users/3'):
            self.assertNotIn('password_hash', self.client.get(url).get_data(as_text=True))
        self.assertEqual(self.client.post('/api/auth/logout').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/me').status_code, 401)

    def test_staff_and_both_admin_roles(self):
        self.login('anna.moller@example.com')
        for url in ('/api/periods', '/api/personnel?period_id=1'):
            self.assertEqual(self.client.get(url).status_code, 200)
        for resource in ('periods', 'sections', 'staff-groups', 'users', 'employments'):
            self.assertEqual(self.client.post('/api/' + resource, json={}).status_code, 403)
        self.assertEqual(self.client.get('/api/users').status_code, 403)
        for email in ('sofie.andersen@example.com', 'ida.petersen@example.com'):
            self.login(email)
            self.assertEqual(self.client.get('/api/users').status_code, 200)

    def test_password_change_revokes_token_and_roles_are_read_again(self):
        self.login()
        staff = self.app.test_client()
        self.login('anna.moller@example.com', client=staff)
        user = self.client.get('/api/users/1').get_json()
        self.assertEqual(self.client.put('/api/users/1', json={**user, 'password': 'NyTestkode2026!'}).status_code, 200)
        self.assertEqual(staff.get('/api/auth/me').status_code, 401)
        self.login('anna.moller@example.com', 'NyTestkode2026!', staff)
        self.assertEqual(self.client.put('/api/users/1', json={**user, 'is_admin': True}).status_code, 200)
        self.assertEqual(staff.get('/api/users').status_code, 200)
        self.assertEqual(self.client.put('/api/users/1', json=user).status_code, 200)
        self.assertEqual(staff.get('/api/users').status_code, 403)

    def test_last_admin_cannot_be_removed(self):
        self.login()
        sofie = self.client.get('/api/users/3').get_json()
        self.assertEqual(self.client.put('/api/users/3', json={**sofie, 'is_admin': False}).status_code, 200)
        self.login('ida.petersen@example.com')
        ida = self.client.get('/api/users/7').get_json()
        self.assertEqual(self.client.delete('/api/users/7').status_code, 409)
        self.assertEqual(self.client.put('/api/users/7', json={**ida, 'is_admin': False, 'is_staff': True}).status_code, 409)

    def test_token_survives_restart_then_expires(self):
        token = self.login()
        other = create_app(self.config).test_client()
        other.environ_base['HTTP_AUTHORIZATION'] = 'Bearer ' + token
        self.assertEqual(other.get('/api/auth/me').status_code, 200)
        with self.app.app_context():
            execute('UPDATE login_sessions SET expires_at = 0')
        self.assertEqual(other.get('/api/auth/me').status_code, 401)

    def test_deleted_user_and_password_validation(self):
        self.login()
        user = {'name': 'Test', 'email': 'login@example.com', 'is_admin': False, 'is_staff': True}
        for password in (None, '', 'kort', 'x' * 129, 123, []):
            self.assertEqual(self.client.post('/api/users', json={**user, 'password': password}).status_code, 400)
        created = self.client.post('/api/users', json={**user, 'password': 'GyldigKode!'})
        self.assertEqual(created.status_code, 201)
        other = self.app.test_client()
        self.login('login@example.com', 'GyldigKode!', other)
        self.assertEqual(self.client.delete('/api/users/' + str(created.get_json()['id'])).status_code, 200)
        self.assertEqual(other.get('/api/auth/me').status_code, 401)
