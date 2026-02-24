import json
import os
import re
import subprocess
import threading
import time
from urllib.parse import urlencode

frontend_url = None
backend_url = None
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_access_token():
    env_token = (os.getenv("ACCESS_TOKEN") or "").strip()
    if env_token:
        return env_token

    env_path = os.path.join(BASE_DIR, ".env")
    if not os.path.exists(env_path):
        return ""

    try:
        with open(env_path, "r", encoding="utf-8") as file_obj:
            for line in file_obj:
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                if key.strip() == "ACCESS_TOKEN":
                    return value.strip().strip("\"'")
    except Exception as exc:
        print(f"[TUNNEL] Warning: failed to parse .env for ACCESS_TOKEN: {exc}")

    return ""


ACCESS_TOKEN = load_access_token()


def run_tunnel(port, type_name):
    global frontend_url, backend_url

    cloudflared_path = os.path.join(BASE_DIR, "cloudflared.exe")
    if not os.path.exists(cloudflared_path):
        print(f"[{type_name}] ERROR: cloudflared.exe not found at {cloudflared_path}")
        return

    cmd = [cloudflared_path, "tunnel", "--protocol", "http2", "--url", f"http://localhost:{port}"]

    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            encoding="utf-8",
            errors="replace",
        )

        print(f"[{type_name}] Starting tunnel for port {port}...")

        for line in process.stdout:
            if "trycloudflare.com" in line and ".tgz" not in line:
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
                if not match:
                    continue

                url = match.group(0)
                if type_name == "FRONTEND":
                    frontend_url = url
                else:
                    backend_url = url

                print(f"[{type_name}] Acquired link: {url}")

                if frontend_url and backend_url:
                    save_access_info()

    except Exception as exc:
        print(f"[{type_name}] Error: {exc}")


def save_access_info():
    time.sleep(1)

    ws_url = backend_url.replace("https://", "wss://")
    if ACCESS_TOKEN:
        ws_url = f"{ws_url}?{urlencode({'access_token': ACCESS_TOKEN})}"

    params = {"mobile": "1", "ws_url": ws_url}
    if ACCESS_TOKEN:
        params["access_token"] = ACCESS_TOKEN
    final_link = f"{frontend_url}?{urlencode(params)}"

    data = {
        "frontend": frontend_url,
        "backend": backend_url,
        "mobile_link": final_link,
        "ws_url": ws_url,
        "access_token_configured": bool(ACCESS_TOKEN),
        "updated_at": time.time(),
    }

    public_path = os.path.join(BASE_DIR, "public", "mobile-access.json")
    mobile_link_path = os.path.join(BASE_DIR, "mobile_link.txt")

    try:
        with open(public_path, "w", encoding="utf-8") as file_obj:
            json.dump(data, file_obj, indent=2)

        with open(mobile_link_path, "w", encoding="utf-8") as file_obj:
            file_obj.write(final_link)

        print(f"[TUNNEL] Wrote mobile access config: {public_path}")
        print(f"[TUNNEL] Wrote mobile link: {mobile_link_path}")
    except Exception as exc:
        print(f"[TUNNEL] Error writing config: {exc}")

    print("\n" + "=" * 60)
    print("MOBILE TRADING ACCESS READY")
    print(f"Link: {final_link}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    print("Initializing 2 Cloudflare tunnels...")
    if not ACCESS_TOKEN:
        print("[TUNNEL] WARNING: ACCESS_TOKEN is missing. Public API/WS calls will fail.")

    thread_frontend = threading.Thread(target=run_tunnel, args=(3000, "FRONTEND"), daemon=True)
    thread_backend = threading.Thread(target=run_tunnel, args=(8091, "BACKEND"), daemon=True)

    thread_backend.start()
    time.sleep(1)
    thread_frontend.start()

    try:
        while True:
            time.sleep(5)
    except (KeyboardInterrupt, SystemExit):
        print("\nStopping tunnels...")
