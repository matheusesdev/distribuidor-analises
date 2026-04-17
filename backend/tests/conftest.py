import importlib
import sys
from copy import deepcopy
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


class FakeResponse:
    def __init__(self, data=None, count=None):
        self.data = data or []
        self.count = count


class FakeTable:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self._reset()

    def _reset(self):
        self.action = "select"
        self.selected_fields = "*"
        self.count_requested = None
        self.filters = []
        self.limit_value = None
        self.order_field = None
        self.order_desc = False
        self.payload = None
        self.upsert_conflict = None
        return self

    def select(self, fields="*", count=None):
        self.action = "select"
        self.selected_fields = fields
        self.count_requested = count
        return self

    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self

    def neq(self, field, value):
        self.filters.append(("neq", field, value))
        return self

    def gte(self, field, value):
        self.filters.append(("gte", field, value))
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def order(self, field, desc=False):
        self.order_field = field
        self.order_desc = desc
        return self

    def insert(self, payload):
        self.action = "insert"
        self.payload = payload
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def upsert(self, payload, on_conflict=None, ignore_duplicates=False):
        self.action = "upsert"
        self.payload = payload
        self.upsert_conflict = on_conflict
        return self

    def _matches(self, row):
        for op, field, value in self.filters:
            row_value = row.get(field)
            if op == "eq" and row_value != value:
                return False
            if op == "neq" and row_value == value:
                return False
            if op == "gte" and (row_value is None or row_value < value):
                return False
        return True

    def _project(self, rows):
        if self.selected_fields in (None, "*"):
            return [deepcopy(row) for row in rows]
        fields = [field.strip() for field in str(self.selected_fields).split(",") if field.strip()]
        return [{field: row.get(field) for field in fields} for row in rows]

    def execute(self):
        rows = self.db.setdefault(self.table_name, [])
        matched = [row for row in rows if self._matches(row)]

        if self.action == "select":
            result = matched[:]
            if self.order_field:
                result.sort(key=lambda item: item.get(self.order_field) or "", reverse=self.order_desc)
            if self.limit_value is not None:
                result = result[: self.limit_value]
            response = FakeResponse(
                data=self._project(result),
                count=len(matched) if self.count_requested == "exact" else None,
            )
            self._reset()
            return response

        if self.action == "insert":
            payloads = self.payload if isinstance(self.payload, list) else [self.payload]
            inserted = [deepcopy(item) for item in payloads]
            rows.extend(inserted)
            response = FakeResponse(data=inserted)
            self._reset()
            return response

        if self.action == "update":
            updated = []
            for row in matched:
                row.update(deepcopy(self.payload))
                updated.append(deepcopy(row))
            response = FakeResponse(data=updated)
            self._reset()
            return response

        if self.action == "delete":
            deleted = [deepcopy(row) for row in matched]
            self.db[self.table_name] = [row for row in rows if not self._matches(row)]
            response = FakeResponse(data=deleted)
            self._reset()
            return response

        if self.action == "upsert":
            payloads = self.payload if isinstance(self.payload, list) else [self.payload]
            conflict_field = self.upsert_conflict or "reserva_id"
            affected = []
            for payload in payloads:
                payload_copy = deepcopy(payload)
                existing = next((row for row in rows if row.get(conflict_field) == payload_copy.get(conflict_field)), None)
                if existing:
                    existing.update(payload_copy)
                    affected.append(deepcopy(existing))
                else:
                    rows.append(payload_copy)
                    affected.append(deepcopy(payload_copy))
            response = FakeResponse(data=affected)
            self._reset()
            return response

        self._reset()
        return FakeResponse()


class FakeSupabase:
    def __init__(self):
        self.db = {
            "analistas": [],
            "administradores": [],
            "distribuicoes": [],
            "historico": [],
            "logs_transferencias": [],
            "logs_sessoes_revogadas": [],
        }

    def table(self, table_name):
        return FakeTable(self.db, table_name)


@pytest.fixture
def app_module(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-key")
    monkeypatch.setenv("CVCRM_EMAIL", "test@example.com")
    monkeypatch.setenv("CVCRM_TOKEN", "test-token")
    monkeypatch.setenv("ADMIN_AUTH_SECRET", "admin-secret-32-chars-min-1234567890")
    monkeypatch.setenv("ANALYST_AUTH_SECRET", "analyst-secret-32-chars-min-123456")
    monkeypatch.setenv("TESTING", "1")

    fake_supabase = FakeSupabase()

    import supabase

    monkeypatch.setattr(supabase, "create_client", lambda url, key: fake_supabase)
    sys.modules.pop("main", None)
    module = importlib.import_module("main")
    module.supabase = fake_supabase
    return module


@pytest.fixture
def client(app_module):
    with TestClient(app_module.app) as test_client:
        yield test_client
