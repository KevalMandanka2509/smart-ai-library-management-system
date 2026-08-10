from app.main import app
import re

routes = []
for route in app.routes:
    if hasattr(route, 'methods'):
        methods = ",".join(route.methods)
        routes.append(f"{methods} {route.path}")

for r in sorted(set(routes)):
    print(r)
