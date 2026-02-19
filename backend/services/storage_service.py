import boto3
from botocore.client import Config
from fastapi import UploadFile
import os
from dotenv import load_dotenv
import uuid

load_dotenv()

S3_ENDPOINT = os.getenv("S3_ENDPOINT", "http://localhost:9000")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "minioadmin")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "minioadmin")
S3_BUCKET = os.getenv("S3_BUCKET", "receipts")

# Initialize S3 client for Garage S3
s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    config=Config(signature_version='s3v4')
)

def ensure_bucket_exists():
    """Ensure the S3 bucket exists"""
    try:
        s3_client.head_bucket(Bucket=S3_BUCKET)
    except:
        try:
            s3_client.create_bucket(Bucket=S3_BUCKET)
        except Exception as e:
            print(f"Warning: Could not create bucket: {e}")

async def upload_image(file: UploadFile) -> str:
    """Upload image to S3 and return URL"""
    try:
        ensure_bucket_exists()
        
        # Generate unique filename
        file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        unique_filename = f"{uuid.uuid4()}.{file_extension}"
        
        # Read file contents
        contents = await file.read()
        
        # Upload to S3
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=unique_filename,
            Body=contents,
            ContentType=file.content_type or 'image/jpeg'
        )
        
        # Return URL
        url = f"{S3_ENDPOINT}/{S3_BUCKET}/{unique_filename}"
        return url
        
    except Exception as e:
        raise Exception(f"Failed to upload image: {str(e)}")
