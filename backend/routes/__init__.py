from routes.auth import router as auth_router
from routes.manager_auth import router as manager_auth_router
from routes.manager_panel import router as manager_panel_router
from routes.manager_analysts import router as manager_analysts_router
from routes.analyst_actions import router as analyst_actions_router
from routes.analyst_data import router as analyst_data_router
from routes.workflow import router as workflow_router
from routes.suggestions import router as suggestions_router

all_routers = [
    auth_router,
    manager_auth_router,
    manager_panel_router,
    manager_analysts_router,
    analyst_actions_router,
    analyst_data_router,
    workflow_router,
    suggestions_router,
]