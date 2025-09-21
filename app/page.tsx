"use client";

import type React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, Video, ImageIcon, Loader2, FileText, Download, Info, Eye, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRouter } from "next/navigation";

interface ProcessingStep {
  id: string;
  name: string;
  status: "pending" | "processing" | "completed" | "error";
  progress: number;
}

// New interfaces for wall analysis
interface WallDimensions {
  length_meters: number;
  width_meters: number;
  length_pixels: number;
  width_pixels: number;
  scale_factor: number;
}

interface WallData {
  wall_id: number;
  corners: number[][];
  depth_stats: {
    min_depth: number;
    max_depth: number;
    mean_depth: number;
    median_depth: number;
    std_depth: number;
  };
  measurements: {
    area_square_meters: number;
    area_pixels: number;
    dimensions: WallDimensions | null;
  };
  scores: {
    yolo_score: number;
    sam_score: number;
  };
  mask_base64: string;
}

interface WallAnalysisResult {
  success: boolean;
  message: string;
  wall_count: number;
  walls: WallData[];
  segmentation_visualization: string;
  measurement_visualization: string;
  summary: {
    total_wall_area_square_meters: number;
    average_yolo_confidence: number;
    average_sam_score: number;
    depth_range: {
      min: number;
      max: number;
      mean: number;
    };
    image_dimensions: {
      width: number;
      height: number;
    };
  };
}

const MeasurementAnalyzer = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [finalResult, setFinalResult] = useState<string>("");
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);

  // New state for wall analysis
  const [wallAnalysisResult, setWallAnalysisResult] = useState<WallAnalysisResult | null>(null);
  const [isAnalyzingWalls, setIsAnalyzingWalls] = useState(false);
  const [wallAnalysisError, setWallAnalysisError] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'ai_analysis' | 'wall_analysis'>('wall_analysis');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const router = useRouter();

  const initialSteps: ProcessingStep[] = [
    {
      id: "upload",
      name: "Media Upload & Summary",
      status: "pending",
      progress: 0,
    },
    {
      id: "questions",
      name: "Generating Analysis Questions",
      status: "pending",
      progress: 0,
    },
    {
      id: "analysis",
      name: "Detailed Measurement Analysis",
      status: "pending",
      progress: 0,
    },
    {
      id: "formatting",
      name: "Formatting Final Results",
      status: "pending",
      progress: 0,
    },
  ];

  const addLog = (message: string) => {
    setProcessingLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const updateStep = (
    stepIndex: number,
    status: ProcessingStep["status"],
    progress: number
  ) => {
    setProcessingSteps((prev) =>
      prev.map((step, index) =>
        index === stepIndex ? { ...step, status, progress } : step
      )
    );
    setCurrentStep(stepIndex);
  };

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validTypes = [
        "video/mp4",
        "video/avi",
        "video/mov",
        "video/wmv",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ];

      if (!validTypes.includes(file.type)) {
        alert("Please select a valid video or image file");
        return;
      }

      const maxSize = 100 * 1024 * 1024; // 100MB
      if (file.size > maxSize) {
        alert("File size must be less than 100MB");
        return;
      }

      setUploadedFile(file);
      setFilePreview(URL.createObjectURL(file));
      setProcessingSteps(initialSteps);
      setProcessingLogs([]);
      setFinalResult("");
      setSessionId("");
      // Reset wall analysis state
      setWallAnalysisResult(null);
      setWallAnalysisError("");
      setIsAnalyzingWalls(false);
      setActiveTab('wall_analysis');
    },
    []
  );

  const uploadAndSummarize = async (): Promise<string> => {
    if (!uploadedFile) throw new Error("No file uploaded");

    updateStep(0, "processing", 25);
    addLog("Uploading file to NVIDIA API...");

    // Upload file
    const formData = new FormData();
    formData.append("mediaFiles", uploadedFile);

    const uploadResponse = await fetch("/api/process-media", {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error("Upload failed");
    }

    const uploadData = await uploadResponse.json();
    setSessionId(uploadData.sessionId);

    updateStep(0, "processing", 50);
    addLog("File uploaded successfully, generating summary...");

    // Get summary

    console.log("Session ID:", uploadData.sessionId);
    const summaryResponse = await fetch("/api/process-media?action=chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: uploadData.sessionId,
        query:
          "Summarize this video/image focusing on any visible measurements, dimensions, construction elements, rooms, walls, floors, ceilings, or any structural components that could be measured.",
        stream: false,
      }),
    });

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices?.[0]?.message?.content || "";
    console.log("Summary:", summary);
    updateStep(0, "completed", 100);
    addLog("Summary generated successfully");

    return summary;
  };

  const generateQuestions = async (summary: string): Promise<string[]> => {
    updateStep(1, "processing", 50);
    addLog("Generating detailed analysis questions...");

    const response = await fetch("/api/openai-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary,
        mediaType: uploadedFile?.type.startsWith("video") ? "video" : "image",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate questions");
    }

    const data = await response.json();
    const questions = data.questions || [];

    updateStep(1, "completed", 100);
    addLog(`Generated ${questions.length} analysis questions`);

    return questions;
  };

  const analyzeWithQuestions = async (
    questions: string[]
  ): Promise<string[]> => {
    updateStep(2, "processing", 0);
    addLog("Starting detailed measurement analysis...");

    const answers: string[] = [];

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const progress = ((i + 1) / questions.length) * 100;

      updateStep(2, "processing", progress);
      addLog(
        `Analyzing question ${i + 1}/${questions.length}: ${question.substring(
          0,
          50
        )}...`
      );

      const response = await fetch("/api/process-media?action=chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          query: question,
          stream: false,
        }),
      });

      const data = await response.json();
      const answer =
        data.choices?.[0]?.message?.content || "No answer available";
      answers.push(answer);

      // Small delay to avoid overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    updateStep(2, "completed", 100);
    addLog("Detailed analysis completed");

    return answers;
  };

  const formatFinalResult = async (
    questions: string[],
    answers: string[]
  ): Promise<string> => {
    updateStep(3, "processing", 50);
    addLog("Formatting final measurements...");

    const qaData = questions.map((q, i) => ({
      question: q,
      answer: answers[i] || "No answer",
    }));

    const response = await fetch("/api/openai-format", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qaData }),
    });

    if (!response.ok) {
      throw new Error("Failed to format results");
    }

    const data = await response.json();
    const formattedResult =
      data.result || "No measurements could be determined";

    updateStep(3, "completed", 100);
    addLog("Final formatting completed");

    return formattedResult;
  };

  const startAnalysis = async () => {
    if (!uploadedFile) return;

    setIsProcessing(true);
    setCurrentStep(0);

    try {
      // Step 1: Upload and summarize
      const summary = await uploadAndSummarize();

      // Step 2: Generate questions
      const questions = await generateQuestions(summary);

      // Step 3: Analyze with questions
      const answers = await analyzeWithQuestions(questions);

      // Step 4: Format final result
      const result = await formatFinalResult(questions, answers);

      setFinalResult(result);
      addLog("Analysis completed successfully!");
    } catch (error) {
      console.error("Analysis error:", error);
      addLog(`Error: ${error}`);
      updateStep(currentStep, "error", 0);
    } finally {
      setIsProcessing(false);
    }
  };

  // Unified measurement analysis pipeline
  const startMeasurementAnalysis = async () => {
    if (!uploadedFile) {
      setWallAnalysisError('Please upload an image first');
      return;
    }

    if (!uploadedFile.type.startsWith('image/')) {
      setWallAnalysisError('Measurement analysis is only available for images');
      return;
    }

    console.log('🚀 Starting unified measurement analysis pipeline...');
    console.log('📁 File:', uploadedFile.name);

    setIsAnalyzingWalls(true);
    setWallAnalysisError('');
    setIsProcessing(true);
    setCurrentStep(0);
    setProcessingLogs([]);
    setProcessingSteps([
      { id: "segmentation", name: "Wall Segmentation (YOLOv8 + SAM)", status: "pending", progress: 0 },
      { id: "depth_analysis", name: "Depth Map Generation (DepthPro)", status: "pending", progress: 0 },
      { id: "measurements", name: "Calculating Real-world Measurements", status: "pending", progress: 0 },
      { id: "visualization", name: "Generating Results Visualizations", status: "pending", progress: 0 }
    ]);
    
    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      // Step 1: Wall Segmentation
      updateStep(0, "processing", 50);
      addLog('Step 1: Performing wall segmentation using YOLOv8 and SAM models...');
      console.log('📤 Sending request to /analyze endpoint for complete analysis...');
      
      const response = await fetch('http://localhost:8000/analyze', {
        method: 'POST',
        body: formData,
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      updateStep(0, "completed", 100);
      updateStep(1, "processing", 50);
      addLog('Step 1 completed: Wall segmentation successful');
      addLog('Step 2: Generating depth map using DepthPro model...');

      const data: WallAnalysisResult = await response.json();
      console.log('📊 Response data:', data);

      updateStep(1, "completed", 100);
      updateStep(2, "processing", 50);
      addLog('Step 2 completed: Depth map generated successfully');
      addLog('Step 3: Calculating real-world measurements from depth data...');
      
      if (data.success) {
        updateStep(2, "completed", 100);
        updateStep(3, "processing", 50);
        addLog('Step 3 completed: Measurements calculated successfully');
        addLog('Step 4: Generating visualization images...');

        updateStep(3, "completed", 100);
        addLog('✅ Complete measurement analysis pipeline finished successfully!');
        
        console.log('✅ Unified measurement analysis successful!');
        setWallAnalysisResult(data);
        setActiveTab('wall_analysis');
      } else {
        throw new Error(data.message || 'Wall analysis failed');
      }
    } catch (err) {
      console.error('💥 Error in measurement analysis pipeline:', err);
      const errorMessage = `Error: ${(err as Error).message}`;
      setWallAnalysisError(errorMessage);
      addLog(`❌ ${errorMessage}`);
      updateStep(currentStep, "error", 0);
    } finally {
      setIsAnalyzingWalls(false);
      setIsProcessing(false);
    }
  };

  // Helper function to download images
  const downloadImage = (imageData: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${imageData}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isVideo = uploadedFile?.type.startsWith("video");
  const isImage = uploadedFile?.type.startsWith("image");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Construction Measurement Analyzer
            </h1>
            <p className="text-gray-600 text-lg">
              AI-powered measurement extraction from videos and images
            </p>
          </div>

          {/* Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Upload Media File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 cursor-pointer hover:border-blue-400 transition-colors text-center"
                >
                  <div className="flex justify-center gap-4 mb-4">
                    <Video className="w-16 h-16 text-gray-400" />
                    <ImageIcon className="w-16 h-16 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">
                    Upload Video or Image
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Select a construction video or image for measurement
                    analysis
                  </p>
                  <Button>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex justify-center items-center">
                      {isVideo ? (
                        <video
                          src={filePreview}
                          controls
                          className="w-auto h-auto max-w-md max-h-64 rounded-lg object-contain"
                        />
                      ) : (
                        <img
                          src={filePreview || "/placeholder.svg"}
                          alt="Uploaded"
                          className="w-auto h-auto max-w-md max-h-64 rounded-lg object-contain"
                        />
                      )}
                    </div>
                    <div className="mt-4 text-center">
                      <p className="font-medium text-gray-700">
                        {uploadedFile.name}
                      </p>
                      <p className="text-gray-500 text-sm">
                        {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={startAnalysis}
                      disabled={isProcessing}
                      size="lg"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Start AI Analysis
                        </>
                      )}
                    </Button>

                    {isImage && (
                      <Button
                        onClick={startMeasurementAnalysis}
                        disabled={isAnalyzingWalls || isProcessing}
                        variant="outline"
                        size="lg"
                      >
                        {isAnalyzingWalls || isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <BarChart3 className="w-4 h-4 mr-2" />
                            Start Measurement Analysis
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Steps */}
          {(isProcessing || isAnalyzingWalls) && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Analysis Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {processingSteps.map((step) => (
                    <div key={step.id} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span
                          className={`font-medium ${step.status === "completed"
                              ? "text-green-600"
                              : step.status === "processing"
                                ? "text-blue-600"
                                : step.status === "error"
                                  ? "text-red-600"
                                  : "text-gray-500"
                            }`}
                        >
                          {step.name}
                        </span>
                        <span className="text-sm text-gray-500">
                          {step.progress}%
                        </span>
                      </div>
                      <Progress value={step.progress} className="w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Logs */}
          {processingLogs.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Processing Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {processingLogs.map((log, index) => (
                    <div key={index} className="text-sm text-gray-600 mb-1">
                      {log}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Tabs */}
          {(finalResult || wallAnalysisResult) && (
            <div className="mb-4">
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('ai_analysis')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    activeTab === 'ai_analysis'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  AI Analysis
                </button>
                <button
                  onClick={() => setActiveTab('wall_analysis')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    activeTab === 'wall_analysis'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 inline mr-2" />
                  Wall Analysis
                </button>
              </div>
            </div>
          )}

          {/* AI Analysis Results */}
          {finalResult && activeTab === 'ai_analysis' && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  AI Measurement Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-50 rounded-lg p-6">
                  <pre className="whitespace-pre-wrap text-gray-800 font-mono text-sm leading-relaxed">
                    {finalResult}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Wall Analysis Results */}
          {wallAnalysisResult && activeTab === 'wall_analysis' && (
            <div className="space-y-6">
              {/* Summary Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Wall Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-600 font-medium">Walls Detected</p>
                      <p className="text-2xl font-bold text-blue-900">{wallAnalysisResult.wall_count}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-green-600 font-medium">Total Area</p>
                      <p className="text-2xl font-bold text-green-900">
                        {wallAnalysisResult.summary.total_wall_area_square_meters.toFixed(2)} m²
                      </p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-sm text-purple-600 font-medium">Depth Range</p>
                      <p className="text-lg font-bold text-purple-900">
                        {wallAnalysisResult.summary.depth_range.min.toFixed(1)}-{wallAnalysisResult.summary.depth_range.max.toFixed(1)}m
                      </p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-sm text-orange-600 font-medium">Avg Confidence</p>
                      <p className="text-2xl font-bold text-orange-900">
                        {(wallAnalysisResult.summary.average_yolo_confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Visualization */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    Wall Measurement Visualization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <div className="w-full max-w-3xl">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-gray-800">Segmented Wall with Measurements</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadImage(wallAnalysisResult.measurement_visualization, 'wall_analysis.png')}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
                        <img
                          src={`data:image/png;base64,${wallAnalysisResult.measurement_visualization}`}
                          alt="Wall Analysis"
                          className="max-w-full h-auto max-h-[600px] object-contain rounded-lg border shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Wall Data */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Wall Measurements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {wallAnalysisResult.walls.map((wall, index) => (
                      <div key={wall.wall_id} className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-semibold text-lg mb-4 text-gray-800">
                          Wall {wall.wall_id}
                        </h4>
                        
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Measurements */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-3">Measurements</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Area:</span>
                                <span className="font-medium">{wall.measurements.area_square_meters.toFixed(2)} m²</span>
                              </div>
                              {wall.measurements.dimensions && (
                                <>
                                  <div className="flex justify-between">
                                    <span>Height:</span>
                                    <span className="font-medium">{wall.measurements.dimensions.length_meters.toFixed(2)} m</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Width:</span>
                                    <span className="font-medium">{wall.measurements.dimensions.width_meters.toFixed(2)} m</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between">
                                <span>Mean Depth:</span>
                                <span className="font-medium">{wall.depth_stats.mean_depth.toFixed(2)} m</span>
                              </div>
                            </div>
                          </div>

                          {/* Depth Statistics */}
                          <div>
                            <h5 className="font-medium text-gray-700 mb-3">Depth Analysis</h5>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Min Depth:</span>
                                <span className="font-medium">{wall.depth_stats.min_depth.toFixed(2)} m</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Max Depth:</span>
                                <span className="font-medium">{wall.depth_stats.max_depth.toFixed(2)} m</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Std Deviation:</span>
                                <span className="font-medium">{wall.depth_stats.std_depth.toFixed(3)} m</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Detection Score:</span>
                                <span className="font-medium">{(wall.scores.yolo_score * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Corner Coordinates */}
                        {wall.corners.length > 0 && (
                          <div className="mt-4">
                            <h5 className="font-medium text-gray-700 mb-2">Corner Coordinates</h5>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                              {wall.corners.map((corner, idx) => (
                                <div key={idx} className="bg-white p-2 rounded border">
                                  <span className="text-gray-500">
                                    {['TL', 'TR', 'BR', 'BL'][idx] || `C${idx + 1}`}:
                                  </span>
                                  <br />
                                  <span className="font-mono">
                                    ({Math.round(corner[0])}, {Math.round(corner[1])})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Wall Analysis Error */}
          {wallAnalysisError && (
            <Card className="mb-8 border-red-200">
              <CardContent className="pt-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Wall Analysis Error</p>
                  <p className="text-red-600 text-sm mt-1">{wallAnalysisError}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeasurementAnalyzer;