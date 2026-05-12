from datetime import date, timedelta


def _tomorrow_iso():
    return (date.today() + timedelta(days=1)).isoformat()


def test_create_booking_happy_path(client, seed_user, seed_desk):
    booking_date = _tomorrow_iso()

    response = client.post(
        "/api/bookings",
        json={"deskId": seed_desk, "date": booking_date, "slot": "full"},
    )

    assert response.status_code == 201
    body = response.get_json()
    assert body["ok"] is True
    assert body["deskId"] == seed_desk
    assert body["date"] == booking_date
    assert body["slot"] == "full"

    listing = client.get(f"/api/bookings?date={booking_date}").get_json()
    assert seed_desk in listing["bookings"]
    assert listing["bookings"][seed_desk][0]["slot"] == "full"


def test_create_booking_conflict_on_same_slot(client, seed_user, seed_desk):
    booking_date = _tomorrow_iso()
    payload = {"deskId": seed_desk, "date": booking_date, "slot": "full"}

    first = client.post("/api/bookings", json=payload)
    assert first.status_code == 201

    second = client.post("/api/bookings", json=payload)
    assert second.status_code == 409
    assert "already booked" in second.get_json()["error"].lower()


def test_create_booking_unknown_desk_returns_404(client, seed_user):
    response = client.post(
        "/api/bookings",
        json={"deskId": "does-not-exist", "date": _tomorrow_iso(), "slot": "full"},
    )

    assert response.status_code == 404


def test_create_booking_rejects_invalid_slot(client, seed_user, seed_desk):
    response = client.post(
        "/api/bookings",
        json={"deskId": seed_desk, "date": _tomorrow_iso(), "slot": "evening"},
    )

    assert response.status_code == 400
