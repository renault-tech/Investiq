import os
import re
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.fernet import Fernet

def fix_env():
    pk = rsa.generate_private_key(65537, 2048)
    priv = pk.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode().strip()
    pub = pk.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode().strip()
    fk = Fernet.generate_key().decode()

    env_path = ".env"
    if not os.path.exists(env_path):
        return

    content = open(env_path, "r", encoding="utf-8").read()
    
    # Substitui preservando as aspas da string literal
    content = re.sub(r'JWT_PRIVATE_KEY=".*?"', f'JWT_PRIVATE_KEY="{priv}"', content, flags=re.DOTALL)
    content = re.sub(r'JWT_PUBLIC_KEY=".*?"', f'JWT_PUBLIC_KEY="{pub}"', content, flags=re.DOTALL)
    
    # Se estivesse salvando com "..."
    content = re.sub(r'JWT_PRIVATE_KEY=.*?(?=JWT_PUBLIC_KEY=)', f'JWT_PRIVATE_KEY="{priv}"\n', content, flags=re.DOTALL)
    content = re.sub(r'JWT_PUBLIC_KEY=.*?(?=ENCRYPTION_KEY=)', f'JWT_PUBLIC_KEY="{pub}"\n', content, flags=re.DOTALL)
    content = re.sub(r'ENCRYPTION_KEY=.*?\n', f'ENCRYPTION_KEY={fk}\n', content)

    open(env_path, "w", encoding="utf-8").write(content)
    print("CHAVES CRIPTOGRÁFICAS GERADAS COM SUCESSO!")

if __name__ == "__main__":
    fix_env()
