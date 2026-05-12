from flask import Blueprint, jsonify, request

from App.extensions import db
from App.models import AppUser, Booking, Desk
from App.services.dates import parse_date_arg

api_desks_bp = Blueprint("api_desks", __name__, url_prefix="/api")
WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
VALID_BLOCK_SLOTS = {"full", "am", "pm"}


def _busyness_band(percent):
    if percent >= 75:
        return "High"
    if percent >= 45:
        return "Moderate"
    return "Light"


@api_desks_bp.get("/desks")
def desks():
    booking_date, error = parse_date_arg(request.args.get("date"))
    if error:
        return error

    desk_rows = Desk.query.order_by(Desk.id).all()
    booking_rows = Booking.query.filter(Booking.date == booking_date).all()

    slots_by_desk = {}
    for row in booking_rows:
        slots_by_desk.setdefault(row.desk_id, {})[row.slot] = row.to_api()

    desk_payload = []
    for desk in desk_rows:
        slots = slots_by_desk.get(desk.id, {})
        full = slots.get("full")
        am = slots.get("am")
        pm = slots.get("pm")
        fully_booked = bool(full) or (am is not None and pm is not None)
        desk_payload.append(
            {
                **desk.to_api(),
                "available": not fully_booked,
                "bookedBy": full or am or pm,
                "slots": {"full": full, "am": am, "pm": pm},
            }
        )

    return jsonify({"date": booking_date.isoformat(), "desks": desk_payload})


@api_desks_bp.get("/office-busyness")
def office_busyness():
    booking_date, error = parse_date_arg(request.args.get("date"))
    if error:
        return error

    total_desks = Desk.query.count()
    booked_count = Booking.query.filter(Booking.date == booking_date).count()

    target_day = WEEKDAY_CODES[booking_date.weekday()]
    users = AppUser.query.with_entities(AppUser.email, AppUser.anchor_days).all()
    anchor_users = {
        str(user_email).strip().lower()
        for user_email, anchor_days in users
        if user_email and isinstance(anchor_days, list) and target_day in {
            str(day).strip().lower() for day in anchor_days if str(day).strip()
        }
    }

    anchor_matched_users = len(anchor_users)
    predicted_occupancy_count = min(total_desks, max(booked_count, anchor_matched_users))
    predicted_occupancy_pct = round((predicted_occupancy_count / total_desks) * 100) if total_desks else 0

    return jsonify(
        {
            "date": booking_date.isoformat(),
            "predictedOccupancyCount": predicted_occupancy_count,
            "predictedOccupancyPct": predicted_occupancy_pct,
            "bookedCount": booked_count,
            "anchorMatchedUsers": anchor_matched_users,
            "totalDesks": total_desks,
            "band": _busyness_band(predicted_occupancy_pct),
            "basis": "Based on users with matching anchor days in user settings.",
        }
    )


POD_NEIGHBOUR_ROW_DY = 4.0
POD_NEIGHBOUR_COL_DX = 4.0
POD_NEIGHBOUR_ROW_DX = 14.0
POD_NEIGHBOUR_COL_DY = 14.0


def _pods_adjacent(a, b):
    if a["floor"] != b["floor"] or a["zone"] != b["zone"]:
        return False
    dx = abs(a["centroid"][0] - b["centroid"][0])
    dy = abs(a["centroid"][1] - b["centroid"][1])
    if dx == 0 and dy == 0:
        return False
    same_row = dy <= POD_NEIGHBOUR_ROW_DY and dx <= POD_NEIGHBOUR_ROW_DX
    same_col = dx <= POD_NEIGHBOUR_COL_DX and dy <= POD_NEIGHBOUR_COL_DY
    return same_row or same_col


@api_desks_bp.post("/team-block-recommend")
def team_block_recommend():
    payload = request.get_json(silent=True) or {}

    try:
        count = int(payload.get("count") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "count must be an integer"}), 400
    if count < 2 or count > 12:
        return jsonify({"error": "count must be between 2 and 12"}), 400

    slot = str(payload.get("slot") or "full").strip().lower()
    if slot not in VALID_BLOCK_SLOTS:
        return jsonify({"error": "slot must be one of full, am, pm"}), 400

    booking_date, error = parse_date_arg(payload.get("date"))
    if error:
        return error

    preferred_floor = payload.get("floor")

    booking_rows = Booking.query.filter(Booking.date == booking_date).all()
    booked_slots_by_desk = {}
    for row in booking_rows:
        booked_slots_by_desk.setdefault(row.desk_id, set()).add(row.slot)

    def slot_free(desk_id):
        booked = booked_slots_by_desk.get(desk_id, set())
        if "full" in booked:
            return False
        if slot == "full":
            return not booked
        return slot not in booked

    desk_rows = Desk.query.filter(Desk.pod.isnot(None)).all()
    pods_by_key = {}
    for desk in desk_rows:
        pods_by_key.setdefault(desk.pod, []).append(desk)

    pod_list = []
    for key, members in pods_by_key.items():
        free = [d for d in members if slot_free(d.id)]
        cx = sum(d.x_percent for d in members) / len(members)
        cy = sum(d.y_percent for d in members) / len(members)
        pod_list.append({
            "key": key,
            "floor": members[0].floor,
            "zone": members[0].zone,
            "centroid": (cx, cy),
            "free": free,
        })

    best = None
    for anchor in pod_list:
        if not anchor["free"]:
            continue
        cluster = [anchor]
        used = {anchor["key"]}
        free_total = len(anchor["free"])

        while free_total < count:
            options = []
            for pod in pod_list:
                if pod["key"] in used or not pod["free"]:
                    continue
                if not any(_pods_adjacent(pod, c) for c in cluster):
                    continue
                ax, ay = anchor["centroid"]
                px, py = pod["centroid"]
                dist_sq = (px - ax) ** 2 + (py - ay) ** 2
                options.append((dist_sq, pod))
            if not options:
                break
            options.sort(key=lambda o: o[0])
            next_pod = options[0][1]
            cluster.append(next_pod)
            used.add(next_pod["key"])
            free_total += len(next_pod["free"])

        if free_total < count:
            continue

        free_in_cluster = [d for p in cluster for d in p["free"]]
        cx = sum(d.x_percent for d in free_in_cluster) / len(free_in_cluster)
        cy = sum(d.y_percent for d in free_in_cluster) / len(free_in_cluster)
        free_in_cluster.sort(key=lambda d: (d.x_percent - cx) ** 2 + (d.y_percent - cy) ** 2)
        picked = free_in_cluster[:count]
        floor_match = 0 if (preferred_floor and anchor["floor"] == preferred_floor) else 1
        priority = (len(cluster), floor_match, anchor["key"])

        if best is None or priority < best["priority"]:
            best = {
                "priority": priority,
                "pods": [p["key"] for p in cluster],
                "floor": anchor["floor"],
                "zone": anchor["zone"],
                "picked": picked,
            }

    if best is None:
        return jsonify({
            "deskIds": [],
            "message": f"No adjacent pods have {count} free desks for {slot} on this date.",
        })

    picked_sorted = sorted(best["picked"], key=lambda d: (d.y_percent, d.x_percent))
    return jsonify({
        "deskIds": [d.id for d in picked_sorted],
        "pods": best["pods"],
        "pod": best["pods"][0] if len(best["pods"]) == 1 else None,
        "floor": best["floor"],
        "zone": best["zone"],
    })
