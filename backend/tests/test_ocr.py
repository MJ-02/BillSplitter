"""
Test script for OCR engines
Usage: uv run python test_ocr.py [engine_name]
"""
import sys
import os
from PIL import Image
import io

# Set OCR engine if provided
if len(sys.argv) > 1:
    engine = sys.argv[1].lower()
    os.environ['OCR_ENGINE'] = engine
    print(f"Testing with OCR engine: {engine}")
else:
    print(f"Testing with default OCR engine: {os.getenv('OCR_ENGINE', 'docling')}")

# Now import after setting env var
from services.ocr_service import process_receipt_image, OCR_ENGINE, SURYA_AVAILABLE, DOCLING_AVAILABLE

async def test_ocr():
    print(f"\n{'='*60}")
    print(f"OCR Engine Configuration")
    print(f"{'='*60}")
    print(f"Selected Engine: {OCR_ENGINE}")
    print(f"Surya Available: {SURYA_AVAILABLE}")
    print(f"Docling Available: {DOCLING_AVAILABLE}")
    print(f"{'='*60}\n")
    
    # Create a simple test image
    img = Image.new('RGB', (400, 300), color='white')
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    # Create a mock UploadFile
    class MockUploadFile:
        def __init__(self, file_bytes):
            self.file_bytes = file_bytes
            
        async def read(self):
            return self.file_bytes
    
    mock_file = MockUploadFile(img_bytes.getvalue())
    
    # Test OCR
    print("Processing test image...\n")
    result = await process_receipt_image(mock_file)
    
    print(f"{'='*60}")
    print(f"OCR Result")
    print(f"{'='*60}")
    print(f"Engine Used: {result.get('engine', 'unknown')}")
    print(f"Confidence: {result.get('confidence', 0):.2f}")
    print(f"Fallback Mode: {result.get('fallback', False)}")
    print(f"Text Length: {len(result.get('raw_text', ''))}")
    print(f"\nExtracted Text:")
    print("-" * 60)
    print(result.get('raw_text', 'No text')[:500])
    print(f"{'='*60}\n")

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_ocr())
