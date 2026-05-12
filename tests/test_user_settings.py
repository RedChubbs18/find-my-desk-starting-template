def test_get_user_settings_returns_defaults(client, seed_user):
    response = client.get("/api/user-settings")

    assert response.status_code == 200
    body = response.get_json()
    assert body["deskPreferences"] == []
    assert body["preferredUsers"] == []
    assert body["anchorDays"] == []
    assert body["autoCheckin"] is False


def test_put_user_settings_persists_auto_checkin(client, seed_user):
    response = client.put(
        "/api/user-settings",
        json={
            "deskPreferences": [],
            "preferredUsers": [],
            "anchorDays": ["mon", "wed"],
            "autoCheckin": True,
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["ok"] is True
    assert body["autoCheckin"] is True
    assert body["anchorDays"] == ["mon", "wed"]

    # Round-trip via GET to confirm persistence.
    follow_up = client.get("/api/user-settings").get_json()
    assert follow_up["autoCheckin"] is True
    assert follow_up["anchorDays"] == ["mon", "wed"]


def test_put_user_settings_ignores_invalid_desk_preferences(client, seed_user):
    response = client.put(
        "/api/user-settings",
        json={
            "deskPreferences": ["not-a-real-preference"],
            "preferredUsers": [],
            "anchorDays": [],
            "autoCheckin": False,
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["deskPreferences"] == []
    assert "not-a-real-preference" in body["ignoredPreferences"]


def test_put_user_settings_rejects_non_list_payload(client, seed_user):
    response = client.put(
        "/api/user-settings",
        json={
            "deskPreferences": "monitor",
            "preferredUsers": [],
            "anchorDays": [],
        },
    )

    assert response.status_code == 400
