#!/bin/bash
pip install --upgrade pip setuptools wheel

npm run start &
cd python-service && uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload