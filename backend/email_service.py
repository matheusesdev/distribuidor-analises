import base64
import datetime
import hashlib
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app_core.config import (
    FRONTEND_URL, RESET_TOKEN_TTL_MINUTES,
    SMTP_FROM, SMTP_HOST, SMTP_PASS, SMTP_PORT,
    SMTP_TIMEOUT_SECONDS, SMTP_USE_SSL, SMTP_USE_TLS, SMTP_USER,
)
from app_core.logging_setup import logger


def generate_reset_token():
    raw = os.urandom(32)
    plain = base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")
    return plain, hashlib.sha256(plain.encode("utf-8")).hexdigest()


def send_reset_email(to_email: str, reset_link: str, analyst_name: str) -> bool:
    if not SMTP_HOST or not SMTP_FROM:
        logger.warning("[SMTP] SMTP nao configurado para %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Redefinicao de senha - VCACloud"
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        text_body = "Ola, " + analyst_name + "!\n\nLink (valido por " + str(RESET_TOKEN_TTL_MINUTES) + " min): " + reset_link + "\n\nVCA Construtora"
        year = str(datetime.datetime.now().year)
        html_body = "<html><body><div style='font-family:Arial'><h2>VCACloud</h2><p>Ola, " + analyst_name + "!</p><a href='" + reset_link + "' style='background:#2563eb;color:white;padding:12px;border-radius:8px;text-decoration:none'>Redefinir senha</a><p style='color:#999'>Valido por " + str(RESET_TOKEN_TTL_MINUTES) + " minutos. VCA Construtora (c) " + year + "</p></div></body></html>"
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        smtp_client = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
        with smtp_client(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT_SECONDS) as server:
            server.ehlo()
            if SMTP_USE_TLS and not SMTP_USE_SSL:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, [to_email], msg.as_string())
        return True
    except Exception as e:
        logger.error("[SMTP] Falha ao enviar e-mail: %s", e)
        return False