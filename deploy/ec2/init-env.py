"""Run once on the Linux server. Never prints secrets or overwrites existing keys."""
from pathlib import Path
import base64, os, secrets, subprocess, tempfile
root = Path(__file__).resolve().parents[2]
target = root / '.env.ec2'
if target.exists():
    raise SystemExit('.env.ec2 already exists; retain its passwords and signing keys.')
with tempfile.TemporaryDirectory() as folder:
    private, public = Path(folder)/'private.pem', Path(folder)/'public.pem'
    subprocess.run(['openssl', 'genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', str(private)], check=True, capture_output=True)
    subprocess.run(['openssl', 'pkey', '-in', str(private), '-pubout', '-out', str(public)], check=True, capture_output=True)
    values = dict(DB_PASSWORD=secrets.token_hex(24), MYSQL_ROOT_PASSWORD=secrets.token_hex(24), INTERNAL_KEY=secrets.token_hex(32), JWT_PRIVATE_KEY_BASE64=base64.b64encode(private.read_bytes()).decode(), JWT_PUBLIC_KEY_BASE64=base64.b64encode(public.read_bytes()).decode())
text = (root/'deploy/ec2/.env.example').read_text()
for key,value in values.items():
    text = text.replace(key+'=GENERATE_ME', key+'='+value)
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(text)
print('Created .env.ec2. Edit SITE_ADDRESS, S3 bucket/region and OPENAI_API_KEY locally on the server.')
