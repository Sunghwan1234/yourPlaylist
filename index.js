const playlistContainer = document.getElementById("playlistContainer");
const videoPlayer = document.getElementById("video");

const BACKEND_MIRRORS = [
    "inv.nadeko.net",
    "inv.thepixora.com"
];

let temp_playlistAddress = "PLXPg0M1hQSff6jP8XGSDSsyf4lDdTfOXT";

let playlist;

/** Get the Playlist */
async function getPlaylistData(playlistId) {
    for (let domain of BACKEND_MIRRORS) {
        const targetUrl = `https://${domain}/api/v1/playlists/${playlistId}`;
        console.log(`Polling server path: ${targetUrl}`);

        try {
            const response = await fetch(targetUrl);
            if (!response.ok) {
                console.warn(`${domain} response: ${response.status}`);
                continue;
            }
            console.log("got ",response);
            const data = await response.json();
            if (!data.videos || !Array.isArray(data.videos)) {
                console.warn(`${domain} returned data, but 'videos' array was missing.`);
                continue;
            }
            const videoData = data.videos.map(video => {
                return {
                    id: video.videoId,
                    title: video.title,
                    author: video.author,
                    index: video.index,
                    length: video.lengthSeconds,
                    thumbnail: `https://${domain}${video.videoThumbnails?.[0]?.url || ''}`
                };
            });
            const playlistData = {
                title: data.title,
                author: data.author,
                authorThumbnail: '',
                description: data.description,
                videos: videoData
            }
            console.log(`Successfully imported ${playlistData.length} videos from ${domain}`);
            return playlistData;
        } catch (e) {
            console.error(`getPlaylistVideos Error on ${domain}: `+e);
        }
    }

    console.error("All public API instances failed.");
    return [];
}

async function getVideo(videoId) {
    for (let domain of BACKEND_MIRRORS) {
        const targetUrl = `https://${domain}/api/v1/videos/${videoId}`;

        try {
            const response = await fetch(targetUrl);
            if (!response.ok) {
                console.warn(`${domain} Resp: `+response.status);
                continue;
            }
            const data = await response.json();
            return data;
        } catch (e) {
            console.error("getVideo Error on ${domain}: "+e);
        }
    }
    console.error("All public API instances failed.");
    return [];
}

async function loadVideo(videoId) {
    const videoData = await getVideo(videoId);
    console.log("Got data:",videoData);
    const videoUrl = videoData.adaptiveFormats[0].url;
    video.src = videoUrl;
    videoPlayer.load();
}

getPlaylistData(temp_playlistAddress).then(PlaylistData => {
    const videoData = PlaylistData.videos;
    console.log("Video Data returned:",videoData);
    if (videoData.length === 0) {
        playlistContainer.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
        return;
    }
    playlistContainer.innerHTML = "";

    for (let video of videoData) {
        const videoItem = `
            <div class='video'>
                <img src='${video.thumbnail}' alt='${video.title}'>
                <h3 class='video_title'>${video.title}</h3>
                <p class='video_author'>${video.author}</p>
                <button class='video_loadButton_temp' onclick="loadVideo('${video.id}')">Load Video</button>
            </div>
        `;
        playlistContainer.insertAdjacentHTML('beforeend', videoItem);
    }
});