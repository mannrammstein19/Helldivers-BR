#!/usr/bin/env python3
"""Mantem um snapshot persistente da Ordem Maior para o Helldivers-BR.

O endpoint /assignments mostra ordens ativas. Quando a ordem termina, ela pode
sumir da API; por isso este script preserva o ultimo registro em
`dados/major-order.json` e marca o resultado automaticamente.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import urllib.request
import unicodedata
from datetime import datetime, timezone, timedelta
from pathlib import Path

API = "https://api.helldivers2.dev/api/v1"
SNAPSHOT = Path("dados/major-order.json")
HEADERS = {
    "X-Super-Client": "mannrammstein19.github.io/Helldivers-BR",
    "X-Super-Contact": "https://github.com/mannrammstein19/Helldivers-BR",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": "Helldivers-BR-Major-Order-Snapshot/1.0",
}
ACTIVE_REFRESH = timedelta(hours=1)  # heartbeat; mudanças de progresso são salvas imediatamente
MISSING_CONFIRM = timedelta(minutes=8)  # exige 2 leituras vazias no cron de 10 min


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime | None = None) -> str:
    return (dt or now_utc()).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        # aceita epoch em segundos ou milissegundos
        n = float(value)
        if n > 10_000_000_000:
            n /= 1000
        try:
            return datetime.fromtimestamp(n, tz=timezone.utc)
        except Exception:
            return None
    s = str(value).strip()
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def fetch_json(endpoint: str):
    req = urllib.request.Request(f"{API}/{endpoint}", headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} em {endpoint}")
        return json.load(response)


def load_snapshot():
    try:
        return json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_snapshot(data):
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    SNAPSHOT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def as_list(value):
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get("data"), list):
        return value["data"]
    return []


def clean_text(value):
    if isinstance(value, str):
        return re.sub(r"<[^>]*>", " ", value).strip()
    if isinstance(value, dict):
        for key in ("pt-BR", "pt-PT", "en-US", "en"):
            if value.get(key):
                return clean_text(value[key])
        for v in value.values():
            if v:
                return clean_text(v)
    return "" if value is None else str(value).strip()


def pick_order(data):
    for item in as_list(data):
        if isinstance(item, dict) and (item.get("tasks") or item.get("title") or item.get("briefing")):
            return item
    return None


def order_key(order):
    for field in ("id", "assignmentId", "assignmentID", "settingId", "settingID"):
        value = order.get(field)
        if value not in (None, ""):
            return str(value)
    base = "|".join([
        clean_text(order.get("title")),
        clean_text(order.get("description")),
        str(order.get("expiration") or order.get("expiresAt") or ""),
    ])
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]


def num(value):
    try:
        n = float(value)
        return n if n == n else None
    except Exception:
        return None


def task_goal(task):
    if not isinstance(task, dict):
        return None
    types = task.get("valueTypes") or []
    values = task.get("values") or []
    try:
        idx = list(types).index(3)
        g = num(values[idx])
        if g and g > 0:
            return g
    except Exception:
        pass
    for key in ("goal", "targetValue", "required", "amount"):
        g = num(task.get(key))
        if g and g > 0:
            return g
    return None


def completion_metrics(order):
    tasks = order.get("tasks") if isinstance(order.get("tasks"), list) else []
    progress = order.get("progress")
    if not isinstance(progress, list):
        progress = [progress] if progress is not None else []

    known = []
    for i, task in enumerate(tasks):
        g = task_goal(task)
        if not g:
            continue
        p = num(progress[i]) if i < len(progress) else None
        if p is None and isinstance(task, dict):
            tp = task.get("progress")
            if isinstance(tp, list):
                tp = tp[0] if tp else None
            p = num(tp)
        if p is None:
            p = 0.0
        known.append((max(0.0, p), g))

    # Alguns wrappers ja expõem goal/progress direto na ordem.
    if not known:
        g = num(order.get("goal"))
        p = num(order.get("progress"))
        if g and g > 0 and p is not None:
            known.append((max(0.0, p), g))

    if not known:
        return {"known": False, "all_complete": False, "percent": None, "done": 0, "total": 0}

    done = sum(1 for p, g in known if p >= g)
    total = len(known)
    total_goal = sum(g for _, g in known)
    total_progress = sum(min(p, g) for p, g in known)
    percent = (total_progress / total_goal * 100) if total_goal else None
    return {"known": True, "all_complete": done == total and total == len(tasks), "percent": percent, "done": done, "total": total}


def published_time(dispatch):
    for key in ("published", "publishedAt", "date", "timestamp"):
        dt = parse_date(dispatch.get(key)) if isinstance(dispatch, dict) else None
        if dt:
            return dt
    return None


def normalized(value):
    value = re.sub(r"<[^>]*>", " ", clean_text(value))
    value = "".join(c for c in unicodedata.normalize("NFD", value) if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]+", " ", value.upper()).strip()


def target_ids(order):
    result = []
    for task in order.get("tasks") or []:
        types, values = task.get("valueTypes") or [], task.get("values") or []
        if 12 in types and types.index(12) < len(values):
            value = str(values[types.index(12)])
            if value and value != "0" and value not in result:
                result.append(value)
    return result


def dispatch_outcome(dispatches, snapshot, now=None):
    now = now or now_utc()
    start = parse_date(snapshot.get("first_seen_at"))
    if not start:
        return None
    order = snapshot["order"]
    ids = target_ids(order)
    names = [normalized(snapshot.get("target_planets", {}).get(i, "")) for i in ids]
    success_re = re.compile(r"^(?:MAJOR ORDER (?:COMPLETED|SUCCESSFUL|SUCCESS|VICTORY|WON)|ORDEM (?:MAIOR|PRINCIPAL) (?:CONCLUIDA|COMPLETADA|VENCIDA|GANHA|CUMPRIDA)|PEDIDO PRINCIPAL (?:GANHO|CONCLUIDO)|VITORIA NA ORDEM MAIOR)\b")
    fail_re = re.compile(r"^(?:MAJOR ORDER (?:FAILED|LOST|FAILURE)|ORDEM (?:MAIOR|PRINCIPAL) (?:PERDIDA|FRACASSADA|FALHOU)|PEDIDO PRINCIPAL (?:PERDIDO|FRACASSADO)|DERROTA NA ORDEM MAIOR)\b")
    candidates = []
    for d in as_list(dispatches):
        if not isinstance(d, dict):
            continue
        dt = published_time(d)
        if dt and start <= dt <= now + timedelta(minutes=5):
            candidates.append((dt, d))
    for dt, d in sorted(candidates, key=lambda x: x[0], reverse=True):
        title, body = normalized(d.get("title")), normalized(d.get("message"))
        msg = f" {title} {body} "
        success = bool(success_re.search(title) or success_re.search(body))
        failure = bool(fail_re.search(title) or fail_re.search(body))
        if success == failure:
            continue
        linked = d.get("assignmentId", d.get("assignmentID", d.get("majorOrderId")))
        if linked is not None and str(linked) != order_key(order):
            continue
        explicit = linked is not None and str(linked) == order_key(order)
        planets = bool(ids) and all(name and f" {name} " in msg for name in names)
        order_title = normalized(order.get("title"))
        specific = len(order_title.split()) >= 3 and order_title not in {"MAJOR ORDER", "ORDEM MAIOR", "PEDIDO PRINCIPAL"} and f" {order_title} " in msg
        if not explicit and not planets and not (not ids and specific):
            continue
        return {
            "state": "completed" if success else "failed",
            "outcome_source": "dispatch",
            "ended_at": iso(dt),
            "outcome_dispatch": {"id": d.get("id"), "published": iso(dt), "message": clean_text(d.get("message") or d.get("title"))},
        }
    return None


def same_order(snapshot, order):
    return bool(snapshot and snapshot.get("key") == order_key(order))


def build_active(order, previous=None):
    now = now_utc()
    metrics = completion_metrics(order)
    first = previous.get("first_seen_at") if same_order(previous, order) else None
    return {
        "schema": 1,
        "state": "active",
        "key": order_key(order),
        "first_seen_at": first or iso(now),
        "last_seen_at": iso(now),
        "last_progress_update_at": iso(now),
        "final_percent": round(metrics["percent"], 2) if metrics["percent"] is not None else None,
        "outcome_source": None,
        "order": order,
    }


def main():
    previous = load_snapshot()
    now = now_utc()
    assignments_ok = True
    try:
        assignments = fetch_json("assignments")
        if not isinstance(assignments, list) and not (isinstance(assignments, dict) and isinstance(assignments.get("data"), list)):
            raise ValueError("Resposta de assignments invalida")
    except Exception as exc:
        print(f"[major-order] Assignments indisponivel; preservando leitura: {exc}")
        assignments_ok, assignments = False, []

    active = pick_order(assignments)
    if active:
        snapshot = build_active(active, previous)
        if same_order(previous, active):
            if previous.get("state") in {"completed", "failed"}:
                print("[major-order] Resultado confirmado preservado.")
                return 0
            snapshot["target_planets"] = previous.get("target_planets", {})
    elif previous and previous.get("order"):
        snapshot = dict(previous)
        if snapshot.get("state") in {"completed", "failed"}:
            print("[major-order] Ultimo resultado confirmado preservado.")
            return 0
    else:
        print("[major-order] Sem ordem ou historico para analisar.")
        return 0

    # Nomes dos alvos vêm da API; não há planetas ou vitórias cadastrados à mão.
    ids = target_ids(snapshot["order"])
    names = dict(snapshot.get("target_planets", {}))
    if any(not names.get(i) for i in ids):
        try:
            for planet in as_list(fetch_json("planets")):
                index = str(planet.get("index"))
                if index in ids and planet.get("name"):
                    names[index] = clean_text(planet["name"])
        except Exception as exc:
            print(f"[major-order] Catalogo indisponivel: {exc}")
    snapshot["target_planets"] = names

    # Consulta o anúncio mesmo se a ordem ainda estiver na lista ou a API de ordens falhar.
    evidence = None
    try:
        evidence = dispatch_outcome(fetch_json("dispatches"), snapshot, now)
    except Exception as exc:
        print(f"[major-order] Dispatches indisponiveis: {exc}")
    if evidence:
        snapshot.update(evidence)
        snapshot["last_checked_at"] = iso(now)
        if evidence["state"] == "completed":
            snapshot["final_percent"] = 100.0
        # order.progress continua sendo o último contador medido, não um valor inventado.
        write_snapshot(snapshot)
        print(f"[major-order] Resultado confirmado: {evidence['state'].upper()} (dispatch vinculado).")
        return 0

    if not assignments_ok:
        print("[major-order] Sem nova evidencia; snapshot anterior preservado.")
        return 0

    expiration = parse_date(snapshot["order"].get("expiration") or snapshot["order"].get("expiresAt") or snapshot["order"].get("expireTime"))
    expired = bool(expiration and now >= expiration)
    if not active or expired:
        snapshot["state"] = "pending"
        snapshot["missing_since"] = (previous or {}).get("missing_since") or iso(now)
        metrics = completion_metrics(snapshot["order"])
        tasks = snapshot["order"].get("tasks") or []
        counters = bool(tasks) and all(t.get("type") == 3 for t in tasks)
        waited = now - (parse_date(snapshot["missing_since"]) or now) >= MISSING_CONFIRM
        if counters and metrics["all_complete"] and (expired or waited):
            snapshot.update(state="completed", outcome_source="objective_progress", ended_at=iso(now), final_percent=100.0)
        # Ausência, controle atual e percentual antigo nunca provam derrota.
    snapshot["last_checked_at"] = iso(now)
    ignored = {"last_checked_at", "last_seen_at", "last_progress_update_at"}
    meaningful = lambda d: {k: v for k, v in (d or {}).items() if k not in ignored}
    last = parse_date((previous or {}).get("last_progress_update_at"))
    if meaningful(snapshot) != meaningful(previous) or not last or now-last >= ACTIVE_REFRESH:
        write_snapshot(snapshot)
        print(f"[major-order] Leitura salva: {snapshot['state']}.")
    else:
        print("[major-order] Consulta concluida; sem mudanca de progresso ou resultado.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
