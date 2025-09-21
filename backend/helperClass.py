import cv2
import numpy as np
import torch
from ultralytics import YOLO
from segment_anything import sam_model_registry, SamPredictor
from transformers import DepthProImageProcessorFast, DepthProForDepthEstimation
import os
import base64
from io import BytesIO
from PIL import Image
from typing import List, Dict, Any
import json
from datetime import datetime
import logging


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WallAnalysisService:
    def __init__(self):
        self.yolo_model = None
        self.sam_model = None
        self.sam_predictor = None
        self.depth_processor = None
        self.depth_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.load_models()
    
    def load_models(self):
        """Load YOLOv8, SAM, and DepthPro models"""
        try:
            # Load YOLOv8 model
            yolo_model_path = "yolov8_model/best (2).pt"
            if not os.path.exists(yolo_model_path):
                raise FileNotFoundError(f"YOLOv8 model not found at {yolo_model_path}")
            
            self.yolo_model = YOLO(yolo_model_path)
            logger.info(f"YOLOv8 model loaded from: {yolo_model_path}")
            
            # Load SAM model
            sam_checkpoint_path = "sam_model/sam_vit_h_4b8939.pth"
            if not os.path.exists(sam_checkpoint_path):
                raise FileNotFoundError(f"SAM model not found at {sam_checkpoint_path}")
            
            self.sam_model = sam_model_registry["vit_h"](checkpoint=sam_checkpoint_path)
            self.sam_model.to(device=self.device)
            self.sam_predictor = SamPredictor(self.sam_model)
            logger.info(f"SAM model loaded on device: {self.device}")
            
            # Load DepthPro model
            logger.info("Loading DepthPro model...")
            self.depth_processor = DepthProImageProcessorFast.from_pretrained("apple/DepthPro-hf")
            self.depth_model = DepthProForDepthEstimation.from_pretrained("apple/DepthPro-hf").to(self.device)
            logger.info("DepthPro model loaded successfully!")
            
        except Exception as e:
            logger.error(f"Error loading models: {str(e)}")
            raise
    
    def preprocess_image(self, image_bytes: bytes) -> tuple:
        """Convert uploaded image bytes to OpenCV format and PIL format"""
        try:
            # Load with PIL for depth estimation and EXIF handling
            pil_image = Image.open(BytesIO(image_bytes))
            
            # Handle EXIF orientation
            try:
                from PIL.ExifTags import TAGS
                exif = pil_image._getexif()
                if exif is not None:
                    orientation_key = None
                    for key, value in TAGS.items():
                        if value == 'Orientation':
                            orientation_key = key
                            break
                    
                    if orientation_key and orientation_key in exif:
                        orientation = exif[orientation_key]
                        if orientation == 3:
                            pil_image = pil_image.rotate(180, expand=True)
                        elif orientation == 6:
                            pil_image = pil_image.rotate(270, expand=True)
                        elif orientation == 8:
                            pil_image = pil_image.rotate(90, expand=True)
            except (AttributeError, KeyError, TypeError, ImportError):
                pass
         
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            
            # Convert to numpy array and then to OpenCV format
            image_array = np.array(pil_image)
            image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
            return image_bgr, pil_image
            
        except Exception as e:
            logger.error(f"Error preprocessing image: {str(e)}")
            raise
    
    def detect_walls(self, image: np.ndarray, confidence: float = 0.3) -> List[Dict[str, Any]]:
        """Detect walls using YOLOv8"""
        try:
            results = self.yolo_model.predict(image, conf=confidence, save=False, verbose=False)
            
            wall_detections = []
            
            if results[0].boxes is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                scores = results[0].boxes.conf.cpu().numpy()
                classes = results[0].boxes.cls.cpu().numpy()
                
                for i in range(len(boxes)):
                    class_id = int(classes[i])
                    class_name = self.yolo_model.names[class_id]
                    
                    if class_name == 'wall':
                        wall_detections.append({
                            'bbox': boxes[i].tolist(),
                            'score': float(scores[i]),
                            'class_id': class_id,
                            'class_name': class_name
                        })
            
            logger.info(f"Wall detections found: {len(wall_detections)}")
            return wall_detections
            
        except Exception as e:
            logger.error(f"Error in wall detection: {str(e)}")
            raise
    
    def segment_walls(self, image: np.ndarray, wall_detections: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Segment walls using SAM"""
        try:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            self.sam_predictor.set_image(image_rgb)
            
            wall_segments = []
            
            for i, wall_det in enumerate(wall_detections):
                logger.info(f"Processing wall {i+1}/{len(wall_detections)}")
                
                x1, y1, x2, y2 = wall_det['bbox']
                input_box = np.array([[x1, y1, x2, y2]])
                
                masks, scores, logits = self.sam_predictor.predict(
                    point_coords=None,
                    point_labels=None,
                    box=input_box[None, :],
                    multimask_output=False,
                )
                
                # Store mask as numpy array for further processing
                mask_array = masks[0]
                
                # Encode mask for response
                mask_uint8 = (mask_array * 255).astype(np.uint8)
                _, mask_encoded = cv2.imencode('.png', mask_uint8)
                mask_base64 = base64.b64encode(mask_encoded).decode('utf-8')
                
                wall_segments.append({
                    'wall_id': i + 1,
                    'mask_array': mask_array,  # Keep for depth analysis
                    'mask_base64': mask_base64,
                    'sam_score': float(scores[0]),
                    'yolo_score': wall_det['score'],
                    'bbox': wall_det['bbox'],
                    'mask_area_pixels': int(np.sum(mask_array)),
                    'bbox_dimensions': {
                        'width': float(x2 - x1),
                        'height': float(y2 - y1)
                    }
                })
            
            logger.info(f"Processed {len(wall_segments)} wall segments")
            return wall_segments
            
        except Exception as e:
            logger.error(f"Error in wall segmentation: {str(e)}")
            raise
    
    def get_wall_corners(self, mask: np.ndarray) -> np.ndarray:
        """Extract corner coordinates from wall mask"""
        try:
            contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if not contours:
                return np.array([])
            
            largest_contour = max(contours, key=cv2.contourArea)
            epsilon = 0.02 * cv2.arcLength(largest_contour, True)
            approx = cv2.approxPolyDP(largest_contour, epsilon, True)
            
            if len(approx) != 4:
                x, y, w, h = cv2.boundingRect(largest_contour)
                corners = np.array([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
            else:
                corners = approx.reshape(-1, 2)
            
            return self.sort_corners(corners)
            
        except Exception as e:
            logger.error(f"Error extracting wall corners: {str(e)}")
            return np.array([])
    
    def sort_corners(self, corners: np.ndarray) -> np.ndarray:
        """Sort corners clockwise from top-left"""
        if len(corners) == 0:
            return corners
            
        center = np.mean(corners, axis=0)
        
        def angle_from_center(point):
            return np.arctan2(point[1] - center[1], point[0] - center[0])
        
        sorted_corners = sorted(corners, key=angle_from_center)
        min_sum_idx = np.argmin([p[0] + p[1] for p in sorted_corners])
        ordered_corners = sorted_corners[min_sum_idx:] + sorted_corners[:min_sum_idx]
        
        return np.array(ordered_corners)
    
    def generate_depth_map(self, pil_image: Image.Image) -> np.ndarray:
        """Generate depth map using DepthPro"""
        try:
            logger.info(f"Generating depth map for image size: {pil_image.size}")
            
            # Preprocess image
            logger.info("Preprocessing image for depth estimation...")
            inputs = self.depth_processor(images=pil_image, return_tensors="pt").to(self.depth_model.device)
            logger.info(f"Input tensor shape: {inputs['pixel_values'].shape}")
            
            # Inference
            logger.info("Running depth inference...")
            with torch.no_grad():
                outputs = self.depth_model(**inputs)
            
            logger.info("Post-processing depth results...")
            # Post-process to match original resolution
            depth = self.depth_processor.post_process_depth_estimation(
                outputs, target_sizes=[(pil_image.height, pil_image.width)]
            )[0]
            
            depth_map = depth['predicted_depth'].squeeze().cpu().numpy()
            
            logger.info(f"Depth map generated successfully!")
            logger.info(f"Depth map shape: {depth_map.shape}")
            logger.info(f"Depth range: {np.min(depth_map):.3f}m to {np.max(depth_map):.3f}m")
            logger.info(f"Mean depth: {np.mean(depth_map):.3f}m")
            
            return depth_map
            
        except Exception as e:
            logger.error(f"Error generating depth map: {str(e)}")
            logger.error(f"Error type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def calculate_pixel_to_meter_scale(self, depth_value: float, focal_length: float) -> float:
        """Calculate the scale factor to convert pixels to meters at a given depth"""
        return depth_value / focal_length
    
    def calculate_wall_area_in_meters(self, mask: np.ndarray, wall_depths: np.ndarray, focal_length: float) -> float:
        """Calculate wall area in square meters using depth information"""
        try:
            # Use the median depth for more stable calculation
            representative_depth = np.median(wall_depths)
            
            # Calculate the scale at this depth
            scale = self.calculate_pixel_to_meter_scale(representative_depth, focal_length)
            
            # Each pixel represents scale² square meters
            pixel_area_m2 = scale ** 2
            
            # Total area is number of pixels * area per pixel
            total_area = np.sum(mask) * pixel_area_m2
            
            return total_area
            
        except Exception as e:
            logger.error(f"Error calculating wall area: {str(e)}")
            return 0.0
    
    def calculate_wall_dimensions(self, corners: np.ndarray, mean_depth: float, focal_length: float) -> Dict[str, Any]:
        """Calculate length and width of wall from corners using depth information"""
        try:
            if len(corners) != 4:
                return None
            
            # Calculate pixel distances for each side
            top_side = np.linalg.norm(corners[1] - corners[0])
            right_side = np.linalg.norm(corners[2] - corners[1])
            bottom_side = np.linalg.norm(corners[3] - corners[2])
            left_side = np.linalg.norm(corners[0] - corners[3])
            
            # Calculate average width and length in pixels
            width_pixels = (top_side + bottom_side) / 2
            height_pixels = (left_side + right_side) / 2
            
            # Convert to meters using depth
            scale = self.calculate_pixel_to_meter_scale(mean_depth, focal_length)
            
            width_meters = width_pixels * scale
            height_meters = height_pixels * scale
            
            # Determine which is length and which is width
            if width_meters >= height_meters:
                length_meters = width_meters
                width_meters_final = height_meters
                length_pixels = width_pixels
                width_pixels_final = height_pixels
            else:
                length_meters = height_meters
                width_meters_final = width_meters
                length_pixels = height_pixels
                width_pixels_final = width_pixels
            
            return {
                'length_meters': float(length_meters),
                'width_meters': float(width_meters_final),
                'length_pixels': float(length_pixels),
                'width_pixels': float(width_pixels_final),
                'all_sides_pixels': [float(top_side), float(right_side), float(bottom_side), float(left_side)],
                'scale_factor': float(scale)
            }
            
        except Exception as e:
            logger.error(f"Error calculating wall dimensions: {str(e)}")
            return None
    
    def analyze_wall_depths(self, wall_segments: List[Dict[str, Any]], depth_map: np.ndarray, image_shape: tuple) -> List[Dict[str, Any]]:
        """Analyze depth values within wall regions and calculate measurements"""
        try:
            logger.info("Analyzing wall depths...")
            
            wall_depth_analysis = []
            height, width = image_shape[:2]
            
            # Estimate focal length (conservative estimate based on typical smartphone cameras)
            focal_length = max(width, height) * 0.8
            logger.info(f"Estimated focal length: {focal_length:.1f} pixels")
            
            for segment in wall_segments:
                wall_id = segment['wall_id']
                mask = segment['mask_array']
                
                # Get corner coordinates
                corners = self.get_wall_corners(mask)
                
                # Resize mask to match depth map if necessary
                if mask.shape != depth_map.shape:
                    resized_mask = cv2.resize(mask.astype(np.uint8), (depth_map.shape[1], depth_map.shape[0]), interpolation=cv2.INTER_NEAREST)
                    resized_mask = resized_mask.astype(bool)
                else:
                    resized_mask = mask.astype(bool)
                
                # Get depth values within the wall mask
                wall_depths = depth_map[resized_mask]
                
                if len(wall_depths) > 0 and len(corners) > 0:
                    # Calculate area in square meters
                    area_m2 = self.calculate_wall_area_in_meters(resized_mask, wall_depths, focal_length)
                    
                    # Calculate wall dimensions (length and width)
                    dimensions = self.calculate_wall_dimensions(corners, np.mean(wall_depths), focal_length)
                    
                    analysis = {
                        'wall_id': wall_id,
                        'corners': corners.tolist() if len(corners) > 0 else [],
                        'min_depth': float(np.min(wall_depths)),
                        'max_depth': float(np.max(wall_depths)),
                        'mean_depth': float(np.mean(wall_depths)),
                        'median_depth': float(np.median(wall_depths)),
                        'std_depth': float(np.std(wall_depths)),
                        'area_pixels': int(np.sum(resized_mask)),
                        'area_square_meters': float(area_m2),
                        'dimensions': dimensions,
                        'yolo_score': segment['yolo_score'],
                        'sam_score': segment['sam_score'],
                        'mask_base64': segment['mask_base64']  # Keep for visualization
                    }
                    
                    wall_depth_analysis.append(analysis)
                    
                    logger.info(f"Wall {wall_id}: Area={area_m2:.2f}m², Mean depth={np.mean(wall_depths):.2f}m")
                    if dimensions:
                        logger.info(f"  Dimensions: {dimensions['length_meters']:.2f}m x {dimensions['width_meters']:.2f}m")
            
            return wall_depth_analysis
            
        except Exception as e:
            logger.error(f"Error analyzing wall depths: {str(e)}")
            raise
    
    def create_visualization(self, image: np.ndarray, wall_segments: List[Dict[str, Any]]) -> str:
        """Create visualization with dark green segmentation overlay"""
        try:
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            overlay = image_rgb.copy()
            
            # Use dark green color for all segments
            dark_green = (0, 100, 0)  # Dark green color
            
            for i, segment in enumerate(wall_segments):
                # Get mask from mask_array if available, otherwise decode from base64
                if 'mask_array' in segment:
                    mask = segment['mask_array'] > 0
                else:
                    # Decode mask from base64
                    mask_bytes = base64.b64decode(segment['mask_base64'])
                    mask_array = np.frombuffer(mask_bytes, dtype=np.uint8)
                    mask = cv2.imdecode(mask_array, cv2.IMREAD_GRAYSCALE)
                    mask = mask > 0  # Convert to boolean mask
                
                # Apply dark green overlay to segmented areas only
                overlay[mask] = overlay[mask] * 0.5 + np.array(dark_green) * 0.5
                
                # Add wall label at center of mask with better visibility
                mask_coords = np.where(mask)
                if len(mask_coords[0]) > 0:
                    center_y, center_x = np.mean(mask_coords[0]), np.mean(mask_coords[1])
                    
                    # Add black outline for better text visibility
                    text = f"Wall {i+1}"
                    font = cv2.FONT_HERSHEY_SIMPLEX
                    font_scale = 1.5
                    thickness = 3
                    
                    # Calculate text size for better positioning
                    (text_width, text_height), _ = cv2.getTextSize(text, font, font_scale, thickness)
                    text_x = int(center_x - text_width // 2)
                    text_y = int(center_y + text_height // 2)
                    
                    # Draw black outline
                    cv2.putText(overlay, text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness + 2)
                    # Draw white text on top
                    cv2.putText(overlay, text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
            
            # Encode result
            _, img_encoded = cv2.imencode('.png', cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR))
            img_base64 = base64.b64encode(img_encoded).decode('utf-8')
            
            return img_base64
            
        except Exception as e:
            logger.error(f"Error creating visualization: {str(e)}")
            raise

    def create_measurement_visualization(self, image: np.ndarray, wall_depth_analysis: List[Dict[str, Any]]) -> str:
        """Create visualization with segmented overlay and measurements"""
        try:
            logger.info("Creating measurement visualization...")
            
            measurement_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB).copy()
            overlay = measurement_image.copy()
            
            # Very dark green for segmentation
            dark_green = (0, 40, 0)  # Much darker green
            
            # First, apply dark green segmentation for all walls
            for analysis in wall_depth_analysis:
                # Get or decode the mask
                if 'mask_base64' in analysis:
                    mask_bytes = base64.b64decode(analysis['mask_base64'])
                    mask_array = np.frombuffer(mask_bytes, dtype=np.uint8)
                    mask = cv2.imdecode(mask_array, cv2.IMREAD_GRAYSCALE)
                    mask = mask > 0
                    
                    # Apply dark green overlay with stronger opacity
                    overlay[mask] = overlay[mask] * 0.3 + np.array(dark_green) * 0.7
            
            # Blend the overlay with the original image with more overlay weight
            measurement_image = cv2.addWeighted(measurement_image, 0.4, overlay, 0.6, 0)
            
            # Now add measurements for each wall
            for idx, analysis in enumerate(wall_depth_analysis):
                if not analysis.get('corners') or not analysis.get('dimensions'):
                    continue
                    
                corners = np.array(analysis['corners'])
                wall_id = analysis['wall_id']
                dimensions = analysis['dimensions']
                area = analysis['area_square_meters']
                
                # Calculate center and bounds
                center = np.mean(corners, axis=0).astype(int)
                cx, cy = center
                
                # Get bounding box
                x_coords = corners[:, 0]
                y_coords = corners[:, 1]
                min_x, max_x = int(np.min(x_coords)), int(np.max(x_coords))
                min_y, max_y = int(np.min(y_coords)), int(np.max(y_coords))
                
                # Draw measurement lines through center
                # Horizontal line (width)
                cv2.line(measurement_image, (min_x, cy), (max_x, cy), (255, 255, 0), 3)
                # Add arrows at the ends
                cv2.arrowedLine(measurement_image, (min_x + 20, cy), (min_x, cy), (255, 255, 0), 3, tipLength=0.3)
                cv2.arrowedLine(measurement_image, (max_x - 20, cy), (max_x, cy), (255, 255, 0), 3, tipLength=0.3)
                
                # Vertical line (height)
                cv2.line(measurement_image, (cx, min_y), (cx, max_y), (255, 255, 0), 3)
                # Add arrows at the ends
                cv2.arrowedLine(measurement_image, (cx, min_y + 20), (cx, min_y), (255, 255, 0), 3, tipLength=0.3)
                cv2.arrowedLine(measurement_image, (cx, max_y - 20), (cx, max_y), (255, 255, 0), 3, tipLength=0.3)
                
                # Add measurement labels with background
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 2.5  # Large font size for better visibility
                font_thickness = 5  # Thicker text
                
                # Width label (on horizontal line)
                width_text = f"Width = {dimensions['width_meters']:.2f} m"
                (w_width, w_height), _ = cv2.getTextSize(width_text, font, font_scale, font_thickness)
                
                # Position width text above the horizontal line with even more spacing
                width_x = cx - w_width // 2
                width_y = cy - 100  # Much more spacing for larger text
                
                # Background for width text with padding
                padding = 20  # Much more padding for larger text
                cv2.rectangle(measurement_image, 
                            (width_x - padding, width_y - w_height - padding),
                            (width_x + w_width + padding, width_y + padding),
                            (0, 0, 0), -1)
                cv2.rectangle(measurement_image, 
                            (width_x - padding, width_y - w_height - padding),
                            (width_x + w_width + padding, width_y + padding),
                            (255, 255, 0), 4)
                cv2.putText(measurement_image, width_text, (width_x, width_y),
                          font, font_scale, (255, 255, 255), font_thickness, cv2.LINE_AA)
                
                # Height label (on vertical line) - positioned to the right side
                height_text = f"Height = {dimensions['length_meters']:.2f} m"
                (h_width, h_height), _ = cv2.getTextSize(height_text, font, font_scale, font_thickness)
                
                # Position height text to the right of vertical line with much more spacing
                height_x = cx + 100  # Much more spacing for larger text
                height_y = cy + h_height // 2
                
                # Background for height text with padding
                cv2.rectangle(measurement_image, 
                            (height_x - padding, height_y - h_height - padding),
                            (height_x + h_width + padding, height_y + padding),
                            (0, 0, 0), -1)
                cv2.rectangle(measurement_image, 
                            (height_x - padding, height_y - h_height - padding),
                            (height_x + h_width + padding, height_y + padding),
                            (255, 255, 0), 4)
                cv2.putText(measurement_image, height_text, (height_x, height_y),
                          font, font_scale, (255, 255, 255), font_thickness, cv2.LINE_AA)
                
                # Add area in top right corner of the wall
                area_text = f"Area = {area:.2f} m^2"  # Changed to m^2 instead of m²
                (a_width, a_height), _ = cv2.getTextSize(area_text, font, 2.2, 5)  # Much larger font size
                
                # Position in top-right of wall bounding box
                area_x = max_x - a_width - 20
                area_y = min_y + a_height + 20
                
                # Background for area text
                cv2.rectangle(measurement_image,
                            (area_x - 10, area_y - a_height - 10),
                            (area_x + a_width + 10, area_y + 10),
                            (0, 0, 0), -1)
                cv2.rectangle(measurement_image,
                            (area_x - 10, area_y - a_height - 10),
                            (area_x + a_width + 10, area_y + 10),
                            (255, 255, 0), 2)
                cv2.putText(measurement_image, area_text, (area_x, area_y),
                          font, 2.2, (255, 255, 255), 5, cv2.LINE_AA)  # Much larger font size and thickness
                
                # Add wall ID label
                wall_text = f"Wall {wall_id}"
                (wt_width, wt_height), _ = cv2.getTextSize(wall_text, font, 1.2, 3)  # Increased font size
                wall_label_x = min_x + 10
                wall_label_y = min_y + wt_height + 10
                
                # Background for wall ID
                cv2.rectangle(measurement_image,
                            (wall_label_x - 5, wall_label_y - wt_height - 5),
                            (wall_label_x + wt_width + 5, wall_label_y + 5),
                            (0, 100, 0), -1)
                cv2.putText(measurement_image, wall_text, (wall_label_x, wall_label_y),
                          font, 1.2, (255, 255, 255), 3, cv2.LINE_AA)  # Increased font size and thickness
            
            # Encode result
            _, img_encoded = cv2.imencode('.png', cv2.cvtColor(measurement_image, cv2.COLOR_RGB2BGR))
            img_base64 = base64.b64encode(img_encoded).decode('utf-8')
            
            return img_base64
            
        except Exception as e:
            logger.error(f"Error creating measurement visualization: {str(e)}")
            raise