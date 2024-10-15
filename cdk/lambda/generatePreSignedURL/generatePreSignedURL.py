import os, json
import boto3
from botocore.config import Config
from aws_lambda_powertools import Logger

BUCKET = os.environ["BUCKET"]
REGION = os.environ["REGION"]

s3 = boto3.client(
    "s3",
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(
        s3={"addressing_style": "virtual"}, region_name=REGION, signature_version="s3v4"
    ),
)
logger = Logger()

def s3_key_exists(bucket, key):
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except:
        return False

@logger.inject_lambda_context(log_event=True)
def lambda_handler(event, context):
    # Use .get() to safely extract query string parameters
    query_params = event.get("queryStringParameters", {})

    if not query_params:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing queries to generate pre-signed URL')
        }

    simulation_group_id = query_params.get("simulation_group_id", "")
    patient_id = query_params.get("patient_id", "")
    file_type = query_params.get("file_type", "")
    file_name = query_params.get("file_name", "")

    if not simulation_group_id:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing required parameter: simulation_group_id')
        }

    if not patient_id:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing required parameter: patient_id')
        }

    if not file_name:
        return {
            'statusCode': 400,
            'body': json.dumps('Missing required parameter: file_name')
        }

    # Allowed file types for documents with their corresponding MIME types
    allowed_document_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt": "text/plain",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xps": "application/oxps",  # or "application/vnd.ms-xpsdocument" for legacy XPS
        "mobi": "application/x-mobipocket-ebook",
        "cbz": "application/vnd.comicbook+zip"
    }

    if file_type in allowed_document_types:
        key = f"{simulation_group_id}/{patient_id}/documents/{file_name}.{file_type}"
        content_type = allowed_document_types[file_type]
    else:
        return {
            'statusCode': 400,
            'body': json.dumps('Unsupported file type')
        }

    logger.info({
        "simulation_group_id": simulation_group_id,
        "patient_id": patient_id,
        "file_type": file_type,
        "file_name": file_name,
    })

    try:

        presigned_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": BUCKET,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=300,
            HttpMethod="PUT",
        )

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "*",
            },
            "body": json.dumps({"presignedurl": presigned_url}),
        }
    
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps('Internal server error')
        }