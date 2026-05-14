const playlistContainer = document.getElementById("playlistContainer");
const videoPlayer = document.getElementById("video");

const BACKEND_MIRRORS = [
    "inv.nadeko.net",
    "inv.thepixora.com",
    "yt.chocolatemoo53.com"
];
const NOCORS_BACKEND_MIRRORS = [
    "inv.thepixora.com"
]

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
    for (let domain of NOCORS_BACKEND_MIRRORS) {
        const targetUrl = `https://${domain}/api/v1/videos/${videoId}`;

        try {
            console.log("Fetching "+targetUrl);
            const response = await fetch(targetUrl);
            if (!response.ok) {
                console.warn(`${domain} Resp: `+response.status);
                continue;
            }
            const data = await response.json();
            const videoData = {
                id: data.videoId,
                title: data.title,
                thumbnail: data.videoThumbnails,
                description: data.description,
                published: data.published,
                publishedText: data.publishedText,
                authorThumbnails: data.authorThumbnails,
                length: data.lengthSeconds,
                adaptiveFormats: data.adaptiveFormats,
                formatSteams: data.formatSteams,
                musicTracks: data.musicTracks,
            };
            return videoData;
        } catch (e) {
            console.error("getVideo Error on ${domain}: "+e);
        }
    }
    console.error("All public API instances failed.");
    return [];
}

async function loadVideo(videoId) {
    const videoData = await getVideo(videoId);
    if (!videoData) {return;}
    console.log("Got data:",videoData.adaptiveFormats);
    const mp4Formats = {
        r144p: 4,
        r240p: 6,
        r360p: 8,
        r480p: 10,
        r720p: 12,
        r1080p: 14
    }
    const audioUrl = videoData.adaptiveFormats[3].url;
    const videoUrl = videoData.adaptiveFormats[mp4Formats.r480p].url; // 480p
    
    document.getElementById("track-name").textContent = videoData.title;
    
    video.src = videoUrl;
    videoPlayer.load();
    const audio = new Audio(audioUrl);
    videoPlayer.play();
    audio.play().catch(error => console.error(error));
}

getPlaylistData(temp_playlistAddress).then(PlaylistData => {
    const videoData = PlaylistData.videos;
    console.log("Video Data returned:",videoData);
    if (videoData.length == 0) {
        playlistContainer.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
        return;
    }
    playlistContainer.innerHTML = "";

    for (let video of videoData) {
        const videoItem = `
            <div class='video' id='${video.id}'>
                <img src='${video.thumbnail}' alt='${video.title}'>
                <p class='video_title'>${video.title}</p>
                <p class='video_author'>${video.author}</p>
            </div>
        `;
        playlistContainer.insertAdjacentHTML('beforeend', videoItem);
    }
    playlistContainer.addEventListener('click',function(event) {
        const videoItem = event.target.closest('.video');
        if (!videoItem) {return;}
        const videoId = videoItem.id;
        loadVideo(videoId);
    });
});