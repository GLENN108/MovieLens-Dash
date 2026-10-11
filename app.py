from __future__ import annotations

import io
import json
import re
import threading
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "DATA"
DATASET_URL = "https://files.grouplens.org/datasets/movielens/ml-1m.zip"
PORT = 8000
REQUIRED_FILES = ("movies.dat", "ratings.dat")

_cache_lock = threading.Lock()
_cached_signature: tuple[tuple[int, int], ...] | None = None
_cached_data: dict[str, Any] | None = None


def find_data_dir() -> Path | None:
    for candidate in (DATA_DIR, DATA_DIR / "ml-1m"):
        if all((candidate / name).is_file() for name in REQUIRED_FILES):
            return candidate
    return None


def download_dataset() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(
        DATASET_URL, headers={"User-Agent": "MovieLens-Dashboard/1.0"}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        archive_bytes = response.read()

    targets = {
        "ml-1m/movies.dat": DATA_DIR / "movies.dat",
        "ml-1m/ratings.dat": DATA_DIR / "ratings.dat",
    }
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        for archive_name, destination in targets.items():
            try:
                contents = archive.read(archive_name)
            except KeyError as error:
                raise RuntimeError(
                    f"The MovieLens archive is missing {archive_name}."
                ) from error
            destination.write_bytes(contents)

    return DATA_DIR


def _read_movies(path: Path) -> tuple[dict[int, dict[str, Any]], dict[str, int]]:
    movies: dict[int, dict[str, Any]] = {}
    genre_movie_counts: dict[str, int] = defaultdict(int)
    with path.open("r", encoding="latin-1") as source:
        for line_number, line in enumerate(source, start=1):
            parts = line.rstrip("\r\n").split("::", 2)
            if len(parts) != 3:
                raise ValueError(f"Invalid movie row at {path}:{line_number}.")
            try:
                movie_id = int(parts[0])
            except ValueError as error:
                raise ValueError(
                    f"Invalid movie ID at {path}:{line_number}."
                ) from error
            title, raw_genres = parts[1], parts[2]
            year_match = re.search(r"\((\d{4})\)\s*$", title)
            genres = [] if raw_genres == "(no genres listed)" else raw_genres.split("|")
            movies[movie_id] = {
                "id": movie_id,
                "title": title,
                "year": int(year_match.group(1)) if year_match else None,
                "genres": genres,
                "ratingCount": 0,
                "ratingSum": 0.0,
            }
            for genre in genres:
                genre_movie_counts[genre] += 1
    return movies, genre_movie_counts


def load_dataset(data_dir: Path) -> dict[str, Any]:
    global _cached_data, _cached_signature
    movie_path = data_dir / "movies.dat"
    ratings_path = data_dir / "ratings.dat"
    signature = tuple(
        (path.stat().st_mtime_ns, path.stat().st_size)
        for path in (movie_path, ratings_path)
    )
    with _cache_lock:
        if signature == _cached_signature and _cached_data is not None:
            return _cached_data

        movies, genre_movie_counts = _read_movies(movie_path)
        rating_histogram: dict[str, int] = defaultdict(int)
        ratings_by_year: dict[int, int] = defaultdict(int)
        release_years: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0])
        genre_ratings: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
        users: set[int] = set()
        total_rating_sum = 0.0
        total_ratings = 0

        with ratings_path.open("r", encoding="ascii") as source:
            for line_number, line in enumerate(source, start=1):
                parts = line.rstrip("\r\n").split("::")
                if len(parts) != 4:
                    raise ValueError(f"Invalid rating row at {ratings_path}:{line_number}.")
                try:
                    user_id, movie_id = int(parts[0]), int(parts[1])
                    rating, timestamp = float(parts[2]), int(parts[3])
                except ValueError as error:
                    raise ValueError(
                        f"Invalid rating value at {ratings_path}:{line_number}."
                    ) from error
                movie = movies.get(movie_id)
                if movie is None:
                    continue

                users.add(user_id)
                total_ratings += 1
                total_rating_sum += rating
                movie["ratingCount"] += 1
                movie["ratingSum"] += rating
                rating_histogram[f"{rating:g}"] += 1
                rating_year = datetime.fromtimestamp(
                    timestamp, tz=timezone.utc
                ).year
                ratings_by_year[rating_year] += 1
                if movie["year"] is not None:
                    release_year_stats = release_years[movie["year"]]
                    release_year_stats[0] += rating
                    release_year_stats[1] += 1
                for genre in movie["genres"]:
                    genre_stats = genre_ratings[genre]
                    genre_stats[0] += rating
                    genre_stats[1] += 1

        movie_list = []
        for movie in movies.values():
            count = movie.pop("ratingCount")
            rating_sum = movie.pop("ratingSum")
            movie["ratingCount"] = count
            movie["averageRating"] = round(rating_sum / count, 2) if count else 0
            movie_list.append(movie)
        movie_list.sort(key=lambda item: item["title"].casefold())

        year_stats = [
            {
                "year": year,
                "averageRating": round(total / count, 2),
                "ratingCount": int(count),
            }
            for year, (total, count) in sorted(release_years.items())
            if count
        ]
        decades: dict[int, list[float]] = defaultdict(lambda: [0.0, 0.0])
        for item in year_stats:
            decade = (item["year"] // 10) * 10
            decades[decade][0] += item["averageRating"] * item["ratingCount"]
            decades[decade][1] += item["ratingCount"]
        genre_stats_list = [
            {
                "genre": genre,
                "movieCount": genre_movie_counts[genre],
                "ratingCount": int(stats[1]),
                "averageRating": round(stats[0] / stats[1], 2) if stats[1] else 0,
            }
            for genre, stats in genre_ratings.items()
        ]
        genre_stats_list.sort(key=lambda item: item["ratingCount"], reverse=True)
        data = {
            "stats": {
                "totalRatings": total_ratings,
                "totalMovies": len(movies),
                "totalUsers": len(users),
                "averageRating": round(total_rating_sum / total_ratings, 2)
                if total_ratings
                else 0,
            },
            "movies": movie_list,
            "ratingDistribution": [
                {"rating": float(value), "count": rating_histogram.get(value, 0)}
                for value in ("0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5")
            ],
            "ratingsByYear": [
                {"year": year, "count": count}
                for year, count in sorted(ratings_by_year.items())
            ],
            "genres": genre_stats_list,
            "ratingsByReleaseYear": year_stats,
            "ratingsByDecade": [
                {
                    "decade": decade,
                    "averageRating": round(total / count, 2),
                    "ratingCount": int(count),
                }
                for decade, (total, count) in sorted(decades.items())
                if count
            ],
            "topMovies": sorted(
                (movie.copy() for movie in movie_list),
                key=lambda item: item["ratingCount"],
                reverse=True,
            )[:10],
        }
        _cached_signature, _cached_data = signature, data
        return data


class DashboardHandler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self._send(status, body, "application/json; charset=utf-8")

    def do_GET(self) -> None:
        if self.path == "/api/status":
            data_dir = find_data_dir()
            self._json(
                200,
                {
                    "ready": data_dir is not None,
                    "source": "MovieLens 1M",
                    "dataDirectory": str(data_dir or DATA_DIR),
                },
            )
            return
        if self.path == "/api/data":
            data_dir = find_data_dir()
            if data_dir is None:
                self._json(
                    404,
                    {"error": "MovieLens data is missing. Download the dataset first."},
                )
                return
            try:
                self._json(200, load_dataset(data_dir))
            except (OSError, ValueError, RuntimeError) as error:
                self._json(500, {"error": f"Could not load MovieLens data: {error}"})
            return

        file_name = {
            "/": "index.html",
            "/index.html": "index.html",
            "/styles.css": "styles.css",
            "/app.js": "app.js",
        }.get(self.path)
        if file_name is None:
            self._json(404, {"error": "Not found."})
            return
        content_type = "text/html; charset=utf-8" if file_name.endswith(".html") else (
            "text/css; charset=utf-8" if file_name.endswith(".css") else
            "text/javascript; charset=utf-8"
        )
        try:
            self._send(200, (ROOT / file_name).read_bytes(), content_type)
        except OSError as error:
            self._json(500, {"error": f"Could not read {file_name}: {error}"})

    def do_POST(self) -> None:
        if self.path != "/api/download":
            self._json(404, {"error": "Not found."})
            return
        if find_data_dir() is not None:
            self._json(200, {"message": "MovieLens data is already available."})
            return
        try:
            download_dataset()
        except (OSError, urllib.error.URLError, zipfile.BadZipFile, RuntimeError) as error:
            self._json(502, {"error": f"Could not download MovieLens 1M: {error}"})
            return
        self._json(200, {"message": "MovieLens 1M downloaded successfully."})

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DashboardHandler)
    print(f"MovieLens dashboard running at http://127.0.0.1:{PORT}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
