import logging
import os

import httpx

logger = logging.getLogger("caloriessnap.email")

RESEND_API_URL = "https://api.resend.com/emails"
DEFAULT_FROM = "CaloriesSnap <noreply@caloriessnap.app>"


class EmailSender:
    def send(self, to: str, subject: str, body: str) -> None:
        raise NotImplementedError


class LoggingEmailSender(EmailSender):
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send(self, to: str, subject: str, body: str) -> None:
        self.sent.append({"to": to, "subject": subject, "body": body})
        logger.info("EMAIL (not sent) to=%s subject=%s body=%s", to, subject, body)


class ResendEmailSender(EmailSender):
    def __init__(self, api_key: str, sender: str) -> None:
        self.api_key = api_key
        self.sender = sender

    def send(self, to: str, subject: str, body: str) -> None:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            json={"from": self.sender, "to": [to], "subject": subject, "text": body},
            timeout=10.0,
        )
        resp.raise_for_status()


def build_email_sender() -> EmailSender:
    api_key = os.environ.get("RESEND_API_KEY")
    sender = os.environ.get("EMAIL_FROM", DEFAULT_FROM)
    if api_key:
        return ResendEmailSender(api_key, sender)
    return LoggingEmailSender()
