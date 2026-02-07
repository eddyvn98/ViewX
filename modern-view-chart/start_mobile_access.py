import subprocess
import threading
import time
import re
import os
import sys
import json

# sys.stdout.reconfigure(encoding='utf-8') - Removed as it might cause issues

frontend_url = None
backend_url = None

def run_tunnel(port, type_name):
    global frontend_url, backend_url
    
    if not os.path.exists("cloudflared.exe"):
        print(f"[{type_name}] ERROR: cloudflared.exe not found")
        return

    cmd = ["cloudflared.exe", "tunnel", "--protocol", "http2", "--url", f"http://localhost:{port}"]
    
    try:
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            text=True, 
            bufsize=1,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
            encoding='utf-8', 
            errors='replace'
        )
        
        print(f"[{type_name}] Starting Tunnel for port {port}...")
        
        for line in process.stdout:
            if "trycloudflare.com" in line and ".tgz" not in line:
                match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
                if match:
                    url = match.group(0)
                    if type_name == "FRONTEND":
                        frontend_url = url
                    else:
                        backend_url = url
                    
                    print(f"[{type_name}] Acquired Link: {url}")
                    
                    if frontend_url and backend_url:
                        save_access_info()
                        
    except Exception as e:
        print(f"[{type_name}] Error: {e}")

def save_access_info():
    time.sleep(1)
    
    ws_url = backend_url.replace("https://", "wss://")
    final_link = f"{frontend_url}?mobile=1&ws_url={ws_url}"
    
    data = {
        "frontend": frontend_url,
        "backend": backend_url,
        "mobile_link": final_link,
        "updated_at": time.time()
    }
    
    # Write to public folder so Frontend can fetch it
    public_path = os.path.join(os.getcwd(), "public", "mobile-access.json")
    try:
        with open(public_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        print(f"✅ Generated mobile access config: {public_path}")
        
        # Also write to a text file for easy reading
        with open("mobile_link.txt", "w", encoding="utf-8") as f:
            f.write(final_link)
    except Exception as e:
        print(f"❌ Error writing config: {e}")

    print("\n" + "="*60)
    print("MOBILE TRADING ACCESS READY!")
    print(f"Link: {final_link}")
    print("="*60 + "\n")

if __name__ == "__main__":
    print("Initializing 2 Cloudflare Tunnels...")
    
    t1 = threading.Thread(target=run_tunnel, args=(3000, "FRONTEND"))
    t2 = threading.Thread(target=run_tunnel, args=(8091, "BACKEND"))

    t1.daemon = True
    t2.start()
    time.sleep(1) # Stagger starts
    t1.start()

    try:
        # Instead of while True, use a counter to detect if threads are still alive
        while True:
            time.sleep(5)
            # If both links are acquired, we can stay alive or exit if everything is handled by threads
            # But the tunnels need the process to stay alive if cloudflared is a child.
            # subprocess.Popen creates a child, so as long as this script lives, children live.
    except (KeyboardInterrupt, SystemExit):
        print("\nStopping Tunnels...")

