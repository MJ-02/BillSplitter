from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import users, orders, splits

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Bill Splitter API", version="1.0.0")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(splits.router, prefix="/api/splits", tags=["splits"])

@app.get("/")
def read_root():
    return {"message": "Bill Splitter API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
