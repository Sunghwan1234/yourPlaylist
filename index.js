const playlistContainer = document.getElementById("playlistContainer");
const playlistElement = document.getElementById("playlist");
const togglePlaylistContainerButton = document.getElementById("togglePlaylistContainer");

const videoPlayer = document.getElementById("video");
const audioPlayer = new Audio();
audioPlayer.preload = "auto";

const thumbnail = document.getElementById("thumbnail");

const settingsPanel = document.getElementById("s_settingsPanel");

const INVIDIOUS_INSTANCES = [
    "inv.nadeko.net",
    "yt.chocolatemoo53.com",
    "invidious.nerdvpn.de", // Does Not Work
    "yewtu.be",
    "inv.thepixora.com",
];
const API_INVIDIOUS_INSTANCES = [
    "inv.thepixora.com"
];
const PIPED_INSTANCES = [
    "piped.video",
    "pipedapi.kavin.rocks",
    "api.piped.private.coffee",
    "pipedapi.orangenet.cc",
]
const CORS_PROXIES = [
    "corsproxy.io/?url=",
    // "proxy.corsfix.com/?", // does not work
];
let available_instances;
function addCors_Proxy(cors_proxy, url) {
    return `https://${cors_proxy}${url}`;
}

let temp_playlistAddress = "PLXPg0M1hQSff6jP8XGSDSsyf4lDdTfOXT";

let playlist; // PlaylistData
let currentVideo; // VideoData
let currentVideoIndex=0;
let backgroundPlaybackStatus = false;
let unsynced = false;

function getLocalBoolean(setting) {
    return localStorage.getItem("s_"+setting)=='true';
}
/** Awaits a fetch with response ok. You only need to check if it is null. */
async function fetchWithCatch(targetUrl, Error="") {
    const response = await fetch(targetUrl).catch((error) => {
        return null;
    });
    if (response && response.ok) {
        return await response.json();
    }
}

/** Get the Playlist */
async function fetchPlaylistData(playlistId) {
    for (let domain of INVIDIOUS_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/playlists/${playlistId}`;
        console.log(`Polling server path: ${targetUrl}`);

        const data = await fetchWithCatch(targetUrl);
        if (!data) {continue;}
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
    }

    console.error("All public API instances failed.");
    return null;
}
/** Get a video from a URL */
async function fetchVideo(videoId) {
    for (let domain of API_INVIDIOUS_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/videos/${videoId}`;
        console.log("Fetching "+targetUrl);
        const data = await fetchWithCatch(targetUrl);
        if (!data) {continue;}
        return data;
    }
    console.warn("Trying Piped API...");
    for (let domain of PIPED_INSTANCES) {
        
    }
    console.error("All public API instances failed.");
    return null;
}

async function fetchProxiedVideo(videoId) {
    for (let proxy of CORS_PROXIES) {
        for (let domain of INVIDIOUS_INSTANCES) {
            console.log(`gPVD: URL: https://${domain}/api/v1/videos/${videoId}`)
            const targetUrl = addCors_Proxy(proxy, `https://${domain}/api/v1/videos/${videoId}`);
            console.log(`gPVD: Fetching ${targetUrl}`);
            const response = await fetch(targetUrl).catch((error) => {
                return null;
            });
            if (response && response.ok) {
                return await response.json();
            }
        }
    }
    return null;
}

/**
 * Loads pure unreadable Video Data. Use parseVideoData()
 * @param {String} videoId 
 * @param {boolean} forceLoad 
 * @param {String} forceSaveAsId Enter a URL to overwrite the save
 * @returns 
 */
