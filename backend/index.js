const express = require("express");
const cors = require("cors");
const multer = require("multer");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const ytdl = require("@distube/ytdl-core");

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Route for file upload and conversion
app.post("/convert", upload.single("video"), (req, res) => {
  const file = req.file;
  const { quality } = req.body;

  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const outputFilePath = `converted/${Date.now()}.mp4`;

  let ffmpegOptions = {
    preset: "fast",
    crf: 23,
    videoBitrate: "1000k",
    audioBitrate: "128k",
  };

  // Adjust ffmpeg settings based on the selected quality
  if (quality === "high") {
    ffmpegOptions = {
      preset: "slow",
      crf: 18,
      videoBitrate: "5000k",
      audioBitrate: "320k",
    };
  } else if (quality === "normal") {
    ffmpegOptions = {
      preset: "medium",
      crf: 21,
      videoBitrate: "2500k",
      audioBitrate: "192k",
    };
  }

  ffmpeg(file.path).ffprobe((err, metadata) => {
    if (err) {
      console.error("Error fetching metadata:", err);
      return res.status(500).send("Error during conversion.");
    }

    const hasAudio = metadata.streams.some(
      (stream) => stream.codec_type === "audio"
    );
    if (!hasAudio) {
      console.warn("No audio stream detected in the input file.");
    }

    ffmpeg(file.path)
      .output(outputFilePath)
      .videoCodec("libx264")
      .audioCodec(hasAudio ? "aac" : null)
      .videoBitrate(ffmpegOptions.videoBitrate)
      .audioBitrate(ffmpegOptions.audioBitrate)
      .outputOptions("-preset", ffmpegOptions.preset)
      .outputOptions("-crf", ffmpegOptions.crf)
      .outputOptions("-pix_fmt", "yuv420p")
      .outputOptions("-movflags", "+faststart")
      .outputOptions("-map", "0:v:0")
      .outputOptions(hasAudio ? "-map 0:a:0" : "")
      .on("start", () => {
        console.log(
          `Starting ${quality} quality conversion for file: ${file.originalname}`
        );
      })
      .on("end", () => {
        console.log(
          `${
            quality.charAt(0).toUpperCase() + quality.slice(1)
          } quality conversion finished for file: ${outputFilePath}`
        );
        fs.unlinkSync(file.path);
        res.json({ path: outputFilePath });
      })
      .on("error", (err) => {
        console.error("Error during conversion:", err);
        res.status(500).send("Error during conversion.");
      })
      .run();
  });
});

// Route for downloading and converting a YouTube video
app.post("/convert-youtube", async (req, res) => {
  try {
    const { url, quality } = req.body;

    if (!url || !ytdl.validateURL(url)) {
      console.error("Invalid YouTube URL:", url);
      return res.status(400).send("Invalid YouTube URL.");
    }

    const videoInfo = await ytdl.getInfo(url);
    console.log("Video Info:", videoInfo);

    const title = videoInfo.videoDetails.title.replace(/[\/:*?"<>|]/g, ""); // Sanitize file name
    const outputFilePath = `converted/${Date.now()}-${title}.mp4`;

    const tempDir = path.join(__dirname, "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const videoPath = path.join(tempDir, `${Date.now()}-video.mp4`);
    const audioPath = path.join(tempDir, `${Date.now()}-audio.mp4`);

    const videoStream = ytdl(url, { quality: "highestvideo" }).pipe(
      fs.createWriteStream(videoPath)
    );
    const audioStream = ytdl(url, { quality: "highestaudio" }).pipe(
      fs.createWriteStream(audioPath)
    );

    const ffmpegOptions = {
      preset: "fast",
      crf: 23,
      videoBitrate: "1000k",
      audioBitrate: "128k",
    };

    if (quality === "high") {
      ffmpegOptions.preset = "slow";
      ffmpegOptions.crf = 18;
      ffmpegOptions.videoBitrate = "5000k";
      ffmpegOptions.audioBitrate = "320k";
    } else if (quality === "normal") {
      ffmpegOptions.preset = "medium";
      ffmpegOptions.crf = 21;
      ffmpegOptions.videoBitrate = "2500k";
      ffmpegOptions.audioBitrate = "192k";
    }

    Promise.all([
      new Promise((resolve) => videoStream.on("finish", resolve)),
      new Promise((resolve) => audioStream.on("finish", resolve)),
    ]).then(() => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .videoCodec("h264_videotoolbox")
        .audioCodec("aac")
        .outputOptions("-preset", ffmpegOptions.preset)
        .outputOptions("-crf", ffmpegOptions.crf)
        .outputOptions("-movflags", "+faststart")
        .outputOptions("-threads", "0")
        .videoBitrate(ffmpegOptions.videoBitrate)
        .audioBitrate(ffmpegOptions.audioBitrate)
        .save(outputFilePath)
        .on("start", () =>
          console.log(
            `Starting ${quality} quality conversion for YouTube video`
          )
        )
        .on("end", () => {
          console.log("ffmpeg finished");
          fs.unlinkSync(videoPath);
          fs.unlinkSync(audioPath);
          res.json({ path: outputFilePath });
        })
        .on("error", (err, stdout, stderr) => {
          console.error("ffmpeg error:", err.message);
          console.error("ffmpeg stderr:", stderr);
          res
            .status(500)
            .send(
              "ffmpeg encountered an error during conversion. Please try again."
            );
        });
    });
  } catch (error) {
    console.error("Error during conversion:", error);
    res.status(500).send("Error during conversion. Please try again.");
  }
});

// Route to download the converted file
app.get("/download/:file", (req, res) => {
  const file = req.params.file;
  const filePath = path.join(__dirname, "converted", file);

  res.download(filePath, (err) => {
    if (err) {
      console.error("Error during file download:", err);
      res.status(500).send("Error during file download.");
    } else {
      fs.unlinkSync(filePath);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
