import httpx
import pytest

from email_service import (
    EmailSender,
    LoggingEmailSender,
    ResendEmailSender,
    build_email_sender,
)


def test_logging_sender_captures_messages():
    sender = LoggingEmailSender()
    sender.send("a@b.com", "Subject", "Body")
    assert sender.sent == [{"to": "a@b.com", "subject": "Subject", "body": "Body"}]


def test_resend_sender_posts_expected_payload(monkeypatch):
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json

        class Resp:
            def raise_for_status(self):
                return None

        return Resp()

    monkeypatch.setattr(httpx, "post", fake_post)
    ResendEmailSender("key123", "From <from@x.com>").send("to@x.com", "Subj", "Hello")

    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer key123"
    assert captured["json"] == {
        "from": "From <from@x.com>",
        "to": ["to@x.com"],
        "subject": "Subj",
        "text": "Hello",
    }


def test_build_email_sender_uses_resend_when_key_set(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "abc")
    monkeypatch.setenv("EMAIL_FROM", "X <x@y.com>")
    assert isinstance(build_email_sender(), ResendEmailSender)


def test_build_email_sender_falls_back_to_logging(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert isinstance(build_email_sender(), LoggingEmailSender)