async function loadVideoData(videoId, forceLoad, forceSaveAsId=null) {
    console.log('Loading Video Data of',videoId,", fl,fs",forceLoad,forceSaveAsId);
    let saved_video = null;
    if (!forceLoad) {
        saved_video = JSON.parse(localStorage.getItem(videoId));
        if (saved_video) {
            console.log(`Found saved video:`,saved_video);
            return saved_video;
        }
    }
    let video = await fetchVideo(videoId);
    if (!video) {
        video = await fetchProxiedVideo(videoId);
        if (!video) {
            console.error("All attempts to load Video Data failed.");
            return null;
        }
    }
    const videoData = parseVideoData(video);
    if ((!forceLoad && !saved_video) || forceSaveAsId) { // maybe () around !saved_video || saveTo
        console.log("Saving VideoData:",videoData);
        if (forceSaveAsId) {
            console.log("Overwriting saved video to alternative:",videoData.title);
            localStorage.setItem(forceSaveAsId, JSON.stringify(videoData));
        } else {
            localStorage.setItem(videoId, JSON.stringify(videoData));
        }
    } else {
        console.log(saved_video, forceLoad);
    }
    return videoData;
}
/** Parses a Video Object into readable data. */
function parseVideoData(data) {
    return {
        id: data.videoId,
        title: data.title,
        author: data.author,
        description: data.description,
        published: data.published,
        publishedText: data.publishedText,
        thumbnails: data.videoThumbnails,
        authorThumbnails: data.authorThumbnails,
        length: data.lengthSeconds,
        adaptiveFormats: data.adaptiveFormats,
        formatSteams: data.formatStreams,
        musicTracks: data.musicTracks
    };
}

/**
 * Searched using videoData for the most similar video.
 * @param {*} videoData 
 * @returns video ID of the most similar video
 */
