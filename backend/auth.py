import hashlib
import secrets
import time

from flask import Blueprint, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from backend.database import execute, fetch_one
from backend.validators import ApiError, email, json_body

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


def password_hash(value):
    if not isinstance(value, str) or not 8 <= len(value) <= 128 or not value.strip():
        raise ApiError('Adgangskoden skal være mellem 8 og 128 tegn.')
    return generate_password_hash(value)


def token_hash():
    token = request.headers.get('Authorization', '').removeprefix('Bearer ')
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(row):
    return {key: bool(row[key]) if key in ('is_admin', 'is_staff') else row[key]
            for key in ('id', 'name', 'email', 'is_admin', 'is_staff')}


def protect_api():
    if request.endpoint in (None, 'health', 'auth.login'):
        return
    g.auth = fetch_one('''SELECT users.* FROM users JOIN login_sessions ON users.id = user_id
                         WHERE token_hash = %s AND expires_at > %s''', (token_hash(), int(time.time())))
    if not g.auth:
        raise ApiError('Log ind for at fortsætte.', 401)
    personnel_read = request.method in ('GET', 'HEAD') and request.endpoint in ('api.list_periods', 'api.list_personnel')
    if request.blueprint != 'auth' and not g.auth['is_admin'] and not (g.auth['is_staff'] and personnel_read):
        raise ApiError('Du skal have rollen Admin for at udføre denne handling.', 403)


@bp.post('/login')
def login():
    data = json_body()
    user = fetch_one('SELECT * FROM users WHERE email = %s', (email(data),))
    password = data.get('password')
    if not user or not user['password_hash'] or not isinstance(password, str) or not check_password_hash(user['password_hash'], password):
        raise ApiError('E-mail eller adgangskode er forkert.', 401)
    token = secrets.token_urlsafe(32)
    execute('DELETE FROM login_sessions WHERE expires_at <= %s', (int(time.time()),))
    execute('INSERT INTO login_sessions VALUES (%s, %s, %s)',
            (hashlib.sha256(token.encode()).hexdigest(), user['id'], int(time.time()) + 8 * 3600))
    return jsonify({'user': public_user(user), 'token': token})


@bp.get('/me')
def me():
    return jsonify({'user': public_user(g.auth)})


@bp.post('/logout')
def logout():
    execute('DELETE FROM login_sessions WHERE token_hash = %s', (token_hash(),))
    return jsonify({'message': 'Du er logget ud.'})
