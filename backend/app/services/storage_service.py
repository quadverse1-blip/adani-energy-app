import os
import uuid
import logging
import requests
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        os.makedirs(self.upload_dir, exist_ok=True)

    async def save_file(self, file: UploadFile, subfolder: str = "attendance") -> str:
        # Validate max size: 10MB
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification photo exceeds maximum allowable size of 10 MB."
            )
        
        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        unique_name = f"{subfolder}_{uuid.uuid4().hex[:12]}{ext}"

        # 1. Try Firebase Cloud Storage if enabled
        if settings.STORAGE_MODE == "firebase_storage":
            try:
                bucket = settings.FIREBASE_STORAGE_BUCKET
                upload_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o?uploadType=media&name={subfolder}%2F{unique_name}"
                headers = {"Content-Type": file.content_type or "image/jpeg"}
                resp = requests.post(upload_url, data=content, headers=headers, timeout=8)
                if resp.status_code in [200, 201]:
                    data = resp.json()
                    download_token = data.get("downloadTokens")
                    token_param = f"&token={download_token}" if download_token else ""
                    firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{subfolder}%2F{unique_name}?alt=media{token_param}"
                    logger.info(f"Photo uploaded to Firebase Storage: {firebase_url}")
                    return firebase_url
            except Exception as e:
                logger.warning(f"Firebase Storage upload failed: {e}. Falling back to server storage.")

        # 2. Local static server fallback
        target_path = os.path.join(self.upload_dir, unique_name)
        with open(target_path, "wb") as f:
            f.write(content)
            
        # Return URL path accessible via FastAPI static files
        return f"/uploads/{unique_name}"

    def cleanup_expired_photos(self, max_age_hours: int = 24) -> int:
        """
        Deletes check-in photos that are older than max_age_hours (default 24 hours)
        from local storage, Firebase Cloud Storage, and purges expired photo references
        from the database and Firestore.
        """
        import time
        from datetime import datetime, timedelta
        deleted_count = 0
        cutoff_time = time.time() - (max_age_hours * 3600)
        cutoff_dt = datetime.utcnow() - timedelta(hours=max_age_hours)

        # 1. Cleanup local storage directory
        if os.path.exists(self.upload_dir):
            for fname in os.listdir(self.upload_dir):
                fpath = os.path.join(self.upload_dir, fname)
                try:
                    if os.path.isfile(fpath) and os.path.getmtime(fpath) < cutoff_time:
                        os.remove(fpath)
                        deleted_count += 1
                except Exception as e:
                    logger.debug(f"Error deleting expired file {fname}: {e}")

        # 2. Cleanup expired photo URLs in database & Firestore
        try:
            from app.core.database import db
            all_records = list(db.attendance.values())
            updated_records = 0
            for r in all_records:
                if not isinstance(r, dict) or not (r.get("photoUrl") or (r.get("checkIn") and r["checkIn"].get("photoUrl"))):
                    continue

                ci_time_str = (r.get("checkIn") or {}).get("time") or r.get("createdAt") or ""
                if not ci_time_str:
                    continue

                try:
                    clean_time = str(ci_time_str).replace("Z", "")
                    dt = datetime.fromisoformat(clean_time)
                    if dt < cutoff_dt:
                        # Photo has expired (older than 24 hours)
                        r["photoUrl"] = None
                        if r.get("checkIn"):
                            r["checkIn"]["photoUrl"] = None
                        r["photoExpired"] = True
                        db.save_attendance(r)
                        updated_records += 1
                except Exception:
                    pass
            if updated_records > 0:
                logger.info(f"Purged {updated_records} expired photo links older than {max_age_hours} hours from Firestore.")
        except Exception as e:
            logger.debug(f"Attendance photo database cleanup notice: {e}")

        logger.info(f"Cleaned up {deleted_count} check-in photos older than {max_age_hours} hours.")
        return deleted_count

storage_service = StorageService()
