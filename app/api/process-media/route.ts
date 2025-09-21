import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosResponse } from "axios";
import { extname } from "path";

const invokeUrl = "https://ai.api.nvidia.com/v1/vlm/nvidia/vila";
const kNvcfAssetUrl = "https://api.nvcf.nvidia.com/v2/nvcf/assets";

// const kApiKey = process.env.VILA_API_KEY;
// if (!kApiKey) {
//   throw new Error("VILA_API_KEY is not set");
// }
const kApiKey = "dummy_key"; // Commented out VILA API key check

const kSupportedList: Record<string, [string, string]> = {
  png: ["image/png", "img"],
  jpg: ["image/jpg", "img"],
  jpeg: ["image/jpeg", "img"],
  mp4: ["video/mp4", "video"],
};

interface AuthorizeResponse {
  uploadUrl: string;
  assetId: string;
}

interface SessionData {
  assetList: string[];
  extList: string[];
  mediaContent: string;
  uploadedAt: number;
  hasVideo: boolean;
}

// In-memory session storage (use Redis/DB in production)
const sessions = new Map<string, SessionData>();

const getExtension = (filename: string): string => {
  const ext = extname(filename).toLowerCase();
  return ext.slice(1);
};

const mimeType = (ext: string): string => kSupportedList[ext]?.[0] ?? "";

const mediaType = (ext: string): string => kSupportedList[ext]?.[1] ?? "";

const uploadAsset = async (
  file: File,
  description: string
): Promise<string> => {
  const ext = getExtension(file.name);
  if (!(ext in kSupportedList)) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  // Commented out VILA API upload functionality
  // const headers = {
  //   Authorization: `Bearer ${kApiKey}`,
  //   "Content-Type": "application/json",
  //   Accept: "application/json",
  // };

  // const postData = {
  //   contentType: mimeType(ext),
  //   description,
  // };

  // const { data: authorizeRes }: AxiosResponse<AuthorizeResponse> =
  //   await axios.post(kNvcfAssetUrl, postData, { headers });
  // console.log(`uploadUrl: ${authorizeRes.uploadUrl}`);

  // const fileBuffer = await file.arrayBuffer();
  // const response = await axios.put(
  //   authorizeRes.uploadUrl,
  //   Buffer.from(fileBuffer),
  //   {
  //     headers: {
  //       "x-amz-meta-nvcf-asset-description": description,
  //       "content-type": mimeType(ext),
  //     },
  //   }
  // );

  // if (response.status === 200) {
  //   console.log(`upload asset_id ${authorizeRes.assetId} successfully!`);
  //   return authorizeRes.assetId;
  // } else {
  //   console.log(`upload asset_id ${authorizeRes.assetId} failed.`);
  //   throw new Error(`Asset upload failed: ${authorizeRes.assetId}`);
  // }
  
  // Return dummy asset ID for now
  return `dummy_asset_${Date.now()}`;
};

const deleteAsset = async (assetId: string): Promise<void> => {
  // Commented out VILA API delete functionality
  // const headers = {
  //   Authorization: `Bearer ${kApiKey}`,
  // };
  // const url = `${kNvcfAssetUrl}/${assetId}`;
  // await axios.delete(url, { headers });
  
  // Just log for now instead of actual deletion
  console.log(`Would delete asset: ${assetId}`);
};

const chatWithMediaNvcf = async (
  inferUrl: string,
  sessionData: SessionData,
  query: string,
  stream: boolean
): Promise<unknown> => {
  const assetSeq = sessionData.assetList.join(",");
  console.log(`received asset_id list: ${assetSeq}`);

  // Commented out VILA API chat functionality
  // const headers = {
  //   Authorization: `Bearer ${kApiKey}`,
  //   "Content-Type": "application/json",
  //   "NVCF-INPUT-ASSET-REFERENCES": assetSeq,
  //   "NVCF-FUNCTION-ASSET-IDS": assetSeq,
  //   Accept: stream ? "text/event-stream" : "application/json",
  // };

  // const messages = [
  //   {
  //     role: "user",
  //     content: `${query} ${sessionData.mediaContent}`,
  //   },
  // ];

  // const payload = {
  //   max_tokens: 1024,
  //   temperature: 1,
  //   top_p: 0.7,
  //   seed: 50,
  //   num_frames_per_inference: 8,
  //   messages,
  //   stream,
  //   model: "nvidia/vila",
  // };

  // const response = await axios.post(inferUrl, payload, {
  //   headers,
  //   responseType: stream ? "stream" : "json",
  // });

  // return response.data;
  
  // Return dummy response for now
  return {
    choices: [{
      message: {
        role: "assistant",
        content: "VILA API is currently disabled. This is a placeholder response."
      }
    }]
  };
};

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    // Handle file upload (no action parameter, FormData)
    if (contentType.includes("multipart/form-data") && !action) {
      const formData = await request.formData();
      const mediaFiles = formData.getAll("mediaFiles") as File[];

      if (!mediaFiles || mediaFiles.length === 0) {
        return NextResponse.json(
          { error: "No media files provided" },
          { status: 400 }
        );
      }

      const assetList: string[] = [];
      const extList: string[] = [];
      let mediaContent = "";
      let hasVideo = false;

      for (const mediaFile of mediaFiles) {
        const ext = getExtension(mediaFile.name);
        if (!(ext in kSupportedList)) {
          throw new Error(`${mediaFile.name} format is not supported`);
        }

        if (mediaType(ext) === "video") {
          hasVideo = true;
        }

        console.log(`uploading file: ${mediaFile.name}`);
        const assetId = await uploadAsset(mediaFile, "Reference media file");
        console.log(`assetId: ${assetId}`);
        assetList.push(assetId);
        extList.push(ext);
        mediaContent += `<${mediaType(ext)} src="data:${mimeType(
          ext
        )};asset_id,${assetId}" />`;
      }

      if (hasVideo && mediaFiles.length !== 1) {
        throw new Error("Only a single video is supported.");
      }

      const sessionId = `session_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      sessions.set(sessionId, {
        assetList,
        extList,
        mediaContent,
        uploadedAt: Date.now(),
        hasVideo,
      });

      return NextResponse.json({
        sessionId,
        message: "Files uploaded successfully",
      });
    }

    // Handle chat request
    if (action === "chat") {
      const body = await request.json();
      const { sessionId, query, stream = false } = body;


      console.log(sessionId,"session iddd")
      if (!sessionId) {
        return NextResponse.json(
          { error: "Invalid or expired session" },
          { status: 400 }
        );
      }

      if (!query) {
        return NextResponse.json(
          { error: "Query is required" },
          { status: 400 }
        );
      }

      const sessionData = sessions.get(sessionId)!;

      const result = await chatWithMediaNvcf(
        invokeUrl,
        sessionData,
        query,
        stream
      );

      if (stream) {
        return new NextResponse(typeof result === "string" ? result : JSON.stringify(result), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      return NextResponse.json(result);
    }

    // Handle cleanup request
    if (action === "cleanup") {
      const body = await request.json();
      const { sessionId } = body;

      if (sessionId && sessions.has(sessionId)) {
        const sessionData = sessions.get(sessionId)!;

        console.log(`deleting assets: ${sessionData.assetList}`);
        for (const assetId of sessionData.assetList) {
          try {
            await deleteAsset(assetId);
          } catch (error) {
            console.error(`Failed to delete asset ${assetId}:`, error);
          }
        }

        sessions.delete(sessionId);
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
