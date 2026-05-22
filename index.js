const playlistContainer = document.getElementById("playlistContainer");
const playlistElement = document.getElementById("playlist");
const togglePlaylistContainerButton = document.getElementById("togglePlaylistContainer");

const videoPlayer = document.getElementById("video");
const audioPlayer = new Audio();
audioPlayer.preload = "auto";

const thumbnail = document.getElementById("thumbnail");

const settingsPanel = document.getElementById("s_settingsPanel");

const INVIDIOUS_INSTANCES = [
    //"inv.nadeko.net", // Endpoint Disabled
    //"yt.chocolatemoo53.com",
    // "invidious.nerdvpn.de", // Auth required
    // "yewtu.be", // Is a frontend
    //"inv.thepixora.com",
];
const INVIDIOUS_API_INSTANCES = [
    "inv.thepixora.com"
];
/**
 * Nothing is working btw
 * https://github.com/TeamPiped/documentation/blob/main/content/docs/public-instances/index.md
 * https://github.com/TeamPiped/Piped/wiki/Instances/408b500c3e205e95a197d42b33345c1f207ba62b
 * https://awsmfoss.com/piped/
 */
const PIPED_API_INSTANCES = [
    //"pipedapi.kavin.rocks", // 526 CORS
    //"api.piped.private.coffee", // 500
    //"pipedapi.leptons.xyz", // 502 BAD GATEWAY CORS
    //"pipedapi-libre.kavin.rocks", // 502 BAD GATEWAY
    //"pipedapi.orangenet.cc", // Frontend
    "piped.syncpundit.io",
    //"nuv3d-7iaaa-aaaan-qahma-cai.ic0.app", // Frontend
];
/**
 * https://github.com/imputnet/cobalt
 */
const COBALT_INSTANCES = [

]
/**
 * https://www.whateverorigin.org/
 * https://allorigins.win/
 * https://github.com/Freeboard/thingproxy
 * https://codetabs.com/cors-proxy/cors-proxy.html
 * https://cors.lol/#getStarted
 * https://github.com/Eiledon/alloworigin
 */
const CORS_PROXIES = [
    //"corsproxy.io/?url=",
    //"proxy.corsfix.com/?", // Must signup
    // "thingproxy.freeboard.io/fetch/", // 10r/s
    "api.codetabs.com/v1/proxy?quest=", // 5r/s slow
    //"api.allorigins.win/raw?url=", // slow
    //"whateverorigin.org/get?url=", // 20r/s 500(ServerError)
    "api.cors.lol/?url=", // FileLimit20mb but works
    //"alloworigin.com/get?url=", // Failing
];
const SUCCESSFUL_PROXIES = [];
function addCors_Proxy(cors_proxy, url) {
    return `https://${cors_proxy}${encodeURIComponent(url)}`;
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
/**
 * 
 * @param {*} targetUrl 
 * @returns data or null
 */
let fetchWithCatchError;
async function fetchWithCatch(targetUrl) {
    fetchWithCatchError = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>controller.abort(),10*1000);
    try {
        const response = await fetch(targetUrl, {
            signal: controller.signal
        }).catch((error) => {
            fetchWithCatchError = error.status;
            return null;
        });
        if (response && response.ok) {
            const raw = await response.text();
            try {
                const data =JSON.parse(raw);
                if ("url" in data) {
                    return data;
                }
                console.warn("URL Not in",data);
            } catch (parseError) {
                console.warn(`URL ${targetUrl} did not return valid:`,raw);
                return null;
            }
        } else {
            fetchWithCatchError = response.status;
        }
    } catch (error) {
        console.warn("Timed out or other error");
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
    console.warn("Unknown error");
    return null;
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

    console.error("All Invidious API instances failed.");
    return null;
}
/** Get a video from a URL */
async function fetchVideo(videoId) {
    for (let domain of INVIDIOUS_API_INSTANCES) {
        const targetUrl = `https://${domain}/api/v1/videos/${videoId}`;
        console.log("Fetching "+targetUrl);
        const data = await fetchWithCatch(targetUrl);
        if (!data) {continue;}
        return data;
    }
    console.error("All Invidious API instances failed.");
    return null;
}
async function fetchPipedVideo(videoId) {
    for (let domain of PIPED_API_INSTANCES) {
        const targetUrl = `https://${domain}/streams/${videoId}`;
        console.log("Fetching",targetUrl);
        const data = await fetchWithCatch(targetUrl);
        if (!data) {continue;}
        return data;
    }
}

async function fetchProxiedVideo(videoId) {
    for (let proxy of CORS_PROXIES) {
        for (let domain of INVIDIOUS_INSTANCES) {
            const domainUrl = `https://${domain}/api/v1/videos/${videoId}`;
            console.log(`gPVD Proxy:`,proxy,"Domain",domainUrl);
            const targetUrl = addCors_Proxy(proxy, domainUrl);
            //console.log(`gPVD Fetching ${targetUrl}`);
            const data = await fetchWithCatch(targetUrl);
            if (data) {
                return data;
            } else {
                if (fetchWithCatchError==500) {
                    console.warn("Skipped Proxy with 500");
                    break;
                }
            }
        }
    }
    return null;
}
async function fetchProxiedPipedVideo(videoId) {
    for (let proxy of CORS_PROXIES) {
        for (let domain of PIPED_API_INSTANCES) {
            const domainUrl = `https://${domain}/streams/${videoId}`;
            console.log(`gPVD Proxy:`,proxy,"Domain",domainUrl);
            const targetUrl = addCors_Proxy(proxy, domainUrl);
            //console.log(`gPVD: Fetching ${targetUrl}`);
            const data = await fetchWithCatch(targetUrl);
            if (data) {
                return data;
            } else {
                if (fetchWithCatchError==500) {
                    console.warn("Skipped Proxy with 500");
                    break;
                }
            }
        }
    }
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
    let pipeline = "invidious";
    let video = await fetchVideo(videoId);
    if (!video) {
        // pipeline = "piped";
        // console.log("Trying Piped Videos...");
        // video = await fetchPipedVideo(videoId);
        if (!video) {
            pipeline = "invidious";
            console.log("Trying Proxies...");
            video = await fetchProxiedVideo(videoId);
            if (!video) {
                // pipeline = "piped";
                // console.log("Trying Proxied Piped...");
                // video = await fetchProxiedPipedVideo(videoId);
                if (!video){
                    console.error("All attempts to load Video Data failed.");
                    return null;
                }
            }
        }
    }
    console.log(`Successfully got data:`,video);
    const videoData = parseVideoData(video,pipeline,videoId);
    
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
/**
 * parses Video Data into one format.
 * https://docs.invidious.io/api/
 * https://docs.piped.video/docs/api-documentation/
 * @param {*} data unfiltered videoData
 * @param {String} pipeline "invidious" or "piped"
 * @param {String} videoId
 * @returns singular object
 */
function parseVideoData(data, pipeline="invidious", videoId) {
    if (pipeline == "invidious") {
        const videoStreams = [];
        const audioStreams = [];
        data.adaptiveFormats.forEach(stream => {
            if (stream.type.includes('video')) {
                const res = stream.resolution.split('x');
                videoStreams.push({
                    index: stream.index,
                    bitrate: stream.bitrate,
                    codec: stream.encoding,
                    format: null,
                    url: stream.url,
                    mimeType: stream.type, // video/mp4 or audio/webm
                    container: stream.container, // format: mp4, webm
                    encoding: stream.encoding, // codec, compression method
                    qualityLabel: stream.qualityLabel, // "720p"
                    resolution: stream.resolution, //1920x1080
                    width: res[0],
                    height: res[1],
                    fps: stream.fps,
                    size: stream.size, // File Size
                    duration: stream.targetDuractionSec,
                });
            } else {
                audioStreams.push({
                    index: stream.index,
                    bitrate: stream.bitrate,
                    codec: stream.encoding, // codex == encoding method
                    format: null,
                    url: stream.url,
                    mimeType: stream.type,
                    container: stream.container,
                    encoding: stream.encoding,
                    duration: stream.targetDurationSec,
                    qualityType: stream.audioQuality, // "AUDIO_QUALITY_LOW"
                    sampleRate: stream.audioSampleRate, // Samples of audio/sec
                    channels: stream.audioChannels // 2 for stereo
                });
            }
        });
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
            videoStreams: videoStreams,
            audioStreams: audioStreams,
            formatSteams: data.formatStreams,
            musicTracks: data.musicTracks,
            pipeline: pipeline,
        };
    } else if (pipeline == "piped") {
        const videoStreams = [];
        const audioStreams = [];
        data.videoStreams.forEach((stream, index) => {
            const containerType = stream.mimeType ? stream.mimeType.split('/')[1] : null;
            videoStreams.push({
                index: index, 
                bitrate: stream.bitrate,
                codec: stream.codec,
                format: stream.format,
                url: stream.url,
                mimeType: stream.mimeType, 
                container: containerType, 
                encoding: stream.codec, 
                qualityLabel: stream.quality, 
                resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : null, 
                width: stream.width,
                height: stream.height,
                fps: stream.fps,
                size: null, // Requires content-length header or file data
                duration: null, // Requires stream metadata
            });
        });
        data.audioStreams.forEach(stream => {
            audioStreams.push({
                index: stream.index,
                bitrate: stream.bitrate,
                codec: stream.encoding, // codex == encoding method
                format: null,
                url: stream.url,
                mimeType: stream.type,
                container: stream.container,
                encoding: stream.encoding,
                duration: stream.targetDuractionSec,
                qualityType: stream.audioQuality, // "AUDIO_QUALITY_LOW"
                sampleRate: stream.audioSampleRate, // Samples of audio/sec
                channels: stream.audioChannels // 2 for stereo
            });
        });
        return {
            id: videoId,
            title: data.title,
            author: data.uploader,
            description: data.description,
            published: null,
            publishedText: data.uploadDate,
            thumbnailUrl: data.thumbnailUrl,
            authorThumbnails: null,
            length: data.duration,
            videoStreams: videoStreams,
            audioStreams: audioStreams,
            formatStreams: null,
            audioStreams: data.audioStreams,
            pipeline: pipeline,
        }
    }
    return null;
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
                        window.alert("All attempts at loading has failed.");
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
    try {
        videoPlayer.pause();
        videoPlayer.hidden = getLocalBoolean('useThumbnail');
        audioPlayer.currentTime = 0;
        const audioUrl = videoData.audioStreams[3].url; // TODO: TEST TS
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
    } catch (error) {
        return false;
    }
}

async function loadVideoPlayer(videoData) {
    document.getElementById("video_name").textContent = videoData.title;
    document.getElementById("video_author").textContent = videoData.author;

    if (getLocalBoolean('useThumbnail')) {
        thumbnail.src = videoData.thumbnails[0].url;
    } else {
        const resolutions = [];
        const formats = { // +1 for webm
            r144p: 0, r240p: 2, r360p: 4, r480p: 8,
            r720p: 10, r1080p: 12
        }; // TODO: TEST TS
        const videoUrl = videoData.videoStreams[formats.r480p+1].url; // 480p
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