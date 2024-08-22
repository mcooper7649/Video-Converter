import React, { useState } from "react";
import axios from "axios";

const VideoConverter = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [quality, setQuality] = useState("fast");
  const [convertedFilePath, setConvertedFilePath] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleYoutubeUrlChange = (event) => {
    setYoutubeUrl(event.target.value);
  };

  const handleQualityChange = (event) => {
    setQuality(event.target.value);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedFile && !youtubeUrl) {
      alert("Please select a file or enter a YouTube URL.");
      return;
    }

    setIsConverting(true);
    let response;

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append("video", selectedFile);
        formData.append("quality", quality);

        response = await axios.post("http://localhost:5000/convert", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else if (youtubeUrl) {
        response = await axios.post("http://localhost:5000/convert-youtube", {
          url: youtubeUrl,
          quality,
        });
      }

      setConvertedFilePath(response.data.path);
    } catch (error) {
      console.error("Error during conversion:", error);
      alert("Error during conversion. Please try again.");
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="container mt-5">
      <h1 className="text-center mb-4">Video Converter</h1>
      <form onSubmit={handleSubmit} className="card p-4 shadow">
        <div className="form-group">
          <label htmlFor="videoFile">Select a Video File</label>
          <input
            type="file"
            className="form-control-file"
            id="videoFile"
            accept="video/*"
            onChange={handleFileChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="youtubeUrl">Or Enter a YouTube URL</label>
          <input
            type="text"
            className="form-control"
            id="youtubeUrl"
            placeholder="Enter YouTube URL"
            value={youtubeUrl}
            onChange={handleYoutubeUrlChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="qualitySelect">Select Quality</label>
          <select
            className="form-control"
            id="qualitySelect"
            value={quality}
            onChange={handleQualityChange}
          >
            <option value="fast">Very Fast</option>
            <option value="normal">Normal</option>
            <option value="high">High Quality</option>
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={isConverting}
        >
          {isConverting ? "Converting..." : "Convert to MP4"}
        </button>
      </form>

      {convertedFilePath && (
        <div className="alert alert-success mt-4 text-center">
          <h4>Conversion Complete</h4>
          <a
            href={`http://localhost:5000/download/${convertedFilePath
              .split("/")
              .pop()}`}
            className="btn btn-success"
          >
            Download Converted Video
          </a>
        </div>
      )}
    </div>
  );
};

export default VideoConverter;
