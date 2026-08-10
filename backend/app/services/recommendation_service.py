from typing import List, Dict, Any
from collections import defaultdict
from bson import ObjectId

class RecommendationService:
    
    @staticmethod
    def get_recommendations(student_id: str, db, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Generates AI recommendations based on a user's borrowing history.
        Uses a category and author affinity scoring mechanism.
        """
        # 1. Fetch borrowing history
        borrows = list(db.borrows.find({"student_id": student_id}))
        
        # If no history, return top recent active books
        if not borrows:
            fallback = list(db.books.find({"is_available": True}).sort("created_at", -1).limit(limit))
            return fallback

        # 2. Build frequency map for authors and genres
        borrowed_book_ids = set()
        author_affinity = defaultdict(int)
        genre_affinity = defaultdict(int)

        for borrow in borrows:
            b_id = borrow.get("book_id")
            if not b_id:
                continue
            
            borrowed_book_ids.add(b_id)
            
            # Fetch book details to inspect author/genre
            book = db.books.find_one({"_id": ObjectId(b_id)}) if ObjectId.is_valid(b_id) else db.books.find_one({"isbn": b_id})
            if book:
                author = book.get("author")
                genre = book.get("genre")
                if author:
                    author_affinity[author.strip()] += 2  # Stronger weight for authors
                if genre:
                    genre_affinity[genre.strip()] += 1    # Base weight for genres

        # Convert borrowed_book_ids to ObjectIds for filtering
        excluded_ids = []
        for bid in borrowed_book_ids:
            if ObjectId.is_valid(bid):
                excluded_ids.append(ObjectId(bid))

        # 3. Fetch candidates (exclude already borrowed)
        candidates_cursor = db.books.find({
            "_id": {"$nin": excluded_ids},
            "is_available": True
        })
        
        scored_candidates = []
        for candidate in candidates_cursor:
            score = 0
            # Score against affinities
            c_author = candidate.get("author", "").strip()
            c_genre = candidate.get("genre", "").strip()
            
            if c_author and c_author in author_affinity:
                score += author_affinity[c_author] * 5  # Author multiplier
                
            if c_genre and c_genre in genre_affinity:
                score += genre_affinity[c_genre] * 3    # Genre multiplier
                
            if score > 0:
                scored_candidates.append((score, candidate))
                
        # 4. Sort and return
        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        
        results = [c[1] for c in scored_candidates[:limit]]
        
        # If affinities yielded less than limit, fill with generic recent
        if len(results) < limit:
            exclude_all = excluded_ids + [c["_id"] for c in results]
            filler = list(db.books.find({
                "_id": {"$nin": exclude_all},
                "is_available": True
            }).sort("created_at", -1).limit(limit - len(results)))
            results.extend(filler)
            
        return results
