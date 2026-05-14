const playlistContainer = document.getElementById("playlistContainer");

const BACKEND_MIRRORS = [
    "inv.nadeko.net",
    "inv.thepixora.com"
];

let temp_playlistAddress = "PLXPg0M1hQSff6jP8XGSDSsyf4lDdTfOXT";

let playlist;

/** Get the Playlist */
async function getPlaylistVideos(playlistId) {
    for (let domain of BACKEND_MIRRORS) {
        const targetUrl = `https://${domain}/api/v1/playlist?list=${playlistId}`;
        console.log(`Polling server path: ${targetUrl}`);

        try {
            const response = await fetch(targetUrl);
            if (!response.ok) {
                console.warn(`${domain} response: ${response.status}`);
                continue;
            }
            console.log("got ",response);
            const data = response.json();
            if (!data.videos || !Array.isArray(data.videos)) {
                console.warn(`${domain} returned data, but 'videos' array was missing.`);
                continue;
            }
            const videoData = data.videos.map(video => {
                return {
                    id: video.videoId,
                    title: video.title,
                    author: video.author,
                    thumbnail: video.videoThumbnails?.[0]?.url || ''
                };
            });
            console.log(`Successfully imported ${videoData.length} videos from ${domain}`);
            return videoData;
        } catch (e) {
            console.error(`getPlaylistVideos Error on ${domain}: `+e);
        }
    }

    console.error("All public API instances failed.");
    return [];
}

getPlaylistVideos(temp_playlistAddress).then(videoData => {
    console.log("Video Data returned:",videoData);
    if (videoData.length === 0) {
        playlistContainer.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
        return;
    }
    playlistContainer.innerHTML = ""

    for (let video of videoData) {
        const videoItem = `
            <div class='video'>
                <img src='${video.thumbnail}' alt='${video.title}'>
                <h3 class='video_title'>${video.title}</h2>
            </div>
        `;
        playlistContainer.insertAdjacentHTML('beforeend', videoItem);
    }
});