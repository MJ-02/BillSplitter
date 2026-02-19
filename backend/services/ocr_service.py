from fastapi import UploadFile
from PIL import Image
import io
import os
from typing import Optional

# Surya OCR v0.17+ API
try:
    from surya.common.surya.schema import TaskNames
    from surya.detection import DetectionPredictor
    from surya.foundation import FoundationPredictor
    from surya.recognition import RecognitionPredictor
    SURYA_AVAILABLE = True
except ImportError as e:
    SURYA_AVAILABLE = False
    print(f"WARNING: Surya OCR not available - {str(e)}")

# Docling OCR
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
    DOCLING_AVAILABLE = True
except ImportError as e:
    DOCLING_AVAILABLE = False
    DocumentConverter = None  # type: ignore
    print(f"WARNING: Docling OCR not available - {str(e)}")

# Get OCR engine from environment (default: docling)
OCR_ENGINE = os.getenv("OCR_ENGINE", "docling").lower()

# Global predictor instances for Surya
foundation_predictor: Optional[FoundationPredictor] = None
detection_predictor: Optional[DetectionPredictor] = None
recognition_predictor: Optional[RecognitionPredictor] = None

# Global converter instance for Docling
docling_converter: Optional = None

def initialize_surya_models():
    """Initialize Surya OCR predictors"""
    global foundation_predictor, detection_predictor, recognition_predictor
    
    if not SURYA_AVAILABLE:
        return
    
    if foundation_predictor is None:
        print("Loading Surya OCR models... This may take a while on first run.")
        print("Models will be downloaded from Hugging Face (~2GB)...")
        try:
            foundation_predictor = FoundationPredictor()
            detection_predictor = DetectionPredictor()
            recognition_predictor = RecognitionPredictor(foundation_predictor)
            print("✓ Surya OCR models loaded successfully!")
        except Exception as e:
            print(f"✗ Error loading Surya OCR models: {str(e)}")
            raise

def initialize_docling_converter():
    """Initialize Docling converter with RapidOCR"""
    global docling_converter
    
    if not DOCLING_AVAILABLE:
        return
    
    if docling_converter is None:
        print("Initializing Docling converter with RapidOCR...")
        try:
            # Configure pipeline options with RapidOCR (no external model downloads needed)
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = True
            pipeline_options.ocr_options = RapidOcrOptions(force_full_page_ocr=True)
            
            # Create converter with format options
            docling_converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
                    InputFormat.IMAGE: PdfFormatOption(pipeline_options=pipeline_options),
                }
            )
            print("✓ Docling converter initialized successfully!")
        except Exception as e:
            print(f"✗ Error initializing Docling converter: {str(e)}")
            raise

async def process_receipt_with_surya(image: Image.Image) -> dict:
    """Process receipt image with Surya OCR"""
    if not SURYA_AVAILABLE:
        raise RuntimeError("Surya OCR not available")
    
    # Initialize models if not already done
    initialize_surya_models()
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Run OCR with the correct API
    print("Running Surya OCR on image...")
    task_names = [TaskNames.ocr_with_boxes]  # OCR task
    
    predictions_by_image = recognition_predictor(
        [image],
        task_names=task_names,
        det_predictor=detection_predictor,
        math_mode=False  # We don't need math recognition for receipts
    )
    
    # Extract text from predictions
    raw_text = ""
    total_confidence = 0.0
    line_count = 0
    
    if predictions_by_image and len(predictions_by_image) > 0:
        prediction = predictions_by_image[0]
        
        # Extract text lines
        if hasattr(prediction, 'text_lines'):
            for text_line in prediction.text_lines:
                if hasattr(text_line, 'text'):
                    raw_text += text_line.text + "\n"
                    line_count += 1
                    # Get confidence if available
                    if hasattr(text_line, 'confidence'):
                        total_confidence += text_line.confidence
    
    # Calculate average confidence
    avg_confidence = total_confidence / line_count if line_count > 0 else 0.9
    
    result_text = raw_text.strip() if raw_text.strip() else "No text detected"
    
    print(f"✓ Surya OCR completed. Detected {line_count} lines with avg confidence: {avg_confidence:.2f}")
    
    return {
        "raw_text": result_text,
        "confidence": avg_confidence,
        "fallback": False,
        "lines_detected": line_count,
        "engine": "surya"
    }

async def process_receipt_with_docling(file_path: str) -> dict:
    """Process receipt image with Docling OCR"""
    if not DOCLING_AVAILABLE:
        raise RuntimeError("Docling OCR not available")
    
    # Initialize converter if not already done
    initialize_docling_converter()
    
    print("Running Docling OCR on image...")
    
    # Convert the document
    result = docling_converter.convert(file_path)
    
    # Extract text from the result
    raw_text = result.document.export_to_markdown()
    
    # Docling doesn't provide confidence scores in the same way
    # We'll estimate based on whether we got results
    confidence = 0.95 if raw_text and len(raw_text.strip()) > 0 else 0.0
    
    result_text = raw_text.strip() if raw_text.strip() else "No text detected"
    
    print(f"✓ Docling OCR completed. Extracted {len(result_text)} characters")
    
    return {
        "raw_text": result_text,
        "confidence": confidence,
        "fallback": False,
        "engine": "docling"
    }

async def process_receipt_image(file: UploadFile) -> dict:
    """Process receipt image with configured OCR engine"""
    try:
        # Read file contents
        contents = await file.read()
        
        # Choose OCR engine
        if OCR_ENGINE == "surya":
            if not SURYA_AVAILABLE:
                print("WARNING: Surya OCR requested but not available, using fallback")
                return get_fallback_result()
            
            # Process with Surya (works with PIL Image)
            image = Image.open(io.BytesIO(contents))
            return await process_receipt_with_surya(image)
            
        elif OCR_ENGINE == "docling":
            if not DOCLING_AVAILABLE:
                print("WARNING: Docling OCR requested but not available, using fallback")
                return get_fallback_result()
            
            # Docling needs a file path, so save temporarily
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
                tmp_file.write(contents)
                tmp_path = tmp_file.name
            
            try:
                result = await process_receipt_with_docling(tmp_path)
                return result
            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except:
                    pass
        else:
            print(f"WARNING: Unknown OCR engine '{OCR_ENGINE}', using fallback")
            return get_fallback_result()
        
    except Exception as e:
        error_msg = f"OCR processing failed: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        
        # Return fallback data on error
        return {
            "raw_text": "Error processing image. Please try again or enter receipt details manually.",
            "confidence": 0.0,
            "fallback": True,
            "error": str(e)
        }

def get_fallback_result() -> dict:
    """Return fallback OCR result for testing"""
    print("Using fallback OCR mode")
    return {
        "raw_text": "Restaurant Name\nItem 1 x2 $10.00\nItem 2 x1 $15.00\nSubtotal: $25.00\nTax: $2.50\nTotal: $27.50",
        "confidence": 0.0,
        "fallback": True,
        "engine": "fallback"
    }