async function searchSimilarVideo(videoData) {
    for (let domain of INVIDIOUS_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/search?`+
        `q=${encodeURIComponent(`${videoData.title} ${videoData.author}`)}`+
        `&type=video`;
        try {
            console.log("searchSimilar Fetching:",targetUrl);
            const response = await fetch(targetUrl).catch((error) => {
                return null;
            });
            if (!response || !response.ok) {
                if (response) {
                    console.warn(`SearchSimilar: Domain ${domain} Resp: `,response);
                }
                continue;
            }
            const data = await response.json();
            console.log(`searchSimilar Data:`,data);

            for (let video of data) {
                if (video.author.includes("Topic")) {
                    continue;
                }
                const authorMatches = videoData.author.includes(video.author) || video.author.includes(videoData.author);
                if (authorMatches) {
                    if (!video.author.includes("Topic")) {
                        console.log("searchSimilar Found:",video);
                        return video.videoId;
                    }
                }
            }
        } catch (e) {
            console.warn("Unknown error:",e);
        }
    }
    console.error("No similar videos found, or domains returned error");
    return null;
}

/**
 * 
 * @param {*} videoId 
 * @param {*} forceLoad 
 * @param {*} saveAsId Force Save as Id
 * @returns 
 */
async function loadVideo(videoId, forceLoad=getLocalBoolean('forceLoad'), saveAsId=null) {
    console.log(`Loading Video`,videoId);
    let videoData = await loadVideoData(videoId, forceLoad, saveAsId);
    if (!videoData) {return;}
    let videoLoaded = await loadPlayer(videoData);
    if (!videoLoaded) {
        if (!forceLoad) {
            console.error(`Saved Video ${videoData.title} failed to load. ForceLoading...`);
            videoData = await loadVideoData(videoId, true, videoId);
            if (!videoData) {return;}
            videoLoaded = await loadPlayer(videoData);
        }
        if (!videoLoaded) {
            console.error(`Video ${videoData.title} failed to forceload.`);

            const isConfirmed = confirm("Try searching for similar videos?");

            if (isConfirmed) {
                console.log("Attempting search with video title",videoData.title);
                const searchResult = await searchSimilarVideo(videoData);
                if (searchResult) {
                    videoLoaded = await loadVideo(searchResult, true, videoId);
                    if (!videoLoaded) {
                        console.error(`loadVideo: All attempts to load ${videoData.title} failed.`);
                        return;
                    }
                } else {
                    console.error("loadVideo: searchResult returned null.");
                    return;
                }
            } else {
                return;
            }
        }
    }
    currentVideo = videoData;
    return true;
}

async function loadVideoIndex(videoIndex, forceLoad=getLocalBoolean('forceLoad'), saveAsId=null) {
    const videoId = playlist.videos[videoIndex].id;
    currentVideoIndex = videoIndex;
    return await loadVideo(videoId, forceLoad, saveAsId);
}

/**
 * Loads a video into the videoplayer and audioplayer
 * @param {*} videoData 
 * @param {*} saveAsId ID to overwrite original
 * @returns {Boolean} Success or not
 */
async function loadPlayer(videoData) {
    videoPlayer.pause();
    videoPlayer.hidden = getLocalBoolean('useThumbnail');
    audioPlayer.currentTime = 0;
    const audioUrl = videoData.adaptiveFormats[3].url;
    audioPlayer.src = audioUrl;

    await loadVideoPlayer(videoData);
    if (getLocalBoolean('useThumbnail') || document.hidden) {
        audioPlayer.play().then(() => updateMediaSession(videoData));

        if (document.hidden) {
            videoPlayer.src = '';
            console.warn("Started playing audio while hidden!");
            return true;
        }
    } else {
        const videoPlayed = await playVideoPlayer();
        if (!videoPlayed) {return false;}
    }

    document.body.style.background = "black";

    console.log("Loading was successful!");
    return true;
}

async function loadVideoPlayer(videoData) {
    document.getElementById("video_name").textContent = videoData.title;
    document.getElementById("video_author").textContent = videoData.author;

    if (getLocalBoolean('useThumbnail')) {
        thumbnail.src = videoData.thumbnails[0].url;
    } else {
        const formats = { // +1 for webm
            r144p: 4, r240p: 6, r360p: 8, r480p: 10,
            r720p: 12, r1080p: 14
        }
        const videoUrl = videoData.adaptiveFormats[formats.r480p+1].url; // 480p
        console.log("loadVideoPlayer: Loading Video URL:",videoUrl);
        videoPlayer.src = videoUrl;
        await videoPlayer.load();
    }
}
async function playVideoPlayer() {
    const videoPlayed = await videoPlayer.play().catch((error) => {
        videoPlayer.pause();
        // Perhaps return a better error
        console.error("videoPlayer Error;",error);
        return "failed";
    });
    return videoPlayed!=="failed";
}

function updateMediaSession(videoData) {
    if ('mediaSession' in navigator) {
        if (videoData) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: videoData.title,
                artist: videoData.author,
                album: ''
            });
        }

        // Map lock-screen controls so system actions don't break execution
        navigator.mediaSession.setActionHandler('play', () => videoPlayer.play());
        navigator.mediaSession.setActionHandler('pause', () => videoPlayer.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => track(1));
        navigator.mediaSession.setActionHandler('previoustrack', () => track(-1));
    }
}
async function track(offset) {
    return await loadVideoIndex(currentVideoIndex+offset);
}
// UI
function showPlaylist() {
    const videoData = playlist.videos;
    console.log("Playlist Videos returned:",playlist);
    if (videoData.length == 0) {
        playlistElement.innerHTML = "<p style='color:red;'>Could not fetch playlist metadata. All public instances are currently busy or rate-limited.</p>";
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
        playlistElement.insertAdjacentHTML('beforeend', videoItem);
    }
    playlistElement.addEventListener('click',function(event) {
        const videoItem = event.target.closest('.video');
        if (!videoItem) {return;}
        const videoId = videoItem.id;
        const videoIndex = playlist.videos.findIndex(video => video.id==videoId);
        loadVideoIndex(videoIndex, getLocalBoolean('forceLoad'), getLocalBoolean("forceSave")?videoId:null);
    });

    document.getElementById("playlist_name").textContent = playlist.title;
}
function togglePlaylistContainer() {
    if (togglePlaylistContainerButton.classList.contains("showPlaylistContainer")) {
        playlistContainer.classList.remove("hiddenPlaylistContainer");
        togglePlaylistContainerButton.classList.remove("showPlaylistContainer");
        togglePlaylistContainerButton.textContent = "Hide";
    } else {
        playlistContainer.classList.add("hiddenPlaylistContainer");
        togglePlaylistContainerButton.classList.add("showPlaylistContainer");
        togglePlaylistContainerButton.textContent = "Show Playlist";
    }
}

function savePlaylist() {
    localStorage.setItem('playlist', JSON.stringify(playlist));
    console.log("Saved Playlist!");
}

async function init() {
    const saved_playlist = JSON.parse(localStorage.getItem('playlist'));
    if (saved_playlist && saved_playlist.videos.length>0 && !getLocalBoolean('forceLoad')) {
        console.log("Loaded saved playlist!");
        playlist = saved_playlist;
    } else {
        //console.log("Saved Playlist: "+saved_playlist);
        playlist = await fetchPlaylistData(temp_playlistAddress);
        savePlaylist();
    }
    showPlaylist();
}

function checkAllInstances() {
    for (let domain of BACKEND_MIRRORS) {
        fetch(`https://${domain}/api/v1/stats`)
        .then((response) => {return response.json();})
        .then((data) => {console.log(domain,data);});
    }
}

