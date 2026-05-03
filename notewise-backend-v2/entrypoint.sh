#!/bin/bash
set -e

echo "Waiting for database..."
python -c "
import time, os
from sqlalchemy import create_engine, text
engine = create_engine(os.environ['DATABASE_URL'])
for i in range(30):
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('Database ready')
        break
    except Exception as e:
        print(f'Waiting... ({i+1}/30)')
        time.sleep(2)
else:
    raise Exception('Database not reachable after 60s')
"

alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000