import tempfile
import unittest
from pathlib import Path

from app import load_dataset


class LoadDatasetTests(unittest.TestCase):
    def test_builds_dashboard_summaries_and_top_movies(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            data_dir = Path(temporary_directory)
            (data_dir / "movies.dat").write_text(
                "1::Alpha (1999)::Action|Comedy\n"
                "2::Beta (2001)::Comedy\n"
                "3::No Year::(no genres listed)\n",
                encoding="latin-1",
            )
            (data_dir / "ratings.dat").write_text(
                "1::1::5::978300760\n"
                "2::1::4::978302109\n"
                "1::2::3::978301968\n"
                "3::2::4::978301968\n",
                encoding="ascii",
            )

            data = load_dataset(data_dir)

        self.assertEqual(data["stats"], {
            "totalRatings": 4,
            "totalMovies": 3,
            "totalUsers": 3,
            "averageRating": 4.0,
        })
        self.assertEqual(data["ratingDistribution"][7], {"rating": 4.0, "count": 2})
        self.assertEqual(data["ratingsByYear"][0]["year"], 2000)
        self.assertEqual(data["ratingsByReleaseYear"][0]["year"], 1999)
        self.assertEqual(data["topMovies"][0]["title"], "Alpha (1999)")
        self.assertEqual(data["movies"][0]["averageRating"], 4.5)

    def test_rejects_malformed_rating_rows(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            data_dir = Path(temporary_directory)
            (data_dir / "movies.dat").write_text("1::Alpha (1999)::Comedy\n", encoding="latin-1")
            (data_dir / "ratings.dat").write_text("not a valid row\n", encoding="ascii")

            with self.assertRaisesRegex(ValueError, "Invalid rating row"):
                load_dataset(data_dir)


if __name__ == "__main__":
    unittest.main()
