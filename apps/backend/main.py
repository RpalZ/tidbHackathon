
from fastapi import FastAPI, HTTPException
from paddleocr import PaddleOCR, PPStructureV3
from pydantic import BaseModel, Field
from datetime import datetime
import base64


class OCRRequest(BaseModel):
    file: str = Field(..., description="Base64 encoded PDF file to be processed")

app = FastAPI()

ocr = PPStructureV3(
    use_doc_orientation_classify=False, # Disables document orientation classification model via this parameter
    use_doc_unwarping=False, # Disables text image rectification model via this parameter
    use_textline_orientation=False, # Disables text line orientation classification model via this parameter
    use_chart_recognition=False,
    text_recognition_model_name="en_PP-OCRv4_mobile_rec",  # Use mobile recognition model
    enable_mkldnn=True,  # Add this to disable MKLDNN mode
    cpu_threads=8,  # Set to the number of physical CPU cores
)   

@app.get('/')
def root(): 
    print('hello world')
    return "main chicka"

@app.get("/test")
def test(): 
 
    # ocr = PaddleOCR(lang="en") # Uses English model by specifying language parameter
    # ocr = PaddleOCR(ocr_version="PP-OCRv4") # Uses other PP-OCR versions via version parameter
    # ocr = PaddleOCR(device="gpu") # Enables GPU acceleration for model inference via device parameter
    # ocr = PaddleOCR(
    #     text_detection_model_name="PP-OCRv5_mobile_det",
    #     text_recognition_model_name="PP-OCRv5_mobile_rec",
    #     use_doc_orientation_classify=False,
    #     use_doc_unwarping=False,
    #     use_textline_orientation=False,
    # ) # Switch to PP-OCRv5_mobile models
    print("testing OCR")
    time_start = datetime.now()
    test_pdf = "./test1.png"
    result = ocr.predict(test_pdf)  
    # results = []
    markdown = result[0].markdown["markdown_texts"]
    for res in result:
        res.save_to_markdown(save_path="output")
        res.save_to_img(save_path="output")

    
    print("OCR test completed")
    time_end =   datetime.now() - time_start 
    print(f"Time taken for OCR processing: {time_end.total_seconds()} seconds")
    return {
        "result": markdown,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }