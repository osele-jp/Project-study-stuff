# AI Research Study

## Firebase setup

1. Create a Firebase project and enable Cloud Firestore.
2. Create a service account under Firebase/Google Cloud IAM.
3. Download its JSON key outside this repository.
4. Configure the backend:

```bash
cd backend
cp .env.example .env
```

Set these values in `backend/.env`:

- `FIREBASE_PROJECT_ID`: Firebase project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: absolute path to the service-account JSON
- `GOOGLE_API_KEY`: Gemini API key

## Backend

```bash
cd backend
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host localhost --port 8000
```

API documentation: `http://localhost:8000/docs`

## Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Production frontend build

```bash
cd frontend
npm run build
```
