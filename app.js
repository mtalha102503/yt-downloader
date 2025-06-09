require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ytdlp = require("yt-dlp-exec");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.static("public"));


app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/download", async (req, res) => {
  const videoURL = req.body.videoURL;

  try {
    const info = await ytdlp(videoURL, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificate: true,
    });

    const videoFormats = info.formats
      .filter(f => f.ext === "mp4" && f.url && f.vcodec !== "none" && f.acodec !== "none")
      .map(f => ({
        quality: f.format_note || (f.height ? `${f.height}p` : "Unknown"),
        url: f.url,
      }));

    const audioFormat = info.formats.find(f => f.ext === "m4a" || (f.acodec !== "none" && f.vcodec === "none"));
    const audioUrl = audioFormat ? audioFormat.url : null;

    res.render("result", {
      title: info.title,
      thumbnail: info.thumbnail,
      formats: videoFormats,
      audioUrl,
      videoURL,
    });

  } catch (err) {
    console.error("❌ Error fetching video info:", err);
    res.send("❌ Error fetching video info. Please check the URL or try again.");
  }
});

app.get("/download-mp3", async (req, res) => {
  const videoURL = req.query.url;

  if (!videoURL) {
    return res.status(400).send("No URL provided.");
  }

  const outputPath = path.join(__dirname, "downloads");
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  const outputTemplate = path.join(outputPath, `audio-%(title)s.%(ext)s`);

  try {
    // Download and extract MP3
    await ytdlp(videoURL, {
      extractAudio: true,
      audioFormat: "mp3",
      audioQuality: "0",
      output: outputTemplate,
    });

    // Find the downloaded MP3 file
    const files = fs.readdirSync(outputPath).filter(f => f.endsWith(".mp3"));
    if (!files.length) {
      throw new Error("MP3 file was not found after extraction.");
    }

    const filePath = path.join(outputPath, files[0]);

    res.download(filePath, files[0], (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).send("Error sending file.");
      } else {
        fs.unlink(filePath, () => {}); // delete after sending
      }
    });
  } catch (error) {
    console.error("MP3 Download error:", error);
    res.status(500).send("Failed to download MP3.");
  }
});
const extractVideoId = (url) => {
  const regex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regex);
  return match ? match[1] : null;
};
// Feature Pages
app.get("/mp3-features", (req, res) => {
  res.render("mp3-features");
});

app.get("/mp4-features", (req, res) => {
  res.render("mp4-features");
});
// GET: Show Thumbnail Downloader page
app.get('/thumbnail-downloader', (req, res) => {
  res.render('thumbnail', {
    thumbnailUrls: [],
    error: null
  });
});



// POST route to process thumbnail request
const getThumbnailUrls = (url) => {
  const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
  if (!videoIdMatch) return null;

  const videoId = videoIdMatch[1];
  return [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/default.jpg`
  ];
};

// POST: Handle thumbnail URL
app.post('/get-thumbnail', (req, res) => {
  const videoURL = req.body.videoURL;
  const thumbnailUrls = getThumbnailUrls(videoURL);

  if (!thumbnailUrls) {
    return res.render('thumbnail', {
      thumbnailUrls: [],
      error: 'Invalid YouTube video URL'
    });
  }

  res.render('thumbnail', {
    thumbnailUrls,
    error: null
  });
});
const { google } = require('googleapis');
const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY, // Replace with your API key
});

app.get('/channel-info', (req, res) => {
  res.render('channel-info', { channelData: null, error: null });
});

app.post('/channel-info', async (req, res) => {
  const channelUrl = req.body.channelUrl;
  const channelId = await extractChannelId(channelUrl);

  if (!channelId) {
    return res.render('channel-info', { channelData: null, error: 'Invalid YouTube channel URL.' });
  }

  try {
    const response = await youtube.channels.list({
      part: 'snippet,statistics',
      id: channelId,
    });

    const channel = response.data.items[0];
    if (!channel) {
      return res.render('channel-info', { channelData: null, error: 'Channel not found.' });
    }

    const data = {
      name: channel.snippet.title,
      thumbnail: channel.snippet.thumbnails.high.url,
      subscriberCount: channel.statistics.subscriberCount,
      viewCount: channel.statistics.viewCount,
      videoCount: channel.statistics.videoCount,
      description: channel.snippet.description || "No description provided.",
      created: channel.snippet.publishedAt,
    };

    res.render('channel-info', { channelData: data, error: null });
  } catch (err) {
    console.error(err);
    res.render('channel-info', { channelData: null, error: 'Error fetching channel data.' });
  }
});

async function extractChannelId(url) {
  // For full channel ID
  const idMatch = url.match(/(channel\/)(UC[0-9A-Za-z-_]{21}[AQgw])/);
  if (idMatch) return idMatch[2];

  // For @handle
  const handleMatch = url.match(/youtube\.com\/@([a-zA-Z0-9-_]+)/);
  if (handleMatch) {
    const username = handleMatch[1];
    const response = await youtube.search.list({
      part: 'snippet',
      q: username,
      type: 'channel',
      maxResults: 1
    });

    const channel = response.data.items[0];
    return channel?.id?.channelId || null;
  }

  // YouTube user/ or custom URLs (approx fallback)
  const userMatch = url.match(/youtube\.com\/(user|c)\/([a-zA-Z0-9-_]+)/);
  if (userMatch) {
    const username = userMatch[2];
    const response = await youtube.search.list({
      part: 'snippet',
      q: username,
      type: 'channel',
      maxResults: 1
    });

    const channel = response.data.items[0];
    return channel?.id?.channelId || null;
  }

  return null;
}
app.get('/terms', (req, res) => {
  res.render('terms');
});

app.get('/copyright', (req, res) => {
  res.render('copyright');
});

app.get('/privacy', (req, res) => {
  res.render('privacy');
});
 console.log("Loaded API Key:", process.env.YOUTUBE_API_KEY);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

