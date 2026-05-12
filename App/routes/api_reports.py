from collections import defaultdict
from datetime import date, timedelta
from math import hypot

from flask import Blueprint, jsonify, request

from App.models import AppUser, Booking, Desk
from App.services.users import get_effective_user

api_reports_bp = Blueprint("api_reports", __name__, url_prefix="/api")

WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEKDAY_LABELS = {
    "mon": "Monday", "tue": "Tuesday", "wed": "Wednesday",
    "thu": "Thursday", "fri": "Friday", "sat": "Saturday", "sun": "Sunday",
}
TEAM_NEARBY_DISTANCE = 18
DEFAULT_WINDOW_DAYS = 30
MAX_WINDOW_DAYS = 365


def _slot_weight(slot):
    return 1.0 if slot == "full" else 0.5


def _parse_window():
    raw = request.args.get("days", str(DEFAULT_WINDOW_DAYS))
    try:
        days = int(raw)
    except (TypeError, ValueError):
        days = DEFAULT_WINDOW_DAYS
    days = max(1, min(days, MAX_WINDOW_DAYS))
    end = date.today()
    start = end - timedelta(days=days - 1)
    return start, end, days


@api_reports_bp.get("/reports")
def reports():
    start, end, days = _parse_window()

    active = get_effective_user()
    email = (active.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "No active user"}), 400

    profile = AppUser.query.filter_by(email=email).first()

    my_bookings = (
        Booking.query.filter(
            Booking.date >= start,
            Booking.date <= end,
            Booking.user_email == email,
        )
        .order_by(Booking.date, Booking.slot)
        .all()
    )

    desks = {d.id: d for d in Desk.query.all()}

    weekdays_in_window = sum(
        1 for n in range((end - start).days + 1)
        if (start + timedelta(days=n)).weekday() < 5
    )

    summary = _summary(my_bookings, weekdays_in_window)
    calendar = _calendar(start, end, my_bookings)
    slot_split = _slot_split(my_bookings)
    favourite_desks = _favourite_desks(my_bookings, desks)
    by_floor, by_zone = _by_floor_and_zone(my_bookings, desks)
    weekday_pattern = _weekday_pattern(my_bookings)
    anchor_adherence = _anchor_adherence(my_bookings, profile)
    co_location = _co_location(start, end, email, profile, desks)

    return jsonify(
        {
            "range": {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "days": days,
                "weekdaysInWindow": weekdays_in_window,
            },
            "user": {
                "name": active.get("name"),
                "email": email,
                "team": getattr(profile, "team", None),
            },
            "summary": summary,
            "calendar": calendar,
            "slotSplit": slot_split,
            "favouriteDesks": favourite_desks,
            "byFloor": by_floor,
            "byZone": by_zone,
            "weekdayPattern": weekday_pattern,
            "anchorAdherence": anchor_adherence,
            "coLocation": co_location,
        }
    )


def _summary(bookings, weekdays_in_window):
    distinct = {b.date for b in bookings}
    full_days = sum(1 for b in bookings if b.slot == "full")
    half_days = sum(1 for b in bookings if b.slot in ("am", "pm"))
    weight = sum(_slot_weight(b.slot) for b in bookings)
    attendance_pct = (
        round((len(distinct) / weekdays_in_window) * 100, 1)
        if weekdays_in_window else 0
    )
    return {
        "totalDays": len(distinct),
        "totalBookings": len(bookings),
        "fullDays": full_days,
        "halfDays": half_days,
        "deskDays": round(weight, 1),
        "attendancePct": attendance_pct,
    }


def _calendar(start, end, bookings):
    by_date = defaultdict(list)
    for b in bookings:
        desk = b.desk_id
        by_date[b.date].append({"deskId": desk, "slot": b.slot})

    out = []
    cursor = start
    while cursor <= end:
        entries = by_date.get(cursor, [])
        out.append(
            {
                "date": cursor.isoformat(),
                "weekday": WEEKDAY_CODES[cursor.weekday()],
                "isWeekend": cursor.weekday() >= 5,
                "entries": entries,
                "weight": round(sum(_slot_weight(e["slot"]) for e in entries), 1),
            }
        )
        cursor += timedelta(days=1)
    return out


def _slot_split(bookings):
    counts = {"full": 0, "am": 0, "pm": 0}
    for b in bookings:
        if b.slot in counts:
            counts[b.slot] += 1
    return counts


def _favourite_desks(bookings, desks):
    counts = defaultdict(float)
    for b in bookings:
        counts[b.desk_id] += _slot_weight(b.slot)

    out = []
    for desk_id, weight in counts.items():
        desk = desks.get(desk_id)
        out.append(
            {
                "deskId": desk_id,
                "floor": desk.floor if desk else None,
                "zone": desk.zone if desk else None,
                "features": (desk.features or []) if desk else [],
                "deskDays": round(weight, 1),
            }
        )
    out.sort(key=lambda row: (-row["deskDays"], row["deskId"]))
    return out


def _by_floor_and_zone(bookings, desks):
    floor = defaultdict(float)
    zone = defaultdict(float)
    for b in bookings:
        desk = desks.get(b.desk_id)
        if not desk:
            continue
        w = _slot_weight(b.slot)
        floor[desk.floor] += w
        zone[desk.zone] += w
    total = sum(floor.values()) or 1
    by_floor = [
        {"floor": f, "deskDays": round(v, 1), "pct": round((v / total) * 100, 1)}
        for f, v in sorted(floor.items(), key=lambda kv: -kv[1])
    ]
    by_zone = [
        {"zone": z, "deskDays": round(v, 1), "pct": round((v / total) * 100, 1)}
        for z, v in sorted(zone.items(), key=lambda kv: -kv[1])
    ]
    return by_floor, by_zone


