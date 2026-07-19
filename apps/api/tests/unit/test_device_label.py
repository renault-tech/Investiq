"""Unit tests for parse_device_label — the "Browser em OS" heuristic used
to make the /auth/sessions list human-readable."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from src.auth.service import parse_device_label


def test_chrome_windows():
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36"
    assert parse_device_label(ua) == "Chrome em Windows"


def test_safari_iphone():
    ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    assert parse_device_label(ua) == "Safari em iOS"


def test_firefox_linux():
    ua = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0"
    assert parse_device_label(ua) == "Firefox em Linux"


def test_edge_windows():
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36 Edg/115.0"
    assert parse_device_label(ua) == "Edge em Windows"


def test_chrome_android():
    ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Mobile Safari/537.36"
    assert parse_device_label(ua) == "Chrome em Android"


def test_safari_macos():
    ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15"
    assert parse_device_label(ua) == "Safari em macOS"


def test_none_falls_back_to_unknown():
    assert parse_device_label(None) == "Dispositivo desconhecido"


def test_empty_string_falls_back_to_unknown():
    assert parse_device_label("") == "Dispositivo desconhecido"
