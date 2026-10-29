DAYFEEL: EC2 DEPLOYMENT, STEP BY STEP

This guide follows the deployment we used: Ubuntu, t3.medium, a 30 GB disk,
Docker Compose, S3, and OpenAI. It starts with a new instance and ends with
sample accounts, working AI, profile pictures, and stop/start instructions.
The app, MySQL, MongoDB, and Kafka run in separate containers on one server.
Local database records are NOT automatically copied to EC2.

WHERE TO TYPE
- AWS CONSOLE: your browser, signed into AWS.
- LAPTOP POWERSHELL: Windows Terminal on your laptop.
- EC2 TERMINAL: the Ubuntu terminal after connecting with SSH.
Replace YOUR_PUBLIC_IP and YOUR_BUCKET with your actual values.
Never paste passwords, API keys, private keys, or full signed URLs into chat.

1. CREATE THE EC2 INSTANCE (AWS CONSOLE)

Open EC2 > Instances > Launch instances.
- Name: dayfeel-demo
- OS: Ubuntu Server 24.04 LTS, 64-bit x86 (not ARM).
- Instance type: t3.medium (2 vCPUs, 4 GiB RAM) for a small demo.
  Nano is too small for this complete stack. More users may need more RAM.
- Key pair: create dayfeel-key, RSA, .pem. Save it to C:\Users\cvalencia022\OneDrive - PwC\Downloads\dayfeel-key.pem.
  Keep the key outside your project and never upload it with your source.
- Network: public subnet, public IPv4 enabled, Internet Gateway route.
- Security group: SSH 22 from My IP; HTTP 80 and HTTPS 443 from the internet.
  Do not expose 3306, 27017, 9092, 8081, 8082, or 8000.
- Storage: 30 GiB gp3, encrypted. Do not use the default 8 GiB for these builds.
- Advanced details: metadata endpoint enabled, IMDSv2 required, hop limit 2.
- T3 credit specification: Standard avoids surplus CPU-credit charges but may
  throttle when credits run out. This is not a guaranteed free-tier deployment.
Launch, wait for Running and successful status checks, then copy Public IPv4.

2. OPTIONAL: KEEP THE SAME IP (AWS CONSOLE)

EC2 > Elastic IP addresses > Allocate Elastic IP address > Allocate.
Select it > Actions > Associate Elastic IP address > select your instance.
Use this address for all remaining steps, including SSH and S3 CORS.
Elastic IPs are charged while allocated, including while EC2 is stopped.
Without one, your public IP can change after stopping and starting the instance.

3. CREATE S3 STORAGE AND ATTACH AN IAM ROLE (AWS CONSOLE)

S3 > Create bucket. Choose a unique name and note its region.
Keep Block Public Access enabled. Use SSE-S3 (AES256) encryption for this guide.
Existing buckets with mandatory KMS encryption need different permissions/config.

IAM > Roles > Create role > AWS service > EC2. Name: dayfeel-ec2.
Add an inline JSON policy using deploy/ec2/s3-policy.json from this project.
Replace EVERY YOUR_BUCKET occurrence with the actual bucket name. Save it.
EC2 > select instance > Actions > Security > Modify IAM role > dayfeel-ec2.

Check Actions > Instance settings > Modify instance metadata options:
- Metadata service enabled
- IMDSv2 required
- Response hop limit 2 (containers need this to obtain role credentials)
No static AWS access key is needed in .env.ec2.

