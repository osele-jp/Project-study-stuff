import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")


def get_firestore():
    if not firebase_admin._apps:
        credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        project_id = os.getenv("FIREBASE_PROJECT_ID")
        options = {"projectId": project_id} if project_id else None

        if credential_path:
            credential = credentials.Certificate(credential_path)
            firebase_admin.initialize_app(credential, options=options)
        else:
            firebase_admin.initialize_app(options=options)

    return firestore.client()
