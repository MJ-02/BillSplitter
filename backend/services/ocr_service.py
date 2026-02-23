from fastapi import UploadFile
from PIL import Image, ImageDraw
import io
import os
import base64
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
GLM_OCR_OLLAMA_URL = os.getenv("GLM_OCR_OLLAMA_URL", "http://localhost:11434")

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
            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_ocr = True
            pipeline_options.ocr_options = RapidOcrOptions(force_full_page_ocr=True)

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


def generate_annotated_image(image: Image.Image, bboxes: list) -> str:
    """Draw bounding boxes on image and return as base64 JPEG data URL"""
    # Resize if too large to keep response payload manageable
    max_width = 1200
    scale = 1.0
    if image.width > max_width:
        scale = max_width / image.width
        new_size = (max_width, int(image.height * scale))
        image = image.resize(new_size, Image.LANCZOS)

    # Work in RGBA so we can composite a transparent fill
    base = image.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for bbox in bboxes:
        if "polygon" in bbox and bbox["polygon"]:
            pts = [(p[0] * scale, p[1] * scale) for p in bbox["polygon"]]
            draw.polygon(pts, outline=(59, 130, 246, 255), fill=(59, 130, 246, 45))
        elif "bbox" in bbox and bbox["bbox"]:
            x1, y1, x2, y2 = [c * scale for c in bbox["bbox"]]
            draw.rectangle([x1, y1, x2, y2], outline=(59, 130, 246, 255), fill=(59, 130, 246, 45))

    composited = Image.alpha_composite(base, overlay)

    buf = io.BytesIO()
    composited.convert("RGB").save(buf, format="JPEG", quality=85)
    img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{img_b64}"


async def process_receipt_with_surya(image: Image.Image) -> dict:
    """Process receipt image with Surya OCR, returning text and bounding boxes"""
    if not SURYA_AVAILABLE:
        raise RuntimeError("Surya OCR not available")

    initialize_surya_models()

    if image.mode != "RGB":
        image = image.convert("RGB")

    print("Running Surya OCR on image...")
    task_names = [TaskNames.ocr_with_boxes]

    predictions_by_image = recognition_predictor(
        [image],
        task_names=task_names,
        det_predictor=detection_predictor,
        math_mode=False,
    )

    raw_text = ""
    total_confidence = 0.0
    line_count = 0
    bboxes = []

    if predictions_by_image and len(predictions_by_image) > 0:
        prediction = predictions_by_image[0]

        if hasattr(prediction, "text_lines"):
            for text_line in prediction.text_lines:
                if hasattr(text_line, "text"):
                    raw_text += text_line.text + "\n"
                    line_count += 1
                    if hasattr(text_line, "confidence"):
                        total_confidence += text_line.confidence
                    # Extract polygon points for visualization
                    if hasattr(text_line, "polygon") and text_line.polygon:
                        bboxes.append({"polygon": [[p[0], p[1]] for p in text_line.polygon]})
                    elif hasattr(text_line, "bbox") and text_line.bbox:
                        bboxes.append({"bbox": list(text_line.bbox)})

    avg_confidence = total_confidence / line_count if line_count > 0 else 0.9
    result_text = raw_text.strip() if raw_text.strip() else "No text detected"

    annotated_image = generate_annotated_image(image.copy(), bboxes) if bboxes else None

    print(f"✓ Surya OCR completed. {line_count} lines, avg confidence: {avg_confidence:.2f}, {len(bboxes)} boxes")

    return {
        "raw_text": result_text,
        "confidence": avg_confidence,
        "fallback": False,
        "lines_detected": line_count,
        "engine": "surya",
        "bboxes": bboxes,
        "annotated_image": annotated_image,
    }


async def process_receipt_with_docling(file_path: str) -> dict:
    """Process receipt image with Docling OCR"""
    if not DOCLING_AVAILABLE:
        raise RuntimeError("Docling OCR not available")

    initialize_docling_converter()

    print("Running Docling OCR on image...")

    result = docling_converter.convert(file_path)
    raw_text = result.document.export_to_markdown()

    confidence = 0.95 if raw_text and len(raw_text.strip()) > 0 else 0.0
    result_text = raw_text.strip() if raw_text.strip() else "No text detected"

    print(f"✓ Docling OCR completed. Extracted {len(result_text)} characters")

    return {
        "raw_text": result_text,
        "confidence": confidence,
        "fallback": False,
        "engine": "docling",
        "bboxes": [],
        "annotated_image": None,
    }


async def process_receipt_with_glm_ocr(image_bytes: bytes) -> dict:
    """Process receipt image with GLM-OCR via Ollama"""
    import httpx

    print(f"Running GLM-OCR via Ollama at {GLM_OCR_OLLAMA_URL}...")

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{GLM_OCR_OLLAMA_URL}/api/generate",
            json={
                "model": "glm-ocr",
                "prompt": "Text Recognition:",
                "images": [image_b64],
                "stream": False,
            },
        )
        response.raise_for_status()
        result = response.json()

    raw_text = result.get("response", "").strip()
    confidence = 0.94 if raw_text else 0.0

    print(f"✓ GLM-OCR completed. Extracted {len(raw_text)} characters")

    return {
        "raw_text": raw_text,
        "confidence": confidence,
        "fallback": not bool(raw_text),
        "engine": "glm-ocr",
        "bboxes": [],
        "annotated_image": None,
    }


async def process_receipt_image(file: UploadFile) -> dict:
    """Process receipt image with the configured OCR engine"""
    try:
        contents = await file.read()

        if OCR_ENGINE == "surya":
            if not SURYA_AVAILABLE:
                print("WARNING: Surya OCR requested but not available, using fallback")
                return get_fallback_result()
            image = Image.open(io.BytesIO(contents))
            return await process_receipt_with_surya(image)

        elif OCR_ENGINE == "glm-ocr":
            return await process_receipt_with_glm_ocr(contents)

        elif OCR_ENGINE == "docling":
            if not DOCLING_AVAILABLE:
                print("WARNING: Docling OCR requested but not available, using fallback")
                return get_fallback_result()

            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
                tmp_file.write(contents)
                tmp_path = tmp_file.name

            try:
                return await process_receipt_with_docling(tmp_path)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        else:
            print(f"WARNING: Unknown OCR engine '{OCR_ENGINE}', using fallback")
            return get_fallback_result()

    except Exception as e:
        error_msg = f"OCR processing failed: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()

        return {
            "raw_text": "Error processing image. Please try again or enter receipt details manually.",
            "confidence": 0.0,
            "fallback": True,
            "error": str(e),
            "bboxes": [],
            "annotated_image": None,
        }


def get_fallback_result() -> dict:
    """Return fallback OCR result for testing"""
    print("Using fallback OCR mode")
    return {
        "raw_text": "Restaurant Name\nItem 1 x2 $10.00\nItem 2 x1 $15.00\nSubtotal: $25.00\nTax: $2.50\nTotal: $27.50",
        "confidence": 0.0,
        "fallback": True,
        "engine": "fallback",
        "bboxes": [],
        "annotated_image": None,
    }
