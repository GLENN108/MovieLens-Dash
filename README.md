# MovieLens Data Studio

A small, local MovieLens 1M dashboard made with Python's standard library and plain HTML, CSS, and JavaScript. No Streamlit, package install, API key, or database is required.

## Run it

1. Install Python 3.8 or later.
2. In this folder, run `python app.py`.
3. Open <http://127.0.0.1:8000>.
4. Click **Download MovieLens 1M**. The app downloads the official GroupLens archive and extracts `movies.dat` and `ratings.dat` into `DATA/`.

The first analysis takes a little longer while the million ratings are processed. The results are cached while the data files remain unchanged.

You can also download MovieLens 1M yourself and place `movies.dat` and `ratings.dat` in `DATA/` (or `DATA/ml-1m/`) before starting the app.

## What is inside

- **Overview:** total ratings, movies, users, overall average, rating activity, popular genres, and the 10 most-rated movies.
- **Explore data:** rating distribution, average ratings by genre and release year, rating activity over time, and averages grouped by release decade.
- **Recommendations:** choose up to five movies you like and/or genres you are in the mood for. Genre tags are compared using TF-IDF-weighted cosine similarity; audience rating and rating count help rank close matches.

## A note on tags

The MovieLens 1M dataset includes `movies.dat`, `ratings.dat`, and `users.dat`; it does **not** include `tags.dat`. This dashboard uses the genres in `movies.dat` as selectable tags. MovieLens datasets with user-submitted tags can be added later if you want recommendations based on those.

## Files

```text
app.py          Local web server, dataset download, and data analysis
index.html      Dashboard layout
styles.css      Responsive styling
app.js          Charts, navigation, and recommendations
DATA/           Downloaded MovieLens files (created when you download)
```

MovieLens data is provided by GroupLens Research. The dataset is downloaded from the official GroupLens site when you press the download button.
