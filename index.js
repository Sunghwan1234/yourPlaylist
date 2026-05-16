const playlistContainer = document.getElementById("playlistContainer");
const videoPlayer = document.getElementById("video");
const thumbnail = document.getElementById("thumbnail");

const settingsPanel = document.getElementById("s_settingsPanel");

const BACKEND_MIRRORS = [
    "inv.nadeko.net",
    "inv.thepixora.com",
    "yt.chocolatemoo53.com",
    "invidious.nerdvpn.de", // Does Not Work
];
const NOCORS_BACKEND_MIRRORS = [
    "inv.thepixora.com"
]

let temp_playlistAddress = "PLXPg0M1hQSff6jP8XGSDSsyf4lDdTfOXT";

let playlist;

function getLocalSetting(setting) {
    return localStorage.getItem("s_"+setting);
}

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
                    thumbnail: `https://${domain}${video.videoThumbnails?.[0]?.url || ''}`,
                };
            });
            const playlistData = {
                title: data.title,
                author: data.author,
                authorThumbnail: '',
                description: data.description,
                videos: videoData
            }
            console.log(`Successfully imported ${videoData.length} videos from ${domain}`);
            console.log(playlistData);
            return playlistData;
        } catch (e) {
            console.error(`getPlaylistVideos Error on ${domain}: `+e);
        }
    }

    console.error("All public API instances failed.");
    return [];
}

async function getVideo(videoId, force) {
    if (!force) {
        const saved_video = localStorage.getItem(videoId);
        if (saved_video) {
            console.log("Found saved video: "+saved_video);
            return saved_video;
        }
    }
    for (let domain of BACKEND_MIRRORS) {
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
                thumbnails: data.videoThumbnails,
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
    const videoData = await getVideo(videoId, false);
    if (!videoData) {return;}
    console.log("Got data:",videoData);

    const audioUrl = videoData.adaptiveFormats[3].url;
    const audio = new Audio(audioUrl);

    if (getLocalSetting('useThumbnail')=='true') {
        thumbnail.src = videoData.thumbnails[0].url;

        audio.play().catch(error => console.error(error));
    } else {
        const formats = { // Add 1 for webm
            r144p: 4,
            r240p: 6,
            r360p: 8,
            r480p: 10,
            r720p: 12,
            r1080p: 14
        }
        const videoUrl = videoData.adaptiveFormats[formats.r480p+1].url; // 480p
        videoPlayer.src = videoUrl;
        videoPlayer.hidden = false;
        videoPlayer.load();

        videoPlayer.addEventListener('play', () => {
            audio.play();
        });
        videoPlayer.addEventListener('pause', () => {
            audio.pause();
        });

        videoPlayer.addEventListener('seeking', () => {
            audio.currentTime = videoPlayer.currentTime;
        });
        videoPlayer.addEventListener('seeked', () => {
            audio.currentTime = videoPlayer.currentTime;
        });

        videoPlayer.addEventListener('volumechange', () => {
            audio.volume = videoPlayer.volume;
            audio.muted = videoPlayer.muted;
        });
        videoPlayer.addEventListener('ratechange', () => {
            audio.playbackRate = videoPlayer.playbackRate;
        });

        videoPlayer.play();
    }

    
    //audio.play().catch(error => console.error(error));

    document.getElementById("track-name").textContent = videoData.title;
}

function showSettings() {
    settingsPanel.hidden = !settingsPanel.hidden;
}
function showPlaylist() {
    const videoData = playlist.videos;
    console.log("Video Data returned:",playlist);
    if (videoData.length == 0) {
        playlistContainer.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
        return;
    }
    for (let video of videoData) {
        const videoItem = `
            <div class='video' id='${video.id}'>
                <img src='${video.thumbnail}' alt='${video.title}'>
                <div class='video_details'>
                    <p class='video_title'>${video.title}</p>
                    <p class='video_author'>${video.author}</p>
                </div>
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
}

function savePlaylist() {
    localStorage.setItem('playlist', JSON.stringify(playlist));
    console.log("Saved Playlist!");
}

async function init() {
    const saved_playlist = JSON.parse(localStorage.getItem('playlist'));
    if (saved_playlist && saved_playlist.videos.length>0) {
        console.log("Loaded saved playlist!");
        playlist = saved_playlist;
    } else {
        console.log("Saved Playlist: "+saved_playlist);
        playlist = await getPlaylistData(temp_playlistAddress);
        savePlaylist();
    }
    showPlaylist();
}

// Settings
$("#s_useThumbnail").prop("checked", localStorage.getItem('s_useThumbnail')=='true');

// Running

$("#s_useThumbnail").change(function(){
    if ($(this).is(':checked')) {
        localStorage.setItem('s_useThumbnail', 'true');
    } else {
        localStorage.setItem('s_useThumbnail', 'false');
    }
})

init();