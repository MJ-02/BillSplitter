# Bill Splitter APP

I built this app to solve the issue of keeping track of who owes who when we order food at work. The basic vision is that we add all the people in our office and their contact details. We upload a reciept which could be a screenshot from a food delivery app. Extract Items and prices and map them to their respictive users. Now every one can get a text message reminding them of who they owe for what.

## Tech Stack

- **Frontend**: Next.js 16 with TypeScript and Tailwind CSS 4 (This is vibe coded AF, but I did use bun so give me some props)
- **Backend**: FastAPI
- **Database**: PostgreSQL
- **OCR**: Surya OCR
- **AI Parsing**: Local LLM via LM Studio (localhost:1234)
- **Storage**: MinIO (S3-compatible) (Could alternatively use Garage or S3 directly)

## Prerequisites

- Python 3.9+
- Bun (for frontend)
- Docker & Docker Compose
- LM Studio (for local LLM)

## Quick Start

### 1. Start Infrastructure Services

Start PostgreSQL and MinIO using Docker Compose:

```bash
docker-compose up -d
```

### 2. Start LM Studio

Im using LM studio but anything with an OpenAI compatible endpoint could work.
1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load a model (recommend: Mistral 7B or similar)
3. Start the local server on port 1234

### 3. Setup and Start Backend

```bash
cd backend
uv sync
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The backend will be available at http://localhost:8000

### 4. Setup and Start Frontend

```bash
cd frontend
bun install
bun dev
```

The frontend will be available at http://localhost:3000

## Testing the MVP

### 1. Test User Management

1. Navigate to http://localhost:3000/users
2. Click "Add User"
3. Add test users (e.g., John, Jane, Bob)
4. Verify CRUD operations work

### 2. Test Receipt Upload & OCR

1. Navigate to http://localhost:3000
2. Upload a test receipt image
3. Verify OCR extracts text correctly
4. Verify AI parsing returns structured data

### 3. Test Manual Correction

1. After uploading a receipt, click "Edit"
2. Modify restaurant name, items, and prices
3. Add/remove items
4. Click "Save" and verify changes persist

## API Endpoints

### Users
- `GET /api/users` - List all users
- `POST /api/users` - Create a user
- `GET /api/users/{id}` - Get a user
- `PUT /api/users/{id}` - Update a user
- `DELETE /api/users/{id}` - Delete a user

### Orders
- `GET /api/orders` - List all orders
- `POST /api/orders` - Create an order
- `GET /api/orders/{id}` - Get an order
- `DELETE /api/orders/{id}` - Delete an order
- `POST /api/orders/upload-receipt` - Upload and process receipt

## Project Structure

```
Bill Splitter/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── database.py          # Database configuration
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── routers/             # API route handlers
│   │   ├── users.py
│   │   └── orders.py
│   └── services/            # Business logic
│       ├── ocr_service.py   # Surya OCR integration
│       ├── llm_service.py   # LLM parsing
│       └── storage_service.py # S3 storage
├── frontend/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── page.tsx         # Home page (receipt upload)
│   │   ├── users/           # User management
│   │   ├── orders/          # Order list
│   │   └── components/      # React components
│   └── .env.local
└── docker-compose.yml       # Infrastructure services
```

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/billsplitter
LLM_API_URL=http://localhost:1234/v1/chat/completions
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=receipts
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Troubleshooting

### OCR Issues
- Ensure image is clear and well-lit
- Supported formats: JPG, PNG, JPEG
- Max file size: 10MB

### LLM Connection Issues
- Verify LM Studio is running on localhost:1234
- Check that a model is loaded
- Test endpoint: `curl http://localhost:1234/v1/models`

### Database Connection Issues
- Verify PostgreSQL is running: `docker-compose ps`
- Check connection: `psql postgresql://user:password@localhost:5432/billsplitter`

### S3 Storage Issues
- Verify MinIO is running: `docker-compose ps`
- Access MinIO Console: http://localhost:9001 (minioadmin/minioadmin)

## Known Limitations (MVP)

- No authentication/authorization
- No bill splitting logic yet (Phase 2)
- No SMS/WhatsApp notifications yet (Phase 3)
- Manual LLM prompt adjustment may be needed for different receipt formats
- No persistent storage for parsed receipts (in progress)

## License

Idk just use it ig