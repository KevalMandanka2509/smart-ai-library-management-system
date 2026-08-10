from app.main import app

def get_routes(app_or_router, prefix=""):
    routes = []
    for r in getattr(app_or_router, "routes", []):
        if hasattr(r, "methods"):
            routes.append(f"{','.join(r.methods)} {prefix}{r.path}")
        elif hasattr(r, "routes"): # Sub-router or Mount
            routes.extend(get_routes(r, prefix + getattr(r, "path", "")))
    return routes

for route in sorted(set(get_routes(app))):
    print(route)
