# MovieLens EDA & Recommendation System

A complete Streamlit application for exploring MovieLens data and providing movie recommendations.

## Features

### 📊 Dashboard
- Key metrics: Total ratings, movies, users, average rating
- Rating distribution visualization
- Top 10 most-rated movies with average ratings

### 📈 EDA Analysis
- **Temporal Analysis**: Ratings over time
- **Genre Analysis**: Genre popularity and average ratings
- **Year Analysis**: Ratings and average ratings by release year
- **Rating Distribution**: Decade-based analysis

### 🎯 Recommendation System
- **Content-based filtering** using TF-IDF on movie genres
- Find 5-6 similar movies for any selected movie
- Search functionality to browse movies
- Similarity scores for recommendations

## Installation & Setup

### Prerequisites
- Python 3.8+
- pip

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Run the Application
```bash
streamlit run app.py
```

The application will open automatically in your browser at `http://localhost:8501`

## Data Format

The app expects MovieLens data in `.dat` format in the `DATA/` folder:
- `ratings.dat`: userId::movieId::rating::timestamp
- `movies.dat`: movieId::title::genres
- `tags.dat`: userId::movieId::tag::timestamp

## How the Recommendation System Works

The recommendation system uses **content-based filtering** based on movie genres:

1. **Feature Extraction**: Converts genre tags into TF-IDF vectors
2. **Similarity Calculation**: Computes cosine similarity between all movies
3. **Ranking**: Returns the movies with the highest similarity scores

This approach ensures that movies with similar genres are recommended together.

## Updating with 1M Dataset

To use the larger 1M MovieLens dataset:

1. Download the 1M dataset from: https://grouplens.org/datasets/movielens/1m/
2. Extract the `.dat` files to the `DATA/` folder
3. Re-run the app (data will be reloaded)

The app will automatically work with the larger dataset - no code changes needed!

## File Structure
```
bda-rebuild/
├── app.py                 # Main Streamlit application
├── memory.py              # Original analysis script
├── requirements.txt       # Python dependencies
├── README.md              # This file
└── DATA/
    ├── ratings.dat
    ├── movies.dat
    ├── tags.dat
    └── other supporting files
```

## Performance Tips

- The app caches data loading and model building for faster performance
- First run will be slower as it processes all data
- Subsequent selections will be nearly instant

## Future Enhancements

Potential improvements you could add:
- Collaborative filtering (user-based recommendations)
- Hybrid recommendations (combining content + collaborative)
- Rating prediction model
- User preference analysis
- Movie clustering visualization
# MovieLens-Dash
# MovieLens-Dash