def _weekday_pattern(bookings):
    counts = defaultdict(int)
    seen = set()
    for b in bookings:
        key = (b.date, b.user_email)
        if key in seen:
            continue
        seen.add(key)
        counts[WEEKDAY_CODES[b.date.weekday()]] += 1
    return [
        {"weekday": code, "label": WEEKDAY_LABELS[code], "days": counts.get(code, 0)}
        for code in WEEKDAY_CODES[:5]
    ]


def _anchor_adherence(bookings, profile):
    anchor_days = [
        str(d).strip().lower()
        for d in (getattr(profile, "anchor_days", None) or [])
        if str(d).strip()
    ]
    if not anchor_days:
        return {
            "configured": False,
            "anchorDays": [],
            "onAnchor": 0,
            "offAnchor": 0,
            "missedAnchor": 0,
            "pct": 0,
        }

    distinct = sorted({b.date for b in bookings})
    on_anchor = sum(1 for d in distinct if WEEKDAY_CODES[d.weekday()] in anchor_days)
    off_anchor = len(distinct) - on_anchor

    booked_set = set(distinct)
    cursor_start = distinct[0] if distinct else date.today()
    cursor_end = distinct[-1] if distinct else date.today()
    missed = 0
    cursor = cursor_start
    while cursor <= cursor_end:
        if WEEKDAY_CODES[cursor.weekday()] in anchor_days and cursor not in booked_set:
            missed += 1
        cursor += timedelta(days=1)

    pct = round((on_anchor / len(distinct)) * 100, 1) if distinct else 0
    return {
        "configured": True,
        "anchorDays": anchor_days,
        "anchorLabels": [WEEKDAY_LABELS[d] for d in anchor_days],
        "onAnchor": on_anchor,
        "offAnchor": off_anchor,
        "missedAnchor": missed,
        "pct": pct,
    }


def _co_location(start, end, email, profile, desks):
    preferred = [
        str(e).strip().lower()
        for e in (getattr(profile, "preferred_users", None) or [])
        if str(e).strip()
    ]
    if not preferred:
        return {"configured": False, "perUser": [], "totals": None}

    preferred_set = set(preferred)
    preferred_profiles = {
        u.email.lower(): u
        for u in AppUser.query.filter(AppUser.email.in_(preferred_set)).all()
        if u.email
    }

    my_rows = (
        Booking.query.filter(
            Booking.date >= start,
            Booking.date <= end,
            Booking.user_email == email,
        ).all()
    )
    if not my_rows:
        return {
            "configured": True,
            "perUser": [
                {
                    "email": e,
                    "name": (preferred_profiles.get(e).full_name if preferred_profiles.get(e) else e),
                    "sharedDays": 0,
                    "coLocatedDays": 0,
                    "pct": 0,
                }
                for e in preferred
            ],
            "totals": {"sharedDays": 0, "coLocatedDays": 0, "pct": 0},
        }

    my_by_date = defaultdict(list)
    for r in my_rows:
        my_by_date[r.date].append(r)

    their_rows = (
        Booking.query.filter(
            Booking.date >= start,
            Booking.date <= end,
            Booking.user_email.in_(preferred_set),
        ).all()
    )
    their_by_date_email = defaultdict(lambda: defaultdict(list))
    for r in their_rows:
        their_by_date_email[r.date][(r.user_email or "").lower()].append(r)

    per_user = []
    total_shared = 0
    total_co = 0
    for other_email in preferred:
        other_profile = preferred_profiles.get(other_email)
        name = other_profile.full_name if other_profile else other_email
        shared = 0
        co_located = 0
        for day, my_rows_day in my_by_date.items():
            their_day = their_by_date_email.get(day, {}).get(other_email, [])
            if not their_day:
                continue
            shared += 1
            if _any_near(my_rows_day, their_day, desks):
                co_located += 1
        pct = round((co_located / shared) * 100, 1) if shared else 0
        per_user.append(
            {
                "email": other_email,
                "name": name,
                "team": getattr(other_profile, "team", None),
                "sharedDays": shared,
                "coLocatedDays": co_located,
                "pct": pct,
            }
        )
        total_shared += shared
        total_co += co_located

    per_user.sort(key=lambda row: (-row["pct"], -row["sharedDays"], row["name"].lower()))
    totals = {
        "sharedDays": total_shared,
        "coLocatedDays": total_co,
        "pct": round((total_co / total_shared) * 100, 1) if total_shared else 0,
    }
    return {"configured": True, "perUser": per_user, "totals": totals}


def _any_near(my_rows, their_rows, desks):
    for mine in my_rows:
        my_desk = desks.get(mine.desk_id)
        if not my_desk:
            continue
        for theirs in their_rows:
            their_desk = desks.get(theirs.desk_id)
            if not their_desk or their_desk.floor != my_desk.floor:
                continue
            dx = my_desk.x_percent - their_desk.x_percent
            dy = my_desk.y_percent - their_desk.y_percent
            if hypot(dx, dy) <= TEAM_NEARBY_DISTANCE:
                return True
    return False