let isSeeking = false;

async function initVideoEventListeners() {
    videoPlayer.addEventListener('play', () => {
        console.log("play");
        if (backgroundPlaybackStatus) {
            setTimeout(() => {
            backgroundPlaybackStatus = false;
            },100);
        } else {
            if (audioPlayer.paused) {
                videoPlayer.currentTime = audioPlayer.currentTime;
                audioPlayer.play().then(()=>{updateMediaSession(currentVideo)});
                audioPlayer.muted = false;
            }
        }
    });
    videoPlayer.addEventListener('pause', () => {
        console.log("pause");
        if (document.hidden) {
            backgroundPlaybackStatus = true;
        } else {
            audioPlayer.pause()
            updateMediaSession(currentVideo);
            
            audioPlayer.muted = true;
        }
    });

    videoPlayer.addEventListener('seeking', () => {
        console.log("seek");
        if (!backgroundPlaybackStatus) {
            isSeeking = true;

            audioPlayer.currentTime = videoPlayer.currentTime;
            updateMediaSession(currentVideo);
        }
    });
    videoPlayer.addEventListener('seeked', () => {
        console.log("seeked");
        if (!backgroundPlaybackStatus) {
            updateMediaSession(currentVideo);
            audioPlayer.muted = false;
            setTimeout(()=>{isSeeking=false;}, 10);
        }
    });

    audioPlayer.addEventListener('ended', () => {
        videoPlayer.pause();
        if (document.hidden) {
            unsynced = true;
        }
        track(1);
    });
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            if (unsynced) { // video did not load in background?
                if (currentVideo) {
                    await loadVideoPlayer(currentVideo);
                    audioPlayer.muted = true;

                    videoPlayer.addEventListener('loadedmetadata', function syncOnLoad() {
                        videoPlayer.currentTime = audioPlayer.currentTime;
                        if (!audioPlayer.paused) {
                            audioPlayer.muted = false;
                            playVideoPlayer();
                        }
                        videoPlayer.removeEventListener('loadedmetadata', syncOnLoad);
                    });
                }
                unsynced = false;
            } else if (!audioPlayer.paused) { // Video is loaded
                videoPlayer.currentTime = audioPlayer.currentTime;
            }
        }
    });
}

// Settings
function initBoolSettings() {
    const settings = [
        "useThumbnail",
        "forceLoad",
        "forceSave"
    ]
    for (let setting of settings) {
        $(`#s_${setting}`).prop("checked", getLocalBoolean(setting));
        $(`#s_${setting}`).change(function(){
            if ($(this).is(':checked')) {
                localStorage.setItem(`s_${setting}`, 'true');
            } else {
                localStorage.setItem(`s_${setting}`, 'false');
            }
        });
    }
}

function toggleSettingsPanel() {settingsPanel.hidden = !settingsPanel.hidden;}
// Init
initBoolSettings();
init();
initVideoEventListeners();
// Run anything else here