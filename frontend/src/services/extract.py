import os
import re

for root, _, files in os.walk('frontend/src/services'):
    for file in files:
        if file.endswith('.js'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            for m in re.finditer(r'api\.(get|post|put|delete)\(([\'\"\`])([^\'\"\`\?]+)([\'\"\`])', content):
                print(f'{m.group(1).upper()} {m.group(3)}')
