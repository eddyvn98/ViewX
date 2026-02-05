import os

def check_clean_code(directory):
    violations = []
    for root, dirs, files in os.walk(directory):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.git' in dirs:
            dirs.remove('.git')
            
        for file in files:
            if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
                path = os.path.join(root, file)
                with open(path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    if len(lines) > 200:
                        violations.append(f"{path}: {len(lines)} lines")
    return violations

if __name__ == "__main__":
    current_dir = os.getcwd()
    print(f"--- Đang kiểm tra Clean Code tại: {current_dir} ---")
    results = check_clean_code(current_dir)
    if not results:
        print("Chúc mừng! Không có file nào vượt quá 200 dòng.")
    else:
        print("Các file cần refactor (vượt quá 200 dòng):")
        for v in results:
            print(f" [!] {v}")
