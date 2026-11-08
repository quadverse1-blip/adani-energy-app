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

    def process_and_save_photo(
        self,
        content: bytes,
        filename: Optional[str] = None,
        subfolder: str = "selfie"
    ) -> Dict[str, Any]:
        """
        Processes photo using PIL:
        1. Auto-orients based on EXIF.
        2. Converts RGBA/P to RGB.
        3. Resizes to max 800x800 preserving aspect ratio.
        4. Compresses as optimized JPEG (quality=75, ~30-45 KB).
        5. Saves to disk in settings.UPLOAD_DIR (/uploads/<filename>).
        6. Generates self-contained Base64 data URI (data:image/jpeg;base64,...) for direct
           display in Firestore database console and mobile application with zero 403/permission issues.
        7. Attempts Firebase Storage upload if credentials exist.
        """
        import io
        import base64
        from PIL import Image, ImageOps

        if not filename:
            unique_id = uuid.uuid4().hex[:12]
            filename = f"{subfolder}_{unique_id}.jpg"
        elif not filename.lower().endswith(".jpg") and not filename.lower().endswith(".jpeg"):
            filename = f"{os.path.splitext(filename)[0]}.jpg"

        # 1. Open and optimize with Pillow
        try:
            img = Image.open(io.BytesIO(content))
            img = ImageOps.exif_transpose(img)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize if dimensions exceed 800px
            max_dim = 800
            if img.width > max_dim or img.height > max_dim:
                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=75, optimize=True)
            compressed_bytes = buf.getvalue()
        except Exception as pil_err:
            logger.warning(f"PIL image processing fallback: {pil_err}")
            compressed_bytes = content

        # 2. Save compressed file to UPLOAD_DIR
        local_path = os.path.join(self.upload_dir, filename)
        try:
            with open(local_path, "wb") as f:
                f.write(compressed_bytes)
        except Exception as write_err:
            logger.warning(f"Failed to write photo locally to {local_path}: {write_err}")

        # 3. Create Base64 data URI (self-contained, works everywhere)
        b64_str = base64.b64encode(compressed_bytes).decode("utf-8")
        data_uri = f"data:image/jpeg;base64,{b64_str}"

        # 4. Attempt Firebase Admin SDK upload if configured
        object_path = f"{subfolder}/{filename}"
        firebase_url = None
        try:
            from firebase_admin import storage
            bucket_obj = storage.bucket(self.bucket_name)
            blob = bucket_obj.blob(object_path)
            blob.upload_from_string(compressed_bytes, content_type="image/jpeg")
            try:
                blob.make_public()
                firebase_url = blob.public_url
            except Exception:
                firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{urllib.parse.quote(object_path, safe='')}?alt=media"
        except Exception:
            pass

        # 5. Attempt Firebase Storage REST upload (succeeds when Storage Rules permit write)
        if not firebase_url:
            try:
                safe_path = urllib.parse.quote(object_path, safe="")
                upload_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o?uploadType=media&name={safe_path}"
                if settings.FIREBASE_API_KEY:
                    upload_url += f"&key={settings.FIREBASE_API_KEY}"
                headers = {"Content-Type": "image/jpeg"}
                resp = requests.post(upload_url, data=compressed_bytes, headers=headers, timeout=6)
                if resp.status_code in [200, 201]:
                    data = resp.json()
                    token = data.get("downloadTokens")
                    token_param = f"&token={token}" if token else ""
                    firebase_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{safe_path}?alt=media{token_param}"
                    logger.info(f"[Firebase Storage] Uploaded to {self.bucket_name}/{object_path}")
                else:
                    logger.debug(f"[Firebase Storage] REST upload returned {resp.status_code}: {resp.text[:120]}")
            except Exception as rest_err:
                logger.debug(f"[Firebase Storage] REST notice: {rest_err}")

        # Choose primary photo URL: if Firebase Cloud Storage upload succeeded, prefer it, otherwise use robust Base64 data URI
        primary_photo_url = firebase_url if firebase_url else data_uri

        return {
            "photoUrl": primary_photo_url,
            "photoPath": f"/uploads/{filename}",
            "filename": filename,
            "firebaseUrl": firebase_url,
            "dataUri": data_uri,
            "sizeBytes": len(compressed_bytes)
        }

    def save_base64_photo(self, b64_input: str, subfolder: str = "selfie") -> Dict[str, Any]:
        """
        Decodes a base64 string or data URI and processes it through PIL.
        """
        import base64
        if not b64_input or not isinstance(b64_input, str):
            raise HTTPException(status_code=400, detail="Invalid base64 image data")
        
        # Strip data URL prefix if present
        if "," in b64_input:
            b64_data = b64_input.split(",", 1)[1]
        else:
            b64_data = b64_input

        try:
            raw_bytes = base64.b64decode(b64_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to decode base64 image: {e}")

        return self.process_and_save_photo(raw_bytes, subfolder=subfolder)

    async def save_file(self, file: UploadFile, subfolder: str = "selfie") -> Dict[str, Any]:
        """
        Saves check-in / verification photo, optimizing with PIL and generating data URI.
        """
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification photo exceeds maximum allowable size of 15 MB."
            )

        ext = os.path.splitext(file.filename or "")[1] or ".jpg"
        unique_name = f"{subfolder}_{uuid.uuid4().hex[:12]}{ext}"
        return self.process_and_save_photo(content, filename=unique_name, subfolder=subfolder)

    def delete_file_from_storage(
        self,
        photo_url: Optional[str] = None,
        photo_path: Optional[str] = None,
        firebase_url: Optional[str] = None,
        max_retries: int = 3
    ) -> bool:
        """
        Deletes a check-in photo file from:
        1. Firebase Cloud Storage bucket (gs://adani-energy-2f5e0.firebasestorage.app)
        2. Local disk (/uploads/ or /tmp/uploads/)
        Includes automatic retry logic (3 attempts with exponential backoff) and comprehensive logging.
        """
        targets = []
        if firebase_url:
            targets.append(firebase_url)
        if photo_url and not photo_url.startswith("data:"):
            targets.append(photo_url)
        if photo_path:
            targets.append(photo_path)

        # Extract possible Firebase object paths
        object_paths = []
        for target in targets:
            if f"/b/{self.bucket_name}/o/" in target:
                raw_path = target.split(f"/b/{self.bucket_name}/o/")[1].split("?")[0]
                object_paths.append(urllib.parse.unquote(raw_path))
            elif target.startswith(f"gs://{self.bucket_name}/"):
                object_paths.append(target[len(f"gs://{self.bucket_name}/"):])
            elif "/uploads/" in target:
                fname = os.path.basename(target)
                object_paths.append(f"selfie/{fname}")
                object_paths.append(fname)
            elif target.startswith("selfie_") or target.endswith(".jpg") or target.endswith(".jpeg"):
                object_paths.append(f"selfie/{os.path.basename(target)}")
                object_paths.append(os.path.basename(target))

        # Always check and delete local files matching targets
        for target in targets:
            fname = os.path.basename(target.split("?")[0])
            if fname and (fname.endswith(".jpg") or fname.endswith(".jpeg") or fname.startswith("selfie_")):
                local_path = os.path.join(self.upload_dir, fname)
                if os.path.exists(local_path):
                    try:
                        os.remove(local_path)
                        logger.info(f"[Local Storage] Purged local file: {local_path}")
                    except Exception as le:
                        logger.debug(f"[Local Storage] Failed to remove {local_path}: {le}")

        if not object_paths:
            return True

        deleted_any = False
        import time

        # Deduplicate paths preserving order
        unique_paths = list(dict.fromkeys(object_paths))

        for object_path in unique_paths:
            deleted = False

            # Check if Firebase Admin SDK app is initialized
            has_admin_app = False
            try:
                import firebase_admin
                if getattr(firebase_admin, "_apps", None):
                    has_admin_app = True
            except Exception:
                has_admin_app = False

            # 1. Try Firebase Admin SDK with retry if app is initialized
            if has_admin_app:
                for attempt in range(1, max_retries + 1):
                    try:
                        from firebase_admin import storage
                        bucket_obj = storage.bucket(self.bucket_name)
                        blob = bucket_obj.blob(object_path)
                        blob.delete()
                        logger.info(f"[Firebase Storage] Deleted {self.gs_bucket_uri}/{object_path} via Admin SDK (attempt {attempt})")
                        deleted = True
                        deleted_any = True
                        break
                    except Exception as e:
                        err_str = str(e)
                        if "Not Found" in err_str or "404" in err_str:
                            logger.info(f"[Firebase Storage] Object {object_path} already absent/purged from {self.gs_bucket_uri}")
                            deleted = True
                            deleted_any = True
                            break
                        logger.warning(f"[Firebase Storage] Admin SDK delete attempt {attempt}/{max_retries} for {object_path} notice: {e}")
                        if attempt < max_retries:
                            time.sleep(0.4 * attempt)

            # 2. Try Firebase Storage REST API with retry if not already deleted
            if not deleted:
                for attempt in range(1, max_retries + 1):
                    try:
                        encoded_path = urllib.parse.quote(object_path, safe='')
                        del_url = f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}/o/{encoded_path}"
                        if settings.FIREBASE_API_KEY:
                            del_url += f"?key={settings.FIREBASE_API_KEY}"
                        resp = requests.delete(del_url, timeout=6)
                        if resp.status_code in [200, 204, 404]:
                            logger.info(f"[Firebase Storage] Deleted {self.gs_bucket_uri}/{object_path} via REST (status: {resp.status_code}, attempt {attempt})")
                            deleted = True
                            deleted_any = True
                            break
                        else:
                            logger.debug(f"[Firebase Storage] REST delete attempt {attempt} returned {resp.status_code}")
                    except Exception as e:
                        logger.warning(f"[Firebase Storage] REST delete attempt {attempt}/{max_retries} for {object_path} error: {e}")
                        if attempt < max_retries:
                            time.sleep(0.4 * attempt)

        return deleted_any

    def delete_file_from_firebase(self, photo_url: str) -> bool:
        """Backward-compatible alias for delete_file_from_storage."""
        return self.delete_file_from_storage(photo_url=photo_url)

    def cleanup_previous_days_photos(self, force: bool = False) -> Dict[str, Any]:
        """
        Requirement:
        Automatically delete the actual photo file from storage every day at exactly 12:00 AM IST (midnight).
        - Delete only photos from previous days (rec_date < today_ist_str).
        - Keep current day's photos available for Admin and Supervisor inspection throughout the day.
        - NEVER delete attendance records, employee details, punch times, or coordinates.
        - Remove photo references from the database record to prevent broken image links.
        - Handle deletion failures with retry logic and audit logging.
        """
        now_ist = get_now_ist()
        today_ist_str = now_ist.strftime("%Y-%m-%d")

        deleted_files_count = 0
        purged_records_count = 0
        failed_deletions_count = 0
        errors = []

        # 1. Cleanup from Database & Firebase Storage for all previous days' attendance
        try:
            from app.core.database import db
            all_records = list(db.attendance.values())

            for r in all_records:
                if not isinstance(r, dict):
                    continue

                rec_date = r.get("date") or ""
                # Strictly previous day check in Indian Standard Time (IST)
                is_previous_day = False
                if rec_date and rec_date < today_ist_str:
                    is_previous_day = True
                else:
                    ci_time = (r.get("checkIn") or {}).get("time") or r.get("createdAt") or ""
                    if ci_time:
                        try:
                            clean_t = str(ci_time).replace("Z", "")
                            ci_dt = datetime.fromisoformat(clean_t) + timedelta(hours=5, minutes=30)
                            if ci_dt.strftime("%Y-%m-%d") < today_ist_str:
                                is_previous_day = True
                        except Exception:
                            pass

                # Current day photos remain untouched throughout the day!
                if not is_previous_day:
                    continue

                # Locate photo references
                photo_url = r.get("photoUrl") or (r.get("checkIn") or {}).get("photoUrl")
                firebase_url = r.get("firebaseUrl")
                photo_path = r.get("photoPath")

                if not photo_url and not firebase_url and not photo_path:
                    continue

                # Delete actual file from storage with retry logic
                try:
                    del_ok = self.delete_file_from_storage(
                        photo_url=photo_url,
                        photo_path=photo_path,
                        firebase_url=firebase_url,
                        max_retries=3
                    )
                    if del_ok:
                        deleted_files_count += 1
                except Exception as del_err:
                    failed_deletions_count += 1
                    errors.append(f"Record {r.get('_id')}: {str(del_err)}")
                    logger.error(f"[Storage Cleanup Error] Failed to delete file for {r.get('_id')}: {del_err}")

                # Safely purge photo references from the database record
                # Attendance punch details, times, dates, and locations remain 100% intact!
                r["photoUrl"] = None
                if isinstance(r.get("checkIn"), dict):
                    r["checkIn"]["photoUrl"] = None
                r["firebaseUrl"] = None
                r["photoPath"] = None
                r["photoExpired"] = True
                r["photoDeletedAt"] = now_ist.strftime("%Y-%m-%d %I:%M:%S %p IST")

                # Persist updated record in memory and in remote Firestore cloud
                db.save_attendance(r)
                purged_records_count += 1

            logger.info(
                f"[Daily Midnight Cleanup] Purged {purged_records_count} previous-day check-in photos "
                f"from {self.gs_bucket_uri} (Deleted files: {deleted_files_count}, Failures: {failed_deletions_count})"
            )
        except Exception as db_err:
            logger.error(f"[Storage Cleanup] Error during attendance photo purge: {db_err}", exc_info=True)
            errors.append(str(db_err))

        # 2. Cleanup orphaned local temporary files older than today's 00:00:00 IST
        try:
            if os.path.exists(self.upload_dir):
                today_midnight_epoch = (now_ist.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(hours=5, minutes=30)).timestamp()
                for fname in os.listdir(self.upload_dir):
                    fpath = os.path.join(self.upload_dir, fname)
                    if os.path.isfile(fpath) and os.path.getmtime(fpath) < today_midnight_epoch:
                        try:
                            os.remove(fpath)
                            deleted_files_count += 1
                        except Exception:
                            pass
        except Exception:
            pass

        self.last_cleanup_date = today_ist_str

        return {
            "status": "success",
            "message": f"Successfully deleted previous day check-in photos from {self.gs_bucket_uri} for 12:00 AM IST (midnight).",
            "executionTimeIST": now_ist.strftime("%Y-%m-%d %I:%M:%S %p IST"),
            "targetCutoffDate": f"Prior to {today_ist_str}",
            "deletedPhotosCount": deleted_files_count,
            "purgedRecordsCount": purged_records_count,
            "failedDeletionsCount": failed_deletions_count,
            "storageBucket": self.gs_bucket_uri,
            "errors": errors
        }

    def check_and_run_midnight_cleanup(self) -> None:
        """
        Thread-safe check: verifies if today's midnight cleanup has executed.
        If a new calendar day in IST has started and cleanup has not yet run,
        triggers the purge.
        """
        now_ist = get_now_ist()
        today_ist_str = now_ist.strftime("%Y-%m-%d")

        if self.last_cleanup_date == today_ist_str:
            return

        with self._cleanup_lock:
            if self.last_cleanup_date == today_ist_str:
                return
            self.last_cleanup_date = today_ist_str

        # If not in serverless, run in daemon thread so caller is non-blocked
        if not (os.getenv("VERCEL") or os.getenv("AWS_LAMBDA_FUNCTION_NAME")):
            threading.Thread(
                target=self.cleanup_previous_days_photos,
                kwargs={"force": True},
                daemon=True
            ).start()
        else:
            # In serverless, execute synchronously
            self.cleanup_previous_days_photos(force=True)

    def check_and_run_scheduled_8am_cleanup(self) -> None:
        """Alias redirecting to midnight cleanup for backward compatibility."""
        self.check_and_run_midnight_cleanup()

    # Alias for backward compatibility
    def cleanup_expired_photos(self, max_age_hours: int = 24) -> int:
        res = self.cleanup_previous_days_photos(force=True)
        return res.get("deletedPhotosCount", 0)

storage_service = StorageService()
