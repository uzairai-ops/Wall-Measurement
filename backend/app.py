from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import numpy as np
import logging
from dotenv import load_dotenv
load_dotenv()
from helperClass import WallAnalysisService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Wall Analysis API with Depth Estimation", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# Initialize the service
wall_analysis_service = WallAnalysisService()

@app.get("/")
async def root():
    return {"message": "Wall Analysis API with Depth Estimation is running"}

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "device": wall_analysis_service.device,
        "models_loaded": {
            "yolo": wall_analysis_service.yolo_model is not None,
            "sam": wall_analysis_service.sam_model is not None,
            "depth_pro": wall_analysis_service.depth_model is not None
        }
    }

@app.post("/analyze")
async def analyze_walls(file: UploadFile = File(...)):
    """Upload image and perform complete wall analysis with depth estimation"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only image files are supported")
        
        file_content = await file.read()
        
        logger.info(f"Processing uploaded file: {file.filename}")
        logger.info(f"File size: {len(file_content)} bytes")
        
        # Step 1: Preprocess image
        logger.info("Step 1: Preprocessing image...")
        image, pil_image = wall_analysis_service.preprocess_image(file_content)
        logger.info(f"Image preprocessed - OpenCV shape: {image.shape}, PIL size: {pil_image.size}")
        
        # Step 2: Detect walls
        logger.info("Step 2: Detecting walls...")
        wall_detections = wall_analysis_service.detect_walls(image)
        
        if not wall_detections:
            logger.info("No walls detected, returning early response")
            return JSONResponse(
                content={
                    "success": True,
                    "message": "No walls detected in the image",
                    "wall_count": 0,
                    "walls": [],
                    "segmentation_visualization": None,
                    "measurement_visualization": None
                }
            )
        
        # Step 3: Segment walls
        logger.info("Step 3: Segmenting walls...")
        wall_segments = wall_analysis_service.segment_walls(image, wall_detections)
        logger.info(f"Wall segments created: {len(wall_segments)}")
        
        # Step 4: Generate depth map
        logger.info("Step 4: Generating depth map...")
        try:
            depth_map = wall_analysis_service.generate_depth_map(pil_image)
            logger.info(f"Depth map generated successfully with shape: {depth_map.shape}")
        except Exception as depth_error:
            logger.error(f"Depth map generation failed: {str(depth_error)}")
            # Return basic segmentation results if depth analysis fails
            segmentation_viz = wall_analysis_service.create_visualization(image, wall_segments)
            return JSONResponse(
                content={
                    "success": False,
                    "message": f"Wall segmentation completed but depth analysis failed: {str(depth_error)}",
                    "wall_count": len(wall_segments),
                    "walls": [],
                    "segmentation_visualization": segmentation_viz,
                    "measurement_visualization": None,
                    "error_details": str(depth_error)
                }
            )
        
        # Step 5: Analyze wall depths and calculate measurements
        logger.info("Step 5: Analyzing wall depths...")
        try:
            wall_depth_analysis = wall_analysis_service.analyze_wall_depths(wall_segments, depth_map, image.shape)
            logger.info(f"Wall depth analysis completed for {len(wall_depth_analysis)} walls")
        except Exception as analysis_error:
            logger.error(f"Wall depth analysis failed: {str(analysis_error)}")
            # Return basic segmentation if depth analysis fails
            segmentation_viz = wall_analysis_service.create_visualization(image, wall_segments)
            return JSONResponse(
                content={
                    "success": False,
                    "message": f"Depth analysis failed: {str(analysis_error)}",
                    "wall_count": len(wall_segments),
                    "walls": [],
                    "segmentation_visualization": segmentation_viz,
                    "measurement_visualization": None,
                    "error_details": str(analysis_error)
                }
            )
        
        # Step 6: Create visualizations
        logger.info("Step 6: Creating visualizations...")
        try:
            # Only create measurement visualization (which includes segmentation)
            measurement_viz = wall_analysis_service.create_measurement_visualization(image, wall_depth_analysis)
            logger.info("Measurement visualization created")
            # Use the same visualization for both
            segmentation_viz = measurement_viz
        except Exception as viz_error:
            logger.error(f"Visualization creation failed: {str(viz_error)}")
            # Continue without visualizations
            segmentation_viz = None
            measurement_viz = None
        
        # Step 7: Prepare response
        logger.info("Step 7: Preparing response...")
        total_area = sum([analysis['area_square_meters'] for analysis in wall_depth_analysis])
        avg_yolo_confidence = np.mean([analysis['yolo_score'] for analysis in wall_depth_analysis])
        avg_sam_score = np.mean([analysis['sam_score'] for analysis in wall_depth_analysis])
        
        response_data = {
            "success": True,
            "message": f"Successfully analyzed {len(wall_depth_analysis)} walls with depth estimation",
            "wall_count": len(wall_depth_analysis),
            "walls": [
                {
                    "wall_id": analysis['wall_id'],
                    "corners": analysis['corners'],
                    "depth_stats": {
                        "min_depth": analysis['min_depth'],
                        "max_depth": analysis['max_depth'],
                        "mean_depth": analysis['mean_depth'],
                        "median_depth": analysis['median_depth'],
                        "std_depth": analysis['std_depth']
                    },
                    "measurements": {
                        "area_square_meters": analysis['area_square_meters'],
                        "area_pixels": analysis['area_pixels'],
                        "dimensions": analysis['dimensions']
                    },
                    "scores": {
                        "yolo_score": analysis['yolo_score'],
                        "sam_score": analysis['sam_score']
                    },
                    "mask_base64": analysis['mask_base64']
                } for analysis in wall_depth_analysis
            ],
            "segmentation_visualization": segmentation_viz,
            "measurement_visualization": measurement_viz,
            "summary": {
                "total_wall_area_square_meters": float(total_area),
                "average_yolo_confidence": float(avg_yolo_confidence),
                "average_sam_score": float(avg_sam_score),
                "depth_range": {
                    "min": float(np.min(depth_map)),
                    "max": float(np.max(depth_map)),
                    "mean": float(np.mean(depth_map))
                },
                "image_dimensions": {
                    "width": int(image.shape[1]),
                    "height": int(image.shape[0])
                }
            }
        }
        
        logger.info(f"Successfully analyzed {file.filename}: {len(wall_depth_analysis)} walls, total area: {total_area:.2f} m²")
        logger.info("Analysis completed successfully, returning response")
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error processing analysis: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")

# Keep the original upload endpoint for backward compatibility
@app.post("/upload")
async def upload_and_segment(file: UploadFile = File(...)):
    """Upload image and perform basic wall segmentation (legacy endpoint)"""
    try:
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="Only image files are supported")
        
        file_content = await file.read()
        
        logger.info(f"Processing uploaded file: {file.filename}")
        image, _ = wall_analysis_service.preprocess_image(file_content)
        
        wall_detections = wall_analysis_service.detect_walls(image)
        
        if not wall_detections:
            return JSONResponse(
                content={
                    "success": True,
                    "message": "No walls detected in the image",
                    "wall_count": 0,
                    "walls": [],
                    "visualization": None
                }
            )
        
        wall_segments = wall_analysis_service.segment_walls(image, wall_detections)
        
        # Create basic visualization
        visualization_base64 = wall_analysis_service.create_visualization(image, wall_segments)
        
        avg_yolo_confidence = np.mean([segment['yolo_score'] for segment in wall_segments])
        avg_sam_score = np.mean([segment['sam_score'] for segment in wall_segments])
        total_wall_area = sum([segment['mask_area_pixels'] for segment in wall_segments])
        
        response_data = {
            "success": True,
            "message": f"Successfully segmented {len(wall_segments)} walls",
            "wall_count": len(wall_segments),
            "walls": [
                {
                    "wall_id": segment['wall_id'],
                    "mask_base64": segment['mask_base64'],
                    "sam_score": segment['sam_score'],
                    "yolo_score": segment['yolo_score'],
                    "bbox": segment['bbox'],
                    "mask_area_pixels": segment['mask_area_pixels'],
                    "bbox_dimensions": segment['bbox_dimensions']
                } for segment in wall_segments
            ],
            "visualization": visualization_base64,
            "summary": {
                "average_yolo_confidence": float(avg_yolo_confidence),
                "average_sam_score": float(avg_sam_score),
                "total_wall_area_pixels": int(total_wall_area),
                "image_dimensions": {
                    "width": int(image.shape[1]),
                    "height": int(image.shape[0])
                }
            }
        }
        
        logger.info(f"Successfully processed {file.filename}: {len(wall_segments)} walls found")
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)