S3 > your bucket > Permissions > Cross-origin resource sharing (CORS) > Edit.
Use this JSON, replacing YOUR_PUBLIC_IP. Preserve other origins you still use:
[
  {
    "AllowedOrigins": ["http://YOUR_PUBLIC_IP"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
The origin includes http:// and has no trailing slash. Save changes.

4. PACKAGE AND UPLOAD (LAPTOP POWERSHELL)

Go to the project folder (adjust this path if your checkout is elsewhere):
cd "C:\Users\cvalencia022\Documents\Workspaces\Capstone\dayfeel"

Build the ZIP with the existing Python environment:
.\services\ai-service\.venv\Scripts\python.exe scripts\package-ec2.py

If that environment is absent, use an installed Python 3:
python scripts/package-ec2.py

Expected: Created ... dist/dayfeel-ec2.zip.
This ZIP includes the seed script and example configuration, not your real .env.

Upload:
scp -i "C:\Users\cvalencia022\OneDrive - PwC\Downloads\dayfeel-key.pem" .\dist\dayfeel-ec2.zip ubuntu@YOUR_PUBLIC_IP:/home/ubuntu/

Wait for 100%, then connect:
ssh -i "C:\Users\cvalencia022\OneDrive - PwC\Downloads\dayfeel-key.pem" ubuntu@YOUR_PUBLIC_IP

Verify the host fingerprint if prompted. Type yes only for your intended host.
The prompt should now look like ubuntu@ip-...:~$.
If scp says "stat local ... No such file", check your laptop folder/file path.

5. EXTRACT AND INSTALL DOCKER (EC2 TERMINAL)

sudo apt-get update
sudo apt-get install -y unzip
mkdir -p ~/dayfeel
unzip ~/dayfeel-ec2.zip -d ~/dayfeel
cd ~/dayfeel
sudo sh deploy/ec2/install-docker.sh

Check:
sudo docker compose version
free -h
df -h /

Expect approximately 3.7 GiB RAM and a root filesystem near 28 GiB usable.
The installer enables Docker to start automatically on boot.

6. ADD SWAP FOR BUILD HEADROOM (EC2 TERMINAL)

Check first:
swapon --show

If there is no swap AND /swapfile does not already exist, run once:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

Make it persistent (only add the entry once):
sudo nano /etc/fstab

Add this line if absent:
/swapfile none swap sw 0 0

Save: Ctrl+O, Enter. Exit: Ctrl+X.
Check free -h again. Swap is a buffer, not a substitute for sufficient RAM.

7. CONFIGURE THE APPLICATION (EC2 TERMINAL)

cd ~/dayfeel
python3 deploy/ec2/init-env.py
nano .env.ec2

Edit only these external settings initially:
SITE_ADDRESS=:80
OPENAI_API_KEY=YOUR_NEW_VALID_OPENAI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
S3_BUCKET=YOUR_BUCKET
AWS_REGION=YOUR_BUCKET_REGION

SITE_ADDRESS=:80 serves HTTP on any hostname/IP. You still browse to the actual
public IP. It does not update S3 CORS or provide HTTPS.
Use a valid OpenAI API key with available API quota, not a placeholder.
Save with Ctrl+O, Enter; exit with Ctrl+X.

The script generated database passwords, INTERNAL_KEY and persistent JWT keys.
Do not change/regenerate them during routine redeployments. Existing databases
retain their passwords; changing the environment alone does not reset them.
The EC2 configuration is ~/dayfeel/.env.ec2, not your laptop service .env files.

For t3.medium, open:
nano docker-compose.ec2.yml

Under identity > environment add, aligned with its other environment entries:
      JAVA_TOOL_OPTIONS: "-Xms128m -Xmx512m"

Under kafka > environment change its existing heap setting to:
      KAFKA_HEAP_OPTS: "-Xms256m -Xmx512m"

Save and exit. These limits are starting points for a small demo.

8. BUILD ONE SERVICE AT A TIME (EC2 TERMINAL)

Define this shortcut in each new SSH session:
cd ~/dayfeel
dc() { sudo docker compose --env-file .env.ec2 -f docker-compose.ec2.yml "$@"; }

dc config --quiet

No output means validation passed. Do not use plain "config" when sharing
output: it can print expanded secrets.

dc build identity
dc build content
dc build ai
dc build web

Wait for each command to finish before running the next. "Built" followed by
the Ubuntu prompt means done. Maven and npm steps can be quiet for minutes.
If SSH is slow, open another session and check free -h, df -h /, and top.
Do not repeatedly start concurrent builds. Do not delete database volumes.

9. START AND CHECK THE APPLICATION (EC2 TERMINAL)

dc up -d
dc ps -a

MySQL, MongoDB and Kafka should become healthy. kafka-init and kafka-volume-init
normally show Exited (0): they are one-time setup tasks, not failed services.
App containers should stay Up; web may initially show health: starting.

dc logs --tail=80 identity content ai web caddy

AI should show Application startup complete and Uvicorn running on port 8000.
Ctrl+C exits a following log view; it does not stop containers started with -d.

Check local routing:
curl -f http://127.0.0.1:8080/healthz
curl -f http://127.0.0.1:8080/api/content/health
curl -f http://127.0.0.1:8080/api/identity/.well-known/jwks.json

In your laptop browser, open http://YOUR_PUBLIC_IP (not port 8080).
Register a test account and complete onboarding. Databases start empty.

10. CHECK OPENAI (EC2 TERMINAL)

AI health confirms the server, not OpenAI credentials:
dc exec -T content node -e 'fetch("http://ai:8000/health", {signal: AbortSignal.timeout(10000)}).then(async r => console.log(r.status, await r.text())).catch(e => {console.error(e.message); process.exitCode=1;})'

Test provider access; the companion check may use a small number of paid tokens:
dc exec -T ai python - <<'PY'
import os
from openai import OpenAI
client = OpenAI(timeout=25, max_retries=0)
checks = [
    ("Safety screening", lambda: client.moderations.create(model="omni-moderation-latest", input="Hello")),
    ("Companion model", lambda: client.responses.create(model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"), input="Reply with OK.", max_output_tokens=32, store=False)),
]
for name, check in checks:
    try:
        check()
        print(name, "OK")
    except Exception as e:
        print(name, "FAILED", type(e).__name__, "status=", getattr(e, "status_code", None), "code=", getattr(e, "code", None))
PY

Both should say OK. For 401 invalid_api_key, edit OPENAI_API_KEY in .env.ec2:
nano .env.ec2
dc up -d --force-recreate ai

Re-run the test, then send a new companion message in the app.
No image rebuild is needed for an environment-only change.

11. OPTIONAL: IMPORT SAMPLE ACCOUNTS (EC2 TERMINAL)

This creates fictional records, NOT a copy of your laptop database. Reruns add
missing fixtures, preserve existing content, and reapply sample aliases/consent.
Previously imported wording/circle names are not automatically renamed.
Use the same password on reruns if these accounts already exist.

read -s -p "Demo account password: " DEMO_PASSWORD
echo
sudo env DEMO_PASSWORD="$DEMO_PASSWORD" docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec -T -e DEMO_DOCKER=true -e DEMO_PASSWORD content node < services/content-service/scripts/seed-demo.cjs
unset DEMO_PASSWORD

Wait for Seed complete. Stop and diagnose any error before continuing.
The script uses Mongoose's MongoDB driver; no extra package install is needed.
Enable the sample moderator/admin roles:
dc exec -T content cat /tmp/dayfeel-demo-roles.sql > demo-roles.sql
dc exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" mysql -u dayfeel dayfeel_identity' < demo-roles.sql

Sign out/in using your chosen password and one of:
- maya@demo.dayfeel.test       Maya
- leo@demo.dayfeel.test        Leo
- sam@demo.dayfeel.test        Sam
- moderator@demo.dayfeel.test  Guide (moderator after SQL)
- admin@demo.dayfeel.test      Admin (administrator after SQL)

Expect 3 circles, 21 days of check-ins/journals per account, sample posts,
comments, reactions, moderation reports and companion conversations.
These emails remain test identifiers; visible new records have natural names.

12. TEST PROFILE PICTURES AND THE MAIN FEATURES

Upload a small PNG, JPEG or WebP (maximum 5 MiB) in Settings. Confirm it displays.
Test a check-in, journal save, companion reply, and two-user circle chat.
Test reporting/moderation with the sample accounts if imported.

For profile upload/download failures, use browser F12 > Network and inspect the
failed request's status and Response. Share only hostname/path, not signed URL
query parameters, cookies, authorization headers, or secrets.
- /me/avatar-upload 500: check role attachment and metadata hop limit 2 first.
  The current generic Identity handler may not log the underlying exception.
- S3 preflight CORS error: ensure the bucket allows the exact website origin,
  PUT/GET and requested headers. Keep Block Public Access enabled.
- Broken picture after upload: refresh to obtain a new download URL (5-minute
  expiry). Inspect S3's response for AccessDenied, expired signature or missing
  object. Upload permission alone does not guarantee GetObject permission.
- App API 401: sign out/in, then inspect the failing endpoint if it persists.

13. OPTIONAL: HTTPS WITH A DOMAIN

Use a domain you control. Point its DNS A record to your public/Elastic IP.
Remove stale AAAA records if you are not serving IPv6.
Edit .env.ec2 to SITE_ADDRESS=your.actual.domain (no http:// prefix).
dc up -d --force-recreate caddy

With ports 80/443 reachable and DNS correct, Caddy provisions HTTPS.
Update S3 AllowedOrigins to https://your.actual.domain. Use HTTPS for real
credentials/personal data; the earlier HTTP steps are initial demo checks.

14. STOP AND START LATER

AWS console > EC2 > Instance state > Stop instance. Do not choose Terminate.
When you start it again, Docker and running containers normally restart because
the installer enables Docker and services use restart: unless-stopped.
If you manually ran dc stop first, start them again with dc up -d.

Reconnect with the current IP, cd ~/dayfeel, redefine dc from step 8, then:
dc ps -a

If needed:
dc up -d

No rebuild or data import is required. Named volumes survive stop/start.
If the IP changed: use the new IP for browser/SSH/SCP and update S3 CORS.
SITE_ADDRESS=:80 needs no change. An IP-specific SITE_ADDRESS must be updated
followed by dc up -d --force-recreate caddy. Domain users must update DNS.
An associated Elastic IP stays the same.

Stopping compute does not stop all charges: EBS, snapshots, S3 and retained
Elastic IPs can still cost money; OpenAI is billed separately. Check your AWS
credits/pricing. Budget alerts are not a hard spending cap.

15. UPDATES AND BACKUPS

Before updating, back up the persistent disk and retain a private off-server
copy of .env.ec2. For a consistent disk snapshot, schedule downtime, dc stop,
create/wait for an EBS snapshot, then dc up -d. Back up S3 objects separately.
Test restores on an isolated instance, not against the live S3 prefixes.

Package on laptop (step 4), upload again, then on EC2:
cd ~/dayfeel
unzip -o ~/dayfeel-ec2.zip -d ~/dayfeel

The ZIP excludes .env.ec2. It DOES replace Compose/source files: reapply the
small-instance heap settings from step 7 if your new source doesn't include them.
Build services sequentially as in step 8, then dc up -d and verify features.
Never run dc down -v unless you intend to erase the database volumes.
This single-host deployment is for a small demo, not high availability.

16. TROUBLESHOOTING THE ISSUES WE ENCOUNTERED

Disk full / no space left on device:
  df -h /
  lsblk
  In EC2 > Volumes, identify the attached root volume and increase to 30 GiB.
  Snapshot first. For the Ubuntu EXT4 layout we used (/dev/nvme0n1p1 on /):
  sudo growpart /dev/nvme0n1 1
  sudo resize2fs /dev/nvme0n1p1
  df -h /
  Verify device names and filesystem first with lsblk -f; do not copy those
  resize commands onto a different disk/filesystem. Never delete data volumes
  to fix build space. Increasing RAM does not increase disk space.

MYSQL_PASSWORD not set warning:
  In docker-compose.ec2.yml the MySQL healthcheck must use $$MYSQL_PASSWORD.
  Compose turns $$ into a literal $ for the container shell. The .env.ec2
  input is DB_PASSWORD; it maps to MYSQL_PASSWORD inside MySQL.
  Current source contains this fix. Do not reset database passwords to fix it.

AI PermissionError /app/app.py or logo missing after a build:
  Use the current Dockerfiles from this bundle. AI copies app.py with app
  ownership and mode 0644; /app is 0755. Frontend sets built directories 0755
  and files 0644 for Nginx. Rebuild the affected service and dc up -d.
  Keep WORKDIR /app and RUN chmod 0755 /app as separate Dockerfile instructions;
  /appWORKDIR is an accidental pasted-line error, not a valid path.

Blank site / 502 / service restarting:
  dc ps -a
  dc logs --tail=100 web caddy identity content ai mysql mongo kafka
  Check SITE_ADDRESS, security group, free memory/disk and backend health.
  Do not reinitialize MongoDB or erase volumes to force a healthy status.

AI_UNAVAILABLE despite healthy server:
  Run step 10. Health does not check provider credentials/quota. The AI service
  intentionally hides provider exception details from normal responses/logs.

Exit help:
  nano: Ctrl+O, Enter to save; Ctrl+X to exit.
  Followed logs/top: Ctrl+C (top also accepts q).
  MySQL prompt: exit
  SSH terminal: exit (containers started with -d keep running).

REFERENCES
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-new-instances.html
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Stop_Start.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html
https://docs.docker.com/engine/install/ubuntu/
https://caddyserver.com/docs/automatic-https

CONTENT RECOVERY AFTER EC2 STARTUP
The current Content service explicitly exits with code 1 after a startup failure,
even if database/broker connections are still open. Docker's unless-stopped
policy then retries automatically. Logs identify the failing startup stage without
printing credentials. Content's image now has a /health check; Up alone is not
readiness. Docker marks health failures but does not restart solely on unhealthy.
There can still be a brief 502 during boot while dependencies initialize.

To install this fix on an existing server, upload the current
services/content-service/src/server.ts and services/content-service/Dockerfile
into the same paths under ~/dayfeel, then run:
cd ~/dayfeel
sudo docker compose --env-file .env.ec2 -f docker-compose.ec2.yml build content
sudo docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --no-deps --force-recreate content
sudo docker compose --env-file .env.ec2 -f docker-compose.ec2.yml ps content
curl -i http://127.0.0.1:8080/api/content/health

A restart alone does not install source changes. After deployment, verify a real
EC2 stop/start and wait for Content to become healthy, then test mood loading.
Persistent dependency/configuration failures still need diagnosis; see the stage
in Content logs. No database reset or reseeding is needed for this update.
