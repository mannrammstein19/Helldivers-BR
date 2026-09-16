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
ACTIVE_REFRESH = timedelta(hours=1)  # evita dezenas de commits por dia
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
        return re.sub(r"<[^>]*>", "", value).strip()
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
    return {"known": True, "all_complete": done == total, "percent": percent, "done": done, "total": total}


def published_time(dispatch):
    for key in ("published", "publishedAt", "date", "timestamp"):
        dt = parse_date(dispatch.get(key)) if isinstance(dispatch, dict) else None
        if dt:
            return dt
    return None


def dispatch_outcome(dispatches, since):
    success_re = re.compile(r"\bMAJOR\s+ORDER\s+(?:COMPLETED|SUCCESS(?:FUL)?|VICTORY|WON)\b|\bORDER\s+(?:COMPLETED|SUCCESSFUL)\b", re.I)
    fail_re = re.compile(r"\bMAJOR\s+ORDER\s+FAILED\b|\bORDER\s+FAILED\b", re.I)
    candidates = []
    for d in as_list(dispatches)[:20]:
        if not isinstance(d, dict):
            continue
        dt = published_time(d)
        if since and dt and dt < since - timedelta(minutes=5):
            continue
        msg = clean_text(d.get("message") or d.get("title") or "")
        if msg:
            candidates.append(msg)
    joined = "\n".join(candidates)
    if fail_re.search(joined):
        return "failed", "dispatch"
    if success_re.search(joined):
        return "completed", "dispatch"
    return None, None


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

    try:
        assignments = fetch_json("assignments")
    except Exception as exc:
        print(f"[major-order] API indisponivel; snapshot preservado: {exc}")
        return 0

    active = pick_order(assignments)
    if active:
        key = order_key(active)

        # Nao reabre uma ordem terminal se a API devolver por alguns minutos o mesmo registro.
        if previous and previous.get("state") in {"completed", "failed"} and previous.get("key") == key:
            print("[major-order] A mesma ordem terminal ainda apareceu na API; mantendo resultado final.")
            return 0

        # Se reapareceu apos uma leitura vazia, volta para ativo imediatamente.
        if previous and previous.get("state") == "pending" and previous.get("key") == key:
            write_snapshot(build_active(active, previous))
            print("[major-order] Ordem reapareceu; status restaurado para ACTIVE.")
            return 0

        # Nova ordem: salva imediatamente. Mesma ordem: no maximo 1 snapshot por hora.
        if not same_order(previous, active):
            write_snapshot(build_active(active, None))
            print(f"[major-order] Nova ordem registrada: {key}")
            return 0

        last_update = parse_date(previous.get("last_progress_update_at")) if previous else None
        if not last_update or now - last_update >= ACTIVE_REFRESH:
            write_snapshot(build_active(active, previous))
            print("[major-order] Snapshot horario da ordem ativa atualizado.")
        else:
            print("[major-order] Ordem ativa sem mudanca relevante; nenhum commit necessario.")
        return 0

    # Nenhuma ordem ativa na API.
    if not previous or not previous.get("order"):
        empty = {"schema": 1, "state": "none", "key": None, "order": None}
        if previous != empty:
            write_snapshot(empty)
        print("[major-order] Nenhuma ordem ativa e nenhum historico anterior.")
        return 0

    if previous.get("state") in {"completed", "failed"}:
        print("[major-order] Nenhuma nova ordem; mantendo o ultimo resultado na pagina.")
        return 0

    order = previous["order"]
    metrics = completion_metrics(order)
    expiration = parse_date(order.get("expiration") or order.get("expiresAt") or order.get("expireTime"))
    first_seen = parse_date(previous.get("first_seen_at"))

    # Primeira leitura vazia: nao conclui nada ainda, para evitar falso positivo por cache/API.
    if previous.get("state") != "pending":
        pending = dict(previous)
        pending.update({"state": "pending", "missing_since": iso(now), "outcome_source": None})
        if metrics["percent"] is not None:
            pending["final_percent"] = round(metrics["percent"], 2)
        write_snapshot(pending)
        print("[major-order] Ordem sumiu da API; aguardando uma segunda confirmacao.")
        return 0

    missing_since = parse_date(previous.get("missing_since")) or now
    if now - missing_since < MISSING_CONFIRM:
        print("[major-order] Ainda dentro da janela de confirmacao.")
        return 0

    # 1) objetivo numericamente completo
    state = "completed" if metrics["all_complete"] else None
    source = "objective_progress" if state else None

    # 2) despacho do Alto Comando posterior ao inicio da ordem
    if not state:
        try:
            dispatches = fetch_json("dispatches")
            state, source = dispatch_outcome(dispatches, first_seen)
        except Exception as exc:
            print(f"[major-order] Dispatches indisponiveis: {exc}")

    # 3) se expirou sem cumprir, falhou
    if not state and expiration and now >= expiration:
        state, source = "failed", "expiration"

    # 4) se desapareceu antes do prazo e continua ausente, normalmente foi concluida cedo.
    if not state and expiration and now < expiration:
        state, source = "completed", "removed_before_expiration"

    if not state:
        print("[major-order] Resultado ainda inconclusivo; mantendo AGUARDANDO.")
        return 0

    final = dict(previous)
    final.update({
        "state": state,
        "ended_at": iso(now),
        "outcome_source": source,
        "missing_since": previous.get("missing_since"),
    })
    if state == "completed":
        final["final_percent"] = 100.0
    elif metrics["percent"] is not None:
        final["final_percent"] = round(metrics["percent"], 2)
    write_snapshot(final)
    print(f"[major-order] Resultado confirmado: {state.upper()} ({source}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
