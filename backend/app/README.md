# Football Merchant 

This project is a FastAPI-based backend designed to fetch football match data, generate statistical predictions, and provide AI-powered commentary for upcoming games. It serves as the data and intelligence layer for a football analytics application.

## Features

-   **Data Synchronization**: Fetches comprehensive match, team, and player statistics from [Understat](https://understat.com/).
-   **League Table**: Provides an up-to-date league table sorted by points and goal difference.
-   **Match Predictions**: Generates algorithmic predictions for upcoming matches based on historical data.
-   **AI Commentary**: Leverages an AI model to create human-like commentary and analysis for specific matches.
-   **RESTful API**: Exposes a clean API for consumption by a frontend application.

## Tech Stack

-   **Backend**: Python, FastAPI
-   **Database ORM**: SQLAlchemy
-   **HTTP Client**: Requests
-   **CORS**: `fastapi.middleware.cors` for frontend integration.

## Project Structure

The backend application is organized as follows:

```
backend/
└── app/
    ├── __init__.py
    ├── main.py             # FastAPI application, routes, and middleware
    ├── services.py         # Data fetching (Understat) and processing logic
    ├── models.py           # SQLAlchemy database models
    ├── database.py         # Database engine and session management
    ├── analysis.py         # Algorithmic prediction generation
    └── ai.py               # AI-powered commentary generation
```

## API Endpoints

The following endpoints are available.

### Public Endpoints

-   `GET /table`
    -   **Description**: Returns the full league table, sorted by points and goal difference.
    -   **Response**: A JSON array of team objects.

-   `GET /matches`
    -   **Description**: Returns a list of upcoming (not finished) matches, including prediction data if available.
    -   **Response**: A JSON array of match objects formatted for frontend display.

### Admin & Analysis Endpoints

These endpoints are used to trigger data processing and analysis tasks. They should ideally be protected.

-   `POST /sync-data`
    -   **Description**: Triggers a full data synchronization from Understat. It fetches match, team, and player data for the configured season and updates the database.

-   `POST /update-logos`
    -   **Description**: Updates the `logo_url` for each team in the database based on a hardcoded mapping in `services.py`.

-   `POST /run-algo`
    -   **Description**: Runs the prediction algorithm (defined in `analysis.py`) on upcoming matches and stores the results in the database.

-   `POST /analyze/{match_id}`
    -   **Description**: Generates (or retrieves from cache) detailed AI-powered commentary for a specific match. It first ensures an algorithmic prediction exists.

## Workflow

1.  **Data Ingestion**: Periodically call `POST /sync-data` to keep the database updated with the latest results and fixtures.
2.  **Prediction Generation**: After syncing data, call `POST /run-algo` to generate predictions for new upcoming matches.
3.  **Frontend Consumption**: A client application can now fetch data from `GET /table` and `GET /matches` to display to the user.
4.  **Detailed Analysis**: To get AI commentary for a specific match, the client can trigger a call to `POST /analyze/{match_id}`.
