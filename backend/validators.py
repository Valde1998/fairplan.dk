"""Validering deles af endpoints. Forkerte typer bliver afvist, ikke omdannet."""

import re
from datetime import date

from flask import request
from werkzeug.exceptions import BadRequest


class ApiError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def json_body():
    if not request.is_json:
        raise ApiError("Send felterne som JSON.")
    try:
        data = request.get_json()
    except BadRequest:
        raise ApiError("Indholdet er ikke gyldig JSON.") from None
    if not isinstance(data, dict):
        raise ApiError("JSON skal være et objekt med formularens felter.")
    return data


def required_text(data, field, label, max_length=100):
    value = data.get(field)
    if not isinstance(value, str) or not value.strip():
        raise ApiError(f"{label} er påkrævet og skal være tekst.")
    value = value.strip()
    if len(value) > max_length:
        raise ApiError(f"{label} må højst være {max_length} tegn.")
    return value


def email(data):
    value = required_text(data, "email", "E-mail", 254).lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value):
        raise ApiError("Angiv en gyldig e-mailadresse.")
    return value


def boolean(data, field, label):
    value = data.get(field)
    if type(value) is not bool:
        raise ApiError(f"{label} er påkrævet og skal være ja eller nej.")
    return value


def integer(data, field, label, minimum, maximum=None):
    value = data.get(field)
    # bool er en underklasse af int i Python, derfor kontrolleres den præcise type.
    if type(value) is not int:
        raise ApiError(f"{label} skal være et heltal.")
    if value < minimum or (maximum is not None and value > maximum):
        if maximum is not None:
            raise ApiError(f"{label} skal være mellem {minimum} og {maximum}.")
        raise ApiError(f"{label} skal være mindst {minimum}.")
    return value


def date_range(data):
    values = []
    for field, label in (("start_date", "Startdato"), ("end_date", "Slutdato")):
        value = data.get(field)
        if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ApiError(f"{label} er påkrævet og skal have formatet ÅÅÅÅ-MM-DD.")
        try:
            date.fromisoformat(value)
        except ValueError:
            raise ApiError(f"{label} skal være en gyldig kalenderdato.") from None
        values.append(value)
    start_date, end_date = values
    if start_date >= end_date:
        raise ApiError("Slutdato skal være efter startdato.")
    return start_date, end_date


def color(data):
    value = required_text(data, "color", "Farve", 7)
    if not re.fullmatch(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value):
        raise ApiError("Farve skal være en gyldig HEX-farve, f.eks. #3B82F6.")
    if len(value) == 4:
        value = "#" + "".join(character * 2 for character in value[1:])
    return value.upper()


def require_found(row, label):
    if row is None:
        raise ApiError(f"{label} findes ikke.", 404)
    return row
