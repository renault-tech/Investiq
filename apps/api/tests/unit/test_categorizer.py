"""Unit: normalizador de descrição bancária (merchant_key)."""
from src.finance.categorizer import merchant_key


def test_strips_card_purchase_prefix_card_number_and_acquirer_suffix():
    assert merchant_key("COMPRA CARTAO 1234 IFOOD *IFD") == "IFOOD"


def test_strips_pix_prefix_and_date_keeps_recipient_name():
    assert merchant_key("PIX ENVIADO 12/03 JOAO S") == "JOAO S"


def test_strips_generic_tariff_prefix():
    assert merchant_key("TARIFA PACOTE SERVICOS") == "PACOTE SERVICOS"


def test_case_and_accent_insensitive():
    assert merchant_key("compra cartão ifood") == merchant_key("COMPRA CARTAO IFOOD")


def test_empty_description_yields_empty_key():
    assert merchant_key("") == ""
    assert merchant_key(None) == ""  # type: ignore[arg-type]


def test_two_transactions_at_the_same_merchant_produce_the_same_key():
    a = merchant_key("COMPRA CARTAO 5566 NETFLIX.COM")
    b = merchant_key("COMPRA CARTAO 7788 NETFLIX.COM")
    assert a == b == "NETFLIX.COM"
