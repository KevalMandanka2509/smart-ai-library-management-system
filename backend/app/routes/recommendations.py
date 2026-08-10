from fastapi import APIRouter, Depends, HTTPException, Query, status
from ..database import get_db
from ..core.security import get_current_user
from ..models.book import serialize_books
from ..services.recommendation_service import RecommendationService

router = APIRouter(prefix="/api/v1/recommendations", tags=["AI Recommendations"])

@router.get("/student/{student_id}")
async def get_student_recommendations(
    student_id: str,
    limit: int = Query(10, ge=1, le=50),
    db=Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Get AI-driven book recommendations for a specific student based on borrowing history.
    """
    try:
        # Validate that the student exists or is the current user
        if current_user["role"] == "member" and current_user["username"] != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view recommendations for other students."
            )
            
        student = db.students.find_one({"student_id": student_id})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
            
        books = RecommendationService.get_recommendations(student_id, db, limit)
        return {
            "success": True,
            "books": serialize_books(books)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )
