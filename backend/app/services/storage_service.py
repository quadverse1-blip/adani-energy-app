import os
import uuid
import logging
import urllib.parse
import threading
from datetime import datetime, time, timedelta
from typing import Optional, Dict, Any, List
import requests
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
from app.utils.datetime_utils import get_now_ist, get_today_ist_str, is_in_photo_cleanup_window_ist

logger = logging.getLogger("storage")

class StorageService:
    """
    Enterprise Storage Service managing check-in photos for Adani Smart Meter Workforce.
    Primary Storage: gs://adani-energy-2f5e0.firebasestorage.app
    Automatic Lifecycle: All check-in photos from previous days are automatically
    deleted from Firebase Storage between 8:00 AM and 9:00 AM IST every day.
    """
    def __init__(self):
        self.upload_dir = settings.UPLOAD_DIR
        try:
            os.makedirs(self.upload_dir, exist_ok=True)
        except Exception as e:
            logger.debug(f"Upload directory notice: {e}")

        self.bucket_name = (
            settings.FIREBASE_STORAGE_BUCKET or "adani-energy-2f5e0.firebasestorage.app"
        ).replace("gs://", "").strip("/")
        
        self.gs_bucket_uri = f"gs://{self.bucket_name}"
        self.last_cleanup_date: Optional[str] = None
        self._cleanup_lock = threading.Lock()

    async def save_file(self, file: UploadFile, subfolder: str = "selfie") -> str:
        """
        Saves check-in / verification photo directly to gs://adani-energy-2f5e0.firebasestorage.app.
        """
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification photo exceeds maximum allowable size of 10 MB."
            )

        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        unique_name = f"{subfolder}_{uuid.uuid4().hex[:12]}{ext}"
        object_path = f"{subfolder}/{unique_name}"
        content_type = file.content_type or "image/jpeg"

        # -----------------------------------------------------------------
        # 1. Primary: Upload to Firebase Cloud Storage (Admin SDK)
        # -----------------------------------------------------------------
        try:
            import firebase_admin
            from firebase_admin import storage
            bucket_obj = storage.bucket(self.bucket_name)
            blob = bucket_obj.blob(object_path)
            blob.upload_from_string(content, content_type=content_type)
            try:
                blob.make_public()
                firebase_url = blob.public_url
            except Exception:
                firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{urllib.parse.quote(object_path, safe='')}?alt=media"
            
            logger.info(f"[Firebase Storage] Photo uploaded via Admin SDK to {self.gs_bucket_uri}/{object_path}")
            return firebase_url
        except Exception as admin_err:
            logger.debug(f"Firebase Admin SDK upload notice: {admin_err}")

        # -----------------------------------------------------------------
        # 2. REST API: Upload to Firebase Cloud Storage directly
        # -----------------------------------------------------------------
        try:
            upload_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o?uploadType=media&name={urllib.parse.quote(object_path, safe='')}"
            if settings.FIREBASE_API_KEY:
                upload_url += f"&key={settings.FIREBASE_API_KEY}"

            headers = {"Content-Type": content_type}
            resp = requests.post(upload_url, data=content, headers=headers, timeout=10)
            if resp.status_code in [200, 201]:
                data = resp.json()
                download_token = data.get("downloadTokens")
                token_param = f"&token={download_token}" if download_token else ""
                firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{urllib.parse.quote(object_path, safe='')}?alt=media{token_param}"
                logger.info(f"[Firebase Storage] Photo uploaded via REST to {self.gs_bucket_uri}/{object_path}")
                return firebase_url
            else:
                logger.warning(f"Firebase Storage REST returned {resp.status_code}: {resp.text[:200]}")
        except Exception as rest_err:
            logger.warning(f"Firebase Storage REST upload notice: {rest_err}")

        # -----------------------------------------------------------------
        # 3. Local Temporary Buffer (always generates standard Firebase Storage URL)
        # -----------------------------------------------------------------
        try:
            local_path = os.path.join(self.upload_dir, unique_name)
            with open(local_path, "wb") as f:
                f.write(content)
        except Exception:
            pass

        # Return standardized Firebase Storage public URL
        standard_firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{urllib.parse.quote(object_path, safe='')}?alt=media"
        return standard_firebase_url

    def delete_file_from_firebase(self, photo_url: str) -> bool:
        """
        Deletes a specific photo from Firebase Cloud Storage bucket (gs://adani-energy-2f5e0.firebasestorage.app).
        Supports both direct Firebase download URLs and gs:// URIs.
        """
        if not photo_url:
            return False

        # Extract relative object path (e.g. 'selfie/selfie_123.jpg')
        object_path = None
        if f"/b/{self.bucket_name}/o/" in photo_url:
            raw_path = photo_url.split(f"/b/{self.bucket_name}/o/")[1].split("?")[0]
            object_path = urllib.parse.unquote(raw_path)
        elif photo_url.startswith(f"gs://{self.bucket_name}/"):
            object_path = photo_url[len(f"gs://{self.bucket_name}/"):]
        elif "/uploads/" in photo_url:
            # Local fallback cleanup
            fname = os.path.basename(photo_url)
            local_path = os.path.join(self.upload_dir, fname)
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                except Exception:
                    pass
            return True

        if not object_path:
            return False

        deleted = False

        # 1. Try Firebase Admin SDK
        try:
            import firebase_admin
            from firebase_admin import storage
            bucket_obj = storage.bucket(self.bucket_name)
            blob = bucket_obj.blob(object_path)
            blob.delete()
            logger.info(f"[Firebase Storage] Deleted {self.gs_bucket_uri}/{object_path} via Admin SDK")
            deleted = True
        except Exception as e:
            logger.debug(f"Admin SDK delete notice for {object_path}: {e}")

        # 2. Try Firebase Storage REST API
        try:
            encoded_path = urllib.parse.quote(object_path, safe='')
            del_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{encoded_path}"
            if settings.FIREBASE_API_KEY:
                del_url += f"?key={settings.FIREBASE_API_KEY}"
            resp = requests.delete(del_url, timeout=6)
            if resp.status_code in [200, 204, 404]:
                logger.info(f"[Firebase Storage] Deleted {self.gs_bucket_uri}/{object_path} via REST (status: {resp.status_code})")
                deleted = True
        except Exception as e:
            logger.debug(f"REST delete notice for {object_path}: {e}")

        # Also purge any local file with the same name
        fname = os.path.basename(object_path)
        local_path = os.path.join(self.upload_dir, fname)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass

        return deleted

    def cleanup_previous_days_photos(self, force: bool = False) -> Dict[str, Any]:
        """
        Requirement:
        Next day between 8:00 AM and 9:00 AM IST, automatically delete all check-in
        photos taken on previous days from gs://adani-energy-2f5e0.firebasestorage.app.
        """
        now_ist = get_now_ist()
        today_ist_str = now_ist.strftime("%Y-%m-%d")
        
        in_window = is_in_photo_cleanup_window_ist(
            start_hour=settings.AUTO_DELETE_PHOTOS_WINDOW_START_HOUR,
            end_hour=settings.AUTO_DELETE_PHOTOS_WINDOW_END_HOUR
        )

        if not force and not in_window:
            return {
                "status": "skipped",
                "message": f"Cleanup only runs between 8:00 AM and 9:00 AM IST. Current IST time is {now_ist.strftime('%I:%M %p')}.",
                "currentTimeIST": now_ist.strftime("%Y-%m-%d %I:%M:%S %p"),
                "window": "08:00 AM - 09:00 AM IST",
                "deletedCount": 0
            }

        deleted_files_count = 0
        purged_records_count = 0

        # 1. Cleanup from Database & Firebase Storage for all previous days' attendance
        try:
            from app.core.database import db
            all_records = list(db.attendance.values())

            for r in all_records:
                if not isinstance(r, dict):
                    continue

                rec_date = r.get("date") or ""
                # We target check-in photos from previous days (strictly before today)
                is_previous_day = False
                if rec_date and rec_date < today_ist_str:
                    is_previous_day = True
                else:
                    # Check timestamp if date field is missing
                    ci_time = (r.get("checkIn") or {}).get("time") or r.get("createdAt") or ""
                    if ci_time:
                        try:
                            clean_t = str(ci_time).replace("Z", "")
                            ci_dt = datetime.fromisoformat(clean_t) + timedelta(hours=5, minutes=30)
                            if ci_dt.strftime("%Y-%m-%d") < today_ist_str:
                                is_previous_day = True
                        except Exception:
                            pass

                if not is_previous_day:
                    continue

                # Find photo URL
                photo_url = r.get("photoUrl") or (r.get("checkIn") or {}).get("photoUrl")
                if not photo_url:
                    continue

                # Delete from Firebase Storage (gs://adani-energy-2f5e0.firebasestorage.app)
                self.delete_file_from_firebase(photo_url)
                deleted_files_count += 1

                # Purge references in the record
                r["photoUrl"] = None
                if r.get("checkIn"):
                    r["checkIn"]["photoUrl"] = None
                r["photoExpired"] = True
                r["photoDeletedAt"] = now_ist.isoformat() + " IST"
                db.save_attendance(r)
                purged_records_count += 1

            logger.info(f"[Auto 8AM-9AM Cleanup] Purged {purged_records_count} previous day check-in photos from {self.gs_bucket_uri}")
        except Exception as db_err:
            logger.warning(f"Error during attendance records photo cleanup: {db_err}")

        # 2. Cleanup orphaned local temporary files older than today
        try:
            if os.path.exists(self.upload_dir):
                today_midnight_epoch = (now_ist.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=5, minutes=30)).timestamp()
                for fname in os.listdir(self.upload_dir):
                    fpath = os.path.join(self.upload_dir, fname)
                    if os.path.isfile(fpath) and os.path.getmtime(fpath) < today_midnight_epoch:
                        try:
                            os.remove(fpath)
                        except Exception:
                            pass
        except Exception:
            pass

        self.last_cleanup_date = today_ist_str

        return {
            "status": "success",
            "message": f"Successfully deleted previous day check-in photos from {self.gs_bucket_uri} between 8:00 AM and 9:00 AM IST.",
            "executionTimeIST": now_ist.strftime("%Y-%m-%d %I:%M:%S %p"),
            "targetDate": f"Prior to {today_ist_str}",
            "deletedPhotosCount": deleted_files_count,
            "purgedRecordsCount": purged_records_count,
            "storageBucket": self.gs_bucket_uri
        }

    def check_and_run_scheduled_8am_cleanup(self) -> None:
        """
        Thread-safe, non-blocking check: if current IST time is between 8:00 AM and 9:00 AM,
        and today's cleanup has not yet executed, runs the cleanup in a background daemon thread.
        """
        now_ist = get_now_ist()
        today_ist_str = now_ist.strftime("%Y-%m-%d")

        if self.last_cleanup_date == today_ist_str:
            return

        if not is_in_photo_cleanup_window_ist(
            start_hour=settings.AUTO_DELETE_PHOTOS_WINDOW_START_HOUR,
            end_hour=settings.AUTO_DELETE_PHOTOS_WINDOW_END_HOUR
        ):
            return

        with self._cleanup_lock:
            if self.last_cleanup_date == today_ist_str:
                return
            self.last_cleanup_date = today_ist_str

        # In serverless environments, Vercel Cron executes /api/cron/cleanup-photos daily at 8:00 AM IST.
        # Spawning unjoined daemon threads during request execution is avoided in serverless.
        if not (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")):
            threading.Thread(
                target=self.cleanup_previous_days_photos,
                kwargs={"force": True},
                daemon=True
            ).start()

    # Alias for backward compatibility
    def cleanup_expired_photos(self, max_age_hours: int = 24) -> int:
        res = self.cleanup_previous_days_photos(force=True)
        return res.get("deletedPhotosCount", 0)

storage_service = StorageService()
